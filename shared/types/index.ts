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

export interface ErrorResponse {
  code: string
  message: string
  details?: unknown
}

// Environment variables for Cloudflare Workers
export interface Env {
  // Bindings
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  SYNC_JOB: DurableObjectNamespace

  // Environment variables
  FRONTEND_URL: string

  // Secrets
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  JWT_SECRET: string
  GEMINI_API_KEY: string
}
