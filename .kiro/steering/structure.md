# Project Structure

## Organization Philosophy

**ドメイン駆動 + 機能ファースト**: ユーザー認証、ダッシュボード、ワークスペースといった機能単位でディレクトリを分割し、各機能の依存関係を明確化。フロントエンドとバックエンド（Workers）は別リポジトリまたは monorepo で管理。

## Directory Patterns

### Frontend Structure
**Location**: `/src/`
**Purpose**: React アプリケーションのソースコード
**Example**:
```
/src/
  /pages/          # ページコンポーネント (/, /dashboard, /workspace/:id)
  /components/     # 共通UIコンポーネント (Button, FileTree, ChatBox, MemoPad)
  /features/       # 機能単位のロジック (auth, notes, chat, memo)
  /lib/            # APIクライアント、ユーティリティ
  /types/          # TypeScript型定義
```

### Backend Structure (Workers)
**Location**: `/workers/` (または `/api/`)
**Purpose**: Cloudflare Workers のエンドポイント
**Example**:
```
/workers/
  /auth/           # GitHub OAuth ハンドラ
  /notes/          # ノート作成・同期・削除API
  /chat/           # Gemini API連携チャットエンドポイント
  /sync/           # リポジトリ同期・インデックス処理 (Durable Object)
  /lib/            # 共通ロジック (GitHub API, Gemini API, D1アクセス)
```

### Shared Types
**Location**: `/shared/`
**Purpose**: フロントエンド・バックエンド共通の型定義
**Example**:
```
/shared/
  /types/          # API リクエスト・レスポンススキーマ
  /constants/      # 定数 (ステータス値、制限値)
```

## Naming Conventions

- **Files (React)**: PascalCase for components (`FileTree.tsx`, `ChatBox.tsx`)
- **Files (Workers)**: kebab-case for endpoints (`sync-job.ts`, `github-oauth.ts`)
- **Functions**: camelCase (`fetchRepository`, `indexFilesToGemini`)
- **Types**: PascalCase (`Note`, `ChatMessage`, `SyncStatus`)

## Import Organization

```typescript
// 外部ライブラリ
import { useState } from 'react'

// 絶対パス (path alias)
import { FileTree } from '@/components/FileTree'
import { useNotes } from '@/features/notes/useNotes'

// 相対パス (同一ディレクトリ内)
import { formatDate } from './utils'
```

**Path Aliases**:
- `@/`: プロジェクトルート (`/src/`)
- `@shared/`: 共有型定義 (`/shared/`)

## Code Organization Principles

### 依存方向
- **Pages → Features → Components → Lib**
- Pages は最上位レイヤーで、Features や Components を組み合わせる
- Components は汎用UI部品で、ビジネスロジックを持たない
- Features は特定機能のロジック（カスタムフック、API呼び出し）を集約

### ワークスペース構成（3カラムUI）
- 左カラム (ソース): `<FileTree />` コンポーネント
- 中央カラム (対話): `<ChatBox />` + `<ChatHistory />`
- 右カラム (知見): `<MemoPad />`
- レイアウト管理: `<WorkspaceLayout />` で3カラム比率・レスポンシブ対応

### データフロー
- **Frontend → Workers → External APIs (GitHub, Gemini)**
- フロントエンドはWorkers経由でのみ外部APIにアクセス（直接呼び出しは禁止）
- Workers は JWT 検証後、ユーザーIDとノートIDの所有権を確認

### 状態管理
- **ノート一覧・選択状態**: React Context または Zustand
- **チャット履歴**: Workers から取得し、ローカルステート + D1 永続化
- **メモパッド**: debounce 付き自動保存で KV または D1 に同期

---
_created: 2025-11-15_
