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

export interface ErrorResponse {
  code: string
  message: string
  details?: unknown
}
