import type { Env, Note, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'

/**
 * Get Inactive Notes Endpoint
 * Returns notes that haven't been accessed for 90 days
 * This can be used for archival notifications and cleanup
 */
export async function handleGetInactiveNotes(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Calculate 90 days ago
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString()

    // Query notes that haven't been accessed in 90 days
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
      WHERE user_id = ? AND last_accessed_at < ?
      ORDER BY last_accessed_at ASC`
    )
      .bind(userId, ninetyDaysAgoISO)
      .all<Note>()

    const inactiveNotes = result.results || []

    // Include days since last access for each note
    const notesWithInactivityInfo = inactiveNotes.map((note) => {
      const lastAccessed = new Date(note.last_accessed_at)
      const daysSinceAccess = Math.floor(
        (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        ...note,
        days_since_access: daysSinceAccess,
        recommended_action:
          daysSinceAccess > 180
            ? 'archive' // More than 6 months
            : 'notify', // 90-180 days
      }
    })

    return new Response(JSON.stringify(notesWithInactivityInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get inactive notes error:', error)

    const errorResponse: ErrorResponse = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to retrieve inactive notes',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
