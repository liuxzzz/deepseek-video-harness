/** Package-owned invariant companion for the Web video-editor form. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-video-editor'

/** Cordis companion plugin name. */
export const name = 'client-ui-video-editor-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package contributes one disposable slot entry and
 * delegates durable file and prompt commits to Host-owned operations.
 */
const install: InvariantInstaller = () => {}

/**
 * Register package ownership with the invariant registry.
 * @param ctx - context carrying the invariant service.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
