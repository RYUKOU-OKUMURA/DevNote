# Requirements Document

## Project Description (Input)
GitHubリポジトリをAIが学習し、ユーザーがNotebook LM風の専用ワークスペースで、リポジトリのコードやドキュメントについて対話的に質問できるRAG（検索拡張生成）アプリケーション。コンテキストの分離、3要素の連携（ソース・対話・知見）、根拠の明示（Citation）をコアバリューとする。

## Introduction

DevNote は、GitHubリポジトリを対象としたRAG（検索拡張生成）アプリケーションである。Gemini API File Search機能により、ユーザーはNotebook LM風の統合ワークスペース（ファイルツリー・チャット・メモパッド）でリポジトリを探索し、引用ベースの信頼できる回答を得ることができる。

本ドキュメントは、Phase 1（MVP）の要件を定義する。

## Requirements

### Requirement 1: ユーザー認証
**Objective:** ユーザーとして、GitHubアカウントでログインし、プライベートリポジトリを含むリポジトリにアクセスできるようにしたい。

#### Acceptance Criteria
1. When ユーザーがログインボタンをクリック, DevNote shall GitHub OAuthフローを開始する
2. When GitHub OAuth認証が成功, DevNote shall ユーザーをダッシュボード (`/dashboard`) にリダイレクトする
3. The DevNote shall リポジトリ読み取りに必要なGitHub OAuthスコープ（`repo`）を要求する
4. When ユーザーがログアウトを選択, DevNote shall セッションを終了し、トップページ (`/`) にリダイレクトする
5. The DevNote shall すべてのAPI呼び出しでJWTトークンを検証する

---

### Requirement 2: ダッシュボード - ノート一覧表示
**Objective:** ユーザーとして、登録済みリポジトリノートを一覧で確認し、ワークスペースにアクセスできるようにしたい。

#### Acceptance Criteria
1. When ユーザーがダッシュボードにアクセス, DevNote shall ユーザーが所有するすべてのノートをカード形式で表示する
2. The DevNote shall 各ノートカードにリポジトリ名、最終同期日時、ステータス（`Indexing`, `Ready`, `Failed`, `Auth Required`）を表示する
3. When ユーザーが `Ready` 状態のノートカードをクリック, DevNote shall 該当ワークスペース (`/workspace/{id}`) に遷移する
4. While ノートが `Indexing` 状態, DevNote shall カード上に「準備中...」の進捗表示を行う
5. If ノートが `Failed` 状態, then DevNote shall 「再試行」ボタンとエラー詳細を表示する
6. If ノートが `Auth Required` 状態, then DevNote shall 「再認証」ボタンと原因説明を表示する

---

### Requirement 3: ダッシュボード - ノート作成
**Objective:** ユーザーとして、新しいGitHubリポジトリをノートとして登録し、インデックス化を開始できるようにしたい。

#### Acceptance Criteria
1. The DevNote shall ダッシュボードに「新規ノート作成」ボタンを表示する
2. When ユーザーが「新規ノート作成」ボタンをクリック, DevNote shall リポジトリ選択ダイアログを表示する
3. The DevNote shall ユーザーが（A）自身のリポジトリ一覧から選択、または（B）GitHubリポジトリURLを貼り付けできる入力UIを提供する
4. When ユーザーがリポジトリを選択して登録を実行, DevNote shall 新規ノートレコードをD1に作成し、ステータスを `Indexing` に設定する
5. When ノート登録が完了, DevNote shall バックエンド同期ジョブを非同期で開始する
6. When 同期ジョブが開始, DevNote shall ダッシュボードのノート一覧に新規ノートを `Indexing` 状態で表示する

---

### Requirement 4: ダッシュボード - ノート管理
**Objective:** ユーザーとして、既存ノートの再同期、削除、エクスポートを実行できるようにしたい。

#### Acceptance Criteria
1. The DevNote shall 各ノートカードに「再同期」ボタンを表示する
2. When ユーザーが「再同期」ボタンをクリック, DevNote shall 最新のリポジトリデータで同期ジョブを再実行する
3. The DevNote shall ノートカードに「削除」アクションを提供する
4. When ユーザーがノート削除を実行, DevNote shall 確認ダイアログを表示した後、ノート・Gemini File Store・チャット履歴・メモを24時間以内に削除する
5. The DevNote shall ノートカードから「チャット履歴エクスポート（Markdown）」アクションを実行できる導線を提供する

---

### Requirement 5: データ同期・インデックス
**Objective:** システムとして、GitHubリポジトリの全ファイルをGemini File Storeにインデックス化し、RAG検索を可能にしたい。

