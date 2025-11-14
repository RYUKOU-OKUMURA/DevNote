import './ChatPanel.css';

export interface ChatPanelProps {
  /**
   * 選択されたファイルパスの配列
   * undefinedの場合はリポジトリ全体をコンテキストとする
   */
  selectedFiles?: string[];
}

/**
 * チャットパネルコンポーネント（プレースホルダー）
 * タスク 9.1-9.4 で完全に実装される
 */
export function ChatPanel({ selectedFiles }: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <h2 className="chat-panel__title">対話: チャット</h2>
      <div className="chat-panel__content">
        <p>チャット機能はタスク 9.1-9.4 で実装されます。</p>
        {selectedFiles && selectedFiles.length > 0 && (
          <p className="chat-panel__context">
            コンテキスト: {selectedFiles.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
