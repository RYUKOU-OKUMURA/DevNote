import type { Env, CreateNoteRequest, CreateNoteResponse, ErrorResponse } from '../../../../shared/types'
import { requireAuth } from '../../lib/auth'

// GitHub repository URL pattern
const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/

/**
 * Create Note Endpoint
 * Creates a new note for the authenticated user
 */
export async function handleCreateNote(request: Request, env: Env): Promise<Response> {
  try {
    // Require authentication
    const auth = await requireAuth(request, env)
    if ('error' in auth) {
      return auth.error
    }

    const { userId } = auth

    // Parse request body
    const body = (await request.json()) as CreateNoteRequest
    const { repository_url } = body

    // Validate repository URL format
    const match = repository_url.match(GITHUB_REPO_PATTERN)
    if (!match) {
      const errorResponse: ErrorResponse = {
        code: 'INVALID_REPOSITORY_URL',
        message: 'Invalid GitHub repository URL format. Expected: https://github.com/:owner/:repo',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const [, owner, repo] = match
    const repository_name = `${owner}/${repo}`

    // Check user's note quota (max 10 notes per user)
    const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM Notes WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>()

    if (countResult && countResult.count >= 10) {
      const errorResponse: ErrorResponse = {
        code: 'QUOTA_EXCEEDED',
        message: 'Maximum number of notes (10) reached. Please delete some notes before creating new ones.',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if note with this repository already exists for this user
    const existingNote = await env.DB.prepare(
      'SELECT id FROM Notes WHERE user_id = ? AND repository_url = ?'
    )
      .bind(userId, repository_url)
      .first()

    if (existingNote) {
      const errorResponse: ErrorResponse = {
        code: 'NOTE_ALREADY_EXISTS',
        message: 'A note for this repository already exists',
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create new note with Indexing status
    const noteId = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.prepare(
      `INSERT INTO Notes (
        id,
        user_id,
        repository_url,
        repository_name,
        status,
        last_accessed_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(noteId, userId, repository_url, repository_name, 'Indexing', now, now)
      .run()

    // Trigger sync job with Durable Objects
    const jobId = env.SYNC_JOB.idFromName(noteId)
    const syncJobStub = env.SYNC_JOB.get(jobId)

    await syncJobStub.fetch(`https://sync-job/?action=start`, {
      method: 'POST',
      body: JSON.stringify({
        noteId,
        repositoryUrl: repository_url,
        userId,
      }),
    })

    // Fetch the created note
    const note = await env.DB.prepare('SELECT * FROM Notes WHERE id = ?').bind(noteId).first()

    const response: CreateNoteResponse = {
      note: note as any,
      job_id: jobId,
    }

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Create note error:', error)

    const errorResponse: ErrorResponse = {
      code: 'CREATE_NOTE_ERROR',
      message: 'Failed to create note',
      details: error instanceof Error ? error.message : 'Unknown error',
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
