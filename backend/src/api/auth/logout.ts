import type { Env } from '../../../../shared/types'

/**
 * Logout Endpoint
 * Clears the user's session and redirects to the homepage
 */
export async function handleLogout(request: Request, env: Env): Promise<Response> {
  try {
    // In a stateless JWT system, logout is primarily handled client-side
    // by clearing the JWT token. This endpoint just provides a redirect.

    // Redirect to frontend homepage
    return new Response(null, {
      status: 302,
      headers: {
        Location: env.FRONTEND_URL,
      },
    })
  } catch (error) {
    console.error('Logout error:', error)
    return new Response(
      JSON.stringify({
        code: 'LOGOUT_ERROR',
        message: 'Failed to logout',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
