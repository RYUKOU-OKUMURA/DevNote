# DevNote

GitHubリポジトリを対象とした、AI対話型コード調査ワークスペースアプリケーション

## 概要

DevNoteは、指定したGitHubリポジトリをAIが学習し、**Notebook LM風の3カラムワークスペース**で対話的にコードを探索できるRAG（検索拡張生成）アプリケーションです。

### 主な機能

- **リポジトリノート管理**: GitHubリポジトリごとに独立したワークスペースを作成
- **3カラムUI**: ファイルツリー、チャット、メモパッドを1画面に統合
- **AI対話**: Gemini File Searchによる高精度な回答と引用表示
- **コンテキスト指定**: 特定ファイルを選択して質問可能
- **永続化**: チャット履歴とメモをリポジトリごとに保存

## 技術スタック

### フロントエンド
- React 19
- React Router v7
- Vite
- TypeScript

### バックエンド
- Cloudflare Workers
- Cloudflare D1 (SQLite)
- Cloudflare KV
- Cloudflare R2
- Durable Objects

### AI/RAG
- Google Gemini API (File Search Tool)

### 認証
- GitHub OAuth

## プロジェクト構造

```
DevNote/
├── frontend/           # Reactフロントエンド
│   ├── src/
│   │   ├── components/ # UIコンポーネント
│   │   ├── pages/      # ページコンポーネント
│   │   ├── lib/        # ユーティリティ
│   │   └── types/      # 型定義
│   └── package.json
├── backend/            # Cloudflare Workers
│   ├── src/
│   │   ├── api/        # APIハンドラ
│   │   ├── lib/        # ビジネスロジック
│   │   ├── durable-objects/ # Durable Objects
│   │   └── index.ts    # メインエントリポイント
│   ├── test/           # テストコード
│   ├── wrangler.jsonc  # Cloudflare Workers設定
│   └── package.json
├── shared/             # 共有型定義
│   └── types.ts
└── schema.sql          # D1データベーススキーマ
```

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- Cloudflareアカウント
- GitHubアカウント（OAuth App設定済み）
- Google Cloud Platform アカウント（Gemini API有効化済み）

### 1. リポジトリのクローン

```bash
git clone https://github.com/RYUKOU-OKUMURA/DevNote.git
cd DevNote
```

### 2. 依存関係のインストール

```bash
# フロントエンド
cd frontend
npm install

# バックエンド
cd ../backend
npm install
```

### 3. 環境変数の設定

#### GitHub OAuth Appの作成

1. GitHub Settings → Developer settings → OAuth Apps
2. 新規OAuth Appを作成
   - Application name: DevNote (任意)
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:8787/api/auth/github/callback`
3. Client IDとClient Secretを控える

#### Gemini APIキーの取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. API Keyを作成

#### バックエンド環境変数の設定

```bash
cd backend
cp .dev.vars.example .dev.vars
```

`.dev.vars`ファイルを編集して以下の値を設定:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT Secret (任意の長い文字列)
JWT_SECRET=your_random_secret_key_minimum_32_characters

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Frontend URL (開発環境)
FRONTEND_URL=http://localhost:5173
```

### 4. Cloudflareリソースの作成（開発環境）

#### D1データベースの作成

```bash
cd backend
npx wrangler d1 create devnote-db
```

出力されたdatabase_idを`wrangler.jsonc`の`d1_databases[0].database_id`に設定してください。

#### スキーマの適用

```bash
npx wrangler d1 execute devnote-db --local --file=../schema.sql
npx wrangler d1 execute devnote-db --remote --file=../schema.sql
```

#### KVの作成

```bash
npx wrangler kv:namespace create "KV"
```

出力されたidを`wrangler.jsonc`の`kv_namespaces[0].id`に設定してください。

#### R2バケットの作成

```bash
npx wrangler r2 bucket create devnote-storage
```

### 5. 開発サーバーの起動

ターミナルを2つ開いて、それぞれで実行:

```bash
# ターミナル1: バックエンド
cd backend
npm run dev
# => http://localhost:8787

# ターミナル2: フロントエンド
cd frontend
npm run dev
# => http://localhost:5173
```

ブラウザで `http://localhost:5173` にアクセスしてください。

## テスト

### バックエンドテストの実行

```bash
cd backend
npm test
```

テストファイル:
- `test/e2e.spec.ts` - E2Eテスト
- `test/security.spec.ts` - セキュリティテスト
- `test/performance.spec.ts` - パフォーマンステスト

## デプロイ

本番環境へのデプロイ手順は [DEPLOY.md](./DEPLOY.md) を参照してください。

## API エンドポイント

### 認証
- `GET /api/auth/github/login` - GitHub OAuthログイン開始
- `GET /api/auth/github/callback` - GitHub OAuthコールバック
- `POST /api/auth/logout` - ログアウト

### ノート管理
- `GET /api/notes` - ノート一覧取得
- `POST /api/notes` - ノート作成
- `DELETE /api/notes/:id` - ノート削除
- `POST /api/notes/:id/sync` - ノート再同期
- `GET /api/notes/inactive` - 非アクティブノート一覧

### チャット
- `POST /api/chat` - メッセージ送信（ストリーミング）
- `GET /api/chat/history` - チャット履歴取得

### メモ
- `GET /api/memo` - メモ取得
- `POST /api/memo` - メモ保存
- `POST /api/memo/pin` - メッセージをメモにピン留め

### メトリクス
- `GET /api/metrics/usage` - 使用状況メトリクス取得

## 主要な設計判断

### Gemini File Searchの採用

要件定義（`要件定義.md`）とPoC検証結果（`gemini-poc-results.md`）に基づき、以下の理由でGemini File Searchを採用しています:

- **メタデータフィルタリング**: ファイル指定時の検索精度95-100%
- **引用機能**: 回答の根拠となるファイルを自動で提示
- **File Store**: チャンキング、Embedding、ベクトルDB管理が不要
- **コスト効率**: 独自実装と比較して開発・運用コストが低い

### 3カラムレイアウト

Notebook LMのUXを参考に、以下の3要素を統合:

1. **左カラム（ソース）**: ファイルツリー
2. **中央カラム（対話）**: チャット
3. **右カラム（知見）**: メモパッド

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

問題が発生した場合は、[GitHub Issues](https://github.com/RYUKOU-OKUMURA/DevNote/issues)で報告してください。
