# Implementation Plan

## Overview

このタスクリストは、DevNote MVP（Phase 1）の実装計画を定義します。GitHubリポジトリをGemini File Searchで学習し、Notebook LM風の統合ワークスペースで対話的に探索できるRAGアプリケーションを構築します。

タスクは、プロジェクトセットアップ、バックエンドインフラ、認証、ノート管理、同期ジョブ、チャット機能、ワークスペースUI、統合テストの順に進めます。並列実行可能なタスクには `(P)` マークを付与しています。

## Tasks

### 1. プロジェクトセットアップ

- [x] 1.1 (P) 開発環境を構築する
  - TypeScript、Vite、Reactでフロントエンドプロジェクトを初期化する
  - ESLint、Prettierでコード品質ツールを設定する
  - TypeScript strict modeを有効化し、`any`を禁止するルールを追加する
  - _Requirements: -_

- [x] 1.2 (P) Cloudflare Workersバックエンドを初期化する
  - Wrangler CLIでWorkers / Pages Functionsプロジェクトをセットアップする
  - `/workers/`または`/api/`ディレクトリに機能別エンドポイント構造を作成する
  - フロントエンドとバックエンド共通の型定義を`/shared/`に配置する
  - _Requirements: -_

- [x] 1.3 (P) パスエイリアスとディレクトリ構造を確立する
  - `@/`をフロントエンドルート、`@shared/`を共有型定義としてパスエイリアスを設定する
  - Pages、Features、Components、Libの依存方向を遵守したディレクトリを作成する
  - auth、notes、chat、memoの機能別Featuresディレクトリを準備する
  - _Requirements: -_

### 2. データベーススキーマとマイグレーション

- [x] 2.1 D1データベーススキーマを定義する
  - Users、Notes、ChatMessages、PinnedLogsテーブルを作成するマイグレーションスクリプトを記述する
  - 外部キー制約（user_id、note_id）とCASCADE削除を設定する
  - ステータス列に`Indexing`、`Ready`、`Failed`、`Auth Required`のCHECK制約を適用する
  - _Requirements: 10_

- [x] 2.2 D1インデックスを最適化する
  - `idx_notes_user_id`、`idx_notes_status`、`idx_notes_last_accessed_at`を作成する
  - `idx_chat_messages_note_id_created_at`複合インデックスを作成する
  - `idx_pinned_logs_note_id`を作成する
  - _Requirements: 10_

- [x] 2.3 (P) KVとR2のキー設計を実装する
  - KVに`memo:{note_id}`と`session:{user_id}`のキースキーマを定義する
  - R2に`repo-cache/{note_id}/{commit_sha}.zip`と`backup/{note_id}/metadata.json`のキースキーマを定義する
  - 90日間未アクセスのアーカイブルールを確認する
  - _Requirements: 10, 14_

### 3. 認証機能

- [x] 3.1 GitHub OAuthフローを実装する
  - `/api/auth/github/login`エンドポイントを作成し、GitHub OAuthリダイレクトを開始する
  - `state`パラメータを生成してCSRF攻撃を防止する
  - `repo`スコープを要求する認可URLを構築する
  - _Requirements: 1, 11_

- [x] 3.2 OAuth callbackでトークンを取得する
  - `/api/auth/github/callback`エンドポイントを作成し、`code`と`state`を検証する
  - GitHub APIにトークン交換リクエストを送信する
  - 取得したアクセストークンを暗号化してD1のUsersテーブルに保存する
  - _Requirements: 1, 11_

- [x] 3.3 JWTサービスを構築する
  - JWT生成関数を実装し、ユーザーIDと24時間の有効期限を設定する
  - JWT検証関数を実装し、トークン無効時に例外をスローする
  - ノート所有権検証関数を実装し、ユーザーIDとノートIDの紐づけを確認する
  - _Requirements: 1, 11_

- [x] 3.4 (P) ログアウト機能を実装する
  - `/api/auth/logout`エンドポイントを作成し、セッションを終了する
  - トップページ`/`にリダイレクトする
  - JWTトークンをクリアする
  - _Requirements: 1_

### 4. ノート管理機能

