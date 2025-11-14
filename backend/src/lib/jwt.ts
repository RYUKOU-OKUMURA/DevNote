import type { Env } from '../../../shared/types'

interface JWTPayload {
  userId: string
  exp: number
  iat: number
}

/**
 * Generate a JWT token for a user
 * @param userId - User ID
 * @param secret - JWT secret key
 * @returns JWT token string
 */
export async function generateJWT(userId: string, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    userId,
    iat: now,
    exp: now + 60 * 60 * 24, // 24 hours
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const signature = await sign(unsignedToken, secret)
  return `${unsignedToken}.${signature}`
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string
 * @param secret - JWT secret key
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts
    const unsignedToken = `${encodedHeader}.${encodedPayload}`

    // Verify signature
    const expectedSignature = await sign(unsignedToken, secret)
    if (signature !== expectedSignature) {
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

/**
 * Extract JWT from Authorization header
 * @param request - Request object
 * @returns JWT token or null
 */
export function extractJWT(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Verify user ownership of a note
 * @param db - D1 database binding
 * @param userId - User ID from JWT
 * @param noteId - Note ID to verify
 * @returns true if user owns the note
 */
export async function verifyNoteOwnership(
  db: D1Database,
  userId: string,
  noteId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM Notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId)
    .first()

  return result !== null
}

/**
 * Sign data using HMAC SHA-256
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64UrlEncode(signature)
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string
  if (typeof data === 'string') {
    base64 = btoa(data)
  } else {
    const bytes = new Uint8Array(data)
    base64 = btoa(String.fromCharCode(...bytes))
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}
