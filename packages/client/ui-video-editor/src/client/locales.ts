/** Dictionary namespace owned by the video editor form. */
export const NS = 'videoEditor'

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'action.open': '视频剪辑',
  'dialog.title': '视频轻剪辑',
  'dialog.description': '上传数字人口播视频，并填写完整口播文案和剪辑要求。',
  'field.video': '口播视频',
  'field.video.choose': '选择视频',
  'field.video.empty': '尚未选择文件',
  'field.script': '完整口播文案',
  'field.script.placeholder': '粘贴视频中的完整口播文案',
  'field.requirements': '剪辑要求',
  'field.requirements.placeholder': '例如：在字幕中高亮“孩子”“落后”，不要另起独立文字层',
  'field.output': '输出文件名',
  'field.output.hint': '输出到当前工作区，必须是尚不存在的 .mp4 文件。',
  'action.cancel': '取消',
  'action.submit': '开始剪辑',
  'status.uploading': '正在上传视频…',
  'status.submitting': '正在提交剪辑任务…',
  'error.required': '请完整填写视频、口播文案、剪辑要求和输出文件名。',
  'error.output': '输出文件名必须是单个、以 .mp4 结尾的文件名。',
  'error.upload': '视频上传失败：{message}',
  'error.submit': '剪辑任务提交失败：{message}',
  'action.close': '关闭',
} as const

/** Dictionary key union. */
export type VideoEditorKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en: Record<VideoEditorKey, string> = {
  'action.open': 'Edit video',
  'dialog.title': 'Light video edit',
  'dialog.description': 'Upload a talking-head video and provide its complete script and editing requirements.',
  'field.video': 'Talking-head video',
  'field.video.choose': 'Choose video',
  'field.video.empty': 'No file selected',
  'field.script': 'Complete spoken script',
  'field.script.placeholder': 'Paste the complete script spoken in the video',
  'field.requirements': 'Editing requirements',
  'field.requirements.placeholder': 'For example: highlight “child” and “fall behind” inside the subtitle line',
  'field.output': 'Output filename',
  'field.output.hint': 'Written in the current workspace; must be a new .mp4 file.',
  'action.cancel': 'Cancel',
  'action.submit': 'Start editing',
  'status.uploading': 'Uploading video…',
  'status.submitting': 'Submitting edit task…',
  'error.required': 'Select a video and complete the script, requirements, and output filename.',
  'error.output': 'The output must be one filename ending in .mp4.',
  'error.upload': 'Video upload failed: {message}',
  'error.submit': 'Edit task submission failed: {message}',
  'action.close': 'Close',
}
