/** Package-owned invariant companion for `@deepseek-ai/dsh-tool-video`. @module @deepseek-ai/dsh-tool-video/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-tool-video'
export const name = 'tool-video-invariant'
export const inject = ['invariants']

/** No runtime invariant: tool call/result relations are owned by the shared tool runtime. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
