import type { Env, Memo, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Get Memo Endpoint
 * Returns memo content for a specific note from KV
 */
export async function handleGetMemo(request: Request, env: Env): Promise<Response> {
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

    // Fetch memo from KV (key: memo:{note_id})
    const kvKey = `memo:${noteId}`
    const memoContent = await env.KV.get(kvKey)

    const memo: Memo = {
      note_id: noteId,
      content: memoContent || '',
      updated_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(memo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get memo error:', error)

    const errorResponse: ErrorResponse = {
      code: 'GET_MEMO_ERROR',
      message: 'Failed to retrieve memo',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
