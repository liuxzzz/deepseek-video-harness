import { describe, expect, it } from 'vitest'
import type { VideoRenderSpec } from '@deepseek-ai/dsh-video-editor'
import { compileAss, escapeAssText } from '../src/ass.ts'

const spec: VideoRenderSpec = {
  inputPath: '/tmp/input.mp4',
  outputPath: '/tmp/output.mp4',
  durationMs: 2000,
  width: 1080,
  height: 1920,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  crf: 20,
  preset: 'fast',
  captions: [{ startMs: 0, endMs: 1000, text: '别让孩子悄悄落后，{测试}\\tag' }],
  highlights: [
    { captionIndex: 0, text: '孩子', kind: 'benefit' },
    { captionIndex: 0, text: '落后', kind: 'warning' },
  ],
}

describe('ASS compilation', () => {
  it('escapes user override syntax and highlights phrases inside one subtitle event', () => {
    expect(escapeAssText('{x}\\y')).toBe('｛x｝＼y')
    const ass = compileAss(spec, { fontName: 'sans-serif', captionFontScale: 0.045, highlightFontScale: 0.065, bottomMarginScale: 0.07 })
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:01.00,Caption')
    expect(ass).toContain('别让{\\b1\\fs125\\c&H005EEA73&')
    expect(ass).toContain('孩子{\\rCaption}悄悄{\\b1\\fs125\\c&H003B3BFF&')
    expect(ass).toContain('落后{\\rCaption}，｛测试｝＼tag')
    expect(ass.match(/Dialogue:/gu)).toHaveLength(1)
    expect(ass).not.toContain('别让孩子悄悄落后，{测试}')
  })
})
