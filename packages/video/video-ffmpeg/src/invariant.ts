/** Package-owned invariant companion for `@deepseek-ai/dsh-video-ffmpeg`. @module @deepseek-ai/dsh-video-ffmpeg/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-video-ffmpeg'
export const name = 'video-ffmpeg-invariant'
export const inject = ['invariants']

/** No runtime invariant: process settlement is returned to the Consumer and emits no provider-owned event stream. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
