/** Deterministic script segmentation and audible-span allocation. @module @deepseek-ai/dsh-tool-video/timing */

import type { VideoCaptionCue, VideoSpeechSpan } from '@deepseek-ai/dsh-video-editor'

function splitLongSegment(text: string, maxChars: number): string[] {
  if (Array.from(text).length <= maxChars) return [text]
  const clauses = text.split(/(?<=[，,、：:])/u).filter(Boolean)
  if (clauses.length > 1) return clauses.flatMap(clause => splitLongSegment(clause, maxChars))
  const characters = Array.from(text)
  const parts: string[] = []
  for (let offset = 0; offset < characters.length; offset += maxChars) parts.push(characters.slice(offset, offset + maxChars).join(''))
  return parts
}

/**
 * Split a supplied script at semantic punctuation and a configured display bound.
 * @param script Full spoken script to segment.
 * @param maxChars Maximum Unicode code points per returned segment.
 * @returns Non-empty script segments in source order.
 */
export function segmentScript(script: string, maxChars: number): string[] {
  return script
    .split(/(?<=[。！？!?；;])|\r?\n+/u)
    .map(part => part.trim())
    .filter(Boolean)
    .flatMap(part => splitLongSegment(part, maxChars))
}

function speechPosition(spans: readonly VideoSpeechSpan[], offsetMs: number): number {
  let remaining = offsetMs
  for (const span of spans) {
    const duration = span.endMs - span.startMs
    if (remaining <= duration) return span.startMs + remaining
    remaining -= duration
  }
  return spans.at(-1)?.endMs ?? 0
}

/**
 * Allocate semantic segments monotonically across audible time, weighted by character count.
 * @param segments Script segments in spoken order.
 * @param speechSpans Audible intervals inferred from the source video.
 * @param durationMs Source video duration in milliseconds.
 * @returns Caption cues covering every segment in order.
 */
export function allocateCaptions(
  segments: readonly string[],
  speechSpans: readonly VideoSpeechSpan[],
  durationMs: number,
): VideoCaptionCue[] {
  if (segments.length === 0) return []
  const spans = speechSpans.length > 0 ? speechSpans : [{ startMs: 0, endMs: durationMs }]
  const totalSpeech = spans.reduce((sum, span) => sum + span.endMs - span.startMs, 0)
  const weights = segments.map(text => Math.max(1, Array.from(text.replace(/\s/gu, '')).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let consumedWeight = 0
  return segments.map((text, index) => {
    const startOffset = totalSpeech * consumedWeight / totalWeight
    consumedWeight += weights[index] as number
    const endOffset = index === segments.length - 1 ? totalSpeech : totalSpeech * consumedWeight / totalWeight
    return {
      startMs: Math.max(0, Math.round(speechPosition(spans, startOffset))),
      endMs: Math.min(durationMs, Math.max(1, Math.round(speechPosition(spans, endOffset)))),
      text,
    }
  })
}
