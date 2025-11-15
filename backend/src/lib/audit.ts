/**
 * Audit logging utilities
 * Structured logging for important operations
 */

export type AuditAction =
  | 'note.created'
  | 'note.deleted'
  | 'note.sync.started'
  | 'note.sync.completed'
  | 'note.sync.failed'
  | 'user.login'
  | 'user.logout'

export interface AuditLogEntry {
  timestamp: string
  action: AuditAction
  userId: string
  noteId?: string
  metadata?: Record<string, unknown>
  result: 'success' | 'failure'
  error?: string
}

/**
 * Log an audit event to Cloudflare Logs
 */
export function logAuditEvent(
  action: AuditAction,
  userId: string,
  result: 'success' | 'failure',
  options?: {
    noteId?: string
    metadata?: Record<string, unknown>
    error?: string
  }
): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    noteId: options?.noteId,
    metadata: options?.metadata,
    result,
    error: options?.error,
  }

  // Log to Cloudflare Logs (console.log is captured by Workers)
  console.log('[AUDIT]', JSON.stringify(entry))
}

/**
 * Log successful note creation
 */
export function logNoteCreated(userId: string, noteId: string, repositoryUrl: string): void {
  logAuditEvent('note.created', userId, 'success', {
    noteId,
    metadata: { repositoryUrl },
  })
}

/**
 * Log successful note deletion
 */
export function logNoteDeleted(userId: string, noteId: string): void {
  logAuditEvent('note.deleted', userId, 'success', { noteId })
}

/**
 * Log sync started
 */
export function logSyncStarted(userId: string, noteId: string): void {
  logAuditEvent('note.sync.started', userId, 'success', { noteId })
}

/**
 * Log sync completed
 */
export function logSyncCompleted(userId: string, noteId: string, fileCount?: number): void {
  logAuditEvent('note.sync.completed', userId, 'success', {
    noteId,
    metadata: { fileCount },
  })
}

/**
 * Log sync failed
 */
export function logSyncFailed(userId: string, noteId: string, error: string): void {
  logAuditEvent('note.sync.failed', userId, 'failure', {
    noteId,
    error,
  })
}

/**
 * Log user login
 */
export function logUserLogin(userId: string, githubUsername: string): void {
  logAuditEvent('user.login', userId, 'success', {
    metadata: { githubUsername },
  })
}

/**
 * Log user logout
 */
export function logUserLogout(userId: string): void {
  logAuditEvent('user.logout', userId, 'success')
}
