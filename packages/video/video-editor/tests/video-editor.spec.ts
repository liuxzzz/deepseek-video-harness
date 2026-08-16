import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import VideoEditor from '@deepseek-ai/dsh-video-editor'

it('rejects mounting the abstract Service Definition without a provider', () => {
  const AbstractVideoEditor = VideoEditor as unknown as new (ctx: Context) => VideoEditor
  expect(() => new AbstractVideoEditor(new Context())).toThrow(
    '@deepseek-ai/dsh-video-editor is abstract; load a provider such as @deepseek-ai/dsh-video-ffmpeg',
  )
})
