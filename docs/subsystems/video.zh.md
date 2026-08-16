# 结构化视频剪辑

[English](video.md) | 中文

视频剪辑能力把与 Provider 无关的 `ctx.videoEditor` 服务、FFmpeg Provider 和模型侧工具分开。Consumer 在进入服务前授权路径。Provider 负责媒体分析、渲染默认值、进程生命周期、产物验证和禁止覆盖的发布。

源码：[`packages/video/video-editor/src/types.ts`](../../packages/video/video-editor/src/types.ts)

## 分析与定时文本

`VideoAnalysis` 包含校验和规划渲染所需的媒体元数据。`speechSpans` 是从音频推断的有声区间，不能确定词语身份。字幕是普通文本事件。高亮引用一条字幕中的准确短语，并使用封闭的类别词汇，因此调用方不能注入滤镜表达式或 ASS 标签。

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

## 渲染生命周期

调用方提交已授权路径、权威媒体元数据和定时文本。`resolve()` 校验请求并加入 Provider 自有的编码选择。`start()` 同步返回，使任务控制器能在创建执行资源前完成预检；其终态结果报告进程信息，并且仅在验证和禁止覆盖的发布完成后才包含产物。

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
