/** FFprobe/FFmpeg Service Provider for structured video editing. @module @deepseek-ai/dsh-video-ffmpeg */

import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { chmod, link, mkdir, mkdtemp, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SubprocessHandle, SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import { VideoEditor } from '@deepseek-ai/dsh-video-editor'
import type {
  VideoAnalysis,
  VideoCaptionHighlight,
  VideoCaptionCue,
  VideoRenderArtifact,
  VideoRenderOutcome,
  VideoRenderProcess,
  VideoRenderRequest,
  VideoRenderSpec,
} from '@deepseek-ai/dsh-video-editor'
import { compileAss } from './ass.ts'
import { parseProbeDocument, parseSpeechSpans, runCaptured } from './probe.ts'

export { compileAss, escapeAssText } from './ass.ts'
export { parseProbeDocument, parseSpeechSpans } from './probe.ts'

/** FFmpeg provider configuration. */
export interface Config {
  /** FFmpeg executable name or absolute path. */
  ffmpegPath?: string
  /** FFprobe executable name or absolute path. */
  ffprobePath?: string
  /** H.264 constant-rate-factor value from 0 through 51. */
  crf?: number
  /** H.264 encoder speed and compression preset. */
  preset?: 'veryfast' | 'faster' | 'fast' | 'medium'
  /** Font family written into generated ASS styles. */
  fontName?: string
  /** Caption font size as a fraction of video height. */
  captionFontScale?: number
  /** Inline-highlight font size as a fraction of video height. */
  highlightFontScale?: number
  /** Caption bottom margin as a fraction of video height. */
  bottomMarginScale?: number
  /** FFmpeg silence-detection threshold in decibels. */
  silenceNoiseDb?: number
  /** Minimum silence interval reported by FFmpeg, in seconds. */
  silenceDurationSeconds?: number
  /** Maximum accepted input duration in milliseconds. */
  maxDurationMs?: number
  /** Maximum caption cues accepted by one render. */
  maxCaptions?: number
  /** Maximum inline highlights accepted by one render. */
  maxHighlights?: number
  /** Maximum retained stdout or stderr bytes per subprocess. */
  maxDiagnosticBytes?: number
  /** Maximum render duration in milliseconds. */
  maxRenderMs?: number
  /** Grace period before forcibly terminating a subprocess, in milliseconds. */
  graceMs?: number
}

type ResolvedConfig = Required<Config>

/** Runtime schema for codec, typography, analysis, retention, and lifecycle limits. */
export const Config: z<Config> = z.object({
  ffmpegPath: z.string().default('ffmpeg'),
  ffprobePath: z.string().default('ffprobe'),
  crf: z.number().default(20),
  preset: z.union(['veryfast', 'faster', 'fast', 'medium']).default('fast'),
  fontName: z.string().default('sans-serif'),
  captionFontScale: z.number().default(0.045),
  highlightFontScale: z.number().default(0.065),
  bottomMarginScale: z.number().default(0.07),
  silenceNoiseDb: z.number().default(-35),
  silenceDurationSeconds: z.number().default(0.3),
  maxDurationMs: z.number().default(30 * 60 * 1000),
  maxCaptions: z.number().default(1000),
  maxHighlights: z.number().default(300),
  maxDiagnosticBytes: z.number().default(256 * 1024),
  maxRenderMs: z.number().default(60 * 60 * 1000),
  graceMs: z.number().default(3000),
})

function positive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`video-ffmpeg: ${name} must be positive and finite`)
}

function validateConfig(config: ResolvedConfig): void {
  if (config.ffmpegPath.trim().length === 0 || config.ffprobePath.trim().length === 0 || config.fontName.trim().length === 0) {
    throw new Error('video-ffmpeg: executable paths and fontName must be non-empty')
  }
  positive('captionFontScale', config.captionFontScale)
  positive('highlightFontScale', config.highlightFontScale)
  positive('bottomMarginScale', config.bottomMarginScale)
  positive('silenceDurationSeconds', config.silenceDurationSeconds)
  positive('maxDurationMs', config.maxDurationMs)
  positive('maxCaptions', config.maxCaptions)
  positive('maxHighlights', config.maxHighlights)
  positive('maxDiagnosticBytes', config.maxDiagnosticBytes)
  positive('maxRenderMs', config.maxRenderMs)
  positive('graceMs', config.graceMs)
  if (!Number.isInteger(config.crf) || config.crf < 0 || config.crf > 51) throw new Error('video-ffmpeg: crf must be an integer from 0 through 51')
}