- [x] 4.1 ノート一覧取得APIを実装する
  - `/api/notes` GETエンドポイントを作成し、JWTを検証する
  - ユーザーIDに紐づくノート一覧をD1から取得する
  - ステータス、最終同期日時、リポジトリ名を含むレスポンスを返す
  - _Requirements: 2, 10_

- [x] 4.2 ノート作成APIを実装する
  - `/api/notes` POSTエンドポイントを作成し、リポジトリURLを受け取る
  - リポジトリURL形式（`https://github.com/:owner/:repo`）を正規表現で検証する
  - ユーザーごとのノート上限（10件）をチェックし、超過時は409エラーを返す
  - _Requirements: 3, 10, 14_

- [x] 4.3 ノート作成時に同期ジョブを開始する
  - ノートレコードをD1に作成し、ステータスを`Indexing`に設定する
  - Durable Objectsで同期ジョブを起動し、ジョブIDを返す
  - 同期ジョブの進捗をポーリングできるエンドポイントを準備する
  - _Requirements: 3, 5_

- [x] 4.4 (P) ノート削除APIを実装する
  - `/api/notes/:id` DELETEエンドポイントを作成し、所有権を検証する
  - 確認ダイアログ後、D1のノート、チャット履歴、メモ、Gemini File Storeを24時間以内に削除する
  - R2に軽量なメタデータバックアップを保存する
  - _Requirements: 4, 10, 14_

- [x] 4.5 (P) 再同期APIを実装する
  - `/api/notes/:id/sync` POSTエンドポイントを作成し、所有権を検証する
  - 既存のFile Storeを削除した後、新規同期ジョブを開始する
  - 最新のリポジトリデータで同期ジョブを再実行する
  - _Requirements: 4, 5_

### 5. 同期ジョブ（Durable Objects）

- [x] 5.1 Durable Objectsで同期ジョブクラスを定義する
  - ノートごとに1つのDurable Objectインスタンスが割り当てられる設計にする
  - ジョブステータス（pending、in_progress、completed、failed）を永続化ステートで管理する
  - 強整合性を利用して競合を防止する
  - _Requirements: 5, 10_

- [x] 5.2 GitHubリポジトリからファイルを取得する
  - Octokit (GitHub API) でリポジトリの全ファイルを再帰的に取得する
  - `.git`ディレクトリとバイナリファイルを除外する
  - リポジトリサイズの上限（500MB）を事前にチェックする
  - _Requirements: 5, 13_

- [x] 5.3 Gemini File Storeにファイルをアップロードする
  - Gemini APIでFile Storeを作成し、file_store_idを取得する
  - 各ファイルに`file_path`メタデータを付与してアップロードする
  - 1ノート = 1 File Storeの1対1紐づけを維持する
  - _Requirements: 5_

- [x] 5.4 同期ジョブのリトライロジックを実装する
  - 同期処理失敗時に最大3回まで自動リトライを実行する
  - リトライ間隔を指数バックオフ（1s、2s、4s）で設定する
  - 3回のリトライ後も失敗した場合、ノートステータスを`Failed`に設定する
  - _Requirements: 5, 13_

- [x] 5.5 (P) 同期完了時にノート情報を更新する
  - 同期成功時にノートステータスを`Ready`に設定する
  - File Store ID、最終同期日時、最新コミットSHAをD1に保存する
  - 同期失敗時にエラー詳細をログに記録し、ノートステータスを`Failed`に更新する
  - _Requirements: 5_

- [x] 5.6 (P) R2にリポジトリZIPキャッシュを保存する
  - 同期完了後、リポジトリZIPをR2に保存する（将来の差分同期用）
  - オブジェクトキー`repo-cache/{note_id}/{commit_sha}.zip`でキャッシュする
  - 90日間未アクセスで自動削除されるライフサイクルポリシーを確認する
  - _Requirements: 10, 14_

### 6. チャット機能

- [x] 6.1 チャット送信APIを実装する
  - `/api/chat` POSTエンドポイントを作成し、note_id、message、selected_files?を受け取る
  - JWTを検証し、ノート所有権をチェックする
  - ノートが`Ready`ステータスであることを確認する
  - _Requirements: 8, 11_

