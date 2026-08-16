# Agent Note: Structured FFmpeg video editing

Status: implemented

English | [中文](2026-08-16-structured-ffmpeg-video-editing.zh.md)

## Problem

A video-editing agent needs to turn a talking-head video, its spoken script, and natural-language editing requirements into a rendered MP4 with subtitles and sparse emphasis inside those subtitles. Giving the model a shell command or raw FFmpeg filter would mix content planning with process authority, make paths and escaping unreviewable, and let one malformed phrase become executable filter syntax. The supplied script also carries no timestamps, while FFmpeg can detect silence but cannot identify spoken words.

## Decision

**Video editing is a complete capability with three roles.** `dsh-video-editor` defines provider-neutral analysis, render specifications, live process ownership, and verified artifacts. `dsh-video-ffmpeg` implements that service with FFprobe, FFmpeg, private ASS files, and the managed subprocess runtime. `dsh-tool-video` contributes `video_analyze` and `video_render` to an agent's scoped tool layer. No agent-loop change is involved.

**The model plans only structured timed text.** Ordinary captions carry start, end, and text. Each optional highlight carries a caption index, exact phrase, and closed visual category. The Consumer proves that caption text preserves the complete supplied script, every highlight occurs verbatim inside its referenced caption, and highlights in one caption do not overlap. The Provider repeats these checks, then compiles each highlight as an inline ASS style span at the phrase's original subtitle position. Highlights never become independent text events elsewhere in the frame. The Provider escapes user text before ASS compilation and constructs fixed argv without a shell.

**Script-only timing is explicitly heuristic.** `video_analyze` obtains metadata and audible spans from FFprobe and FFmpeg `silencedetect`, segments the script at semantic punctuation and a configured display bound, then allocates segments across audible time by character weight. The result says `alignmentMode: heuristic`; silence boundaries never claim word identity. Authoritative subtitle or word timestamps remain a separate input extension.

**Rendering publishes one verified workspace artifact.** The Consumer resolves model paths through `ctx.fs`, requires a live Agent workspace, rejects paths outside it, symbolic-link endpoints, existing output files, and non-MP4 output names. The Provider renders to a private partial path, verifies the result with FFprobe, computes size and SHA-256, and publishes with a no-replace hard link. Cancellation terminates the managed process tree, and `done` includes validation and private-file cleanup.

**Long renders reuse the generic job runtime.** `video_render` defaults to a `video-render` job when the deployment enables background work. The process exposes consuming progress and one terminal JSON result; `job_output` and `job_kill` retain the existing owner authorization, notification, and teardown behavior. The shipped `video-editor` preset contributes only the video Consumer and job controller; the FFmpeg Provider remains host-owned.

**The Web form commits media before it submits the task.** `dsh-client-ui-video-editor` appears only for a Session that records the `video-editor` preset. It sends the selected bytes through the loopback-only `workspace.upload` channel into a unique, non-overwriting workspace file, then submits one structured user message containing that committed path, the complete script, editing requirements, and the requested output name. A failed upload creates no model Turn. The existing jobs and deliverables plugins remain the progress and artifact surfaces instead of being duplicated in the form.

## Alternatives considered

**Expose the existing bash tool and teach the model FFmpeg.** Rejected because command construction, filter escaping, codec defaults, path authorization, lifecycle cleanup, and output verification would become prompt conventions instead of enforced operations.

**Implement one monolithic tool package.** Rejected because execution-world analysis and rendering can move to another Provider independently of model schemas and guidance. Keeping the Service Definition separate also prevents FFmpeg-specific paths and process details from becoming the tool API.

**Pretend silence detection is exact alignment.** Rejected because long uninterrupted speech, script drift, and filler words cannot be resolved from silence intervals. The heuristic label preserves an honest quality boundary and leaves authoritative timestamps composable later.

**Extend the image attachment service for video input and output.** Rejected because video streaming, size limits, HTTP Range delivery, retention, and artifact authorization require a different lifecycle from prompt images. The Web form uses a bounded whole-request workspace upload and leaves uploaded input retention under workspace ownership.

## Consequences

The shipped preset can accept a browser-selected talking-head video, analyze its committed workspace file, and render a captioned MP4 with selected subtitle words emphasized in place without exposing shell or filter syntax to the model. Tool calls, the complete timed-text plan, job identity, and results use the existing durable tool events; input and output binaries remain workspace artifacts whose survival is not guaranteed by the session log. Exact word synchronization, repeated-phrase occurrence selection, streaming upload progress, automatic input cleanup, and browser download remain named product gaps rather than hidden behavior.
