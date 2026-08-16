# Agent Note: 结构化 FFmpeg 视频剪辑

Status: implemented

[English](2026-08-16-structured-ffmpeg-video-editing.md) | 中文

## Problem

视频剪辑 Agent 需要把口播视频、口播文案和自然语言剪辑要求转换为带字幕及少量字幕内强调的 MP4。让模型提供 Shell 命令或原始 FFmpeg 滤镜会混合内容规划与进程权限，使路径和转义无法审查，并让格式错误的短语成为可执行滤镜语法。用户文案也没有时间戳，而 FFmpeg 能检测静音，却不能识别说出的词语。

## Decision

**视频剪辑由三个角色组成完整能力。** `dsh-video-editor` 定义与 Provider 无关的分析、渲染参数、活动进程所有权和已验证产物。`dsh-video-ffmpeg` 使用 FFprobe、FFmpeg、私有 ASS 文件和受管子进程运行时实现该服务。`dsh-tool-video` 向 Agent 的作用域工具层贡献 `video_analyze` 和 `video_render`。该能力不修改 agent-loop。

**模型只规划结构化定时文本。** 普通字幕包含开始、结束和文本。每条可选高亮包含字幕索引、准确短语和封闭的视觉类别。Consumer 验证字幕文本完整保留用户文案、每条高亮原样出现在所引用字幕中，且同一字幕的高亮不重叠。Provider 重复这些检查，再把每条高亮编译为短语原字幕位置上的 ASS 行内样式；高亮不会成为画面其他位置的独立文字事件。Provider 在编译 ASS 前转义用户文本，并使用不经过 Shell 的固定 argv。

**纯文案时间轴明确属于启发式结果。** `video_analyze` 通过 FFprobe 和 FFmpeg `silencedetect` 获得媒体信息与有声区间，在语义标点和配置的显示上限处切分文案，再按字符权重把各段分配到有声时间。结果声明 `alignmentMode: heuristic`；静音边界不声称知道词语身份。权威字幕或字级时间戳留作独立输入扩展。

**渲染只发布一个已验证工作区产物。** Consumer 通过 `ctx.fs` 解析模型路径，要求存在活跃 Agent 工作区，并拒绝工作区外路径、符号链接端点、已存在的输出文件和非 MP4 输出名。Provider 先渲染到私有临时路径，使用 FFprobe 验证结果，计算大小与 SHA-256，再通过禁止覆盖的硬链接发布。取消会终止受管进程树，`done` 包含验证和私有文件清理。

**长渲染复用通用任务运行时。** 部署启用后台工作时，`video_render` 默认创建 `video-render` 任务。进程提供消费式进度和一份终态 JSON 结果；`job_output` 和 `job_kill` 保留现有所有者授权、通知与 teardown 行为。发布的 `video-editor` preset 只贡献视频 Consumer 和任务控制器；FFmpeg Provider 仍由 Host 持有。

**Web 表单先提交媒体，再提交任务。** `dsh-client-ui-video-editor` 只在 Session 记录了 `video-editor` preset 时出现。它通过仅限回环的 `workspace.upload` 通道，把所选字节写入唯一且禁止覆盖的 workspace 文件，然后提交一条结构化用户消息，其中包含已提交路径、完整文案、剪辑要求和指定输出名。上传失败不会创建模型 Turn。既有 jobs 和 deliverables 插件继续承担进度与产物界面，表单不重复实现它们。

## Alternatives considered

**暴露现有 bash 工具并在提示词中教授 FFmpeg。** 拒绝，因为命令构造、滤镜转义、编码默认值、路径授权、生命周期清理和产物验证会变成提示词约定，而不是受执行操作强制的规则。

**实现单一整体工具包。** 拒绝，因为执行环境内的分析和渲染可以独立于模型 schema 与指引迁移到其他 Provider。独立 Service Definition 也阻止 FFmpeg 特有路径和进程细节进入工具 API。

**把静音检测描述为精确对齐。** 拒绝，因为连续长语音、文案偏差和口头填充词无法从静音区间解决。启发式标签保留真实质量边界，也允许以后组合权威时间戳。

**扩展图片 attachment 服务以支持视频输入输出。** 拒绝，因为视频流式传输、大小限制、HTTP Range、保留策略和产物授权具有不同于提示词图片的生命周期。Web 表单使用有界的完整请求上传到 workspace，并把已上传输入的保留交给 workspace 所有权管理。

## Consequences

发布的 preset 能接收浏览器所选口播视频、分析已提交到 workspace 的文件，并渲染把选定字幕词语在原位置强化显示的 MP4，而不向模型暴露 Shell 或滤镜语法。工具调用、完整定时文本计划、任务身份和结果使用现有持久工具事件；输入和输出二进制仍是 workspace 产物，会话日志不保证其存续。精确字级同步、重复短语 occurrence 选择、流式上传进度、输入自动清理和浏览器下载仍是明确的产品缺口，不会伪装成已有行为。