#### Acceptance Criteria
1. When 新規ノート作成または再同期がトリガー, DevNote shall GitHub APIを介して対象リポジトリの全ファイルを取得する
2. The DevNote shall `.git` ディレクトリとバイナリファイルを同期対象から除外する
3. When ファイル取得が完了, DevNote shall 取得したファイルをGemini API File Storeにアップロードする
4. The DevNote shall 1つのノートと1つのGemini File Storeを1対1で紐づける
5. When 再同期が実行, DevNote shall 既存のFile Storeを削除した後、最新ファイルを再アップロードする
6. The DevNote shall 同期ジョブにジョブIDを付与し、D1またはDurable Objectで進捗を追跡する
7. If 同期処理が失敗, then DevNote shall 最大3回まで自動リトライを実行する
8. If 3回のリトライ後も失敗, then DevNote shall ノートステータスを `Failed` に設定し、エラー詳細をログに記録する
9. When 同期が成功, DevNote shall ノートステータスを `Ready` に設定し、最終同期日時と最新コミットSHAを更新する
10. The DevNote shall ノートテーブルにGitHubリポジトリ識別子、File Store ID、最終同期日時、ステータス、最新コミットSHAを保存する

---

### Requirement 6: ワークスペース - レイアウト
**Objective:** ユーザーとして、3カラムレイアウト（ファイルツリー・チャット・メモパッド）で統合されたワークスペースを利用したい。

#### Acceptance Criteria
1. When ユーザーがワークスペース (`/workspace/{id}`) にアクセス, DevNote shall 3カラムレイアウトを表示する
2. The DevNote shall デスクトップで左20%（ファイルツリー）、中央50%（チャット）、右30%（メモパッド）の比率でカラムを配置する
3. While デバイス幅がタブレットサイズ, DevNote shall 中央カラムをデフォルト表示とし、左右カラムをタブ切り替えで表示する
4. While デバイス幅がモバイルサイズ, DevNote shall 下部タブまたはスワイプ操作で3領域を切り替えるUIを提供する
5. The DevNote shall モバイルで入力エリアが画面から隠れないよう、ビューポートを調整する

---

### Requirement 7: ワークスペース - ファイルツリー（左カラム）
**Objective:** ユーザーとして、リポジトリのファイル階層を閲覧し、特定ファイルをコンテキストとして選択できるようにしたい。

#### Acceptance Criteria
1. The DevNote shall 左カラムに現在のワークスペース（リポジトリ）のディレクトリツリーを表示する
2. The DevNote shall ファイルとフォルダをクリック（展開/折りたたみ）可能にする
3. When ユーザーが特定ファイルをクリック, DevNote shall そのファイルを「コンテキストとして選択中」とマークし、UIでハイライト表示する
4. When ユーザーが選択ファイルを解除, DevNote shall ハイライトを削除し、コンテキストをリポジトリ全体に戻す

---

### Requirement 8: ワークスペース - チャット（中央カラム）
**Objective:** ユーザーとして、AIと対話してリポジトリに関する質問を行い、引用付きの回答を得たい。

#### Acceptance Criteria
1. The DevNote shall 中央カラムにチャットUI（会話履歴、入力ボックス）を表示する
2. The DevNote shall このワークスペースのチャット履歴をD1に永続化し、次回訪問時に復元する
3. When ユーザーが質問を送信, DevNote shall Gemini API File Searchを使用して回答を生成する
4. While 左カラムで特定ファイルが選択されていない, DevNote shall File Store全体をコンテキストとして回答を生成する
5. While 左カラムで特定ファイルが選択中, DevNote shall そのファイルを優先的に参照するようプロンプトまたはAPIフィルタリングで指示する
6. The DevNote shall AIの回答に引用元ファイル名と箇所を `[引用: src/main.js]` の形式で明記する
7. The DevNote shall 回答をストリーミング（逐次表示）で行う
8. If 選択ファイルがGemini制限を超える, then DevNote shall 警告メッセージを表示する
9. When フロントエンドが質問を送信, DevNote shall 選択されたファイルパス配列をAPIペイロードに含める

---

### Requirement 9: ワークスペース - メモパッド（右カラム）
**Objective:** ユーザーとして、調査中の気づきをメモパッドに記録し、永続化できるようにしたい。

#### Acceptance Criteria
1. The DevNote shall 右カラムに自由にテキストを入力・編集できるメモパッドエリアを表示する
2. The DevNote shall メモパッドの内容を現在のワークスペース（ノート）専用として、D1またはKVに永続化する
3. When ユーザーがメモパッドを編集, DevNote shall debounce付き自動保存で変更をバックエンドに同期する
4. When ユーザーがワークスペースに再訪問, DevNote shall 保存されたメモパッド内容を復元する
5. The DevNote shall チャット履歴からメモパッドへ「ピン留め（転記）」するボタンを提供する
6. When ユーザーがチャットメッセージをピン留め, DevNote shall そのメッセージをメモパッドに追記する

