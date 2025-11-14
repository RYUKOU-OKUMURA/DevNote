import type { Env, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Delete Note Endpoint
 * Deletes a note and all associated data
 */
export async function handleDeleteNote(
  request: Request,
  env: Env,
  noteId: string
): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Verify note ownership
    const isOwner = await verifyNoteOwnership(env.DB, userId, noteId)
    if (!isOwner) {
      const errorResponse: ErrorResponse = {
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found or you do not have permission to delete it',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get note details before deletion
    const note = await env.DB.prepare('SELECT * FROM Notes WHERE id = ?').bind(noteId).first()

    if (!note) {
      const errorResponse: ErrorResponse = {
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Delete note from database (CASCADE will delete related chat messages and pinned logs)
    await env.DB.prepare('DELETE FROM Notes WHERE id = ?').bind(noteId).run()

    // Delete memo from KV
    await env.KV.delete(`memo:${noteId}`)

    // TODO: Schedule Gemini File Store deletion (within 24 hours)
    // TODO: Schedule R2 cache deletion (within 24 hours)
    // TODO: Save lightweight metadata backup to R2
    // These will be implemented as part of the cleanup job

    // Log the deletion for audit purposes
    console.log(`Note deleted: ${noteId} by user: ${userId}`)

    return new Response(
      JSON.stringify({
        message: 'Note deleted successfully',
        note_id: noteId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Delete note error:', error)

    const errorResponse: ErrorResponse = {
      code: 'DELETE_NOTE_ERROR',
      message: 'Failed to delete note',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
