# @deepseek-ai/dsh-video-editor

English | [中文](README.zh.md)

The structured lightweight-video-editing Service Definition. `ctx.videoEditor` inspects a video, resolves timed subtitles and their inline keyword highlights into an explicit render specification, and starts a cancellable process whose completion includes output verification and resource cleanup.

Paths refer to the shared filesystem/subprocess execution world. Consumers resolve and authorize model-supplied paths before calling this service. Providers own codecs, quality defaults, timed-text compilation, process execution, and artifact verification.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-video`, which exposes analysis and rendering as structured tools.

#### KV Cache effect

No direct invalidation; the Consumer owns tool schemas and guidance.

## Known Limitations and Deferred Work

- The first contract burns timed text into MP4 and does not define cuts, transitions, overlays, or audio mixing.
- Input and output are execution-world paths, not durable media attachment references.
