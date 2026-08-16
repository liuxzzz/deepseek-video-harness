/** Model-facing analysis and render Consumer over `ctx.videoEditor`. @module @deepseek-ai/dsh-tool-video */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-jobs'
import type {
  VideoCaptionHighlight,
  VideoCaptionCue,
  VideoDecorationKind,
  VideoRenderOutcome,
} from '@deepseek-ai/dsh-video-editor'
import { allocateCaptions, segmentScript } from './timing.ts'

export { allocateCaptions, segmentScript } from './timing.ts'

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    videoRender: 'video-render'
  }
}

export const name = 'tool-video'
export const inject = ['tools', 'fs', 'systemPrompt', 'videoEditor']

/** Tool-level script and timing bounds. */
export interface Config {
  /** Maximum Unicode code points accepted in the supplied script. */
  maxScriptChars?: number
  /** Maximum Unicode code points assigned to one heuristic caption. */
  maxCaptionChars?: number
  /** Timeout for FFprobe and silence analysis in milliseconds. */
  analyzeTimeoutMs?: number
  /** Timeout for validating and starting a render in milliseconds. */
  renderStartTimeoutMs?: number
  /** Whether callers may submit renders to the generic background job controller. */
  enableRunInBackground?: boolean
}

type ResolvedConfig = Required<Config>

export const Config: z<Config> = z.object({
  maxScriptChars: z.number().default(20_000),
  maxCaptionChars: z.number().default(16),
  analyzeTimeoutMs: z.number().default(120_000),
  renderStartTimeoutMs: z.number().default(120_000),
  enableRunInBackground: z.boolean().default(true),
})

interface RenderArgs {
  input_path: string
  output_path: string
  script: string
  captions: VideoCaptionCue[]
  highlights?: Array<{
    captionIndex: number
    text: string
    kind: VideoDecorationKind
  }>
  run_in_background?: boolean
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`tool-video: ${name} must be a positive integer`)
}

function validateScript(script: string, maxChars: number): void {
  if (script.trim().length === 0) throw new Error('tool-video: script must be non-empty')
  if (Array.from(script).length > maxChars) throw new Error(`tool-video: script exceeds ${maxChars} characters`)
}

function semanticText(value: string): string {
  return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLocaleLowerCase()
}

function validatePlan(args: RenderArgs): VideoCaptionHighlight[] {
  validateScript(args.script, Number.MAX_SAFE_INTEGER)
  if (semanticText(args.captions.map(cue => cue.text).join('')) !== semanticText(args.script)) {
    throw new Error('tool-video: captions must preserve the complete supplied script in order')
  }
  const highlights = args.highlights ?? []
  const occupied = new Map<number, Array<{ start: number; end: number }>>()
  for (const highlight of highlights) {
    if (!Number.isInteger(highlight.captionIndex) || highlight.captionIndex < 0 || highlight.captionIndex >= args.captions.length) {
      throw new Error('tool-video: every highlight must reference an existing captionIndex')
    }
    const caption = args.captions[highlight.captionIndex] as VideoCaptionCue
    const start = caption.text.indexOf(highlight.text)
    if (highlight.text.trim().length === 0 || start < 0) {
      throw new Error('tool-video: every highlight must quote text verbatim from its referenced caption')
    }
    const ranges = occupied.get(highlight.captionIndex) ?? []
    const end = start + highlight.text.length
    if (ranges.some(range => start < range.end && end > range.start)) {
      throw new Error('tool-video: highlights in one caption must not overlap')
    }
    ranges.push({ start, end })
    occupied.set(highlight.captionIndex, ranges)
  }
  return highlights
}

async function workspaceTarget(ctx: Context, exec: ToolExecution): Promise<FsTarget> {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined) throw new Error('tool-video: an owning Agent workspace is required')
  return ctx.fs.resolve(cwd, { signal: exec.signal })
}

