// Shared type definitions for frontend and backend

export interface User {
  id: string
  github_username: string
  github_access_token?: string // Only on backend
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  repository_url: string
  repository_name: string
  status: 'Indexing' | 'Ready' | 'Failed' | 'Auth Required'
  file_store_id?: string
  last_synced_at?: string
  last_accessed_at: string
  latest_commit_sha?: string
  error_message?: string
  created_at: string
}

export interface ChatMessage {
  id: string
  note_id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  created_at: string
}

export interface Citation {
  file_path: string
  snippet?: string
}

export interface PinnedLog {
  id: string
  note_id: string
  message_id: string
  content: string
  created_at: string
}

// File Tree types
export interface FileNode {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

// API Request/Response types
export interface CreateNoteRequest {
  repository_url: string
}

export interface CreateNoteResponse {
  note: Note
  job_id: string
}

export interface ChatRequest {
  note_id: string
  message: string
  selected_files?: string[]
}

export interface ChatStreamChunk {
  type: 'chunk' | 'citation' | 'done'
  content?: string
  citation?: Citation
}

// Error Codes
export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Note errors
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  NOTE_NOT_READY: 'NOTE_NOT_READY',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Sync errors
  SYNC_NOTE_ERROR: 'SYNC_NOTE_ERROR',
  DELETE_NOTE_ERROR: 'DELETE_NOTE_ERROR',
  REPOSITORY_TOO_LARGE: 'REPOSITORY_TOO_LARGE',
  GITHUB_ACCESS_DENIED: 'GITHUB_ACCESS_DENIED',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',

  // Chat errors
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  CHAT_SEND_ERROR: 'CHAT_SEND_ERROR',

  // Gemini errors
  GEMINI_RATE_LIMIT: 'GEMINI_RATE_LIMIT',
  GEMINI_FILE_STORE_LIMIT: 'GEMINI_FILE_STORE_LIMIT',
  GEMINI_API_ERROR: 'GEMINI_API_ERROR',

  // Memo errors
  MEMO_SAVE_ERROR: 'MEMO_SAVE_ERROR',
  MEMO_GET_ERROR: 'MEMO_GET_ERROR',
  MEMO_PIN_ERROR: 'MEMO_PIN_ERROR',

  // General errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export interface ErrorResponse {
  code: ErrorCode
  message: string
  details?: unknown
  retryAfter?: number // For rate limit errors: seconds until retry
}

// Memo types
export interface Memo {
  note_id: string
  content: string
  updated_at: string
}

export interface SaveMemoRequest {
  note_id: string
  content: string
}

export interface PinMessageRequest {
  note_id: string
  message_id: string
}
