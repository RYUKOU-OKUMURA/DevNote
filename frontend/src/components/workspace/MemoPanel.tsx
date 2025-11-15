import { useMemo } from '../../features/memo/useMemo';
import './MemoPanel.css';

export interface MemoPanelProps {
  /**
   * ノートID
   */
  noteId?: string;
  /**
   * メモパッドの内容を外部から更新する（ピン留め機能用）
   */
  onAppendContent?: (content: string) => void;
}

/**
 * メモパッドパネルコンポーネント
 * タスク 10.1, 10.2, 10.3
 */
export function MemoPanel({ noteId, onAppendContent }: MemoPanelProps) {
  const {
    content,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    updateContent,
  } = useMemo({ noteId });

  // ノートIDが指定されていない場合
  if (!noteId) {
    return (
      <div className="memo-panel">
        <h2 className="memo-panel__title">知見: メモパッド</h2>
        <div className="memo-panel__content">
          <p className="memo-panel__placeholder">
            ノートが選択されていません
          </p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error && !content) {
    return (
      <div className="memo-panel">
        <h2 className="memo-panel__title">知見: メモパッド</h2>
        <div className="memo-panel__error">
          <p>メモパッドの読み込みに失敗しました</p>
          <p className="memo-panel__error-detail">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="memo-panel">
      <div className="memo-panel__header">
        <h2 className="memo-panel__title">知見: メモパッド</h2>
        <div className="memo-panel__status">
          {isLoading && <span className="memo-panel__status-text">読み込み中...</span>}
          {isSaving && <span className="memo-panel__status-text">保存中...</span>}
          {hasUnsavedChanges && !isSaving && (
            <span className="memo-panel__status-text memo-panel__status-unsaved">
              未保存の変更があります
            </span>
          )}
          {!hasUnsavedChanges && !isSaving && !isLoading && (
            <span className="memo-panel__status-text memo-panel__status-saved">
              ✓ 保存済み
            </span>
          )}
        </div>
      </div>

      <div className="memo-panel__content">
        <textarea
          className="memo-panel__textarea"
          value={content}
          onChange={(e) => updateContent(e.target.value)}
          placeholder="ここに自由にメモを入力できます。
2秒後に自動保存されます。

チャット履歴の「ピン留め」ボタンを使うと、
重要なメッセージをここに追記できます。"
          disabled={isLoading}
        />
        {error && (
          <div className="memo-panel__error-banner">
            ⚠ {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
