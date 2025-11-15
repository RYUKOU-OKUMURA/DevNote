import type { Env } from '../../../shared/types'
import { Octokit } from '@octokit/rest'
import { decryptToken } from '../lib/crypto'
import {
  isGitHubRateLimitError,
  createRepositoryTooLargeError,
  handleApiError,
} from '../lib/error-handling'
import { logSyncStarted, logSyncCompleted, logSyncFailed } from '../lib/audit'

type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

interface SyncJobState {
  noteId: string
  repositoryUrl: string
  status: JobStatus
  retryCount: number
  error?: string
  fileStoreId?: string
  commitSha?: string
}

/**
 * Durable Object for managing repository sync jobs
 * One instance per note for strong consistency
 */
export class SyncJob implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private jobState: SyncJobState | null = null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  /**
   * Initialize and start a sync job
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'start':
        return this.startSync(request)
      case 'status':
        return this.getStatus()
      case 'retry':
        return this.retrySync()
      default:
        return new Response('Invalid action', { status: 400 })
    }
  }

  /**
   * Start a new sync job
   */
  private async startSync(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as {
        noteId: string
        repositoryUrl: string
        userId: string
      }

      // Initialize job state
      this.jobState = {
        noteId: body.noteId,
        repositoryUrl: body.repositoryUrl,
        status: 'pending',
        retryCount: 0,
      }

      await this.state.storage.put('jobState', this.jobState)

      // Start the sync process in the background
      this.state.waitUntil(this.performSync(body.userId))

      return new Response(
        JSON.stringify({
          message: 'Sync job started',
          status: this.jobState.status,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('Start sync error:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to start sync',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * Get current sync job status
   */
  private async getStatus(): Promise<Response> {
    const jobState = await this.state.storage.get<SyncJobState>('jobState')

    if (!jobState) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(jobState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * Retry a failed sync job
   */
  private async retrySync(): Promise<Response> {
    const jobState = await this.state.storage.get<SyncJobState>('jobState')

    if (!jobState) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (jobState.status !== 'failed') {
      return new Response(JSON.stringify({ error: 'Job is not in failed state' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Reset status and increment retry count
    jobState.status = 'pending'
    jobState.retryCount += 1
    await this.state.storage.put('jobState', jobState)

    // Get user ID from database
    const note = await this.env.DB.prepare('SELECT user_id FROM Notes WHERE id = ?')
      .bind(jobState.noteId)
      .first<{ user_id: string }>()

    if (!note) {
      return new Response(JSON.stringify({ error: 'Note not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Retry the sync
    this.state.waitUntil(this.performSync(note.user_id))

    return new Response(
      JSON.stringify({
        message: 'Sync retry started',
        status: jobState.status,
        retryCount: jobState.retryCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  /**
   * Perform the actual sync process with retry logic
   */
  private async performSync(userId: string): Promise<void> {
    const jobState = await this.state.storage.get<SyncJobState>('jobState')
    if (!jobState) return

    try {
      // Update status to in_progress
      jobState.status = 'in_progress'
      await this.state.storage.put('jobState', jobState)
      await this.updateNoteStatus('Indexing', null)

      // Log sync started
      logSyncStarted(userId, jobState.noteId)

      // Step 1: Fetch files from GitHub
      const { files, commitSha } = await this.fetchGitHubFiles(userId, jobState.repositoryUrl)

      // Step 2: Upload to Gemini File Store
      const fileStoreId = await this.uploadToGemini(files)

      // Step 3: Save to R2 (cache)
      await this.saveToR2(jobState.noteId, commitSha, files)

      // Step 4: Update note in database
      jobState.status = 'completed'
      jobState.fileStoreId = fileStoreId
      jobState.commitSha = commitSha
      await this.state.storage.put('jobState', jobState)
      await this.updateNoteStatus('Ready', null, fileStoreId, commitSha)

      // Log sync completed
      logSyncCompleted(userId, jobState.noteId, files.length)
      console.log(`Sync completed for note: ${jobState.noteId}`)
    } catch (error) {
      console.error('Sync error:', error)

      // Handle rate limit errors with better messages
      if (isGitHubRateLimitError(error)) {
        jobState.error = 'GitHub API rate limit exceeded. Please try again later.'
      } else {
        const errorResponse = handleApiError(error)
        jobState.error = errorResponse.message
      }

      // Retry logic: maximum 3 retries with exponential backoff
      if (jobState.retryCount < 3) {
        const backoffMs = Math.pow(2, jobState.retryCount) * 1000 // 1s, 2s, 4s
        console.log(
          `Retrying sync for note ${jobState.noteId} in ${backoffMs}ms (attempt ${jobState.retryCount + 1})`
        )

        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        jobState.retryCount += 1
        await this.state.storage.put('jobState', jobState)
        await this.performSync(userId)
      } else {
        // Max retries exceeded
        jobState.status = 'failed'
        await this.state.storage.put('jobState', jobState)
        await this.updateNoteStatus('Failed', jobState.error)

        // Log sync failed
        logSyncFailed(userId, jobState.noteId, jobState.error || 'Unknown error')
        console.error(`Sync failed for note ${jobState.noteId} after 3 retries`)
      }
    }
  }

  /**
   * Fetch files from GitHub repository
   */
  private async fetchGitHubFiles(
    userId: string,
    repositoryUrl: string
  ): Promise<{ files: Array<{ path: string; content: string }>; commitSha: string }> {
    // Get user's GitHub access token from database
    const user = await this.env.DB.prepare('SELECT github_access_token FROM Users WHERE id = ?')
      .bind(userId)
      .first<{ github_access_token: string }>()

    if (!user || !user.github_access_token) {
      throw new Error('GitHub access token not found')
    }

    // Decrypt the access token
    const encryptionSecret = this.env.ENCRYPTION_SECRET || 'default-secret-key'
    const accessToken = await decryptToken(user.github_access_token, encryptionSecret)

    // Parse repository URL
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!match) {
      throw new Error('Invalid GitHub repository URL')
    }

    const [, owner, repo] = match

    // Initialize Octokit
    const octokit = new Octokit({ auth: accessToken })

    // Get latest commit SHA
    const { data: repoData } = await octokit.repos.get({ owner, repo })
    const commitSha = repoData.default_branch

    // Get repository tree (all files)
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: 'true',
    })

    // Check repository size (max 500MB)
    if (tree.truncated) {
      const error = createRepositoryTooLargeError()
      throw new Error(error.message)
    }

    // Filter and fetch file contents
    const files: Array<{ path: string; content: string }> = []

    for (const item of tree.tree) {
      // Skip directories, .git folder, and binary files
      if (item.type !== 'blob' || !item.path || item.path.startsWith('.git/')) {
        continue
      }

      // Skip binary files (basic check by extension)
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe', '.dll']
      if (binaryExtensions.some((ext) => item.path!.endsWith(ext))) {
        continue
      }

      try {
        // Fetch file content
        const { data: blob } = await octokit.git.getBlob({
          owner,
          repo,
          file_sha: item.sha!,
        })

        // Decode base64 content
        const content = Buffer.from(blob.content, 'base64').toString('utf-8')

        files.push({
          path: item.path,
          content,
        })
      } catch (error) {
        console.warn(`Failed to fetch file ${item.path}:`, error)
        // Continue with other files
      }
    }

    console.log(`Fetched ${files.length} files from ${owner}/${repo}`)

    return { files, commitSha: repoData.default_branch }
  }

  /**
   * Upload files to Gemini File Store
   */
  private async uploadToGemini(
    files: Array<{ path: string; content: string }>
  ): Promise<string> {
    // TODO: Implement Gemini File Store upload (Task 5.3)
    // For now, return a mock file store ID
    const mockFileStoreId = `fs-${crypto.randomUUID()}`
    console.log(`Uploaded ${files.length} files to Gemini File Store: ${mockFileStoreId}`)
    return mockFileStoreId
  }

  /**
   * Save repository cache to R2
   */
  private async saveToR2(
    noteId: string,
    commitSha: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    // TODO: Implement R2 ZIP cache (Task 5.6)
    // For now, just log
    console.log(`Saved ${files.length} files to R2: repo-cache/${noteId}/${commitSha}.zip`)
  }

  /**
   * Update note status in database
   */
  private async updateNoteStatus(
    status: string,
    errorMessage: string | null,
    fileStoreId?: string,
    commitSha?: string
  ): Promise<void> {
    const jobState = await this.state.storage.get<SyncJobState>('jobState')
    if (!jobState) return

    const now = new Date().toISOString()

    if (fileStoreId && commitSha) {
      await this.env.DB.prepare(
        `UPDATE Notes
        SET status = ?,
            error_message = ?,
            file_store_id = ?,
            latest_commit_sha = ?,
            last_synced_at = ?
        WHERE id = ?`
      )
        .bind(status, errorMessage, fileStoreId, commitSha, now, jobState.noteId)
        .run()
    } else {
      await this.env.DB.prepare(
        `UPDATE Notes
        SET status = ?,
            error_message = ?
        WHERE id = ?`
      )
        .bind(status, errorMessage, jobState.noteId)
        .run()
    }
  }
}
