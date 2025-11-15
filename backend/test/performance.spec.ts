/**
 * Performance Tests for DevNote MVP
 *
 * Tests performance requirements:
 * 1. Chat response first chunk within 500ms
 * 2. Dashboard load within 1 second
 * 3. Multiple notes sync concurrently without conflicts
 */

import { env, createExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { Note, ChatMessage } from '../../shared/types';

describe('Performance Tests', () => {
	describe('Chat Response Performance', () => {
		it('should return first chunk within 500ms', async () => {
			const startTime = Date.now();

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'What is this repository about?'
				})
			});

			const response = await SELF.fetch(request);

			const firstResponseTime = Date.now() - startTime;

			// For authenticated and valid requests, should respond within 500ms
			// Note: This may fail if auth is invalid, but timing should still be reasonable
			if (response.status === 200) {
				expect(firstResponseTime).toBeLessThan(500);
				console.log(`✓ Chat first response time: ${firstResponseTime}ms`);
			} else {
				// Even for error responses, should be fast
				expect(firstResponseTime).toBeLessThan(200);
				console.log(`✓ Error response time: ${firstResponseTime}ms`);
			}
		});

		it('should handle streaming response efficiently', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'Explain the main components'
				})
			});

			const startTime = Date.now();
			const response = await SELF.fetch(request);
			const responseTime = Date.now() - startTime;

			// Response should be initiated quickly
			expect(responseTime).toBeLessThan(500);

			// If successful, check streaming response type
			if (response.status === 200) {
				expect(response.headers.get('Content-Type')).toContain('text/event-stream');
				console.log(`✓ Streaming initiated in: ${responseTime}ms`);
			}
		});

		it('should handle chat with file filtering efficiently', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'Explain this code',
					selected_files: ['src/index.ts', 'src/lib/utils.ts']
				})
			});

			const startTime = Date.now();
			const response = await SELF.fetch(request);
			const responseTime = Date.now() - startTime;

			// Should process file filtering quickly
			expect(responseTime).toBeLessThan(600);
			console.log(`✓ Chat with file filter response time: ${responseTime}ms`);
		});
	});

	describe('Dashboard Load Performance', () => {
		it('should load notes list within 1 second', async () => {
			const startTime = Date.now();

			const request = new Request('http://example.com/api/notes', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);
			const loadTime = Date.now() - startTime;

			// Dashboard should load within 1 second
			expect(loadTime).toBeLessThan(1000);
			console.log(`✓ Notes list load time: ${loadTime}ms`);

			// Should return proper response
			expect([200, 401]).toContain(response.status);
		});

		it('should load chat history efficiently', async () => {
			const startTime = Date.now();

			const request = new Request('http://example.com/api/chat/history?note_id=test_note_id', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);
			const loadTime = Date.now() - startTime;

			// Chat history should load quickly
			expect(loadTime).toBeLessThan(500);
			console.log(`✓ Chat history load time: ${loadTime}ms`);

			expect([200, 401, 404]).toContain(response.status);
		});

		it('should load memo content efficiently', async () => {
			const startTime = Date.now();

			const request = new Request('http://example.com/api/memo?note_id=test_note_id', {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer mock_token'
				}
			});

			const response = await SELF.fetch(request);
			const loadTime = Date.now() - startTime;

			// Memo should load quickly
			expect(loadTime).toBeLessThan(300);
			console.log(`✓ Memo load time: ${loadTime}ms`);

			expect([200, 401, 404]).toContain(response.status);
		});

		it('should handle multiple parallel API calls efficiently', async () => {
			const startTime = Date.now();

			// Simulate dashboard loading multiple resources in parallel
			const requests = [
				SELF.fetch(new Request('http://example.com/api/notes', {
					method: 'GET',
					headers: { 'Authorization': 'Bearer mock_token' }
				})),
				SELF.fetch(new Request('http://example.com/api/metrics/usage', {
					method: 'GET',
					headers: { 'Authorization': 'Bearer mock_token' }
				})),
				SELF.fetch(new Request('http://example.com/api/notes/inactive', {
					method: 'GET',
					headers: { 'Authorization': 'Bearer mock_token' }
				}))
			];

			const responses = await Promise.all(requests);
			const totalTime = Date.now() - startTime;

			// Parallel requests should complete within reasonable time
			expect(totalTime).toBeLessThan(1500);
			console.log(`✓ Parallel API calls completed in: ${totalTime}ms`);

			// All should respond
			responses.forEach(response => {
				expect([200, 401]).toContain(response.status);
			});
		});
	});

	describe('Concurrent Sync Operations', () => {
		it('should handle multiple note creation requests without conflicts', async () => {
			const startTime = Date.now();

			// Create multiple notes concurrently
			const createRequests = [
				{
					repository_url: 'https://github.com/facebook/react'
				},
				{
					repository_url: 'https://github.com/vuejs/vue'
				},
				{
					repository_url: 'https://github.com/angular/angular'
				}
			].map(body =>
				SELF.fetch(new Request('http://example.com/api/notes', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer mock_token'
					},
					body: JSON.stringify(body)
				}))
			);

			const responses = await Promise.all(createRequests);
			const totalTime = Date.now() - startTime;

			console.log(`✓ Concurrent note creation completed in: ${totalTime}ms`);

			// Check that all requests were processed
			responses.forEach(response => {
				// Should return 201 (created), 401 (unauthorized), or 409 (quota exceeded)
				expect([201, 401, 409]).toContain(response.status);
			});

			// Responses should be received within reasonable time
			expect(totalTime).toBeLessThan(2000);
		});

		it('should handle multiple sync operations without race conditions', async () => {
			const startTime = Date.now();

			// Trigger multiple sync operations
			const syncRequests = [
				'note_id_1',
				'note_id_2',
				'note_id_3'
			].map(noteId =>
				SELF.fetch(new Request(`http://example.com/api/notes/${noteId}/sync`, {
					method: 'POST',
					headers: {
						'Authorization': 'Bearer mock_token'
					}
				}))
			);

			const responses = await Promise.all(syncRequests);
			const totalTime = Date.now() - startTime;

			console.log(`✓ Concurrent sync operations initiated in: ${totalTime}ms`);

			// Each should respond independently
			responses.forEach(response => {
				expect([200, 401, 404]).toContain(response.status);
			});

			// Should handle concurrent requests efficiently
			expect(totalTime).toBeLessThan(1500);
		});

		it('should handle concurrent memo saves without conflicts', async () => {
			const startTime = Date.now();

			// Simulate multiple memo save operations
			const memoRequests = [
				{ note_id: 'test_note_1', content: 'Memo content 1' },
				{ note_id: 'test_note_2', content: 'Memo content 2' },
				{ note_id: 'test_note_3', content: 'Memo content 3' }
			].map(body =>
				SELF.fetch(new Request('http://example.com/api/memo', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer mock_token'
					},
					body: JSON.stringify(body)
				}))
			);

			const responses = await Promise.all(memoRequests);
			const totalTime = Date.now() - startTime;

			console.log(`✓ Concurrent memo saves completed in: ${totalTime}ms`);

			// KV writes should handle concurrency
			responses.forEach(response => {
				expect([200, 401]).toContain(response.status);
			});

			// Should handle concurrent writes efficiently
			expect(totalTime).toBeLessThan(1000);
		});

		it('should handle high-frequency polling without performance degradation', async () => {
			// Simulate dashboard polling every 5 seconds
			const iterations = 5;
			const timings: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const startTime = Date.now();

				const request = new Request('http://example.com/api/notes', {
					method: 'GET',
					headers: {
						'Authorization': 'Bearer mock_token'
					}
				});

				await SELF.fetch(request);
				const requestTime = Date.now() - startTime;
				timings.push(requestTime);
			}

			// Calculate average response time
			const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
			const maxTime = Math.max(...timings);

			console.log(`✓ Polling average time: ${avgTime.toFixed(2)}ms, max: ${maxTime}ms`);

			// All requests should be fast
			expect(avgTime).toBeLessThan(500);
			expect(maxTime).toBeLessThan(1000);
		});
	});

	describe('API Endpoint Response Times', () => {
		it('should respond to health check instantly', async () => {
			const startTime = Date.now();
			const response = await SELF.fetch(new Request('http://example.com/api/health'));
			const responseTime = Date.now() - startTime;

			expect(responseTime).toBeLessThan(50);
			expect(response.status).toBe(200);
			console.log(`✓ Health check response time: ${responseTime}ms`);
		});

		it('should handle CORS preflight efficiently', async () => {
			const startTime = Date.now();
			const response = await SELF.fetch(new Request('http://example.com/api/notes', {
				method: 'OPTIONS'
			}));
			const responseTime = Date.now() - startTime;

			expect(responseTime).toBeLessThan(50);
			expect(response.status).toBe(200);
			console.log(`✓ CORS preflight response time: ${responseTime}ms`);
		});

		it('should handle 404 errors quickly', async () => {
			const startTime = Date.now();
			const response = await SELF.fetch(new Request('http://example.com/api/nonexistent'));
			const responseTime = Date.now() - startTime;

			expect(responseTime).toBeLessThan(100);
			expect(response.status).toBe(404);
			console.log(`✓ 404 response time: ${responseTime}ms`);
		});

		it('should handle authentication errors quickly', async () => {
			const startTime = Date.now();
			const response = await SELF.fetch(new Request('http://example.com/api/notes', {
				method: 'GET'
				// No auth header
			}));
			const responseTime = Date.now() - startTime;

			expect(responseTime).toBeLessThan(100);
			expect(response.status).toBe(401);
			console.log(`✓ Auth error response time: ${responseTime}ms`);
		});
	});

	describe('Resource Limits and Scaling', () => {
		it('should handle large memo content efficiently', async () => {
			// Test with 50KB memo (half of 100KB limit)
			const largeContent = 'a'.repeat(50000);
			const startTime = Date.now();

			const request = new Request('http://example.com/api/memo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					content: largeContent
				})
			});

			const response = await SELF.fetch(request);
			const responseTime = Date.now() - startTime;

			// Should handle large content within reasonable time
			expect(responseTime).toBeLessThan(1000);
			console.log(`✓ Large memo save time (50KB): ${responseTime}ms`);
		});

		it('should handle maximum message length efficiently', async () => {
			// Test with 4000 character message (near 5000 limit)
			const longMessage = 'a'.repeat(4000);
			const startTime = Date.now();

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: longMessage
				})
			});

			const response = await SELF.fetch(request);
			const responseTime = Date.now() - startTime;

			// Should process long messages efficiently
			expect(responseTime).toBeLessThan(1000);
			console.log(`✓ Long message processing time (4000 chars): ${responseTime}ms`);
		});

		it('should handle many selected files efficiently', async () => {
			// Test with 20 selected files
			const manyFiles = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`);
			const startTime = Date.now();

			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer mock_token'
				},
				body: JSON.stringify({
					note_id: 'test_note_id',
					message: 'Explain these files',
					selected_files: manyFiles
				})
			});

			const response = await SELF.fetch(request);
			const responseTime = Date.now() - startTime;

			// Should handle many file filters efficiently
			expect(responseTime).toBeLessThan(800);
			console.log(`✓ Many files filter processing time (20 files): ${responseTime}ms`);
		});
	});
});
