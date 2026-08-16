/** Host-only binary upload surfaces carried outside the JSON RPC envelope. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Successful workspace-file upload metadata. */
export interface WorkspaceFileUpload {
  /** Workspace-relative path written for later tool calls. */
  path: string
  /** Number of bytes committed to the workspace file. */
  bytes: number
}

/** Host-only upload operations. */
export interface UploadsApi {
  /**
   * Commit one browser-selected file under an attached Session's workspace.
   * The filename is one path segment and the operation never overwrites an
   * existing entry.
   * @param request - target Session and workspace-relative filename.
   * @param data - complete request bytes after the HTTP carrier's body limit.
   * @param signal - cancellation for the filesystem write.
   * @returns A direct HTTP response for the no-envelope upload channel.
   */
  workspaceFile(
    request: { sessionId: SessionId; filename: string },
    data: Uint8Array,
    signal: AbortSignal,
  ): Promise<Response>
}
