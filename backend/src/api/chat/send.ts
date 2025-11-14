import type { Env, ChatRequest, ChatStreamChunk, ErrorResponse, Citation } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'

/**
 * Chat Send Endpoint
 * Sends a message and streams AI response using Gemini File Search
 */
export async function handleChatSend(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Parse request body
    const body = (await request.json()) as ChatRequest
    const { note_id, message, selected_files } = body

    // Validate message
    if (!message || message.trim().length === 0) {
      const errorResponse: ErrorResponse = {
        code: 'INVALID_MESSAGE',
        message: 'Message cannot be empty',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check message length
    if (message.length > 5000) {
      const errorResponse: ErrorResponse = {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message exceeds maximum length of 5000 characters',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify note ownership
    const isOwner = await verifyNoteOwnership(env.DB, userId, note_id)
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

    // Get note details
    const note = await env.DB.prepare('SELECT * FROM Notes WHERE id = ?')
      .bind(note_id)
      .first<{ status: string; file_store_id?: string }>()

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

    // Check note status
    if (note.status !== 'Ready') {
      const errorResponse: ErrorResponse = {
        code: 'NOTE_NOT_READY',
        message: `Note is not ready. Current status: ${note.status}`,
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Save user message to database
    const userMessageId = crypto.randomUUID()
    await env.DB.prepare(
      'INSERT INTO ChatMessages (id, note_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(userMessageId, note_id, 'user', message, new Date().toISOString())
      .run()

    // Stream AI response
    return streamGeminiResponse(env, note_id, message, selected_files, note.file_store_id)
  } catch (error) {
    console.error('Chat send error:', error)

    const errorResponse: ErrorResponse = {
      code: 'CHAT_SEND_ERROR',
      message: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Stream AI response using Server-Sent Events
 */
async function streamGeminiResponse(
  env: Env,
  noteId: string,
  message: string,
  selectedFiles: string[] | undefined,
  fileStoreId: string | undefined
): Promise<Response> {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Start streaming in background
  handleStreamingResponse(env, noteId, message, selectedFiles, fileStoreId, writer, encoder)

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Handle the streaming response
 */
async function handleStreamingResponse(
  env: Env,
  noteId: string,
  message: string,
  selectedFiles: string[] | undefined,
  fileStoreId: string | undefined,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
): Promise<void> {
  try {
    // Build metadata filter for selected files
    const metadataFilter = selectedFiles
      ? buildMetadataFilter(selectedFiles)
      : null

    // TODO: Call Gemini API with File Search (Task 6.2, 6.3, 6.4)
    // For now, generate mock streaming response
    const mockResponse = await generateMockGeminiResponse(message, selectedFiles)

    // Stream the response
    for (const chunk of mockResponse.chunks) {
      const eventData: ChatStreamChunk = {
        type: 'chunk',
        content: chunk,
      }

      await writer.write(
        encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
      )

      // Simulate streaming delay
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // Stream citations
    for (const citation of mockResponse.citations) {
      const eventData: ChatStreamChunk = {
        type: 'citation',
        citation,
      }

      await writer.write(
        encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
      )
    }

    // Save assistant message to database
    const assistantMessageId = crypto.randomUUID()
    await env.DB.prepare(
      'INSERT INTO ChatMessages (id, note_id, role, content, citations, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(
        assistantMessageId,
        noteId,
        'assistant',
        mockResponse.fullText,
        JSON.stringify(mockResponse.citations),
        new Date().toISOString()
      )
      .run()

    // Send done event
    const doneEvent: ChatStreamChunk = { type: 'done' }
    await writer.write(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`))

    await writer.close()
  } catch (error) {
    console.error('Streaming error:', error)

    const errorEvent = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Streaming failed',
    }

    await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
    await writer.close()
  }
}

/**
 * Build metadata filter for selected files
 */
function buildMetadataFilter(selectedFiles: string[]): string {
  // Example: file_path="src/main.js" OR file_path="src/utils.js"
  return selectedFiles.map((filePath) => `file_path="${filePath}"`).join(' OR ')
}

/**
 * Generate mock Gemini response for testing
 * TODO: Replace with actual Gemini API call
 */
async function generateMockGeminiResponse(
  message: string,
  selectedFiles?: string[]
): Promise<{
  fullText: string
  chunks: string[]
  citations: Citation[]
}> {
  const context = selectedFiles?.length
    ? `focusing on files: ${selectedFiles.join(', ')}`
    : 'across the entire repository'

  const fullText = `Based on your question "${message}" ${context}, here's what I found:\n\nThis is a mock response. The actual implementation will use Gemini File Search to provide accurate answers based on your repository contents.`

  // Split into chunks for streaming
  const chunks = fullText.match(/.{1,20}/g) || [fullText]

  // Mock citations
  const citations: Citation[] = selectedFiles?.length
    ? selectedFiles.map((filePath) => ({
        file_path: filePath,
        snippet: `Relevant content from ${filePath}`,
      }))
    : [
        {
          file_path: 'README.md',
          snippet: 'Example snippet from README',
        },
      ]

  return { fullText, chunks, citations }
}
