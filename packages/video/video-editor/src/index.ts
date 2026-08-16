/** Structured video editing Service Definition (`ctx.videoEditor`). @module @deepseek-ai/dsh-video-editor */

import { Context, Service } from '@deepseek-ai/cordis'
import type { VideoAnalysis, VideoRenderProcess, VideoRenderRequest, VideoRenderSpec } from './types.ts'

export type {
  VideoAnalysis,
  VideoCaptionHighlight,
  VideoCaptionCue,
  VideoDecorationKind,
  VideoRenderArtifact,
  VideoRenderOutcome,
  VideoRenderProcess,
  VideoRenderRequest,
  VideoRenderSpec,
  VideoSpeechSpan,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    videoEditor: VideoEditor
  }
}

/** Abstract provider for media inspection and one-pass caption/highlight rendering. */
export abstract class VideoEditor extends Service {
  constructor(ctx: Context) {
    if (new.target === VideoEditor) {
      throw new Error('@deepseek-ai/dsh-video-editor is abstract; load a provider such as @deepseek-ai/dsh-video-ffmpeg')
    }
    super(ctx, 'videoEditor')
  }

  /**
   * Inspect a regular video and infer audible spans without modifying it.
   * @param inputPath - absolute path in the provider's execution world.
   * @param signal - cancellation for probe and audio analysis subprocesses.
   * @returns metadata and inferred speech intervals.
   */
  abstract inspect(inputPath: string, signal?: AbortSignal): Promise<VideoAnalysis>

  /**
   * Fill provider-owned codec and quality choices and validate the complete plan.
   * @param request - paths, authoritative input metadata, and timed text events.
   * @returns an immutable execution specification.
   */
  abstract resolve(request: VideoRenderRequest): VideoRenderSpec

  /**
   * Start a render synchronously so a job registry can preflight before resources exist.
   * The returned `done` promise settles only after validation and temporary-file cleanup.
   * @param spec - fully resolved specification from {@link resolve}.
   * @param signal - optional foreground-call cancellation; published jobs omit it and own cancellation through the handle.
   * @returns the live render process.
   */
  abstract start(spec: VideoRenderSpec, signal?: AbortSignal): VideoRenderProcess
}

export default VideoEditor
