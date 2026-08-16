// @vitest-environment jsdom
/** Video-editor action visibility, validation, submission, and cancellation. */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { VideoEditorAction, type VideoEditorActionProps } from '../src/client/VideoEditorAction.tsx'
import { VideoEditSubmitError } from '../src/client/task.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: VideoEditorActionProps['t'] = makeTranslate(zh, commonZh)

function mount(preset = 'video-editor', submit: VideoEditorActionProps['submit'] = vi.fn(() => Promise.resolve())) {
  const props = {
    sessionId: 'session-1',
    useSessions: (selector: (state: unknown) => unknown) => selector({
      byId: { 'session-1': { agentPreset: preset } },
    }),
    useWorkspaces: () => { throw new Error('unused') },
    submit,
    t,
  } as unknown as VideoEditorActionProps
  return { submit, view: render(<VideoEditorAction {...props} />) }
}

function openAndFill(): File {
  fireEvent.click(screen.getByRole('button', { name: '视频剪辑' }))
  const file = new File([Uint8Array.of(1, 2, 3)], 'digital-human.mp4', { type: 'video/mp4' })
  fireEvent.change(screen.getByLabelText('口播视频'), { target: { files: [file] } })
  fireEvent.change(screen.getByLabelText('完整口播文案'), { target: { value: '  完整文案  ' } })
  fireEvent.change(screen.getByLabelText('剪辑要求'), { target: { value: '  突出卖点  ' } })
  return file
}

describe('VideoEditorAction', () => {
  it('renders only for the video-editor preset', () => {
    const other = mount('standard')
    expect(other.view.container.firstChild).toBeNull()
    cleanup()
    mount()
    expect(screen.getByRole('button', { name: '视频剪辑' })).toBeTruthy()
  })

  it('keeps the form open for missing fields and an invalid output path', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: '视频剪辑' }))
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    expect((await screen.findByRole('alert')).textContent).toContain('请完整填写')

    openAndFill()
    fireEvent.change(screen.getByLabelText('输出文件名'), { target: { value: '../result.mp4' } })
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    expect((await screen.findByRole('alert')).textContent).toContain('必须是单个')
  })

  it('submits trimmed values once, shows both phases, then resets and closes', async () => {
    let uploaded!: () => void
    let settle!: () => void
    const submit = vi.fn<VideoEditorActionProps['submit']>((_submission, _signal, onUploaded) => new Promise((resolve) => {
      uploaded = onUploaded
      settle = resolve
    }))
    mount('video-editor', submit)
    const file = openAndFill()
    fireEvent.change(screen.getByLabelText('输出文件名'), { target: { value: ' result.mp4 ' } })
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    expect(screen.getByRole('button', { name: '正在上传视频…' })).toBeTruthy()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0]?.[0]).toEqual({
      file,
      script: '完整文案',
      requirements: '突出卖点',
      outputPath: 'result.mp4',
    })

    uploaded()
    await waitFor(() => { expect(screen.getByRole('button', { name: '正在提交剪辑任务…' })).toBeTruthy() })
    settle()
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })

    fireEvent.click(screen.getByRole('button', { name: '视频剪辑' }))
    expect(screen.getByLabelText<HTMLInputElement>('输出文件名').value).toBe('output.mp4')
    expect(screen.getByLabelText<HTMLTextAreaElement>('完整口播文案').value).toBe('')
  })

  it('preserves values and localizes upload and prompt failures', async () => {
    const uploadFailure = vi.fn<VideoEditorActionProps['submit']>(() =>
      Promise.reject(new VideoEditSubmitError('upload', 'HTTP 413')))
    mount('video-editor', uploadFailure)
    openAndFill()
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    expect((await screen.findByRole('alert')).textContent).toBe('视频上传失败：HTTP 413')
    expect(screen.getByLabelText<HTMLTextAreaElement>('完整口播文案').value).toContain('完整文案')
    cleanup()

    const promptFailure = vi.fn<VideoEditorActionProps['submit']>(() => Promise.reject(new Error('offline')))
    mount('video-editor', promptFailure)
    openAndFill()
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    expect((await screen.findByRole('alert')).textContent).toBe('剪辑任务提交失败：offline')
  })

  it('aborts an in-flight submission when cancelled or unmounted', () => {
    const signals: AbortSignal[] = []
    const submit = vi.fn<VideoEditorActionProps['submit']>((_submission, signal) => {
      signals.push(signal)
      return new Promise(() => {})
    })
    const { view } = mount('video-editor', submit)
    openAndFill()
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(signals[0]?.aborted).toBe(true)

    openAndFill()
    fireEvent.click(screen.getByRole('button', { name: '开始剪辑' }))
    view.unmount()
    expect(signals[1]?.aborted).toBe(true)
  })
})
