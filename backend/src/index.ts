/**
 * DevNote Backend - Cloudflare Workers
 * Main entry point for the API
 */

import type { Env } from '../../shared/types'
import { handleGitHubLogin } from './api/auth/login'
import { handleGitHubCallback } from './api/auth/callback'
import { handleLogout } from './api/auth/logout'
import { handleGetNotes } from './api/notes/list'
import { handleCreateNote } from './api/notes/create'
import { handleDeleteNote } from './api/notes/delete'
import { handleSyncNote } from './api/notes/sync'

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url)

		// Add CORS headers for development
		const corsHeaders = {
			'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		}

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders })
		}

		try {
			// Route requests
			const response = await route(request, env, url)

			// Add CORS headers to response
			Object.entries(corsHeaders).forEach(([key, value]) => {
				response.headers.set(key, value)
			})

			return response
		} catch (error) {
			console.error('Request error:', error)
			return new Response(
				JSON.stringify({
					code: 'INTERNAL_ERROR',
					message: 'Internal server error',
					details: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			)
		}
	},
} satisfies ExportedHandler<Env>

/**
 * Route requests to appropriate handlers
 */
async function route(request: Request, env: Env, url: URL): Promise<Response> {
	const { pathname } = url

	// Authentication routes
	if (pathname === '/api/auth/github/login') {
		return handleGitHubLogin(request, env)
	}
	if (pathname === '/api/auth/github/callback') {
		return handleGitHubCallback(request, env)
	}
	if (pathname === '/api/auth/logout') {
		return handleLogout(request, env)
	}

	// Notes routes
	if (pathname === '/api/notes' && request.method === 'GET') {
		return handleGetNotes(request, env)
	}
	if (pathname === '/api/notes' && request.method === 'POST') {
		return handleCreateNote(request, env)
	}

	// Note-specific routes with ID parameter
	const noteIdMatch = pathname.match(/^\/api\/notes\/([^\/]+)$/)
	if (noteIdMatch) {
		const noteId = noteIdMatch[1]
		if (request.method === 'DELETE') {
			return handleDeleteNote(request, env, noteId)
		}
	}

	const noteSyncMatch = pathname.match(/^\/api\/notes\/([^\/]+)\/sync$/)
	if (noteSyncMatch) {
		const noteId = noteSyncMatch[1]
		if (request.method === 'POST') {
			return handleSyncNote(request, env, noteId)
		}
	}

	// Health check
	if (pathname === '/api/health') {
		return new Response(JSON.stringify({ status: 'ok' }), {
			headers: { 'Content-Type': 'application/json' },
		})
	}

	// Not found
	return new Response(
		JSON.stringify({
			code: 'NOT_FOUND',
			message: 'Endpoint not found',
		}),
		{
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		}
	)
}

// Export Durable Objects
export { SyncJob } from './durable-objects/SyncJob'
