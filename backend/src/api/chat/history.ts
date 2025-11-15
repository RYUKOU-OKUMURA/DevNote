import type { Env, ChatMessage, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Chat History Endpoint
 * Returns chat history for a specific note
 */
export async function handleChatHistory(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Get note_id from query parameters
    const url = new URL(request.url)
    const noteId = url.searchParams.get('note_id')

    if (!noteId) {
      const errorResponse: ErrorResponse = {
        code: 'MISSING_NOTE_ID',
        message: 'note_id query parameter is required',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify note ownership
    const isOwner = await verifyNoteOwnership(env.DB, userId, noteId)
    if (!isOwner) {
      const errorResponse: ErrorResponse = {
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found or you do not have permission to access it',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update last_accessed_at when accessing chat history (workspace visit)
    await env.DB.prepare('UPDATE Notes SET last_accessed_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), noteId)
      .run()

    // Fetch chat history
    const result = await env.DB.prepare(
      `SELECT
        id,
        note_id,
        role,
        content,
        citations,
        created_at
      FROM ChatMessages
      WHERE note_id = ?
      ORDER BY created_at ASC`
    )
      .bind(noteId)
      .all()

    // Parse citations JSON
    const messages: ChatMessage[] = (result.results || []).map((row: any) => ({
      id: row.id,
      note_id: row.note_id,
      role: row.role,
      content: row.content,
      citations: row.citations ? JSON.parse(row.citations) : undefined,
      created_at: row.created_at,
    }))

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Chat history error:', error)

    const errorResponse: ErrorResponse = {
      code: 'CHAT_HISTORY_ERROR',
      message: 'Failed to retrieve chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
