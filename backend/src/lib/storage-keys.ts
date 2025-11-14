/**
 * Storage Key Schemas
 *
 * This file defines the key naming conventions for KV and R2 storage.
 */

/**
 * KV Key Schemas
 */
export const KV_KEYS = {
  /**
   * Memo pad content for a note
   * Format: memo:{note_id}
   * Example: memo:abc123
   */
  memo: (noteId: string) => `memo:${noteId}`,

  /**
   * User session data
   * Format: session:{user_id}
   * Example: session:user_xyz
   */
  session: (userId: string) => `session:${userId}`,
} as const

/**
 * R2 Key Schemas
 */
export const R2_KEYS = {
  /**
   * Repository cache (ZIP file)
   * Format: repo-cache/{note_id}/{commit_sha}.zip
   * Example: repo-cache/abc123/a1b2c3d4.zip
   *
   * Auto-delete policy: 90 days from last access
   */
  repoCache: (noteId: string, commitSha: string) => `repo-cache/${noteId}/${commitSha}.zip`,

  /**
   * Backup metadata (JSON file)
   * Format: backup/{note_id}/metadata.json
   * Example: backup/abc123/metadata.json
   *
   * Auto-delete policy: 90 days from last access
   */
  backupMetadata: (noteId: string) => `backup/${noteId}/metadata.json`,
} as const

/**
 * Storage Retention Policies
 */
export const RETENTION_POLICIES = {
  /**
   * KV: No automatic expiration
   * Manual cleanup required for inactive notes
   */
  KV_RETENTION: 'manual',

  /**
   * R2: Automatic deletion after 90 days of inactivity
   * Implemented via R2 lifecycle rules
   */
  R2_RETENTION_DAYS: 90,
} as const
