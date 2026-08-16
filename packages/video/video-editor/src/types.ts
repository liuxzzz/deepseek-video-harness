/** Provider-neutral values for structured lightweight video editing. @module @deepseek-ai/dsh-video-editor/types */

/** One audible interval inferred from the input audio track. */
export interface VideoSpeechSpan {
  startMs: number
  endMs: number
}

/** Metadata and speech intervals required to plan one edit. */
export interface VideoAnalysis {
  durationMs: number
  width: number
  height: number
  frameRate: number
  hasAudio: boolean
  speechSpans: VideoSpeechSpan[]
}

/** One ordinary subtitle event. */
export interface VideoCaptionCue {
  startMs: number
  endMs: number
  text: string
}

/** Content category controlling an inline highlight style. */
export type VideoDecorationKind = 'number' | 'benefit' | 'warning' | 'product' | 'contrast' | 'call_to_action'

/** One phrase emphasized in place inside an ordinary subtitle. */
export interface VideoCaptionHighlight {
  captionIndex: number
  text: string
  kind: VideoDecorationKind
}

/** Caller request before the provider fills execution defaults. */
export interface VideoRenderRequest {
  inputPath: string
  outputPath: string
  durationMs: number
  width: number
  height: number
  captions: readonly VideoCaptionCue[]
  highlights: readonly VideoCaptionHighlight[]
}

/** Fully resolved render specification accepted by a provider process. */
export interface VideoRenderSpec extends VideoRenderRequest {
  videoCodec: 'libx264'
  audioCodec: 'aac'
  crf: number
  preset: 'veryfast' | 'faster' | 'fast' | 'medium'
}

/** Verified MP4 metadata returned only after successful publication. */
export interface VideoRenderArtifact {
  outputPath: string
  durationMs: number
  width: number
  height: number
  bytes: number
  sha256: string
}

/** Independent process facts plus the verified artifact or failure diagnostic. */
export interface VideoRenderOutcome {
  status: 'completed' | 'killed' | 'failed'
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  aborted: boolean
  artifact?: VideoRenderArtifact
  error?: string
}

/** Live render owned by the provider until {@link done} releases its resources. */
export interface VideoRenderProcess {
  readonly done: Promise<VideoRenderOutcome>
  /** Request idempotent process-tree termination. */
  cancel(): void
  /** Consume progress or the terminal result produced since the prior read. */
  readOutput(): string
}
