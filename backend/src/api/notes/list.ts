import type { Env, Note, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'

/**
 * Get Notes List Endpoint
 * Returns all notes for the authenticated user
 */
export async function handleGetNotes(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Query notes for the user
    const result = await env.DB.prepare(
      `SELECT
        id,
        user_id,
        repository_url,
        repository_name,
        status,
        file_store_id,
        last_synced_at,
        last_accessed_at,
        latest_commit_sha,
        error_message,
        created_at
      FROM Notes
      WHERE user_id = ?
      ORDER BY last_accessed_at DESC`
    )
      .bind(userId)
      .all<Note>()

    const notes = result.results || []

    // Detect inactive notes (not accessed for 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString()

    // Mark notes as inactive if they haven't been accessed in 90 days
    const notesWithInactiveFlag = notes.map((note) => ({
      ...note,
      is_inactive: note.last_accessed_at < ninetyDaysAgoISO,
    }))

    return new Response(JSON.stringify(notesWithInactiveFlag), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get notes error:', error)

    const errorResponse: ErrorResponse = {
      code: 'GET_NOTES_ERROR',
      message: 'Failed to retrieve notes',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
