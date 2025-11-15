/**
 * API Client for DevNote
 * Handles all HTTP requests to the backend
 */

import type {
  Note,
  CreateNoteRequest,
  CreateNoteResponse,
  ChatRequest,
  ChatStreamChunk,
  ChatMessage,
  SaveMemoRequest,
  Memo,
  PinMessageRequest,
  ErrorResponse,
} from '../../../shared/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

/**
 * Get JWT token from localStorage
 */
function getToken(): string | null {
  return localStorage.getItem('jwt_token')
}

/**
 * Set JWT token in localStorage
 */
export function setToken(token: string): void {
  localStorage.setItem('jwt_token', token)
}

/**
 * Clear JWT token from localStorage
 */
export function clearToken(): void {
  localStorage.removeItem('jwt_token')
}

/**
 * Create headers with authentication
 */
function createHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/**
 * Handle API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ErrorResponse = await response.json()
    throw new Error(error.message || 'API request failed')
  }

  return response.json()
}

/**
 * Notes API
 */
export const notesApi = {
  /**
   * Get all notes for the current user
   */
  async list(): Promise<Note[]> {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      method: 'GET',
      headers: createHeaders(),
    })

    return handleResponse<Note[]>(response)
  },

  /**
   * Create a new note
   */
  async create(data: CreateNoteRequest): Promise<CreateNoteResponse> {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(data),
    })

    return handleResponse<CreateNoteResponse>(response)
  },

  /**
   * Delete a note
   */
  async delete(noteId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: createHeaders(),
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      throw new Error(error.message || 'Failed to delete note')
    }
  },

  /**
   * Resync a note
   */
  async sync(noteId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/notes/${noteId}/sync`, {
      method: 'POST',
      headers: createHeaders(),
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      throw new Error(error.message || 'Failed to sync note')
    }
  },
}

/**
 * Chat API
 */
export const chatApi = {
  /**
   * Send a chat message and receive streaming response
   */
  async send(
    data: ChatRequest,
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      throw new Error(error.message || 'Failed to send message')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Process complete lines
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const data = line.trim().substring(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const chunk: ChatStreamChunk = JSON.parse(data)
            onChunk(chunk)
          } catch (e) {
            console.error('Failed to parse chunk:', e)
          }
        }
      }
    }
  },

  /**
   * Get chat history for a note
   */
  async getHistory(noteId: string): Promise<ChatMessage[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/history?note_id=${noteId}`,
      {
        method: 'GET',
        headers: createHeaders(),
      }
    )

    return handleResponse<ChatMessage[]>(response)
  },
}

/**
 * Memo API
 */
export const memoApi = {
  /**
   * Get memo for a note
   */
  async get(noteId: string): Promise<Memo> {
    const response = await fetch(`${API_BASE_URL}/api/memo?note_id=${noteId}`, {
      method: 'GET',
      headers: createHeaders(),
    })

    return handleResponse<Memo>(response)
  },

  /**
   * Save memo for a note
   */
  async save(data: SaveMemoRequest): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/memo`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      throw new Error(error.message || 'Failed to save memo')
    }
  },

  /**
   * Pin a message to memo
   */
  async pin(data: PinMessageRequest): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/memo/pin`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      throw new Error(error.message || 'Failed to pin message')
    }
  },
}

/**
 * Auth API
 */
export const authApi = {
  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: createHeaders(),
    })

    clearToken()
  },
}
