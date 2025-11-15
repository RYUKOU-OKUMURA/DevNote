import type { Env, SaveMemoRequest, Memo, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

const MAX_MEMO_SIZE = 100 * 1024 // 100KB

/**
 * Save Memo Endpoint
 * Saves memo content for a specific note to KV
 */
export async function handleSaveMemo(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Parse request body
    const body: SaveMemoRequest = await request.json()
    const { note_id: noteId, content } = body

    if (!noteId) {
      const errorResponse: ErrorResponse = {
        code: 'MISSING_NOTE_ID',
        message: 'note_id is required',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check memo size limit (100KB)
    const contentSize = new TextEncoder().encode(content).length
    if (contentSize > MAX_MEMO_SIZE) {
      const errorResponse: ErrorResponse = {
        code: 'MEMO_TOO_LARGE',
        message: `Memo content exceeds maximum size of ${MAX_MEMO_SIZE} bytes`,
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 413,
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

    // Save memo to KV (key: memo:{note_id})
    const kvKey = `memo:${noteId}`
    await env.KV.put(kvKey, content)

    const memo: Memo = {
      note_id: noteId,
      content,
      updated_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(memo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Save memo error:', error)

    const errorResponse: ErrorResponse = {
      code: 'SAVE_MEMO_ERROR',
      message: 'Failed to save memo',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