- [x] 6.2 Gemini File Searchでメタデータフィルタリングを実装する
  - 選択ファイルパス配列から`metadata_filter`パラメータを生成する
  - 選択ファイルがある場合、`file_path="src/main.js"`形式でフィルタリングする
  - 選択ファイルがない場合、File Store全体をコンテキストとして使用する
  - _Requirements: 8, 15_

- [x] 6.3 ストリーミング応答を実装する
  - Gemini APIの`generateContent`を呼び出し、Server-Sent Events (SSE) でストリーミング応答を返す
  - `{"type": "chunk", "content": "..."}`、`{"type": "citation", ...}`、`{"type": "done"}`形式でイベントを送信する
  - ストリーミング中断時の再接続ロジックを実装する
  - _Requirements: 8, 12_

- [x] 6.4 引用情報を抽出して明示する
  - Gemini APIから返された引用情報を`[引用: src/main.js]`形式で整形する
  - 引用元ファイル名とスニペットをCitation配列として保存する
  - 幻覚防止のため、引用情報は必ずGemini APIから取得する
  - _Requirements: 8_

- [x] 6.5 (P) チャット履歴をD1に永続化する
  - ユーザーメッセージとAI応答をChatMessagesテーブルに保存する
  - 引用情報をJSON配列としてcitations列に保存する
  - ワークスペース訪問時にチャット履歴を復元する
  - _Requirements: 8, 10_

- [x] 6.6 (P) チャット履歴取得APIを実装する
  - `/api/chat/history` GETエンドポイントを作成し、note_idをクエリパラメータで受け取る
  - 所有権を検証した後、ChatMessagesテーブルから履歴を取得する
  - created_atでソートしてレスポンスを返す
  - _Requirements: 8, 10_

### 7. ワークスペースUI - レイアウト

- [x] 7.1 3カラムレイアウトコンポーネントを実装する
  - デスクトップで左20%（ファイルツリー）、中央50%（チャット）、右30%（メモパッド）の比率を実現する
  - CSS GridまたはFlexboxでレスポンシブレイアウトを構築する
  - 768px、1024pxのブレークポイントでメディアクエリを適用する
  - _Requirements: 6_

- [x] 7.2 (P) タブレット対応のタブ切り替えUIを実装する
  - タブレットサイズで中央カラムをデフォルト表示にする
  - 左右カラムをタブ切り替えで表示する
  - タブ選択状態をローカルステートで管理する
  - _Requirements: 6_

- [x] 7.3 (P) モバイル対応のスワイプUIを実装する
  - モバイルサイズで下部タブまたはスワイプ操作で3領域を切り替える
  - キーボード表示時にビューポートを調整し、入力エリアが隠れないようにする
  - スワイプジェスチャーを検出して領域を切り替える
  - _Requirements: 6_

### 8. ワークスペースUI - ファイルツリー

- [x] 8.1 ファイルツリーコンポーネントを実装する
  - ディレクトリツリーを展開/折りたたみ可能にする
  - ファイルとフォルダをクリック可能にし、選択状態を管理する
  - 選択中のファイルをハイライト表示する
  - _Requirements: 7_

- [x] 8.2 選択ファイルパスを親コンポーネントに通知する
  - 選択ファイルパスをonFileSelectコールバックで伝播する
  - 選択解除時に`null`を渡し、コンテキストをリポジトリ全体に戻す
  - 選択状態をローカルステートで管理する
  - _Requirements: 7_

- [x] 8.3 (P) GitHubファイルリストをツリー構造に変換する
  - GitHub APIから取得したファイルリストを階層ツリーに変換する
  - `.git`ディレクトリを除外する
  - 巨大リポジトリでのパフォーマンスを考慮し、仮想スクロールを検討する
  - _Requirements: 7_

### 9. ワークスペースUI - チャット

- [x] 9.1 チャット入力フォームを実装する
  - テキストエリアと送信ボタンを配置する
  - 送信中は入力フォームを無効化する
  - メッセージ最大長（5000文字）をチェックする
  - _Requirements: 8_

- [x] 9.2 チャット履歴表示コンポーネントを実装する
  - ユーザーメッセージとAI応答を区別して表示する
  - 引用情報を`[引用: src/main.js]`形式で表示する
  - 履歴をスクロール可能にし、最新メッセージを自動表示する
  - _Requirements: 8_

