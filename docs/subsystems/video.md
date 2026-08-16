# Structured Video Editing

English | [中文](video.zh.md)

The video-editing capability separates a provider-neutral `ctx.videoEditor` service from the FFmpeg provider and model-facing tools. Consumers authorize paths before entering the service. Providers own media inspection, render defaults, process lifecycle, artifact verification, and publication without replacement.

Source: [`packages/video/video-editor/src/types.ts`](../../packages/video/video-editor/src/types.ts)

## Analysis and timed text

`VideoAnalysis` contains the metadata required to validate and plan a render. `speechSpans` are audible intervals inferred from audio; they do not identify words. Captions are ordinary subtitle events. Highlights reference an exact phrase inside one caption and use a closed kind vocabulary so a caller cannot inject filter expressions or ASS tags.

```ts type-equiv
/** One audible interval inferred from the input audio track. */
interface VideoSpeechSpan {
  startMs: number
  endMs: number
}
```

```ts type-equiv
/** Metadata and speech intervals required to plan one edit. */
interface VideoAnalysis {
  durationMs: number
  width: number
  height: number
  frameRate: number
  hasAudio: boolean
  speechSpans: VideoSpeechSpan[]
}
```

```ts type-equiv
/** One ordinary subtitle event. */
interface VideoCaptionCue {
  startMs: number
  endMs: number
  text: string
}
```

```ts type-equiv
/** Content category controlling an inline highlight style. */
type VideoDecorationKind = 'number' | 'benefit' | 'warning' | 'product' | 'contrast' | 'call_to_action'
```

```ts type-equiv
/** One phrase emphasized in place inside an ordinary subtitle. */
interface VideoCaptionHighlight {
  captionIndex: number
  text: string
  kind: VideoDecorationKind
}
```

## Render lifecycle

The caller submits authorized paths, authoritative media metadata, and timed text. `resolve()` validates that request and adds provider-owned codec choices. `start()` returns synchronously so a job controller can finish preflight before execution resources exist; its terminal outcome reports process facts and includes an artifact only after verification and no-replace publication.

```ts type-equiv
/** Caller request before the provider fills execution defaults. */
interface VideoRenderRequest {
  inputPath: string
  outputPath: string
  durationMs: number
  width: number
  height: number
  captions: readonly VideoCaptionCue[]
  highlights: readonly VideoCaptionHighlight[]
}
```

```ts type-equiv
/** Fully resolved render specification accepted by a provider process. */
interface VideoRenderSpec extends VideoRenderRequest {
  videoCodec: 'libx264'
  audioCodec: 'aac'
  crf: number
  preset: 'veryfast' | 'faster' | 'fast' | 'medium'
}
```

```ts type-equiv
/** Verified MP4 metadata returned only after successful publication. */
interface VideoRenderArtifact {
  outputPath: string
  durationMs: number
  width: number
  height: number
  bytes: number
  sha256: string
}
```

```ts type-equiv
/** Independent process facts plus the verified artifact or failure diagnostic. */
interface VideoRenderOutcome {
  status: 'completed' | 'killed' | 'failed'
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  aborted: boolean
  artifact?: VideoRenderArtifact
  error?: string
}
```

```ts type-equiv
/** Live render owned by the provider until {@link done} releases its resources. */
interface VideoRenderProcess {
  readonly done: Promise<VideoRenderOutcome>
  /** Request idempotent process-tree termination. */
  cancel(): void
  /** Consume progress or the terminal result produced since the prior read. */
  readOutput(): string
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxvideoeditor--videoeditor-abstract-seam"></a>

### `ctx.videoEditor` — `VideoEditor` (abstract seam)

Abstract provider for media inspection and one-pass caption/highlight rendering.

```ts cordis-catalog
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
```

Source: [`packages/video/video-editor/src/index.ts:26`](../../packages/video/video-editor/src/index.ts)
<!-- END GENERATED cordis-surface -->