function validateTimedCue(cue: VideoCaptionCue, durationMs: number, label: string): void {
  if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)
    || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > durationMs) {
    throw new Error(`video-ffmpeg: ${label} has an invalid interval`)
  }
  if (cue.text.trim().length === 0) throw new Error(`video-ffmpeg: ${label} text must be non-empty`)
}

function validateHighlight(highlight: VideoCaptionHighlight, captions: readonly VideoCaptionCue[], label: string): void {
  if (!Number.isInteger(highlight.captionIndex) || highlight.captionIndex < 0 || highlight.captionIndex >= captions.length) {
    throw new Error(`video-ffmpeg: ${label} captionIndex is outside the caption list`)
  }
  if (highlight.text.trim().length === 0) throw new Error(`video-ffmpeg: ${label} text must be non-empty`)
  if (!(captions[highlight.captionIndex] as VideoCaptionCue).text.includes(highlight.text)) {
    throw new Error(`video-ffmpeg: ${label} text must occur verbatim in its caption`)
  }
}

function validateHighlightRanges(highlights: readonly VideoCaptionHighlight[], captions: readonly VideoCaptionCue[]): void {
  const occupied = new Map<number, Array<{ start: number; end: number }>>()
  for (const highlight of highlights) {
    const start = (captions[highlight.captionIndex] as VideoCaptionCue).text.indexOf(highlight.text)
    const end = start + highlight.text.length
    const ranges = occupied.get(highlight.captionIndex) ?? []
    if (ranges.some(range => start < range.end && end > range.start)) {
      throw new Error('video-ffmpeg: highlights in one caption must not overlap')
    }
    ranges.push({ start, end })
    occupied.set(highlight.captionIndex, ranges)
  }
}

