/** Host workspace-file upload commit and refusal behavior. */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function harness() {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-workspace-upload-'))
  dirs.push(cwd)
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  const session = ctx.sessions.create(undefined, { meta: { cwd } })
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
    cwd,
  })
  return { api, cwd, session }
}

describe('workspace file upload', () => {
  it('creates one owner-only workspace file and returns relative metadata', async () => {
    const { api, cwd, session } = await harness()
    const response = await api.uploads.workspaceFile(
      { sessionId: session.id, filename: '.dsh-video-input-test.mp4' },
      Uint8Array.from([1, 2, 3]),
      new AbortController().signal,
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ path: '.dsh-video-input-test.mp4', bytes: 3 })
    expect([...await readFile(join(cwd, '.dsh-video-input-test.mp4'))]).toEqual([1, 2, 3])
  })

  it('refuses empty bodies, unknown Sessions, and existing targets', async () => {
    const { api, cwd, session } = await harness()
    expect((await api.uploads.workspaceFile(
      { sessionId: session.id, filename: 'empty.mp4' },
      new Uint8Array(),
      new AbortController().signal,
    )).status).toBe(400)
    expect((await api.uploads.workspaceFile(
      { sessionId: SessionId('missing'), filename: 'missing.mp4' },
      Uint8Array.of(1),
      new AbortController().signal,
    )).status).toBe(404)
    await writeFile(join(cwd, 'existing.mp4'), 'original')
    expect((await api.uploads.workspaceFile(
      { sessionId: session.id, filename: 'existing.mp4' },
      Uint8Array.of(9),
      new AbortController().signal,
    )).status).toBe(409)
    expect(await readFile(join(cwd, 'existing.mp4'), 'utf8')).toBe('original')
  })
})
