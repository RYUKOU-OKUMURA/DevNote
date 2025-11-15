/**
 * Error handling utilities for rate limits and API errors
 */

import { ErrorResponse, ErrorCodes } from '../../../shared/types'

/**
 * Check if error is a GitHub rate limit error
 */
export function isGitHubRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403 || (error as { status: number }).status === 429
  }
  return false
}

/**
 * Check if error is a Gemini rate limit error
 */
export function isGeminiRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return false
}

/**
 * Extract retry-after header from error
 */
export function getRetryAfter(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: Record<string, string> }).headers
    const retryAfter = headers['retry-after'] || headers['Retry-After']
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10)
      return isNaN(seconds) ? undefined : seconds
    }
  }
  return undefined
}

/**
 * Create a GitHub rate limit error response
 */
export function createGitHubRateLimitError(retryAfter?: number): ErrorResponse {
  return {
    code: ErrorCodes.GITHUB_RATE_LIMIT,
    message: retryAfter
      ? `GitHub API rate limit exceeded. Please try again in ${retryAfter} seconds.`
      : 'GitHub API rate limit exceeded. Please try again later.',
    retryAfter,
  }
}

/**
 * Create a Gemini rate limit error response
 */
export function createGeminiRateLimitError(retryAfter?: number): ErrorResponse {
  return {
    code: ErrorCodes.GEMINI_RATE_LIMIT,
    message: retryAfter
      ? `Gemini API rate limit exceeded. Please try again in ${retryAfter} seconds.`
      : 'Gemini API rate limit exceeded. Please try again later.',
    retryAfter,
  }
}

/**
 * Create a repository too large error response
 */
export function createRepositoryTooLargeError(size?: number): ErrorResponse {
  return {
    code: ErrorCodes.REPOSITORY_TOO_LARGE,
    message:
      'Repository exceeds the 500MB size limit. ' +
      'Please consider using partial sync or specifying target directories.',
    details: size ? { sizeInBytes: size } : undefined,
  }
}

/**
 * Create a File Store limit error response
 */
export function createFileStoreLimitError(): ErrorResponse {
  return {
    code: ErrorCodes.GEMINI_FILE_STORE_LIMIT,
    message:
      'Gemini File Store limit reached. ' +
      'Please delete some existing notes or contact support for higher limits.',
  }
}

/**
 * Create a GitHub access denied error response
 */
export function createGitHubAccessDeniedError(): ErrorResponse {
  return {
    code: ErrorCodes.GITHUB_ACCESS_DENIED,
    message:
      'GitHub access token is invalid or expired. ' +
      'Please re-authenticate by clicking the "Re-authenticate" button.',
  }
}

/**
 * Handle API error and create appropriate error response
 */
export function handleApiError(error: unknown, defaultCode = ErrorCodes.INTERNAL_ERROR): ErrorResponse {
  // GitHub rate limit
  if (isGitHubRateLimitError(error)) {
    const retryAfter = getRetryAfter(error)
    return createGitHubRateLimitError(retryAfter)
  }

  // Gemini rate limit
  if (isGeminiRateLimitError(error)) {
    const retryAfter = getRetryAfter(error)
    return createGeminiRateLimitError(retryAfter)
  }

  // GitHub access denied
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 401 || status === 403) {
      return createGitHubAccessDeniedError()
    }
  }

  // Default error
  return {
    code: defaultCode,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    details: error instanceof Error ? error.stack : undefined,
  }
}
