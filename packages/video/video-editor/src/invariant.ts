/** Package-owned invariant companion for `@deepseek-ai/dsh-video-editor`. @module @deepseek-ai/dsh-video-editor/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-video-editor'
export const name = 'video-editor-invariant'
export const inject = ['invariants']

/** No runtime invariant: the abstract service emits no events or mutable registry relationships. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
