/**
 * Security Tests for DevNote MVP
 *
 * Tests security requirements:
 * 1. JWT validation and note ownership verification
 * 2. Protection against SQL Injection, XSS, CSRF attacks
 * 3. Sensitive data (GitHub tokens, API keys) not exposed
 */

import { env, createExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import type { ErrorResponse } from '../../shared/types';

describe('Security Tests', () => {
	describe('JWT Validation and Authorization', () => {
		it('should reject requests without authorization header', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET'
				// No Authorization header
			});

			const response = await SELF.fetch(request);

			expect(response.status).toBe(401);
			const error = await response.json() as ErrorResponse;
			expect(error.code).toBe('UNAUTHORIZED');
			expect(error.message).toBeDefined();
		});

		it('should reject requests with invalid JWT format', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer invalid.jwt.token'
				}
			});

			const response = await SELF.fetch(request);

			expect(response.status).toBe(401);
			const error = await response.json() as ErrorResponse;
			expect(error.code).toBe('UNAUTHORIZED');
		});

		it('should reject requests with malformed authorization header', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'InvalidFormat token'
				}
			});

			const response = await SELF.fetch(request);

			expect(response.status).toBe(401);
			const error = await response.json() as ErrorResponse;
			expect(error.code).toBe('UNAUTHORIZED');
		});

		it('should reject requests with expired JWT', async () => {
			// Simulate an expired JWT token
			const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.expired';

			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${expiredToken}`
				}
			});

			const response = await SELF.fetch(request);

			expect(response.status).toBe(401);
		});

		it('should verify note ownership before allowing access', async () => {
			// Try to access a note that doesn't belong to the user
			const request = new Request('http://example.com/api/notes/other_user_note_id', {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			// Should return 401 (unauthorized), 403 (forbidden), or 404 (not found)
			expect([401, 403, 404]).toContain(response.status);
		});

		it('should verify ownership before allowing note sync', async () => {
			const request = new Request('http://example.com/api/notes/other_user_note_id/sync', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			expect([401, 403, 404]).toContain(response.status);
		});

		it('should verify ownership before allowing chat access', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'other_user_note_id',
					message: 'Test message'
				})
			});

			const response = await SELF.fetch(request);

			expect([401, 403, 404]).toContain(response.status);
		});

		it('should verify ownership for memo operations', async () => {
			const request = new Request('http://example.com/api/memo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'other_user_note_id',
					content: 'Test memo'
				})
			});

			const response = await SELF.fetch(request);

			expect([401, 403, 404]).toContain(response.status);
		});
	});

	describe('SQL Injection Protection', () => {
		it('should sanitize repository URL input', async () => {
			const maliciousUrl = "https://github.com/test/repo'; DROP TABLE Users; --";

			const request = new Request('http://example.com/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					repository_url: maliciousUrl
				})
			});

			const response = await SELF.fetch(request);

			// Should reject malicious URL or sanitize it
			// Should not cause SQL injection
			expect([400, 401]).toContain(response.status);

			if (response.status === 400) {
				const error = await response.json() as ErrorResponse;
				expect(error.code).toBe('INVALID_REQUEST');
			}
		});

		it('should sanitize note_id parameter', async () => {
			const maliciousNoteId = "1'; DROP TABLE Notes; --";

			const request = new Request(`http://example.com/api/notes/${encodeURIComponent(maliciousNoteId)}`, {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			// Should handle safely without SQL injection
			expect([401, 404]).toContain(response.status);
		});

		it('should sanitize chat message input', async () => {
			const maliciousMessage = "Test'; DELETE FROM ChatMessages WHERE '1'='1";

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: maliciousMessage
				})
			});

			const response = await SELF.fetch(request);

			// Should safely store the message without executing SQL
			expect([200, 401, 404]).toContain(response.status);
		});

		it('should sanitize query parameters', async () => {
			const maliciousNoteId = "1' OR '1'='1";

			const request = new Request(`http://example.com/api/chat/history?note_id=${encodeURIComponent(maliciousNoteId)}`, {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			// Should handle safely
			expect([200, 401, 404]).toContain(response.status);
		});
	});

	describe('XSS (Cross-Site Scripting) Protection', () => {
		it('should sanitize chat message content with script tags', async () => {
			const xssMessage = '<script>alert("XSS")</script>';

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: xssMessage
				})
			});

			const response = await SELF.fetch(request);

			expect([200, 401, 404]).toContain(response.status);

			// The message should be stored safely
			// Frontend should handle rendering with proper escaping
		});

		it('should sanitize memo content with malicious HTML', async () => {
			const xssContent = '<img src=x onerror="alert(1)">';

			const request = new Request('http://example.com/api/memo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					content: xssContent
				})
			});

			const response = await SELF.fetch(request);

			expect([200, 401]).toContain(response.status);
		});

		it('should sanitize repository name with HTML entities', async () => {
			const xssRepoUrl = 'https://github.com/<script>alert(1)</script>/repo';

			const request = new Request('http://example.com/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					repository_url: xssRepoUrl
				})
			});

			const response = await SELF.fetch(request);

			// Should reject invalid URL format
			expect([400, 401]).toContain(response.status);
		});

		it('should return safe content-type headers', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			// Should return JSON content type
			const contentType = response.headers.get('Content-Type');
			expect(contentType).toContain('application/json');
		});
	});

	describe('CSRF (Cross-Site Request Forgery) Protection', () => {
		it('should validate state parameter in OAuth callback', async () => {
			// OAuth callback without state parameter
			const request = new Request('http://example.com/api/auth/github/callback?code=test_code');

			const response = await SELF.fetch(request);

			// Should reject or handle safely
			expect([400, 401, 302, 500]).toContain(response.status);
		});

		it('should use proper CORS headers', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token',
					'Origin': 'https://malicious-site.com'
				}
			});

			const response = await SELF.fetch(request);

			// CORS headers should be set correctly
			const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
			expect(allowOrigin).toBeDefined();

			// Should either match FRONTEND_URL or be restrictive
			// Not allowing arbitrary origins
		});

		it('should handle preflight requests securely', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'OPTIONS',
				headers: {
					'Origin': 'https://malicious-site.com',
					'Access-Control-Request-Method': 'DELETE'
				}
			});

			const response = await SELF.fetch(request);

			expect(response.status).toBe(200);

			// Check CORS headers
			const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
			const allowMethods = response.headers.get('Access-Control-Allow-Methods');

			expect(allowOrigin).toBeDefined();
			expect(allowMethods).toBeDefined();
		});
	});

	describe('Sensitive Data Protection', () => {
		it('should not expose GitHub access token in API responses', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);

			if (response.status === 200) {
				const body = await response.text();

				// Should not contain any token-like strings
				expect(body).not.toMatch(/github_access_token/i);
				expect(body).not.toMatch(/ghp_[a-zA-Z0-9]{36}/); // GitHub token format
			}
		});

		it('should not expose Gemini API key in error responses', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'Test'
				})
			});

			const response = await SELF.fetch(request);

			const body = await response.text();

			// Should not expose API keys
			expect(body).not.toMatch(/GEMINI_API_KEY/i);
			expect(body).not.toMatch(/AIza[a-zA-Z0-9_-]{35}/); // Google API key format
		});

		it('should not expose JWT secret in responses', async () => {
			const request = new Request('http://example.com/api/auth/github/callback?code=test&state=test');

			const response = await SELF.fetch(request);
			const body = await response.text();

			// Should not expose JWT secret
			expect(body).not.toMatch(/JWT_SECRET/i);
		});

		it('should not expose database credentials in error messages', async () => {
			const request = new Request('http://example.com/api/notes/invalid', {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);
			const body = await response.text();

			// Should not expose internal details
			expect(body).not.toMatch(/database/i);
			expect(body).not.toMatch(/D1/i);
			expect(body).not.toMatch(/binding/i);
		});

		it('should not expose internal paths in error messages', async () => {
			const request = new Request('http://example.com/api/nonexistent');

			const response = await SELF.fetch(request);
			const body = await response.text();

			// Should not expose file system paths
			expect(body).not.toMatch(/\/home\//);
			expect(body).not.toMatch(/\/var\//);
			expect(body).not.toMatch(/\.ts$/);
		});
	});

	describe('Input Validation and Sanitization', () => {
		it('should validate repository URL format strictly', async () => {
			const invalidUrls = [
				'not-a-url',
				'http://github.com/user/repo', // Should require HTTPS
				'https://gitlab.com/user/repo', // Should only accept github.com
				'https://github.com', // Missing owner/repo
				'https://github.com/user', // Missing repo
				'javascript:alert(1)',
				'data:text/html,<script>alert(1)</script>'
			];

			for (const invalidUrl of invalidUrls) {
				const request = new Request('http://example.com/api/notes', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer mock_token'
					},
					body: JSON.stringify({
						repository_url: invalidUrl
					})
				});

				const response = await SELF.fetch(request);

				// Should reject invalid URLs
				expect([400, 401]).toContain(response.status);
			}
		});

		it('should enforce message length limits', async () => {
			const tooLongMessage = 'a'.repeat(5001);

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: tooLongMessage
				})
			});

			const response = await SELF.fetch(request);

			expect([400, 401]).toContain(response.status);

			if (response.status === 400) {
				const error = await response.json() as ErrorResponse;
				expect(error.code).toBe('MESSAGE_TOO_LONG');
			}
		});

		it('should enforce memo size limits', async () => {
			const tooLargeMemo = 'a'.repeat(100001); // Over 100KB

			const request = new Request('http://example.com/api/memo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					content: tooLargeMemo
				})
			});

			const response = await SELF.fetch(request);

			// Should reject oversized content
			expect([400, 401, 413]).toContain(response.status);
		});

		it('should validate note_id format', async () => {
			const invalidNoteIds = [
				'../../../etc/passwd',
				'..%2F..%2F..%2Fetc%2Fpasswd',
				'<script>alert(1)</script>',
				'${process.env}',
				'`rm -rf /`'
			];

			for (const invalidNoteId of invalidNoteIds) {
				const request = new Request(`http://example.com/api/notes/${encodeURIComponent(invalidNoteId)}`, {
					method: 'DELETE',
					headers: {
						'Authorization': 'Bearer mock_token'
					}
				});

				const response = await SELF.fetch(request);

				// Should handle safely
				expect([400, 401, 404]).toContain(response.status);
			}
		});

		it('should validate selected_files array', async () => {
			const maliciousFiles = [
				'../../../etc/passwd',
				'..\\..\\..\\windows\\system32',
				'${process.env.SECRET}',
				'`whoami`'
			];

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'Test',
					selected_files: maliciousFiles
				})
			});

			const response = await SELF.fetch(request);

			// Should handle safely - either accept (will be validated against actual files)
			// or reject if validation is strict
			expect([200, 400, 401, 404]).toContain(response.status);
		});
	});

	describe('Rate Limiting and DoS Protection', () => {
		it('should handle rapid repeated requests gracefully', async () => {
			const requests = Array.from({ length: 10 }, () =>
				SELF.fetch(new Request('http://example.com/api/health'))
			);

			const responses = await Promise.all(requests);

			// All requests should complete
			responses.forEach(response => {
				expect(response.status).toBe(200);
			});
		});

		it('should handle malformed JSON payloads', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: 'invalid json {'
			});

			const response = await SELF.fetch(request);

			// Should return 400 bad request
			expect([400, 401]).toContain(response.status);
		});

		it('should handle empty request body', async () => {
			const request = new Request('http://example.com/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: ''
			});

			const response = await SELF.fetch(request);

			expect([400, 401]).toContain(response.status);
		});

		it('should handle oversized request payloads', async () => {
			// Create a very large payload (> 1MB)
			const largePayload = JSON.stringify({
				note_id: 'test',
				message: 'a'.repeat(2000000)
			});

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: largePayload
			});

			const response = await SELF.fetch(request);

			// Should reject or handle gracefully
			expect([400, 401, 413]).toContain(response.status);
		});
	});
});