- [x] 9.3 (P) ストリーミング応答を逐次表示する
  - Server-Sent Events (SSE) を受信し、チャンクごとにUIを更新する
  - ストリーミング中は「入力中...」インジケーターを表示する
  - ネットワークエラー時に再接続を試みる
  - _Requirements: 8, 12_

- [x] 9.4 (P) 選択ファイルをチャットリクエストに含める
  - ファイルツリーの選択状態を取得する
  - selected_files配列をAPIペイロードに含める
  - 選択ファイルがない場合、リポジトリ全体をコンテキストとする
  - _Requirements: 8_

### 10. ワークスペースUI - メモパッド

- [x] 10.1 メモパッド編集コンポーネントを実装する
  - 自由にテキストを入力・編集できるテキストエリアを配置する
  - 編集状態をローカルステートで管理する
  - メモパッド最大長（100KB）をチェックする
  - _Requirements: 9_

- [x] 10.2 debounce付き自動保存を実装する
  - 編集から2秒後に自動保存をトリガーする
  - KVまたはD1にメモパッド内容を永続化する
  - KV書き込みレート制限（1 key/秒）に注意する
  - _Requirements: 9, 12_

- [x] 10.3 (P) ワークスペース訪問時にメモパッドを復元する
  - ワークスペース初回ロード時にKVまたはD1からメモパッド内容を取得する
  - 保存されたメモパッド内容をテキストエリアに復元する
  - 未保存の変更がある場合、警告メッセージを表示する
  - _Requirements: 9_

- [x] 10.4 (P) チャットメッセージのピン留め機能を実装する
  - チャット履歴に「ピン留め」ボタンを表示する
  - ピン留め時にメッセージをメモパッドに追記する
  - PinnedLogsテーブルにピン留めログを記録する
  - _Requirements: 9_

### 11. ダッシュボードUI

- [x] 11.1 ダッシュボードページを実装する
  - ノート一覧をカード形式で表示する
  - 各ノートカードにリポジトリ名、最終同期日時、ステータスを表示する
  - `Ready`状態のノートカードをクリックでワークスペースに遷移する
  - _Requirements: 2_

- [x] 11.2 ステータス別UIを実装する
  - `Indexing`状態で「準備中...」進捗表示を行う
  - `Failed`状態で「再試行」ボタンとエラー詳細を表示する
  - `Auth Required`状態で「再認証」ボタンと原因説明を表示する
  - _Requirements: 2, 11_

- [x] 11.3 (P) 新規ノート作成ダイアログを実装する
  - 「新規ノート作成」ボタンをダッシュボードに表示する
  - ダイアログでリポジトリURL入力欄を表示する
  - リポジトリURL形式を正規表現で検証し、無効な場合はエラーメッセージを表示する
  - _Requirements: 3_

- [x] 11.4 (P) ノート管理アクション（再同期・削除・エクスポート）を実装する
  - 各ノートカードに「再同期」ボタンを表示する
  - 削除時に確認ダイアログを表示する
  - チャット履歴エクスポート（Markdown形式）機能を実装する
  - _Requirements: 4_

- [x] 11.5 (P) ノート一覧のポーリング更新を実装する
  - 5秒間隔でノート一覧を再取得する
  - ステータスが`Indexing`から`Ready`に変わったノートをUIに反映する
  - ポーリング中はAPI呼び出しを最小化する
  - _Requirements: 2_

### 12. エラーハンドリングとセキュリティ

- [x] 12.1 統一エラーレスポンス形式を実装する
  - ErrorResponse型（code、message、details?）を定義する
  - すべてのAPIエンドポイントで統一エラーレスポンスを返す
  - エラーコード（UNAUTHORIZED、NOTE_NOT_FOUND、QUOTA_EXCEEDED等）を定義する
  - _Requirements: 13_

- [x] 12.2 (P) GitHubトークン暗号化サービスを実装する
  - アクセストークンをCloudflare Workers環境変数で暗号化保存する
  - 復号化時にのみトークンを取得する
  - ログやクライアントレスポンスに認証情報を露出させない
  - _Requirements: 11_

