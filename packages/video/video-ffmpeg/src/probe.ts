/** FFprobe metadata parsing and FFmpeg silence-span inference. @module @deepseek-ai/dsh-video-ffmpeg/probe */

import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type { VideoAnalysis, VideoSpeechSpan } from '@deepseek-ai/dsh-video-editor'

interface CaptureOptions {
  cwd: string
  maxBytes: number
  graceMs: number
  signal?: AbortSignal
}

interface CapturedRun {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

/**
 * Run one fixed argv and retain bounded complete output for parsing.
 * @param runtime Subprocess provider used to launch the executable.
 * @param argv Executable and arguments without shell interpolation.
 * @param options Working directory, output limit, shutdown grace, and cancellation.
 * @returns Exit status and complete bounded standard streams.
 */
export async function runCaptured(runtime: SubprocessRuntime, argv: readonly string[], options: CaptureOptions): Promise<CapturedRun> {
  const collect = { maxBytes: options.maxBytes }
  const handle = runtime.spawn({
    argv,
    cwd: options.cwd,
    stdio: { stdin: 'ignore', stdout: collect, stderr: collect },
    graceMs: options.graceMs,
    ...options.signal !== undefined ? { signal: options.signal } : {},
    env: { LC_ALL: 'C' },
  })
  const outcome = await handle.done
  const stdout = handle.collected.stdout?.readFrom(0)
  const stderr = handle.collected.stderr?.readFrom(0)
  if (stdout === undefined || stderr === undefined) throw new Error('video-ffmpeg: subprocess dropped requested collect streams')
  if (stdout.lossy || stderr.lossy) throw new Error('video-ffmpeg: probe output exceeded its configured byte limit')
  return { ...outcome, stdout: stdout.text, stderr: stderr.text }
}

interface ProbeStream {
  codec_type?: string
  width?: number
  height?: number
  avg_frame_rate?: string
  r_frame_rate?: string
  duration?: string
}

interface ProbeDocument {
  streams?: ProbeStream[]
  format?: { duration?: string }
}

function finitePositive(value: string | number | undefined): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function frameRate(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const [numerator, denominator] = value.split('/').map(Number)
  if (numerator === undefined || denominator === undefined || denominator === 0) return finitePositive(value)
  return finitePositive(numerator / denominator)
}

/**
 * Parse the bounded FFprobe JSON document into the public analysis fields.
 * @param text Complete FFprobe JSON output.
 * @returns Validated media metadata excluding speech intervals.
 */
export function parseProbeDocument(text: string): Omit<VideoAnalysis, 'speechSpans'> {
  const document = JSON.parse(text) as ProbeDocument
  const video = document.streams?.find(stream => stream.codec_type === 'video')
  if (video === undefined) throw new Error('video-ffmpeg: input contains no video stream')
  const width = finitePositive(video.width)
  const height = finitePositive(video.height)
  const durationSeconds = finitePositive(document.format?.duration) ?? finitePositive(video.duration)
  const fps = frameRate(video.avg_frame_rate) ?? frameRate(video.r_frame_rate)
  if (width === undefined || height === undefined || durationSeconds === undefined || fps === undefined) {
    throw new Error('video-ffmpeg: input is missing usable width, height, duration, or frame-rate metadata')
  }
  return {
    durationMs: Math.round(durationSeconds * 1000),
    width: Math.round(width),
    height: Math.round(height),
    frameRate: fps,
    hasAudio: document.streams?.some(stream => stream.codec_type === 'audio') ?? false,
  }
}

/**
 * Convert `silencedetect` intervals into their audible complement.
 * @param stderr Complete FFmpeg diagnostic output containing silence events.
 * @param durationMs Source video duration in milliseconds.
 * @returns Audible intervals of at least 100 milliseconds.
 */
export function parseSpeechSpans(stderr: string, durationMs: number): VideoSpeechSpan[] {
  const silences: Array<{ startMs: number; endMs: number }> = []
  let pendingStart: number | undefined
  for (const line of stderr.split(/\r?\n/u)) {
    const start = /silence_start:\s*([0-9.]+)/u.exec(line)
    if (start?.[1] !== undefined) pendingStart = Math.max(0, Math.round(Number(start[1]) * 1000))
    const end = /silence_end:\s*([0-9.]+)/u.exec(line)
    if (end?.[1] !== undefined) {
      silences.push({ startMs: pendingStart ?? 0, endMs: Math.min(durationMs, Math.round(Number(end[1]) * 1000)) })
      pendingStart = undefined
    }
  }
  if (pendingStart !== undefined) silences.push({ startMs: pendingStart, endMs: durationMs })
  const speech: VideoSpeechSpan[] = []
  let cursor = 0
  for (const silence of silences.sort((a, b) => a.startMs - b.startMs)) {
    if (silence.startMs > cursor) speech.push({ startMs: cursor, endMs: silence.startMs })
    cursor = Math.max(cursor, silence.endMs)
  }
  if (cursor < durationMs) speech.push({ startMs: cursor, endMs: durationMs })
  return speech.filter(span => span.endMs - span.startMs >= 100)
}
