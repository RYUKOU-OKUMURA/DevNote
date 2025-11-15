import type { Env, ChatRequest, ChatStreamChunk, ErrorResponse, Citation } from '../../../../shared/types'
import { ErrorCodes } from '../../../../shared/types'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '../../lib/auth'
import { verifyNoteOwnership } from '../../lib/jwt'
import { handleApiError } from '../../lib/error-handling'
import { logSearchQuery } from '../../lib/metrics'

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
        code: ErrorCodes.INVALID_MESSAGE,
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
        code: ErrorCodes.MESSAGE_TOO_LONG,
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
        code: ErrorCodes.NOTE_NOT_FOUND,
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
        code: ErrorCodes.NOTE_NOT_FOUND,
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
        code: ErrorCodes.NOTE_NOT_READY,
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
    return streamGeminiResponse(env, userId, note_id, message, selected_files, note.file_store_id)
  } catch (error) {
    console.error('Chat send error:', error)

    const errorResponse = handleApiError(error, ErrorCodes.CHAT_SEND_ERROR)

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
  userId: string,
  noteId: string,
  message: string,
  selectedFiles: string[] | undefined,
  fileStoreId: string | undefined
): Promise<Response> {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Start streaming in background
  handleStreamingResponse(env, userId, noteId, message, selectedFiles, fileStoreId, writer, encoder)

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
  userId: string,
  noteId: string,
  message: string,
  selectedFiles: string[] | undefined,
  fileStoreId: string | undefined,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
): Promise<void> {
  try {
    // Log search query metrics
    logSearchQuery(userId, noteId, message.length)

    // Build metadata filter for selected files
    const metadataFilter = selectedFiles && selectedFiles.length > 0
      ? buildMetadataFilter(selectedFiles)
      : null

    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // NOTE: File Search Tool implementation is pending full SDK support
    // The current @google/generative-ai package (v0.24.1) has limited TypeScript support
    // for File Search features. Using standard chat for now.

    // Build context prompt with file selection hint
    const contextPrompt = selectedFiles && selectedFiles.length > 0
      ? `User has selected these files for context: ${selectedFiles.join(', ')}.\n\n${message}`
      : message

    // Generate content with streaming
    const result = await model.generateContentStream(contextPrompt)

    let fullText = ''

    // Stream response chunks
    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      fullText += chunkText

      const eventData: ChatStreamChunk = {
        type: 'chunk',
        content: chunkText,
      }

      await writer.write(
        encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
      )
    }

    // Get final response and extract citations
    const response = await result.response
    const citations = extractCitations(response)

    // Stream citations
    for (const citation of citations) {
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
        fullText,
        JSON.stringify(citations),
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
 * Extract citations from Gemini response
 */
function extractCitations(response: any): Citation[] {
  try {
    // Get grounding metadata from the response
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata

    if (!groundingMetadata || !groundingMetadata.groundingChunks) {
      return []
    }

    // Extract citations from grounding chunks
    const citations: Citation[] = groundingMetadata.groundingChunks
      .map((chunk: any) => {
        // Try to extract file path from different possible locations
        const filePath =
          chunk.web?.uri ||
          chunk.retrievedContext?.uri ||
          chunk.retrievedContext?.title ||
          'unknown'

        // Extract snippet from retrieved context
        const snippet = chunk.retrievedContext?.text?.substring(0, 200)

        return {
          file_path: filePath,
          ...(snippet && { snippet }),
        }
      })
      .filter((citation: Citation) => citation.file_path !== 'unknown')

    return citations
  } catch (error) {
    console.error('Failed to extract citations:', error)
    return []
  }
}
