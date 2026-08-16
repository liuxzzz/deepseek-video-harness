# video/ — video editing capability

English | [中文](README.zh.md)

The video group defines structured lightweight editing, implements it with FFmpeg, and exposes model-facing analysis and render tools.

| Package | Role | ctx key |
|---|---|---|
| `video-editor/` | Provider-neutral analysis, render-plan, process, and result definitions | `ctx.videoEditor` |
| `video-ffmpeg/` | FFprobe/FFmpeg provider with bounded diagnostics, ASS compilation, progress, cancellation, and output verification | registers on `ctx.videoEditor` |
| `tool-video/` | `video_analyze` and `video_render` model tools | `ctx.tools` |

The initial contract accepts workspace file paths. Durable video upload, download, and retention are outside the image-only attachment service and remain separate work.
