# @deepseek-ai/dsh-video-ffmpeg

English | [中文](README.zh.md)

The local FFprobe/FFmpeg provider for `ctx.videoEditor`. It probes metadata, infers audible intervals with `silencedetect`, compiles validated captions and inline keyword highlights into a private ASS file, burns that file into H.264/AAC MP4, parses progress, and verifies the completed artifact before no-replace publication.

FFmpeg receives fixed argv templates rather than shell commands. Input protocols are restricted to local file and crypto access; subprocess output is bounded; cancellation terminates the managed process tree; completion waits for output validation and private-file cleanup. The calling Consumer authorizes paths before execution.

Configuration owns executable names, codec quality, typography scales, silence thresholds, count and duration limits, diagnostic retention, render timeout, and termination grace.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-video`. Provider choices do not change the tool names.

#### KV Cache effect

No direct invalidation; the Consumer owns schemas and prompt guidance.

## Known Limitations and Deferred Work

- Silence detection cannot establish word identity. Script-only timing is heuristic unless a later Consumer supplies authoritative timestamps.
- Inline highlights change color, outline, weight, and size at the subtitle phrase's original position; they do not create independent text placement.
- FFmpeg and FFprobe must be available in the provider execution environment.
