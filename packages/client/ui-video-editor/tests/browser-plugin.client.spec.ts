/** Browser registration lifecycle plus inert Node and invariant companions. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as VideoEditorInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: { 'conversation.session.header.actions': { kind: 'list', scope: 'session' } },
  } as never, () => null)
  ctx.provide('sessions', {})
  ctx.provide('conversation', {})
  ctx.provide('connection', { api: { settings: {} }, isLoopback: true } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('ui-video-editor browser half', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['slots', 'sessions', 'locale', 'conversation'])
  })

  it('registers one disposable header action and its dictionaries', async () => {
    const { ctx, fiber } = await bench()
    expect(ctx.slots.entries('conversation.session.header.actions').map(entry => entry.options.id))
      .toContain('video-editor')
    const translate = ctx.locale.bind(NS)
    expect(translate('action.open')).toBe(zh['action.open'])
    ctx.locale.setLocale('en')
    expect(translate('action.open')).toBe(en['action.open'])
    await fiber.dispose()
    expect(ctx.slots.entries('conversation.session.header.actions').map(entry => entry.options.id))
      .not.toContain('video-editor')
    expect(translate('action.open')).not.toBe(en['action.open'])
  })

  it('keeps both dictionaries key-identical', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-video-editor companions', () => {
  it('has an inert Node half', () => {
    expect(applyNode).not.toThrow()
  })

  it('reserves invariant ownership without installing an audit', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(VideoEditorInvariant)
    await fiber.await()
    expect(VideoEditorInvariant.name).toBe('client-ui-video-editor-invariant')
    expect(VideoEditorInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