---

### Requirement 10: データ永続化
**Objective:** システムとして、ユーザー・ノート・チャット履歴・メモを適切なストレージに永続化したい。

#### Acceptance Criteria
1. The DevNote shall Cloudflare D1にユーザーテーブル、ノートテーブル、チャット履歴テーブル、ピン留めログテーブルを作成する
2. The DevNote shall ノートテーブルにGitHubリポジトリ識別子、Gemini File Store ID、最終同期日時、ステータス、最新コミットSHAを保存する
3. The DevNote shall メモパッドの内容をノートと1対1で紐づけ、D1またはKVに保存する
4. The DevNote shall 同期ジョブのステータス・エラーログをDurable ObjectまたはD1で追跡する
5. The DevNote shall Gemini File Store IDとR2キャッシュの関係を記録する（将来の差分同期最適化用）

---

### Requirement 11: セキュリティ
**Objective:** システムとして、ユーザーデータと認証情報を安全に管理し、不正アクセスを防止したい。

#### Acceptance Criteria
1. The DevNote shall GitHubアクセストークンとGemini APIキーをCloudflare Workers環境変数に暗号化保存する
2. The DevNote shall すべてのAPI呼び出しでJWTを検証し、ユーザーIDとノートIDの所有権を照合する
3. The DevNote shall File Store IDとノートをユーザーIDと1対1で紐づけ、アクセス時に所有権チェックを実行する
4. If プライベートリポジトリのトークンが有効期限切れ, then DevNote shall ノートステータスを `Auth Required` に設定する
5. The DevNote shall 重要な操作（ノート削除、再同期開始）に監査ログを記録し、Cloudflare Logsに出力する
6. The DevNote shall ログやクライアントレスポンスに認証情報を露出させない

---

### Requirement 12: パフォーマンス
**Objective:** システムとして、ユーザーに快適な体験を提供するため、応答速度を最適化したい。

#### Acceptance Criteria
1. The DevNote shall チャットの応答をストリーミングで行い、体感速度を向上させる
2. The DevNote shall リポジトリの初回インデックス処理を非同期（バックグラウンド）で行い、ダッシュボードをブロックしない
3. The DevNote shall メモパッドの自動保存にdebounceを適用し、不要なAPI呼び出しを削減する

---

### Requirement 13: エラーハンドリング・制限事項
**Objective:** システムとして、エラーや制限に適切に対応し、ユーザーに明確なフィードバックを提供したい。

#### Acceptance Criteria
1. The DevNote shall リポジトリサイズの上限を500MBとする
2. If リポジトリサイズが500MBを超過, then DevNote shall 警告と推奨対処（部分同期や対象ディレクトリ指定）を表示する
3. If インデックス処理が失敗, then DevNote shall 最大3回まで自動リトライを実行する
4. If 3回のリトライ後も失敗, then DevNote shall ノートステータスを `Failed` に設定し、エラー詳細をユーザーに通知する
5. If Gemini APIのレート制限に到達, then DevNote shall ユーザーへ通知し、再試行までの待ち時間を表示する
6. If Gemini File Store制限に到達, then DevNote shall エラーメッセージと対処方法をユーザーに表示する
7. The DevNote shall 失敗したファイル一覧を確認できるダイアログを提供する

---

### Requirement 14: コスト管理・スケーラビリティ
**Objective:** システムとして、運用コストを管理し、持続可能なサービスを提供したい。

#### Acceptance Criteria
1. The DevNote shall ユーザーあたりのFile Store作成数を上限10件に制限する
2. If ユーザーが上限を超過, then DevNote shall 既存ノートの整理を促すメッセージを表示する
3. The DevNote shall 90日以上アクセスのないノートを特定する
4. When ノートが90日間未アクセス, DevNote shall ユーザーにアーカイブ通知を送信し、File Store削除またはR2移行を選択可能にする
5. The DevNote shall Gemini API利用量（ファイル転送量・検索API呼び出し）をメトリクスとして収集する
6. If Gemini API利用量がしきい値を超過, then DevNote shall アラートを発火する
7. When File Storeを削除, DevNote shall R2へ軽量なバックアップ（メタデータ）を保存する

---

### Requirement 15: PoC検証事項
**Objective:** 開発チームとして、Gemini File Search APIの制約を検証し、技術的リスクを明確化したい。

#### Acceptance Criteria
1. The DevNote development team shall Gemini File Search APIのファイルフィルタリング機能の可否をPoCで検証する
2. The DevNote development team shall File Storeのサイズ制限をPoCで検証する
3. The DevNote development team shall 検証結果を要件のAppendixとして記録する
4. The DevNote development team shall 検証結果に基づき、コンテキスト指定の実装方針（プロンプト指示 vs APIフィルタ）を決定する
