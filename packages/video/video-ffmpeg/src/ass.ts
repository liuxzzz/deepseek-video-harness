/** Safe ASS compilation for subtitles with bounded inline highlights. @module @deepseek-ai/dsh-video-ffmpeg/ass */

import type { VideoCaptionHighlight, VideoRenderSpec } from '@deepseek-ai/dsh-video-editor'

/** ASS style inputs resolved from provider configuration. */
export interface AssStyleConfig {
  fontName: string
  captionFontScale: number
  highlightFontScale: number
  bottomMarginScale: number
}

/**
 * Escape user text so it cannot introduce ASS override tags.
 * @param value Untrusted caption or highlight text.
 * @returns ASS-safe visible text.
 */
export function escapeAssText(value: string): string {
  return value
    .replaceAll('\\', '＼')
    .replaceAll('{', '｛')
    .replaceAll('}', '｝')
    .replaceAll('\r', '')
    .replaceAll('\n', '\\N')
}

function assTime(ms: number): string {
  const centiseconds = Math.round(ms / 10)
  const hours = Math.floor(centiseconds / 360_000)
  const minutes = Math.floor(centiseconds % 360_000 / 6_000)
  const seconds = Math.floor(centiseconds % 6_000 / 100)
  const fraction = centiseconds % 100
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${fraction.toString().padStart(2, '0')}`
}

function highlightTag(kind: VideoCaptionHighlight['kind'], fontSize: number): string {
  switch (kind) {
    case 'warning': return `\\b1\\fs${fontSize}\\c&H003B3BFF&\\3c&H00FFFFFF&\\bord4`
    case 'benefit': return `\\b1\\fs${fontSize}\\c&H005EEA73&\\3c&H00101010&\\bord4`
    case 'call_to_action': return `\\b1\\fs${fontSize}\\c&H00FFFFFF&\\3c&H00E66A28&\\bord5`
    case 'number':
    case 'product':
    case 'contrast': return `\\b1\\fs${fontSize}\\c&H0000D7FF&\\3c&H00202020&\\bord4`
  }
}

function highlightedCaption(text: string, highlights: readonly VideoCaptionHighlight[], fontSize: number): string {
  const ranges = highlights.map((highlight) => {
    const start = text.indexOf(highlight.text)
    if (start < 0) throw new Error('video-ffmpeg: highlight text must occur verbatim in its caption')
    return { start, end: start + highlight.text.length, highlight }
  }).sort((left, right) => left.start - right.start)
  let offset = 0
  let result = ''
  for (const range of ranges) {
    if (range.start < offset) throw new Error('video-ffmpeg: highlights in one caption must not overlap')
    result += escapeAssText(text.slice(offset, range.start))
    result += `{${highlightTag(range.highlight.kind, fontSize)}}${escapeAssText(range.highlight.text)}{\\rCaption}`
    offset = range.end
  }
  return result + escapeAssText(text.slice(offset))
}

/**
 * Compile one validated render specification into an ASS document.
 * @param spec Validated media metadata and timed-text cues.
 * @param config Resolved ASS typography settings.
 * @returns Complete ASS subtitle document.
 */
export function compileAss(spec: VideoRenderSpec, config: AssStyleConfig): string {
  const captionSize = Math.max(18, Math.round(spec.height * config.captionFontScale))
  const highlightSize = Math.max(captionSize, Math.round(spec.height * config.highlightFontScale))
  const bottomMargin = Math.max(20, Math.round(spec.height * config.bottomMarginScale))
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${spec.width}
PlayResY: ${spec.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,${config.fontName},${captionSize},&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,${bottomMargin},1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`
  const captions = spec.captions.map((cue, captionIndex) => {
    const highlights = spec.highlights.filter(highlight => highlight.captionIndex === captionIndex)
    const text = highlightedCaption(cue.text, highlights, highlightSize)
    return `Dialogue: 0,${assTime(cue.startMs)},${assTime(cue.endMs)},Caption,,0,0,0,,${text}`
  })
  return `${header}\n${captions.join('\n')}\n`
}
