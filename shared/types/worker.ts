// Cloudflare Workers specific types (backend only)

// Environment variables for Cloudflare Workers
export interface Env {
  // Bindings
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  SYNC_JOB: DurableObjectNamespace

  // Environment variables
  FRONTEND_URL: string

  // Secrets
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  JWT_SECRET: string
  GEMINI_API_KEY: string
  ENCRYPTION_SECRET: string
}
