# @deepseek-ai/dsh-client-ui-video-editor

[English](README.md) | 中文

面向 `video-editor` Agent Preset 的 Web 表单。本包向 `conversation.session.header.actions` 贡献“视频剪辑”操作，并且仅在当前 Session 记录了 `agentPreset: video-editor` 时渲染。弹窗收集一个浏览器所选视频、完整口播文案、剪辑要求和一个新的 `.mp4` 输出文件名。

提交时先把所选字节发送到 `POST /api/workspace.upload`，在 Session workspace 中提交一个唯一的隐藏输入文件，并且不覆盖已有路径。该提交成功后，本包通过会话作用域内的 conversation service 发送一条结构化用户消息。消息包含已提交的输入路径、指定的输出路径、完整文案和剪辑要求，并要求先执行 `video_analyze`、再执行 `video_render`，最后等待后台渲染结果。关闭弹窗或卸载组件会中止正在进行的上传；如果 Host 已经完成文件写入、但 prompt 尚未准入时取消胜出，已提交的上传文件可能保留。

表单展示上传和 prompt 准入错误，且不清空用户已选内容。准入成功后弹窗关闭并重置；现有的后台任务头部操作展示渲染进度，[`dsh-client-ui-deliverables`](../ui-deliverables/README.md)根据工具结果渲染完成文件。

## 模型体验

间接影响，来自表单提交的普通用户消息；视频工具 schema、prompt 指引和渲染结果由 [`dsh-tool-video`](../../video/tool-video/README.md)负责。

#### KV Cache effect

提交的消息会开启普通 Turn，因此扩展该 Session 的模型前缀；本包自身不增加 system prompt 或工具 schema 内容。

## 已知限制与暂缓事项

- **上传按完整请求传输** —— Web carrier 在配置的 `maxRequestBodyBytes` 限制内缓冲每个请求，不提供字节级进度。上传的输入文件会一直保留在 workspace 中，直到用户自行删除。
- **渲染仍依赖 Host 的 FFmpeg 构建** —— 表单可以在任意 Web Host 上上传和提交，但字幕渲染要求配置的 FFmpeg 提供 [`dsh-video-ffmpeg`](../../video/video-ffmpeg/README.md)所记录的 `ass` 滤镜，否则会失败。
