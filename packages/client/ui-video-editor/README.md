# @deepseek-ai/dsh-client-ui-video-editor

English | [中文](README.zh.md)

Web form for the `video-editor` Agent Preset. The package contributes a “Video editing” action to `conversation.session.header.actions` and renders it only when the current Session records `agentPreset: video-editor`. The modal collects one browser-selected video, the complete spoken script, editing requirements, and a new `.mp4` output filename.

Submitting first sends the selected bytes to `POST /api/workspace.upload`, which commits a unique hidden input file in the Session workspace without overwriting an existing path. After that commit succeeds, the package sends one structured user message through the scoped conversation service. The message names the committed input path, requested output path, complete script, and editing requirements, then requires `video_analyze` before `video_render` and waits for the background render result. Closing or unmounting the dialog aborts the active upload; a committed upload can remain if cancellation wins after the Host write but before prompt admission.

The form shows upload and prompt-admission failures without clearing the selected values. Successful admission closes and resets the form; the existing jobs header action reports render progress, and [`dsh-client-ui-deliverables`](../ui-deliverables/README.md) renders the completed file from the tool result.

## Model Experience

Indirectly, through the ordinary user message the form submits; [`dsh-tool-video`](../../video/tool-video/README.md) owns the video tool schemas, prompt guidance, and rendered results.

#### KV Cache effect

The submitted message opens an ordinary Turn and therefore extends that Session's model prefix; the package adds no system-prompt or tool-schema content of its own.

## Known Limitations and Deferred Work

- **Uploads are whole-request transfers** — the Web carrier buffers each request under its configured `maxRequestBodyBytes` limit and exposes no byte-level progress. Uploaded input files remain in the workspace until the user removes them.
- **Rendering still depends on the Host FFmpeg build** — the form can upload and submit on any Web Host, but subtitle rendering fails unless the configured FFmpeg provides the `ass` filter documented by [`dsh-video-ffmpeg`](../../video/video-ffmpeg/README.md).