async function authorizedFile(ctx: Context, exec: ToolExecution, path: string, purpose: 'input' | 'output'): Promise<FsTarget> {
  const root = await workspaceTarget(ctx, exec)
  const cwd = exec.agent?.session.header.cwd as string
  const pathInfo = await ctx.fs.lstat(path, { cwd }, exec.signal)
  if (pathInfo?.type === 'symlink') throw new Error(`tool-video: ${purpose} path must not be a symbolic link`)
  const target = await ctx.fs.resolve(path, { cwd, signal: exec.signal })
  if (!ctx.fs.contains(root, target)) throw new Error(`tool-video: ${purpose} path must stay inside the session workspace`)
  const info = await ctx.fs.stat(target, exec.signal)
  if (purpose === 'input' && info?.type !== 'file') throw new Error('tool-video: input path must name an existing regular file')
  if (purpose === 'output' && info !== undefined) throw new Error('tool-video: output path already exists')
  return target
}

function completedValue(outcome: VideoRenderOutcome) {
  if (outcome.status !== 'completed' || outcome.artifact === undefined) throw new Error(outcome.error ?? `video render ${outcome.status}`)
  return {
    kind: 'completed' as const,
    ...outcome.artifact,
  }
}

const CAPTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    startMs: { type: 'number', required: true },
    endMs: { type: 'number', required: true },
    text: { type: 'string', required: true },
  },
} as const

const HIGHLIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    captionIndex: { type: 'number', required: true },
    text: { type: 'string', required: true },
    kind: { type: 'string', required: true, enum: ['number', 'benefit', 'warning', 'product', 'contrast', 'call_to_action'] },
  },
} as const

const ARTIFACT_PROPERTIES = {
  outputPath: { type: 'string', required: true },
  durationMs: { type: 'number', required: true },
  width: { type: 'number', required: true },
  height: { type: 'number', required: true },
  bytes: { type: 'number', required: true },
  sha256: { type: 'string', required: true },
} as const

