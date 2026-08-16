import { describe, expect, it } from 'vitest'
import { parseProbeDocument, parseSpeechSpans } from '../src/probe.ts'

describe('video probe parsing', () => {
  it('normalizes metadata and computes the audible complement', () => {
    expect(parseProbeDocument(JSON.stringify({
      streams: [
        { codec_type: 'video', width: 1080, height: 1920, avg_frame_rate: '30000/1001' },
        { codec_type: 'audio' },
      ],
      format: { duration: '5.000' },
    }))).toMatchObject({ durationMs: 5000, width: 1080, height: 1920, hasAudio: true })
    expect(parseSpeechSpans([
      '[silencedetect] silence_start: 1.0',
      '[silencedetect] silence_end: 1.5 | silence_duration: 0.5',
      '[silencedetect] silence_start: 4.0',
    ].join('\n'), 5000)).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 1500, endMs: 4000 },
    ])
  })
})
