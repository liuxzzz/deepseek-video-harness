# video/ — 视频剪辑能力

[English](README.md) | 中文

video 组定义结构化轻剪辑能力，使用 FFmpeg 实现，并提供模型侧的视频分析与渲染工具。

| 包 | 角色 | ctx key |
|---|---|---|
| `video-editor/` | 与 Provider 无关的分析、渲染计划、进程和结果定义 | `ctx.videoEditor` |
| `video-ffmpeg/` | FFprobe/FFmpeg Provider，负责有界诊断、ASS 编译、进度、取消和输出验证 | 注册到 `ctx.videoEditor` |
| `tool-video/` | 模型侧 `video_analyze` 和 `video_render` 工具 | `ctx.tools` |

首版约定接收工作区文件路径。持久视频上传、下载和保留不属于仅支持图片的 attachment 服务，留作独立工作。
