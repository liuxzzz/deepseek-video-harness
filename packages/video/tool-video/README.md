# @deepseek-ai/dsh-tool-video

English | [中文](README.zh.md)

The model-facing Consumer of `ctx.videoEditor`:

- `video_analyze` authorizes a workspace input, probes it, infers audible spans, segments the supplied script, and returns an initial heuristic caption timeline.
- `video_render` requires captions that preserve the complete script, accepts optional inline highlights that reference an exact phrase and caption index, authorizes a new workspace MP4 path, and renders in the foreground or through `ctx.jobs`.

Each highlight must occur verbatim inside its referenced caption and may not overlap another highlight in that caption. The provider restyles those words in the subtitle event instead of rendering a separate text event elsewhere. The tool does not expose commands, codecs, filter expressions, font paths, arbitrary coordinates, or overwrite behavior to the model. Its generic call card lists the input and output locations.

## Model Experience

### Video workflow system prompt

#### What the model sees

One stable section directs the model to analyze before rendering, preserve the script exactly across caption cues, use heuristic timing as its base plan, keep subtitle-internal highlights sparse, and write only a new MP4.

##### Exact section

```markdown
Analyze a video before rendering it. Preserve the supplied script exactly across caption cues. Add sparse highlights only to important words that occur verbatim inside their referenced caption. A highlight changes those words in place on the subtitle line; it is never a separate text event elsewhere in the frame. Use the analyzed caption timing as the base plan. Rendering writes a new MP4 and never overwrites a file.
```

#### Token effect

Fixed prompt cost per request while the Consumer is mounted.

#### KV Cache effect

Prefix-stable while the section text and plugin visibility are unchanged; adding or removing the Consumer invalidates reuse from this section.

### Tool schemas

#### What the model sees

The model sees the generated [`video_analyze` and `video_render` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-video). It supplies workspace paths, the complete script, timed caption cues, and optional highlights with a caption index, exact phrase, and bounded kind; it never supplies commands, codecs, filter expressions, font paths, arbitrary coordinates, or overwrite behavior.

#### Token effect

Fixed schema cost per request; `run_in_background` is omitted when background rendering is disabled by configuration.

#### KV Cache effect

Prefix-stable while tool definitions and visibility are unchanged; configuration that changes background support may invalidate reuse from the first changed schema token.

### Tool results

#### What the model sees

`video_analyze` returns JSON media metadata, audible spans, `alignmentMode: "heuristic"`, and a complete initial caption timeline. Foreground `video_render` returns verified artifact JSON; background execution returns `started background job <id>` and the terminal output is collected through `job_output`. Validation and provider failures are retained by the standard tool pipeline as errors.

#### Token effect

Data-dependent calls and results remain in history until compaction; analysis size is bounded by script length and caption limits, while progress reads and final artifact metadata are bounded by provider and job limits.

#### KV Cache effect

Append-only; new calls and results follow the reusable request prefix and do not invalidate earlier KV-cache entries.

## Known Limitations and Deferred Work

- The initial caption timeline uses punctuation, character weighting, and audible spans; it is not word-level forced alignment.
- Paths must belong to a live Agent workspace. Video upload/download and durable media references are not included.
- Highlighting targets the first exact occurrence of a phrase in its caption; repeated identical phrases require a later occurrence selector.