- [x] 12.3 (P) 監査ログを実装する
  - ノート削除、再同期開始の重要操作をCloudflare Logsに記録する
  - ユーザーID、ノートID、タイムスタンプ、操作種別を記録する
  - Cloudflare Analyticsでメトリクス（API呼び出し頻度、エラーレート）を追跡する
  - _Requirements: 11_

- [x] 12.4 (P) レート制限エラーハンドリングを実装する
  - GitHub/Gemini APIレート制限到達時に再試行までの待ち時間を表示する
  - File Store制限到達時にエラーメッセージと対処方法を表示する
  - リポジトリサイズ超過時に警告と推奨対処（部分同期や対象ディレクトリ指定）を表示する
  - _Requirements: 13_

### 13. コスト管理とスケーラビリティ

- [x] 13.1 (P) ユーザーごとのノート上限を実装する
  - ノート作成時にユーザーのノート数をカウントする
  - 上限10件を超過した場合、既存ノート整理を促すメッセージを表示する
  - 上限チェックをNotesAPIに組み込む
  - _Requirements: 14_

- [x] 13.2 (P) 90日間未アクセスのノート検出を実装する
  - ノートのlast_accessed_atを更新する
  - 90日間未アクセスのノートを特定するクエリを実装する
  - ユーザーにアーカイブ通知を送信し、File Store削除またはR2移行を選択可能にする
  - _Requirements: 14_

- [x] 13.3 (P) Gemini API利用量メトリクスを収集する
  - ファイル転送量と検索API呼び出し回数を記録する
  - しきい値超過時にアラートを発火する
  - Cloudflare Analyticsで利用量を可視化する
  - _Requirements: 14_

### 14. PoC検証

- [ ] 14.1 Gemini File Searchメタデータフィルタリング機能を検証する
  - 特定ファイルパスでメタデータフィルタリングが動作することを確認する
  - フィルタリング精度（選択ファイル優先参照）をテストする
  - 検証結果を要件のAppendixに記録する
  - _Requirements: 15_

- [ ] 14.2 (P) Gemini File Storeサイズ制限を検証する
  - File Storeの最大サイズと最大ファイル数を確認する
  - 500MBリポジトリでの動作を検証する
  - 制限超過時の挙動を確認する
  - _Requirements: 15_

- [ ] 14.3 (P) コンテキスト指定実装方針を決定する
  - メタデータフィルタリングとプロンプト指示の精度を比較する
  - 検証結果に基づき、最終的な実装方針を決定する
  - 決定内容を要件のAppendixに記録する
  - _Requirements: 15_

### 15. 統合テスト

- [ ] 15.1 エンドツーエンドテストを実装する
  - ログイン → ノート作成 → ステータス確認 → ワークスペース遷移のフローをテストする
  - ファイル選択 → チャット送信 → 引用表示 → メモピン留めのフローをテストする
  - エラーハンドリング（無効なリポジトリURL、再試行）をテストする
  - _Requirements: -_

- [ ] 15.2 (P) パフォーマンステストを実装する
  - チャット応答初回チャンク500ms以内を検証する
  - ダッシュボード読み込み1秒以内を検証する
  - 複数ノートの同時同期で競合がないことを確認する
  - _Requirements: 12_

- [ ] 15.3 (P) セキュリティテストを実装する
  - JWT検証とノート所有権チェックが正しく動作することを確認する
  - SQL Injection、XSS、CSRF攻撃への対策を検証する
  - GitHubトークンとGemini APIキーが露出しないことを確認する
  - _Requirements: 11_

## Summary

- **Total Tasks**: 15 major tasks, 56 sub-tasks
- **All Requirements Covered**: 1-15
- **Parallel Execution**: 26 tasks marked with `(P)` for concurrent execution
- **Average Sub-task Size**: 1-3 hours per sub-task

## Next Steps

タスクレビュー後、以下のコマンドで実装を開始してください:

```bash
# 特定タスクの実行（推奨）
/kiro:spec-impl devnote-mvp 1.1

# 複数タスクの実行
/kiro:spec-impl devnote-mvp 1.1,1.2

# 全タスクの実行（非推奨：コンテキスト肥大化のため）
/kiro:spec-impl devnote-mvp
```

**重要**: タスク実行前と切り替え時は、コンテキストをクリアして新鮮な状態を保つことを推奨します。
