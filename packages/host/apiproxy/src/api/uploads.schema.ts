/** Query validation for the host-only workspace upload channel. */

import { z } from 'zod'
import { sessionIdSchema } from './sessions.schema.ts'

/** `/api/workspace.upload` query parameters. */
export const workspaceUploadQuerySchema = z.object({
  sessionId: sessionIdSchema,
  filename: z.string().min(1).refine(
    filename => filename !== '.' && filename !== '..' && !filename.includes('/') && !filename.includes('\\'),
    { message: 'filename must be one path segment' },
  ),
})
