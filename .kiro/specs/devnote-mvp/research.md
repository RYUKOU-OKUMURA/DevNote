# Research & Design Decisions

## Summary
- **Feature**: `devnote-mvp`
- **Discovery Scope**: New Feature (greenfield RAG application)
- **Key Findings**:
  - Gemini File Search APIにメタデータフィルタリング機能があり、ファイル単位の優先参照が可能
  - Cloudflare Workersエコシステムで完全なサーバーレスRAGアーキテクチャが実現可能
  - GitHub OAuthの実装パターンが確立されており、Cloudflare Workers環境で動作実績あり

## Research Log

### Gemini API File Search機能の制約と能力
- **Context**: RAGの中核機能であるGemini File Searchの制限を把握し、設計に反映する必要があった
- **Sources Consulted**:
  - https://ai.google.dev/gemini-api/docs/file-search (公式ドキュメント)
  - https://blog.google/technology/developers/file-search-gemini-api/ (公式ブログ)
- **Findings**:
  - **ファイルサイズ制限**: 1ファイルあたり最大100MB
  - **File Storeストレージ容量**: Freeティアで1GB、Tier 1で10GB、Tier 2で100GB、Tier 3で1TB
  - **推奨File Storeサイズ**: 最適な検索パフォーマンスのため、個別のストアは20GB以下を推奨
  - **メタデータフィルタリング**: カスタムkey-valueメタデータをファイルに付与可能。`metadata_filter`パラメータで検索範囲を絞り込める（例: `metadata_filter: 'doc_type="manual"'`）
  - **対応ファイル形式**: PDF, Word, Excel, PowerPoint, JSON, Markdown, Python, JavaScript, TypeScriptなど多数対応
  - **ストレージコスト計算**: 入力データ + 生成されたEmbedding（入力の約3倍）
- **Implications**:
  - 要件のリポジトリサイズ上限500MBは、Gemini Free/Tier 1の制限内で実現可能
  - メタデータフィルタリングを活用すれば、左カラムで選択されたファイルを優先的に参照できる
  - `.git`ディレクトリや巨大バイナリファイルの除外は必須（ストレージコストとパフォーマンス両面で）

### Cloudflare Workersエコシステムの選定
- **Context**: フロントエンドとバックエンドのホスティング・ストレージ戦略を決定する
- **Sources Consulted**:
  - https://developers.cloudflare.com/workers/platform/storage-options/ (公式ストレージガイド)
  - https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- **Findings**:
  - **D1 (SQLite)**: 軽量でサーバーレスなSQL DB。読み取り重視で、ユーザー・ノート・チャット履歴などの構造化データに最適
  - **Workers KV**: 分散key-valueストア。グローバルで低レイテンシーなアクセスが必要なセッションデータ・設定に推奨
  - **R2**: S3互換オブジェクトストレージ。エグレス料金なしで大容量の非構造化データ（GitHubリポジトリZIPキャッシュなど）を保存
  - **Durable Objects**: 強整合性ステートを持つサーバーレスワークロード。リアルタイムアプリ、レート制限、同期ジョブ管理に最適
  - **組み合わせ利用**: KVでセッション、R2でファイルキャッシュ、D1でメタデータ、Durable Objectsで同期ジョブという多層戦略が可能
- **Implications**:
  - **D1**: ユーザー、ノート、チャット履歴、ピン留めログテーブルを管理
  - **KV**: メモパッドの内容を保存（自動保存のdebounce対応で高頻度書き込み）
  - **R2**: GitHubリポジトリの部分キャッシュ（将来の差分同期最適化用）
  - **Durable Objects**: 同期ジョブの進捗・リトライ・ステータス管理

### GitHub OAuth実装パターン
- **Context**: プライベートリポジトリへのアクセスにはGitHub OAuthが必須
- **Sources Consulted**:
  - https://github.com/gr2m/cloudflare-worker-github-oauth-login
  - https://simonwillison.net/2024/Nov/29/github-oauth-cloudflare/
  - https://github.com/cloudflare/workers-oauth-provider
