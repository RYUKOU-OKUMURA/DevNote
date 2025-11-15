import type { Env, ErrorResponse } from '../../../shared/types'
import { ErrorCodes } from '../../../shared/types'
import { extractJWT, verifyJWT } from './jwt'

/**
 * Authenticate request and return user ID
 * @returns User ID if authenticated, null otherwise
 */
export async function authenticate(request: Request, env: Env): Promise<string | null> {
  const token = extractJWT(request)
  if (!token) {
    return null
  }

  const payload = await verifyJWT(token, env.JWT_SECRET)
  if (!payload) {
    return null
  }

  return payload.userId
}

/**
 * Require authentication and return user ID or error response
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ userId: string } | { error: Response }> {
  const userId = await authenticate(request, env)

  if (!userId) {
    const errorResponse: ErrorResponse = {
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Authentication required',
    }

    return {
      error: new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }

  return { userId }
}
