// @vitest-environment jsdom
/** Structured video-edit prompt and upload carrier behavior. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildVideoEditPrompt, isOutputFilename, uploadVideo, VideoEditSubmitError,
} from '../src/client/task.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('video edit task', () => {
  it('accepts one new MP4 filename and rejects traversal or another extension', () => {
    expect(isOutputFilename('output.mp4')).toBe(true)
    expect(isOutputFilename('OUTPUT.MP4')).toBe(true)
    expect(isOutputFilename('../output.mp4')).toBe(false)
    expect(isOutputFilename('nested/output.mp4')).toBe(false)
    expect(isOutputFilename('output.mov')).toBe(false)
    expect(isOutputFilename('.')).toBe(false)
  })

  it('serializes user prose as structured input and pins the tool order', () => {
    const prompt = buildVideoEditPrompt('.dsh-video-input-id.mp4', {
      file: new File(['video'], 'talking-head.mp4', { type: 'video/mp4' }),
      script: '今天介绍新品。',
      requirements: '在“新品”处添加花字。',
      outputPath: 'result.mp4',
    })
    expect(prompt).toMatchInlineSnapshot(`
      "请使用视频工具完成下面的数字人口播视频轻剪辑任务。

      结构化输入：
      \`\`\`json
      {
        \"input_path\": \".dsh-video-input-id.mp4\",
        \"output_path\": \"result.mp4\",
        \"script\": \"今天介绍新品。\",
        \"editing_requirements\": \"在“新品”处添加花字。\"
      }
      \`\`\`

      先调用 video_analyze，再根据完整文案和剪辑要求规划字幕与字幕内关键词高亮，然后调用 video_render。字幕必须完整保留口播文案；花字必须使用 highlights 标记对应 captionIndex 中原样出现的重点词，并在该字幕原位置强化显示。花字不是画面其他位置的独立文字层。示例：字幕“别让孩子悄悄落后，”可高亮“孩子”和“落后”。保持高亮稀疏且同一字幕内不重叠。等待后台渲染任务完成后再报告输出路径。"
    `)
  })

  it('uploads raw bytes under a unique workspace filename and validates the response', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({
      path: '.dsh-video-input-00000000-0000-4000-8000-000000000001.mp4',
      bytes: 3,
    }, { status: 201 })))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File([Uint8Array.of(1, 2, 3)], 'input.mov', { type: 'video/quicktime' })
    const path = await uploadVideo('session-1', file, new AbortController().signal)
    expect(path).toBe('.dsh-video-input-00000000-0000-4000-8000-000000000001.mp4')
    const [url, init] = fetchMock.mock.calls[0]!
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    expect(href).toContain('sessionId=session-1')
    expect(href).toContain('filename=.dsh-video-input-00000000-0000-4000-8000-000000000001.mp4')
    expect(init).toMatchObject({ method: 'POST', body: file })
  })

  it('tags HTTP and malformed-success failures as upload errors', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response('too large', { status: 413 }))))
    await expect(uploadVideo('s', new File(['x'], 'x.mp4'), new AbortController().signal))
      .rejects.toEqual(new VideoEditSubmitError('upload', 'too large'))

    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ path: 1 }, { status: 201 }))))
    await expect(uploadVideo('s', new File(['x'], 'x.mp4'), new AbortController().signal))
      .rejects.toEqual(new VideoEditSubmitError('upload', 'the Host returned invalid upload metadata'))
  })
})