- **Findings**:
  - **gr2m/cloudflare-worker-github-oauth-login**: 軽量なGitHub OAuth実装。`/login`でGitHubにリダイレクト、`/callback`でコード交換してアクセストークン取得
  - **セキュリティ考慮事項**: `state`パラメータを検証しないとCSRF攻撃に脆弱。PKCE（Proof Key for Code Exchange）サポートが推奨
  - **Cloudflare公式ライブラリ**: `workers-oauth-provider`でOAuth 2.1プロトコル + PKCE実装をラップ可能
  - **必要なシークレット**: `CLIENT_ID`, `CLIENT_SECRET`をWrangler経由でWorkers環境変数に保存
- **Implications**:
  - 認証フローは専用Workerエンドポイント（`/api/auth/github/login`, `/api/auth/github/callback`）で実装
  - アクセストークンはKVまたはD1に暗号化保存し、有効期限切れ時は`Auth Required`ステータスでユーザーに再認証を促す
  - `state`パラメータとPKCEで攻撃対策を実施

### RAGアーキテクチャとコンテキスト指定
- **Context**: ユーザーが左カラムで特定ファイルを選択した際に、そのファイルを優先的に参照する仕組みを検討
- **Sources Consulted**: 一般的なRAGベストプラクティス（Gemini File Searchのメタデータフィルタリング機能と組み合わせ）
- **Findings**:
  - **メタデータフィルタリング戦略**: アップロード時にファイルパスをメタデータとして付与（例: `{file_path: "src/main.js"}`）
  - **クエリ時フィルタリング**: ユーザーがファイルを選択した場合、`metadata_filter: 'file_path="src/main.js"'`でスコープを絞る
  - **フォールバック**: フィルタリングが利用できない場合は、プロンプトで「以下のファイルを優先的に参照してください: src/main.js」と指示
- **Implications**:
  - フロントエンドは選択ファイルパスの配列をAPIペイロードに含める
  - バックエンドはメタデータフィルタ構文を生成し、Gemini File Searchに渡す
  - PoC（Requirement 15）でメタデータフィルタリングの可否を検証し、結果をAppendixに記録

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Layered Architecture (推奨) | Pages → Features → Components → Lib の依存方向で階層化 | ビジネスロジックとUIを分離、テスト容易性、保守性が高い | 小規模プロジェクトではオーバーヘッド | Steeringの`structure.md`に記載された原則と一致 |
| Feature-Sliced Design | 機能単位でディレクトリを分割（auth, notes, chat, memo） | スケーラビリティ、並列開発が容易 | 初期学習コスト | Steeringの推奨パターン |
| Monolithic Component | すべてをワークスペースコンポーネントに集約 | 実装が単純 | スケールしない、テストが困難 | 不採用 |

**選定**: **Layered Architecture + Feature-Sliced Design**を組み合わせ、`/src/features/`配下に機能単位のロジックを配置し、`/src/components/`で汎用UIコンポーネントを管理する。

## Design Decisions

### Decision: データ永続化の責務分割
- **Context**: ノート、チャット、メモパッドのデータを適切なストレージに配置する
- **Alternatives Considered**:
  1. すべてD1で管理 — シンプルだがKVの低レイテンシー特性を活かせない
  2. すべてKVで管理 — チャット履歴のクエリが困難（KVはkey-value操作のみ）
  3. D1とKVのハイブリッド — 責務を明確化し、各ストレージの強みを活用
- **Selected Approach**: **D1とKVのハイブリッド**
  - **D1**: ユーザー、ノート、チャット履歴（リレーショナルクエリが必要）
  - **KV**: メモパッド内容（高頻度書き込み、debounce付き自動保存）
  - **R2**: GitHubリポジトリのZIPキャッシュ（将来の差分同期最適化）
- **Rationale**: チャット履歴はタイムスタンプやノートIDでのクエリが必要なためD1が適切。メモパッドは単純なkey-value操作でKVが最適。
- **Trade-offs**: ストレージが複数に分散するが、各ストレージの特性を最大限活用できる
- **Follow-up**: メモパッドのKV保存時にTTL（例: 90日未アクセスで削除）を設定するか、D1に移行するかは実装フェーズで検討

