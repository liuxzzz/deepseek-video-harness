import { describe, expect, it } from 'vitest'
import { allocateCaptions, segmentScript } from '../src/timing.ts'

describe('heuristic caption timing', () => {
  it('splits semantic text and allocates it monotonically over audible spans', () => {
    const segments = segmentScript('第一句话。第二句很长，需要切开。', 8)
    expect(segments).toEqual(['第一句话。', '第二句很长，', '需要切开。'])
    const captions = allocateCaptions(segments, [
      { startMs: 200, endMs: 1200 },
      { startMs: 1600, endMs: 3000 },
    ], 3200)
    expect(captions.map(cue => cue.text).join('')).toBe('第一句话。第二句很长，需要切开。')
    expect(captions[0]?.startMs).toBe(200)
    expect(captions.at(-1)?.endMs).toBe(3000)
    expect(captions.every((cue, index) => index === 0 || cue.startMs >= (captions[index - 1]?.startMs ?? 0))).toBe(true)
  })
})
