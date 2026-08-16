# @deepseek-ai/dsh-tool-video

[English](README.md) | 中文

`ctx.videoEditor` 的模型侧 Consumer：

- `video_analyze` 授权工作区输入，读取媒体信息，推断有声区间，切分用户文案并返回启发式字幕时间轴。
- `video_render` 要求字幕完整保留文案，只接受引用准确短语与字幕索引的可选行内高亮，授权新的工作区 MP4 路径，并以前台或 `ctx.jobs` 后台方式渲染。

每条花字必须原样出现在所引用字幕中，且不得与该字幕的其他花字重叠。Provider 在同一字幕事件中强化这些词语，而不是在画面其他位置渲染独立文字事件。工具不向模型暴露命令、编码器、滤镜表达式、字体路径、任意坐标或覆盖行为。通用调用卡片列出输入输出位置。

## Model Experience

### 视频工作流系统提示词

#### What the model sees

一个稳定段落要求模型先分析再渲染，在字幕事件中准确保留文案，以启发式时间轴为基础方案，仅在字幕内部使用少量关键词高亮，并只写入新的 MP4。

##### 原文

```markdown
Analyze a video before rendering it. Preserve the supplied script exactly across caption cues. Add sparse highlights only to important words that occur verbatim inside their referenced caption. A highlight changes those words in place on the subtitle line; it is never a separate text event elsewhere in the frame. Use the analyzed caption timing as the base plan. Rendering writes a new MP4 and never overwrites a file.
```

#### Token effect

Consumer 挂载期间，每次请求承担固定提示词成本。

#### KV Cache effect

段落文本和插件可见性不变时前缀稳定；增加或移除 Consumer 会从该段落开始使复用失效。

### 工具 schemas

#### What the model sees

模型会看到生成的 [`video_analyze` 和 `video_render` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-video)。模型提供工作区路径、完整文案、定时字幕事件，以及包含字幕索引、准确短语和受限类别的可选高亮；模型不能提供命令、编码器、滤镜表达式、字体路径、任意坐标或覆盖行为。

#### Token effect

每次请求承担固定 schema 成本；配置禁用后台渲染时会移除 `run_in_background`。

#### KV Cache effect

工具定义和可见性不变时前缀稳定；改变后台支持的配置可能会从首个变化的 schema token 开始使复用失效。

### 工具结果

#### What the model sees

`video_analyze` 返回 JSON 媒体元数据、有声区间、`alignmentMode: "heuristic"` 和完整初始字幕时间轴。前台 `video_render` 返回已验证的产物 JSON；后台执行返回 `started background job <id>`，最终输出通过 `job_output` 收集。标准工具管线会把校验与 Provider 失败保留为错误。

#### Token effect

数据相关的调用与结果会保留到压缩发生；分析大小受文案长度和字幕数量限制，进度读取和最终产物元数据受 Provider 与任务限制。

#### KV Cache effect

仅追加；新调用与结果位于可复用请求前缀之后，不会使更早的 KV-cache 条目失效。

## Known Limitations and Deferred Work

- 首版字幕时间轴使用标点、字符权重和有声区间，不是字级强制对齐。
- 路径必须属于活跃 Agent 工作区。本包不包含视频上传下载或持久媒体引用。
- 高亮使用所引用字幕中第一次准确匹配的短语；重复的相同短语需要后续增加 occurrence 选择能力。