### Decision: 同期ジョブの管理方法
- **Context**: 非同期の同期ジョブ（GitHub API → Gemini File Store）の進捗・リトライを追跡する
- **Alternatives Considered**:
  1. D1でジョブテーブル管理 — Workers間で競合する可能性
  2. Durable Objects — 強整合性で競合なし、リトライロジックを内包可能
- **Selected Approach**: **Durable Objects**
  - 各ノートに対応するDurable Objectインスタンスで同期ジョブを管理
  - ジョブID、ステータス（`pending`, `in_progress`, `completed`, `failed`）、リトライカウントを保持
  - 最大3回の自動リトライをDurable Object内で実行
- **Rationale**: 同期ジョブは並列実行されず、順序保証が必要。Durable Objectsの強整合性が最適。
- **Trade-offs**: Durable Objectsは追加コストがかかるが、信頼性とシンプルさが勝る
- **Follow-up**: ジョブログをCloudflare Logsに出力し、ダッシュボードから確認可能にする

### Decision: コンテキスト指定の実装方針
- **Context**: ユーザーが左カラムで特定ファイルを選択した際の優先参照方法
- **Alternatives Considered**:
  1. プロンプト指示のみ — Gemini APIの解釈に依存、精度が不確実
  2. メタデータフィルタリング — 明示的にスコープを絞れる
  3. ファイル内容をプロンプトに直接埋め込み — トークン消費が大きい
- **Selected Approach**: **メタデータフィルタリング（PoC検証必須）**
  - アップロード時に各ファイルに`{file_path: "src/main.js"}`のメタデータを付与
  - クエリ時に`metadata_filter: 'file_path="src/main.js"'`で検索範囲を絞る
  - フィルタリングが機能しない場合は、プロンプト指示をフォールバックとして併用
- **Rationale**: Gemini公式ドキュメントでメタデータフィルタリングが推奨されている。明示的なフィルタリングで精度向上が期待できる。
- **Trade-offs**: PoC検証が必要（Requirement 15）。メタデータ管理の複雑さが増す。
- **Follow-up**: Phase 1で検証し、結果をAppendixに記録。メタデータフィルタリングが不可の場合はプロンプト指示に切り替え。

## Risks & Mitigations
- **Risk 1: Gemini File Storeの容量超過** — GitHubリポジトリが500MBを超える場合、インデックス失敗の可能性
  - **Mitigation**: アップロード前にリポジトリサイズをチェックし、超過時は警告と部分同期オプションを提示
- **Risk 2: GitHub APIレート制限** — 大量のファイル取得時にレート制限に到達
  - **Mitigation**: バックグラウンドジョブでリトライ、ユーザーへのステータス通知、exponential backoff実装
- **Risk 3: メタデータフィルタリングの動作未検証** — Gemini APIの実際の動作が不明
  - **Mitigation**: Requirement 15でPoC検証を実施。検証結果に基づき実装方針を確定
- **Risk 4: Durable Objectsのコールドスタート** — 同期ジョブ開始時のレイテンシー
  - **Mitigation**: Phase 1では許容。Phase 2でWorkers Cronによる定期ウォームアップを検討

## References
- [Gemini File Search API Documentation](https://ai.google.dev/gemini-api/docs/file-search) — File Store制限、メタデータフィルタリング仕様
- [Cloudflare Workers Storage Options](https://developers.cloudflare.com/workers/platform/storage-options/) — D1, KV, R2, Durable Objectsの選定ガイド
- [gr2m/cloudflare-worker-github-oauth-login](https://github.com/gr2m/cloudflare-worker-github-oauth-login) — GitHub OAuth実装パターン
- [Simon Willison's GitHub OAuth Guide](https://simonwillison.net/2024/Nov/29/github-oauth-cloudflare/) — Cloudflare WorkersでのOAuth実装事例
