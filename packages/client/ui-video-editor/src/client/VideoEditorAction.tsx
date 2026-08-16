/** Session-header action and modal form for one structured video edit. */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import {
  isOutputFilename, VideoEditSubmitError, type VideoEditSubmission,
} from './task.ts'
import css from './VideoEditorAction.module.css'

/** Registration-owned form submission operation. */
export interface VideoEditorInjected {
  /** Upload the selected file and submit the resulting task prompt. */
  submit: (submission: VideoEditSubmission, signal: AbortSignal, onUploaded: () => void) => Promise<void>
}

/** Full slot props for the video-editor action. */
export type VideoEditorActionProps = PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<typeof NS> & InjectFace<VideoEditorInjected>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Render the action only for Sessions composed from the video-editor preset.
 * @param props - session standard kit, localized copy, and submission callback.
 * @returns header trigger plus controlled modal, or null for another preset.
 */
export function VideoEditorAction({ sessionId, useSessions, submit, t }: VideoEditorActionProps) {
  const preset = useSessions(state => state.byId[sessionId]?.agentPreset)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [script, setScript] = useState('')
  const [requirements, setRequirements] = useState('')
  const [outputPath, setOutputPath] = useState('output.mp4')
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)

  useEffect(() => () => { controllerRef.current?.abort() }, [])

  if (preset !== 'video-editor') return null

  const close = (): void => {
    controllerRef.current?.abort()
    controllerRef.current = null
    pendingRef.current = false
    setPhase('idle')
    setOpen(false)
  }

  const start = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (pendingRef.current) return
    const trimmedScript = script.trim()
    const trimmedRequirements = requirements.trim()
    const trimmedOutput = outputPath.trim()
    if (file === null || trimmedScript === '' || trimmedRequirements === '' || trimmedOutput === '') {
      setError(t('error.required'))
      return
    }
    if (!isOutputFilename(trimmedOutput)) {
      setError(t('error.output'))
      return
    }
    pendingRef.current = true
    setError(null)
    setPhase('uploading')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      await submit({
        file,
        script: trimmedScript,
        requirements: trimmedRequirements,
        outputPath: trimmedOutput,
      }, controller.signal, () => { setPhase('submitting') })
      if (controller.signal.aborted) return
      controllerRef.current = null
      pendingRef.current = false
      setPhase('idle')
      setFile(null)
      setScript('')
      setRequirements('')
      setOutputPath('output.mp4')
      setOpen(false)
    } catch (reason: unknown) {
      if (controller.signal.aborted) return
      controllerRef.current = null
      pendingRef.current = false
      setPhase('idle')
      const message = errorMessage(reason)
      setError(reason instanceof VideoEditSubmitError && reason.phase === 'upload'
        ? t('error.upload', { message })
        : t('error.submit', { message }))
    }
  }

  const busy = phase !== 'idle'
  return (
    <>
      <button type="button" className={css.trigger} onClick={() => { setError(null); setOpen(true) }}>
        {t('action.open')}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={t('dialog.title')}
        closeLabel={t('action.close')}
        description={t('dialog.description')}
        className={css.modal as string}
        contentClassName={css.content as string}
        footer={(
          <>
            <button type="button" className={css.secondary} onClick={close}>{t('action.cancel')}</button>
            <button type="submit" form="video-editor-form" className={css.primary} disabled={busy}>
              {busy ? (phase === 'uploading' ? t('status.uploading') : t('status.submitting')) : t('action.submit')}
            </button>
          </>
        )}
      >
        <form id="video-editor-form" className={css.form} onSubmit={(event) => { void start(event) }}>
          <label className={css.field}>
            <span className={css.label}>{t('field.video')}</span>
            <span className={css.fileRow}>
              <span className={css.fileName}>{file?.name ?? t('field.video.empty')}</span>
              <span className={css.fileButton}>{t('field.video.choose')}</span>
              <input
                className={css.fileInput}
                type="file"
                accept="video/*"
                aria-label={t('field.video')}
                disabled={busy}
                onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null) }}
              />
            </span>
          </label>
          <label className={css.field}>
            <span className={css.label}>{t('field.script')}</span>
            <textarea aria-label={t('field.script')} className={css.textarea} value={script} disabled={busy} placeholder={t('field.script.placeholder')} onChange={(event) => { setScript(event.currentTarget.value) }} />
          </label>
          <label className={css.field}>
            <span className={css.label}>{t('field.requirements')}</span>
            <textarea aria-label={t('field.requirements')} className={css.textarea} value={requirements} disabled={busy} placeholder={t('field.requirements.placeholder')} onChange={(event) => { setRequirements(event.currentTarget.value) }} />
          </label>
          <label className={css.field}>
            <span className={css.label}>{t('field.output')}</span>
            <input aria-label={t('field.output')} className={css.input} type="text" value={outputPath} disabled={busy} onChange={(event) => { setOutputPath(event.currentTarget.value) }} />
            <span className={css.hint}>{t('field.output.hint')}</span>
          </label>
          {error !== null && <div className={css.error} role="alert">{error}</div>}
        </form>
      </Modal>
    </>
  )
}
