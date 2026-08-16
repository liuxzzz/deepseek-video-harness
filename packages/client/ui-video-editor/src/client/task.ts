/** Structured prompt and upload response handling for the video-editor form. */

/** Form values after local validation. */
export interface VideoEditSubmission {
  file: File
  script: string
  requirements: string
  outputPath: string
}

/** Which commit phase rejected a form submission. */
export type VideoEditSubmitPhase = 'upload' | 'prompt'

/** Phase-tagged error consumed by localized presentation. */
export class VideoEditSubmitError extends Error {
  /**
   * @param phase - failed commit phase.
   * @param message - safe browser-facing diagnostic.
   */
  constructor(readonly phase: VideoEditSubmitPhase, message: string) {
    super(message)
    this.name = 'VideoEditSubmitError'
  }
}

/**
 * Validate a workspace-root output filename.
 * @param value - user-entered output filename.
 * @returns true for one non-dot path segment ending in `.mp4`.
 */
export function isOutputFilename(value: string): boolean {
  return value !== '.' && value !== '..'
    && !value.includes('/') && !value.includes('\\')
    && value.toLocaleLowerCase().endsWith('.mp4')
}

/**
 * Build the complete user message submitted to the video-editor Agent.
 * JSON keeps user prose distinct from operational instructions without
 * interpreting punctuation in the script or requirements.
 * @param inputPath - committed workspace-relative input path.
 * @param submission - validated form fields.
 * @returns prompt text sent as one user message.
 */
export function buildVideoEditPrompt(inputPath: string, submission: VideoEditSubmission): string {
  const input = {
    input_path: inputPath,
    output_path: submission.outputPath,
    script: submission.script,
    editing_requirements: submission.requirements,
  }
  return [
    '请使用视频工具完成下面的数字人口播视频轻剪辑任务。',
    '',
    '结构化输入：',
    '```json',
    JSON.stringify(input, null, 2),
    '```',
    '',
    '先调用 video_analyze，再根据完整文案和剪辑要求规划字幕与字幕内关键词高亮，然后调用 video_render。字幕必须完整保留口播文案；花字必须使用 highlights 标记对应 captionIndex 中原样出现的重点词，并在该字幕原位置强化显示。花字不是画面其他位置的独立文字层。示例：字幕“别让孩子悄悄落后，”可高亮“孩子”和“落后”。保持高亮稀疏且同一字幕内不重叠。等待后台渲染任务完成后再报告输出路径。',
  ].join('\n')
}

/**
 * Upload one browser File into the current Session workspace.
 * @param sessionId - target Session id.
 * @param file - browser-selected media file.
 * @param signal - cancels the request when the dialog closes or unmounts.
 * @returns committed workspace-relative input path.
 */
export async function uploadVideo(sessionId: string, file: File, signal: AbortSignal): Promise<string> {
  const filename = `.dsh-video-input-${crypto.randomUUID()}.mp4`
  const query = new URLSearchParams({ sessionId, filename })
  const response = await fetch(`/api/workspace.upload?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: file,
    signal,
  })
  if (!response.ok) {
    const detail = (await response.text()).trim()
    throw new VideoEditSubmitError('upload', detail === '' ? `HTTP ${response.status}` : detail)
  }
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null
    || typeof (value as { path?: unknown }).path !== 'string'
    || typeof (value as { bytes?: unknown }).bytes !== 'number') {
    throw new VideoEditSubmitError('upload', 'the Host returned invalid upload metadata')
  }
  return (value as { path: string }).path
}
