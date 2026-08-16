# @deepseek-ai/dsh-video-editor

[English](README.md) | 中文

结构化视频轻剪辑 Service Definition。`ctx.videoEditor` 分析视频，把带时间的字幕及其行内关键词高亮解析为显式渲染参数，并启动可取消进程；进程完成结果包含产物验证和资源清理。

路径属于文件系统与子进程共享的执行环境。Consumer 在调用服务前解析并授权模型提供的路径。Provider 负责编码、质量默认值、定时文本编译、进程执行和产物验证。

## Model Experience

通过 `@deepseek-ai/dsh-tool-video` 间接影响模型；该 Consumer 以结构化工具提供分析和渲染。

#### KV Cache effect

没有直接影响；Consumer 负责工具 schema 和指引。

## Known Limitations and Deferred Work

- 首版约定仅把定时文本压制到 MP4，不定义裁切、转场、叠图或混音。
- 输入输出是执行环境路径，不是持久媒体附件引用。
