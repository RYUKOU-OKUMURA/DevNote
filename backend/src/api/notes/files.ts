import type { Env } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { createErrorResponse } from '../../lib/error-handling'
import { ErrorCodes } from '../../../../shared/types'

/**
 * GET /api/notes/:id/files
 * Get file paths for a note
 */
export async function handleGetFiles(
  request: Request,
  env: Env,
  noteId: string
): Promise<Response> {
  try {
    // Authenticate user
    const userId = await requireAuth(request, env)

    // Get note from database
    const note = await env.DB.prepare(
      'SELECT id, user_id, file_paths, status FROM Notes WHERE id = ?'
    )
      .bind(noteId)
      .first<{ id: string; user_id: string; file_paths: string | null; status: string }>()

    if (!note) {
      return createErrorResponse(ErrorCodes.NOTE_NOT_FOUND, 'Note not found', 404)
    }

    // Check ownership
    if (note.user_id !== userId) {
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Access denied', 403)
    }

    // Check if note is ready
    if (note.status !== 'Ready') {
      return createErrorResponse(
        ErrorCodes.NOTE_NOT_READY,
        `Note is not ready yet. Current status: ${note.status}`,
        400
      )
    }

    // Parse file paths
    const filePaths = note.file_paths ? JSON.parse(note.file_paths) : []

    return new Response(
      JSON.stringify({
        file_paths: filePaths,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Get files error:', error)
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to get files',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
