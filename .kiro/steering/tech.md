# Technology Stack

## Architecture

**Serverless-first JAMstack**: Cloudflare Pagesでホスティングし、Workers経由でGitHub・Gemini APIと連携するフルサーバーレスアーキテクチャ。

## Core Technologies

- **Language**: TypeScript (フロントエンド・バックエンド共通)
- **Frontend Framework**: React (Vite または Next.js)
- **Backend Runtime**: Cloudflare Workers / Pages Functions
- **LLM/RAG**: Google Gemini API (File Search Tool)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV / R2 (メモパッド・キャッシュ)

## Key Libraries

- **認証**: GitHub OAuth (Cloudflare Workers OAuth実装)
- **UI**: 3カラムレイアウト対応のReactコンポーネント
- **API Client**: Gemini API SDK, GitHub Octokit

## Development Standards

### Type Safety
- TypeScript strict mode 有効
- フロントエンド・バックエンド間のスキーマ共有（型定義を統一）
- `any` は原則禁止

### Code Quality
- ESLint + Prettier でコード整形
- Cloudflare Workersの制約（Web API準拠、Node.js非互換）を考慮

### Testing
- フロントエンドは Vitest + React Testing Library
- バックエンドはCloudflare Workers用のテストフレームワーク（Miniflare / Vitest）

## Development Environment

### Required Tools
- Node.js 20+ (Cloudflare Workers互換性)
- Wrangler CLI (Cloudflare開発ツール)
- GitHub OAuth App登録（開発環境用）

### Common Commands
```bash
# Dev: npm run dev (Vite) + wrangler dev (Workers)
# Build: npm run build
# Deploy: wrangler deploy
# Test: npm test
```

## Key Technical Decisions

### Gemini File Search採用理由
- チャンキング・Embedding・ベクトルDB管理をすべてGemini API側に一任
- カスタムRAGスタックと比較して実装コスト・運用負荷を大幅削減
- File Store と 1リポジトリを1対1で紐づけることでコンテキスト分離を実現

### Cloudflare Workersエコシステム選定
- D1（SQLite）でユーザー・ノート・チャット履歴を管理
- R2で巨大リポジトリの部分キャッシュを保存（将来的な差分同期用）
- KVでメモパッドやセッション情報を高速アクセス
- Durable Objectで同期ジョブの進捗・リトライを管理

### セキュリティ設計
- GitHubトークンとGemini APIキーはWorkers環境変数で暗号化保存
- すべてのAPI呼び出しでJWT検証 + ノート所有権チェック
- プライベートリポジトリのトークン有効期限切れ時は `Auth Required` ステータスで再認証要求

---
_created: 2025-11-15_