/** Register video analysis/render tools and their cross-call workflow guidance. */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  assertPositiveInteger('maxScriptChars', resolved.maxScriptChars)
  assertPositiveInteger('maxCaptionChars', resolved.maxCaptionChars)
  assertPositiveInteger('analyzeTimeoutMs', resolved.analyzeTimeoutMs)
  assertPositiveInteger('renderStartTimeoutMs', resolved.renderStartTimeoutMs)

  ctx.systemPrompt.section({
    name: 'tool:video',
    order: 106,
    text: 'Analyze a video before rendering it. Preserve the supplied script exactly across caption cues. Add sparse highlights only to important words that occur verbatim inside their referenced caption. A highlight changes those words in place on the subtitle line; it is never a separate text event elsewhere in the frame. Use the analyzed caption timing as the base plan. Rendering writes a new MP4 and never overwrites a file.',
  })

  ctx.tools.register(defineTool({
    name: 'video_analyze',
    description: 'Inspect a workspace video, detect audible spans, and create an initial caption timeline from the supplied script. Timing is heuristic because silence detection does not identify spoken words.',
    parameters: {
      input_path: { type: 'string', required: true, description: 'Video path inside the current session workspace.' },
      script: { type: 'string', required: true, description: 'Complete spoken script matching the video audio.' },
    },
    timeoutMs: resolved.analyzeTimeoutMs,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          durationMs: { type: 'number', required: true },
          width: { type: 'number', required: true },
          height: { type: 'number', required: true },
          frameRate: { type: 'number', required: true },
          hasAudio: { type: 'boolean', required: true },
          alignmentMode: { type: 'string', required: true, const: 'heuristic' },
          speechSpans: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { startMs: { type: 'number', required: true }, endMs: { type: 'number', required: true } } } },
          captions: { type: 'array', required: true, items: CAPTION_SCHEMA },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      validateScript(args.script, resolved.maxScriptChars)
      const input = await authorizedFile(ctx, exec, args.input_path, 'input')
      const analysis = await ctx.videoEditor.inspect(ctx.fs.processPath(input), exec.signal)
      const captions = allocateCaptions(segmentScript(args.script, resolved.maxCaptionChars), analysis.speechSpans, analysis.durationMs)
      return { ...analysis, alignmentMode: 'heuristic' as const, captions }
    },
    presentCall: args => ({ card: 'generic', title: 'Analyze video', kind: 'read', locations: [{ path: args.input_path }] }),
  }))

  ctx.tools.register(defineTool({
    name: 'video_render',
    description: 'Burn a validated caption plan with inline keyword highlights into a new MP4. Use captions returned by video_analyze, keep their complete script text, and reference each highlighted phrase by captionIndex. Highlights restyle words in the subtitle rather than creating separate text elsewhere. Background rendering returns a job id; collect it with job_output.',
    parameters: {
      input_path: { type: 'string', required: true, description: 'Analyzed video path inside the current session workspace.' },
      output_path: { type: 'string', required: true, description: 'New .mp4 path inside the workspace. The tool never overwrites an existing path.' },
      script: { type: 'string', required: true, description: 'The same complete script passed to video_analyze.' },
      captions: { type: 'array', required: true, items: CAPTION_SCHEMA, description: 'Complete ordered caption timeline, normally copied from video_analyze.' },
      highlights: { type: 'array', items: HIGHLIGHT_SCHEMA, description: 'Optional subtitle-internal highlights. Each item names a captionIndex and an exact non-overlapping phrase inside that caption.' },
      ...resolved.enableRunInBackground ? { run_in_background: { type: 'boolean' as const, description: 'Defaults to true. Return a job id immediately and use job_output to monitor and collect the render.' } } : {},
    },
    timeoutMs: resolved.renderStartTimeoutMs,
    output: {
      schema: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'background' }, jobId: { type: 'string', required: true } } },
          { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'completed' }, ...ARTIFACT_PROPERTIES } },
        ],
      },
      render: (_args, value) => [{ type: 'text', text: value.kind === 'background' ? `started background job ${value.jobId}` : JSON.stringify(value) }],
    },
    async execute(args: RenderArgs, exec) {
      validateScript(args.script, resolved.maxScriptChars)
      if (!args.output_path.toLocaleLowerCase().endsWith('.mp4')) throw new Error('tool-video: output_path must end with .mp4')
      const highlights = validatePlan(args)
      const input = await authorizedFile(ctx, exec, args.input_path, 'input')
      const output = await authorizedFile(ctx, exec, args.output_path, 'output')
      const inputPath = ctx.fs.processPath(input)
      const outputPath = ctx.fs.processPath(output)
      const analysis = await ctx.videoEditor.inspect(inputPath, exec.signal)
      const spec = ctx.videoEditor.resolve({
        inputPath,
        outputPath,
        durationMs: analysis.durationMs,
        width: analysis.width,
        height: analysis.height,
        captions: args.captions,
        highlights,
      })
      const background = resolved.enableRunInBackground && args.run_in_background !== false
      if (background) {
        const jobs = ctx.get('jobs')
        if (jobs === undefined) throw new Error('tool-video: background jobs require @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs')
        const id = jobs.start({
          kind: 'video-render',
          label: `Render ${args.output_path}`,
          ...exec.agent !== undefined ? { owner: exec.agent } : {},
          run: () => {
            const process = ctx.videoEditor.start(spec)
            return {
              cancel: () => { process.cancel() },
              done: process.done.then((outcome) => {
                const detail = outcome.status === 'completed' ? `output: ${outcome.artifact?.outputPath ?? outputPath}` : outcome.error
                return { status: outcome.status, ...detail !== undefined ? { detail } : {} }
              }),
              readOutput: () => process.readOutput(),
            }
          },
        })
        return { kind: 'background' as const, jobId: id }
      }
      return completedValue(await ctx.videoEditor.start(spec, exec.signal).done)
    },
    presentCall: args => ({ card: 'generic', title: 'Render captioned video', kind: 'execute', locations: [{ path: args.input_path }, { path: args.output_path }] }),
  }))
}