function escapeFilterPath(path: string): string {
  return path.replaceAll('\\', '\\\\').replaceAll(':', '\\:').replaceAll("'", "\\'")
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function readers(handle: SubprocessHandle): { stdout: SubprocessOutputReader; stderr: SubprocessOutputReader } {
  const { stdout, stderr } = handle.collected
  if (stdout === undefined || stderr === undefined) throw new Error('video-ffmpeg: subprocess dropped requested collect streams')
  return { stdout, stderr }
}

function renderTerminalOutput(outcome: VideoRenderOutcome): string {
  if (outcome.status === 'completed' && outcome.artifact !== undefined) return JSON.stringify(outcome.artifact)
  return outcome.error ?? `${outcome.status}${outcome.signal === null ? '' : ` (${outcome.signal})`}`
}

/** Local FFmpeg editor over the shared managed subprocess runtime. */
export class FfmpegVideoEditor extends VideoEditor {
  static inject = ['subprocess']
  static Config = Config
  private readonly config: ResolvedConfig
  private assFilterAvailable: boolean | undefined

  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.config = config as ResolvedConfig
    validateConfig(this.config)
  }

  async inspect(inputPath: string, signal?: AbortSignal): Promise<VideoAnalysis> {
    const cwd = dirname(inputPath)
    if (this.assFilterAvailable === undefined) {
      const filters = await runCaptured(this.ctx.subprocess, [this.config.ffmpegPath, '-hide_banner', '-filters'], {
        cwd,
        maxBytes: this.config.maxDiagnosticBytes,
        graceMs: this.config.graceMs,
        ...signal !== undefined ? { signal } : {},
      })
      this.assFilterAvailable = filters.exitCode === 0 && /\bass\s+V->V\b/u.test(filters.stdout)
    }
    const probe = await runCaptured(this.ctx.subprocess, [
      this.config.ffprobePath,
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      inputPath,
    ], {
      cwd,
      maxBytes: this.config.maxDiagnosticBytes,
      graceMs: this.config.graceMs,
      ...signal !== undefined ? { signal } : {},
    })
    if (probe.exitCode !== 0) throw new Error(`video-ffmpeg: ffprobe failed: ${probe.stderr.trim() || `signal ${probe.signal ?? 'unknown'}`}`)
    const metadata = parseProbeDocument(probe.stdout)
    if (metadata.durationMs > this.config.maxDurationMs) {
      throw new Error(`video-ffmpeg: duration ${metadata.durationMs}ms exceeds configured maximum ${this.config.maxDurationMs}ms`)
    }
    if (!metadata.hasAudio) return { ...metadata, speechSpans: [] }
    const silence = await runCaptured(this.ctx.subprocess, [
      this.config.ffmpegPath,
      '-hide_banner', '-nostdin',
      '-protocol_whitelist', 'file,crypto',
      '-i', inputPath,
      '-vn',
      '-af', `silencedetect=n=${this.config.silenceNoiseDb}dB:d=${this.config.silenceDurationSeconds}`,
      '-f', 'null', '-',
    ], {
      cwd,
      maxBytes: this.config.maxDiagnosticBytes,
      graceMs: this.config.graceMs,
      ...signal !== undefined ? { signal } : {},
    })
    if (silence.exitCode !== 0) throw new Error(`video-ffmpeg: audio analysis failed: ${silence.stderr.trim() || `signal ${silence.signal ?? 'unknown'}`}`)
    return { ...metadata, speechSpans: parseSpeechSpans(silence.stderr, metadata.durationMs) }
  }

  resolve(request: VideoRenderRequest): VideoRenderSpec {
    if (this.assFilterAvailable !== true) {
      throw new Error('video-ffmpeg: the configured FFmpeg build does not provide the ass video filter required for timed-text rendering')
    }
    positive('request.durationMs', request.durationMs)
    positive('request.width', request.width)
    positive('request.height', request.height)
    if (request.durationMs > this.config.maxDurationMs) throw new Error('video-ffmpeg: render duration exceeds the configured maximum')
    if (request.captions.length === 0 || request.captions.length > this.config.maxCaptions) throw new Error('video-ffmpeg: caption count is outside the configured range')
    if (request.highlights.length > this.config.maxHighlights) throw new Error('video-ffmpeg: highlight count exceeds the configured maximum')
    request.captions.forEach((cue, index) => { validateTimedCue(cue, request.durationMs, `caption ${index}`) })
    request.highlights.forEach((highlight, index) => { validateHighlight(highlight, request.captions, `highlight ${index}`) })
    validateHighlightRanges(request.highlights, request.captions)
    for (let index = 1; index < request.captions.length; index += 1) {
      if ((request.captions[index - 1] as VideoCaptionCue).startMs > (request.captions[index] as VideoCaptionCue).startMs) {
        throw new Error('video-ffmpeg: captions must be sorted by startMs')
      }
    }
    return Object.freeze({
      ...request,
      captions: Object.freeze(request.captions.map(cue => Object.freeze({ ...cue }))),
      highlights: Object.freeze(request.highlights.map(highlight => Object.freeze({ ...highlight }))),
      videoCodec: 'libx264' as const,
      audioCodec: 'aac' as const,
      crf: this.config.crf,
      preset: this.config.preset,
    })
  }

  start(spec: VideoRenderSpec, signal?: AbortSignal): VideoRenderProcess {
    const controller = new AbortController()
    const combinedSignal = signal === undefined ? controller.signal : AbortSignal.any([signal, controller.signal])
    let handle: SubprocessHandle | undefined
    let stdoutOffset = 0
    let lastProgress = -1
    let terminalOutput: string | undefined
    let terminalDelivered = false
    const timeoutState = { triggered: false }

    const done = (async (): Promise<VideoRenderOutcome> => {
      const workRoot = await mkdtemp(join(tmpdir(), 'dsh-video-'))
      await chmod(workRoot, 0o700)
      const assPath = join(workRoot, 'captions.ass')
      const partialPath = join(dirname(spec.outputPath), `.${randomUUID()}.partial.mp4`)
      const timeout = setTimeout(() => {
        timeoutState.triggered = true
        controller.abort(new Error('video render timed out'))
      }, this.config.maxRenderMs)
      let timedOut = false
      const onAbort = (): void => { handle?.terminate() }
      combinedSignal.addEventListener('abort', onAbort, { once: true })
      try {
        await mkdir(dirname(spec.outputPath), { recursive: false })
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EEXIST') throw error
      }
      try {
        await writeFile(assPath, compileAss(spec, this.config), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        handle = this.ctx.subprocess.spawn({
          argv: [
            this.config.ffmpegPath,
            '-hide_banner', '-nostdin', '-n',
            '-protocol_whitelist', 'file,crypto',
            '-i', spec.inputPath,
            '-map', '0:v:0', '-map', '0:a?',
            '-vf', `ass=filename=${escapeFilterPath(assPath)},format=yuv420p`,
            '-c:v', spec.videoCodec,
            '-preset', spec.preset,
            '-crf', String(spec.crf),
            '-c:a', spec.audioCodec,
            '-movflags', '+faststart',
            '-progress', 'pipe:1', '-nostats',
            partialPath,
          ],
          cwd: dirname(spec.inputPath),
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: this.config.maxDiagnosticBytes },
            stderr: { maxBytes: this.config.maxDiagnosticBytes },
          },
          graceMs: this.config.graceMs,
          signal: combinedSignal,
          env: { LC_ALL: 'C' },
        })
        const processOutcome = await handle.done
        timedOut = timeoutState.triggered
        const stderr = readers(handle).stderr.readFrom(0)
        const aborted = isAborted(combinedSignal) && !timedOut
        if (processOutcome.exitCode !== 0 || aborted || timedOut) {
          return {
            status: aborted || timedOut ? 'killed' : 'failed',
            ...processOutcome,
            timedOut,
            aborted,
            error: stderr.text.trim()
              || (timedOut ? 'video render timed out' : aborted ? 'video render aborted' : 'ffmpeg render failed'),
          }
        }
        const verification = await this.inspect(partialPath, combinedSignal)
        const identity = await stat(partialPath)
        const digest = await sha256(partialPath)
        await link(partialPath, spec.outputPath)
        const artifact: VideoRenderArtifact = {
          outputPath: spec.outputPath,
          durationMs: verification.durationMs,
          width: verification.width,
          height: verification.height,
          bytes: identity.size,
          sha256: digest,
        }
        return { status: 'completed', ...processOutcome, timedOut: false, aborted: false, artifact }
      } catch (error) {
        timedOut = timeoutState.triggered
        const aborted = isAborted(combinedSignal)
        return {
          status: aborted ? 'killed' : 'failed',
          exitCode: null,
          signal: null,
          timedOut,
          aborted: aborted && !timedOut,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        clearTimeout(timeout)
        combinedSignal.removeEventListener('abort', onAbort)
        await unlink(assPath).catch(() => {})
        await unlink(partialPath).catch(() => {})
        await rmdir(workRoot).catch(() => {})
      }
    })().then((outcome) => {
      terminalOutput = renderTerminalOutput(outcome)
      return outcome
    })

    return {
      done,
      cancel: () => {
        if (!controller.signal.aborted) controller.abort(new Error('video render cancelled'))
        handle?.terminate()
      },
      readOutput: () => {
        const stdout = handle?.collected.stdout?.readFrom(stdoutOffset)
        if (stdout !== undefined) stdoutOffset = stdout.nextOffset
        const matches = [...(stdout?.text ?? '').matchAll(/out_time_ms=(\d+)/gu)]
        const latest = matches.at(-1)?.[1]
        const progress = latest === undefined ? undefined : Math.min(100, Number(latest) / 1000 / spec.durationMs * 100)
        const messages: string[] = []
        if (progress !== undefined && Math.floor(progress) > Math.floor(lastProgress)) {
          lastProgress = progress
          messages.push(`render progress ${progress.toFixed(1)}%`)
        }
        if (terminalOutput !== undefined && !terminalDelivered) {
          terminalDelivered = true
          messages.push(terminalOutput)
        }
        return messages.join('\n')
      },
    }
  }
}

export default FfmpegVideoEditor
