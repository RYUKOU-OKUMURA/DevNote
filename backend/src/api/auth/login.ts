import type { Env } from '../../../../shared/types'

/**
 * GitHub OAuth Login Endpoint
 * Redirects to GitHub OAuth authorization page
 */
export async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  try {
    // Generate random state parameter for CSRF protection
    const state = crypto.randomUUID()

    // Store state in KV with 10-minute expiration
    await env.KV.put(`oauth:state:${state}`, 'valid', {
      expirationTtl: 600, // 10 minutes
    })

    // Build GitHub OAuth authorization URL
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${new URL(request.url).origin}/api/auth/github/callback`,
      scope: 'repo user:email',
      state,
    })

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
      },
    })
  } catch (error) {
    console.error('GitHub login error:', error)
    return new Response(
      JSON.stringify({
        code: 'GITHUB_LOGIN_ERROR',
        message: 'Failed to initiate GitHub OAuth',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
