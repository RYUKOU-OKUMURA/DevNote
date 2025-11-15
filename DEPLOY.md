# DevNote デプロイガイド

このドキュメントでは、DevNoteを本番環境にデプロイする手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [GitHub OAuth Appの設定](#github-oauth-appの設定)
3. [Cloudflareリソースの作成](#cloudflareリソースの作成)
4. [Secrets の設定](#secretsの設定)
5. [wrangler.jsoncの設定](#wranglerjsoncの設定)
6. [バックエンドのデプロイ](#バックエンドのデプロイ)
7. [フロントエンドのデプロイ](#フロントエンドのデプロイ)
8. [動作確認](#動作確認)
9. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

- Cloudflareアカウント（Workers Paidプラン推奨）
- GitHubアカウント
- Google Cloud Platform アカウント（Gemini API有効化済み）
- Node.js 18以上
- Wrangler CLI (`npm install -g wrangler`)

---

## GitHub OAuth Appの設定

### 1. OAuth Appの作成

1. GitHubにログインし、[Developer Settings](https://github.com/settings/developers) にアクセス
2. "OAuth Apps" → "New OAuth App" をクリック
3. 以下の情報を入力:
   - **Application name**: `DevNote` (任意)
   - **Homepage URL**: `https://your-domain.com` (本番環境のURL)
   - **Authorization callback URL**: `https://your-worker.your-subdomain.workers.dev/api/auth/github/callback`
     - または独自ドメインの場合: `https://api.your-domain.com/api/auth/github/callback`
   - **Application description**: (任意)

4. "Register application" をクリック
5. **Client ID** と **Client Secret** を控える

### 2. スコープの確認

DevNoteは以下のGitHubスコープを要求します:
- `repo` - プライベートリポジトリへのアクセス
- `read:user` - ユーザー情報の取得

---

## Cloudflareリソースの作成

### 1. Cloudflareにログイン

```bash
wrangler login
```

### 2. D1データベースの作成

```bash
cd backend
wrangler d1 create devnote-db
```

出力例:
```
✅ Successfully created DB 'devnote-db'

[[d1_databases]]
binding = "DB"
database_name = "devnote-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

`database_id` を控えておいてください。

### 3. スキーマの適用

```bash
# 本番環境にスキーマを適用
wrangler d1 execute devnote-db --remote --file=../schema.sql
```

### 4. KV Namespaceの作成

```bash
# 本番環境用
wrangler kv:namespace create "KV"
```

出力例:
```
🌀 Creating namespace with title "backend-KV"
✨ Success!
Add the following to your wrangler.jsonc:

kv_namespaces = [
  { binding = "KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
]
```

`id` を控えておいてください。

### 5. R2バケットの作成

```bash
wrangler r2 bucket create devnote-storage
```

出力:
```
✅ Created bucket 'devnote-storage' with default storage class set to Standard.
```

---

## Secretsの設定

Cloudflare Workersのシークレット環境変数を設定します。

```bash
cd backend

# GitHub OAuth
wrangler secret put GITHUB_CLIENT_ID
# プロンプトが表示されたら、GitHub OAuth AppのClient IDを入力

wrangler secret put GITHUB_CLIENT_SECRET
# プロンプトが表示されたら、GitHub OAuth AppのClient Secretを入力

# JWT Secret (32文字以上のランダムな文字列)
# 生成例: openssl rand -base64 32
wrangler secret put JWT_SECRET
# プロンプトが表示されたら、生成したJWT Secretを入力

# Gemini API Key
wrangler secret put GEMINI_API_KEY
# プロンプトが表示されたら、Gemini API Keyを入力
```

---

## wrangler.jsoncの設定

`backend/wrangler.jsonc`を編集して、プレースホルダーを実際の値に置き換えます。

### 1. D1データベースIDの設定

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "devnote-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  // ← ここに実際のdatabase_idを設定
  }
],
```

### 2. KV Namespace IDの設定

```jsonc
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  // ← ここに実際のKV IDを設定
  }
],
```

### 3. 環境変数の設定

```jsonc
"vars": {
  "FRONTEND_URL": "https://your-domain.com"  // ← フロントエンドの本番URLに変更
}
```

### 4. R2バケット名の確認

```jsonc
"r2_buckets": [
  {
    "binding": "R2",
    "bucket_name": "devnote-storage"  // ← 作成したバケット名と一致していることを確認
  }
],
```

---

## バックエンドのデプロイ

### 1. 型定義の生成

```bash
cd backend
npm run cf-typegen
```

### 2. デプロイ実行

```bash
npm run deploy
```

出力例:
```
✨ Compiled Worker successfully
🌀 Building list of assets...
Total Upload: xx.xx KiB / gzip: xx.xx KiB
✨ Success! Uploaded 1 file
Published backend (x.xx sec)
  https://backend.your-subdomain.workers.dev
```

デプロイされたURLを控えてください。

### 3. カスタムドメインの設定（オプション）

Cloudflareダッシュボードで、Workerに独自ドメインを割り当てることができます。

1. Cloudflare Dashboard → Workers & Pages → `backend`
2. "Settings" → "Triggers" → "Custom Domains"
3. "Add Custom Domain" をクリックして、`api.your-domain.com` などを設定

---

## フロントエンドのデプロイ

### オプション1: Cloudflare Pagesでデプロイ

#### 1. ビルド設定ファイルの確認

フロントエンドの環境変数を設定します。`frontend/.env.production`を作成:

```env
VITE_API_URL=https://backend.your-subdomain.workers.dev
# または独自ドメインの場合:
# VITE_API_URL=https://api.your-domain.com
```

#### 2. Cloudflare Pagesでプロジェクトを作成

1. Cloudflare Dashboard → Pages → "Create a project"
2. GitHubリポジトリを接続
3. ビルド設定:
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/`
   - **Environment variables**:
     - `NODE_VERSION`: `18`
     - `VITE_API_URL`: `https://backend.your-subdomain.workers.dev`

4. "Save and Deploy" をクリック

#### 3. カスタムドメインの設定

1. Cloudflare Dashboard → Pages → プロジェクト → "Custom domains"
2. "Set up a custom domain" で `your-domain.com` を設定

### オプション2: 他のホスティングサービスでデプロイ

#### Vercelの場合

```bash
cd frontend
npm install -g vercel
vercel --prod
```

#### Netlifyの場合

```bash
cd frontend
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## 動作確認

### 1. ヘルスチェック

```bash
curl https://backend.your-subdomain.workers.dev/api/health
```

期待される応答:
```json
{"status":"ok"}
```

### 2. フロントエンドへのアクセス

ブラウザで `https://your-domain.com` にアクセスし、以下を確認:

1. トップページが表示される
2. "Login with GitHub" ボタンが機能する
3. ログイン後、ダッシュボードにリダイレクトされる
4. ノート作成、チャット、メモの動作を確認

### 3. E2Eテストの実行（オプション）

```bash
cd backend
npm test
```

---

## トラブルシューティング

### 問題: "Database not found" エラー

**原因**: D1データベースのIDが正しく設定されていない、またはスキーマが適用されていない

**解決策**:
1. `wrangler.jsonc`の`database_id`が正しいか確認
2. スキーマを再適用: `wrangler d1 execute devnote-db --remote --file=../schema.sql`

### 問題: "KV namespace not found" エラー

**原因**: KV NamespaceのIDが正しく設定されていない

**解決策**:
1. `wrangler.jsonc`の`kv_namespaces[0].id`が正しいか確認
2. KVを再作成: `wrangler kv:namespace create "KV"`

### 問題: CORS エラー

**原因**: `FRONTEND_URL`が正しく設定されていない

**解決策**:
1. `wrangler.jsonc`の`vars.FRONTEND_URL`をフロントエンドの実際のURLに設定
2. Secretsを確認: `wrangler secret list`
3. 再デプロイ: `npm run deploy`

### 問題: GitHub OAuth認証が失敗する

**原因**: GitHub OAuth Appの設定が誤っている

**解決策**:
1. GitHub OAuth Appの"Authorization callback URL"が正しいか確認
2. `GITHUB_CLIENT_ID`と`GITHUB_CLIENT_SECRET`のSecretsが正しく設定されているか確認
3. Secretsを再設定: `wrangler secret put GITHUB_CLIENT_ID`

### 問題: Gemini API呼び出しが失敗する

**原因**: Gemini APIキーが無効、または制限に達している

**解決策**:
1. [Google AI Studio](https://makersuite.google.com/app/apikey)でAPIキーを確認
2. APIの使用量制限を確認
3. Secretを再設定: `wrangler secret put GEMINI_API_KEY`

### 問題: Durable Objectsのエラー

**原因**: Durable Objectsのマイグレーションが適用されていない

**解決策**:
1. `wrangler.jsonc`の`migrations`セクションを確認
2. 再デプロイ: `npm run deploy`

---

## セキュリティチェックリスト

デプロイ前に以下を確認してください:

- [ ] GitHub OAuth AppのClient SecretがWrangler Secretsに保存されている
- [ ] JWT Secretが32文字以上のランダムな文字列である
- [ ] Gemini API KeyがWrangler Secretsに保存されている
- [ ] `.dev.vars`ファイルが`.gitignore`に含まれている（リポジトリにコミットされていない）
- [ ] `FRONTEND_URL`が本番環境のURLに設定されている
- [ ] D1データベースのバックアップ戦略が定義されている
- [ ] Cloudflare Workersのログモニタリングが有効になっている

---

## パフォーマンス最適化

### Cloudflare Workers設定

- **CPU時間制限**: デフォルト50ms（Paid Planでは30秒まで拡張可能）
- **メモリ制限**: 128MB
- **リクエストサイズ制限**: 100MB

### D1クエリ最適化

- インデックスの追加（必要に応じて）
- クエリのバッチ処理

### R2ストレージ最適化

- 不要なファイルの定期的なクリーンアップ
- ライフサイクルポリシーの設定

---

## モニタリングとログ

### Cloudflare Logsの有効化

1. Cloudflare Dashboard → Workers & Pages → `backend`
2. "Logs" → "Logpush" を有効化
3. ログの送信先を設定（例: S3、Google Cloud Storage）

### アラート設定

1. Cloudflare Dashboard → Notifications
2. "Add notification" で以下のアラートを設定:
   - Worker errors exceeding threshold
   - D1 query failures
   - Unusual traffic patterns

---

## アップデート手順

### バックエンドの更新

```bash
cd backend
git pull origin main
npm install
npm run deploy
```

### フロントエンドの更新

Cloudflare Pagesの場合、GitHubにpushすると自動的にデプロイされます。

手動デプロイの場合:
```bash
cd frontend
git pull origin main
npm install
npm run build
# デプロイコマンド（ホスティングサービスに応じて）
```

---

## バックアップとリストア

### D1データベースのバックアップ

```bash
# エクスポート
wrangler d1 export devnote-db --remote --output=backup.sql

# リストア
wrangler d1 execute devnote-db --remote --file=backup.sql
```

### KV Namespaceのバックアップ

KVには自動バックアップ機能がありません。重要なデータはD1にも保存することを推奨します。

### R2バケットのバックアップ

```bash
# rcloneを使用したバックアップ例
rclone sync r2:devnote-storage /local/backup
```

---

## サポート

問題が発生した場合:

1. [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)を確認
2. [GitHub Issues](https://github.com/RYUKOU-OKUMURA/DevNote/issues)で報告
3. Cloudflare Communityフォーラムで質問

---

## 参考リンク

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Gemini API Documentation](https://ai.google.dev/docs)
