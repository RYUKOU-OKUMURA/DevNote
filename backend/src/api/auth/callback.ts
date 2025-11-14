import type { Env, User } from '../../../../shared/types'
import { generateJWT } from '../../lib/jwt'
import { encryptToken } from '../../lib/crypto'

interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

interface GitHubUserResponse {
  id: number
  login: string
  email: string | null
}

/**
 * GitHub OAuth Callback Endpoint
 * Handles the callback from GitHub OAuth and exchanges code for access token
 */
export async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    // Validate parameters
    if (!code || !state) {
      return redirectToFrontendWithError('Missing code or state parameter')
    }

    // Verify state parameter (CSRF protection)
    const storedState = await env.KV.get(`oauth:state:${state}`)
    if (!storedState) {
      return redirectToFrontendWithError('Invalid or expired state parameter')
    }

    // Delete used state
    await env.KV.delete(`oauth:state:${state}`)

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = (await tokenResponse.json()) as GitHubTokenResponse
    const accessToken = tokenData.access_token

    // Get user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user information')
    }

    const githubUser = (await userResponse.json()) as GitHubUserResponse

    // Encrypt access token before storing
    const encryptedToken = await encryptToken(accessToken, env.JWT_SECRET)

    // Check if user already exists
    const existingUser = await env.DB.prepare('SELECT * FROM Users WHERE github_username = ?')
      .bind(githubUser.login)
      .first<User>()

    let userId: string

    if (existingUser) {
      // Update existing user
      userId = existingUser.id
      await env.DB.prepare('UPDATE Users SET github_access_token = ? WHERE id = ?')
        .bind(encryptedToken, userId)
        .run()
    } else {
      // Create new user
      userId = crypto.randomUUID()
      await env.DB.prepare(
        'INSERT INTO Users (id, github_username, github_access_token) VALUES (?, ?, ?)'
      )
        .bind(userId, githubUser.login, encryptedToken)
        .run()
    }

    // Generate JWT token
    const jwt = await generateJWT(userId, env.JWT_SECRET)

    // Redirect to frontend with JWT token
    const redirectUrl = new URL('/dashboard', env.FRONTEND_URL)
    redirectUrl.searchParams.set('token', jwt)

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
      },
    })
  } catch (error) {
    console.error('GitHub callback error:', error)
    return redirectToFrontendWithError(
      error instanceof Error ? error.message : 'Authentication failed'
    )
  }
}

/**
 * Redirect to frontend with error message
 */
function redirectToFrontendWithError(error: string): Response {
  const redirectUrl = new URL('/', process.env.FRONTEND_URL || 'http://localhost:5173')
  redirectUrl.searchParams.set('error', error)

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
    },
  })
}
