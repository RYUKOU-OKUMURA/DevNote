import type { Env, PinMessageRequest, PinnedLog, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Pin Message Endpoint
 * Pins a chat message to the memo pad and records it in PinnedLogs table
 */
export async function handlePinMessage(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Parse request body
    const body: PinMessageRequest = await request.json()
    const { note_id: noteId, message_id: messageId } = body

    if (!noteId || !messageId) {
      const errorResponse: ErrorResponse = {
        code: 'MISSING_PARAMETERS',
        message: 'note_id and message_id are required',
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

    // Fetch the message from ChatMessages table
    const messageResult = await env.DB.prepare(
      `SELECT id, content, role, created_at
       FROM ChatMessages
       WHERE id = ? AND note_id = ?`
    )
      .bind(messageId, noteId)
      .first()

    if (!messageResult) {
      const errorResponse: ErrorResponse = {
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const messageContent = messageResult.content as string
    const messageRole = messageResult.role as string
    const messageCreatedAt = messageResult.created_at as string

    // Format the pinned message
    const pinnedText = `\n\n--- ピン留め (${new Date(messageCreatedAt).toLocaleString('ja-JP')}) ---\n[${messageRole === 'user' ? 'あなた' : 'AI'}]: ${messageContent}\n---\n`

    // Append to memo in KV
    const kvKey = `memo:${noteId}`
    const existingMemo = (await env.KV.get(kvKey)) || ''
    const updatedMemo = existingMemo + pinnedText
    await env.KV.put(kvKey, updatedMemo)

    // Record in PinnedLogs table
    const pinnedLogId = crypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO PinnedLogs (id, note_id, message_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(pinnedLogId, noteId, messageId, messageContent, new Date().toISOString())
      .run()

    const pinnedLog: PinnedLog = {
      id: pinnedLogId,
      note_id: noteId,
      message_id: messageId,
      content: messageContent,
      created_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(pinnedLog), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Pin message error:', error)

    const errorResponse: ErrorResponse = {
      code: 'PIN_MESSAGE_ERROR',
      message: 'Failed to pin message',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
