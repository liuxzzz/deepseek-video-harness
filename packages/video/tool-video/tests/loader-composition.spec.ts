import { execFile, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import FfmpegVideoEditor from '@deepseek-ai/dsh-video-ffmpeg'
import * as ToolVideo from '@deepseek-ai/dsh-tool-video'

const runFile = promisify(execFile)
const ffmpegFilters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' })
const ffmpegAvailable = ffmpegFilters.status === 0 && /\bass\s+V->V\b/u.test(ffmpegFilters.stdout)
let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function makeAgent(ctx: Context, cwd: string): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('video-loader-agent')
  const session = Session.create(id, [], { version: 0, id, createdAt: 0, cwd })
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle', ctx: scope.ctx,
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-video-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-fs-local'",
    '  config:',
    `    cwd: ${JSON.stringify(root)}`,
    "- name: '@deepseek-ai/dsh-subprocess-local'",
    "- name: '@deepseek-ai/dsh-video-ffmpeg'",
    "- name: '@deepseek-ai/dsh-tool-video'",
    '  config:',
    '    enableRunInBackground: false',
    '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-fs-local', LocalFileSystem],
    ['@deepseek-ai/dsh-subprocess-local', LocalSubprocessRuntime],
    ['@deepseek-ai/dsh-video-ffmpeg', FfmpegVideoEditor],
    ['@deepseek-ai/dsh-tool-video', ToolVideo],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe.runIf(ffmpegAvailable)('tool-video real Loader composition through cordis.yml', () => {
  it('analyzes and renders a verified MP4 through the published tool pipeline', async () => {
    const ctx = await boot()
    const input = join(root as string, 'input.mp4')
    const output = join(root as string, 'output.mp4')
    await runFile('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input,
    ])
    const owner = makeAgent(ctx, root as string)
    const signal = new AbortController().signal
    const analyzed = await ctx.tools.execute({ signal, callId: CallId('analyze'), name: 'video_analyze', arguments: { input_path: 'input.mp4', script: '这是测试视频。' }, agent: owner })
    expect(analyzed.isError).toBe(false)
    if (analyzed.isError) throw new Error('analysis unexpectedly failed')
    const analysis = analyzed.value as { captions: unknown[] }
    const rendered = await ctx.tools.execute({
      signal,
      callId: CallId('render'),
      name: 'video_render',
      arguments: { input_path: 'input.mp4', output_path: 'output.mp4', script: '这是测试视频。', captions: analysis.captions, highlights: [{ captionIndex: 0, text: '测试', kind: 'benefit' }], run_in_background: false },
      agent: owner,
    })
    expect(rendered.isError, JSON.stringify(rendered.content)).toBe(false)
    if (rendered.isError) throw new Error('render unexpectedly failed')
    expect(rendered.value).toMatchObject({ kind: 'completed', outputPath: await realpath(output), width: 320, height: 240 })
    expect((rendered.value as { bytes: number }).bytes).toBeGreaterThan(0)
  }, 60_000)
})
