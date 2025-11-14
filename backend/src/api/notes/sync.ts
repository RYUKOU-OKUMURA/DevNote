import type { Env, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Re-sync Note Endpoint
 * Triggers a re-sync of the repository data
 */
export async function handleSyncNote(
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
        message: 'Note not found or you do not have permission to sync it',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get note details
    const note = await env.DB.prepare('SELECT * FROM Notes WHERE id = ?')
      .bind(noteId)
      .first<{ id: string; repository_url: string; file_store_id?: string }>()

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

    // Update note status to Indexing
    await env.DB.prepare('UPDATE Notes SET status = ?, error_message = NULL WHERE id = ?')
      .bind('Indexing', noteId)
      .run()

    // TODO: Delete existing File Store (if exists)
    // This will be implemented when Gemini File Store integration is complete

    // Trigger sync job with Durable Objects
    const jobIdObj = env.SYNC_JOB.idFromName(noteId)
    const syncJobStub = env.SYNC_JOB.get(jobIdObj)

    await syncJobStub.fetch(`https://sync-job/?action=start`, {
      method: 'POST',
      body: JSON.stringify({
        noteId,
        repositoryUrl: note.repository_url,
        userId,
      }),
    })

    console.log(`Re-sync triggered for note: ${noteId} by user: ${userId}`)

    return new Response(
      JSON.stringify({
        message: 'Re-sync started successfully',
        note_id: noteId,
        job_id: jobId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Sync note error:', error)

    const errorResponse: ErrorResponse = {
      code: 'SYNC_NOTE_ERROR',
      message: 'Failed to start re-sync',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
