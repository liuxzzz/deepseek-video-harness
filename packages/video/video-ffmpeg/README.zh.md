# @deepseek-ai/dsh-video-ffmpeg

[English](README.md) | 中文

`ctx.videoEditor` 的本地 FFprobe/FFmpeg Provider。它读取媒体元数据，通过 `silencedetect` 推断有声区间，把已验证的字幕和行内关键词高亮编译到私有 ASS 文件，压制为 H.264/AAC MP4，解析进度，并在禁止覆盖的发布前验证完成产物。

FFmpeg 接收固定 argv 模板，不接收 Shell 命令。输入协议限制为本地文件和加密访问；子进程输出有界；取消会终止受管进程树；完成状态等待产物验证和私有文件清理。调用方 Consumer 在执行前授权路径。

配置负责可执行文件名、编码质量、排版比例、静音阈值、数量与时长限制、诊断保留、渲染超时和终止宽限。

## Model Experience

通过 `@deepseek-ai/dsh-tool-video` 间接影响模型。Provider 选择不改变工具名称。

#### KV Cache effect

没有直接影响；Consumer 负责 schema 和提示词指引。

## Known Limitations and Deferred Work

- 静音检测无法确定词语身份。除非后续 Consumer 提供权威时间戳，否则纯文案时间轴属于启发式结果。
- 行内高亮在字幕短语原位置改变颜色、描边、字重和字号，不创建独立文字位置。
- Provider 执行环境必须提供 FFmpeg 和 FFprobe。
