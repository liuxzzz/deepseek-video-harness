/** Web video-editor plugin registration. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { VideoEditorAction, type VideoEditorInjected } from './VideoEditorAction.tsx'
import { en, NS, zh, type VideoEditorKey } from './locales.ts'
import { buildVideoEditPrompt, uploadVideo } from './task.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Video-editor form copy. */
    videoEditor: VideoEditorKey
  }
}

/** Services required for slot registration, localized copy, and scoped prompt submission. */
export const inject = ['slots', 'sessions', 'locale', 'conversation']

/**
 * Register the video-editor header action.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-video-editor: dictionaries')
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'video-editor',
    order: 5,
    locale: NS,
    inject: (sessionId: SessionId): VideoEditorInjected => ({
      submit: async (submission, signal, onUploaded) => {
        const inputPath = await uploadVideo(sessionId, submission.file, signal)
        signal.throwIfAborted()
        onUploaded()
        const scoped = ctx.sessions.scope(sessionId)
        const conversation = scoped?.get('conversation')
        if (conversation === undefined) throw new Error('conversation service is unavailable for this Session')
        await conversation.send(buildVideoEditPrompt(inputPath, submission))
      },
    }),
  }, VideoEditorAction))
}
