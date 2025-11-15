import type { ChatMessage as ChatMessageType } from '../../../../shared/types';
import './ChatMessage.css';

export interface ChatMessageProps {
  /**
   * メッセージデータ
   */
  message: ChatMessageType;
  /**
   * ピン留めボタンのコールバック（タスク 10.4 で実装）
   */
  onPin?: (message: ChatMessageType) => void;
}

/**
 * チャットメッセージコンポーネント
 * ユーザーメッセージとAI応答を区別して表示
 */
export function ChatMessage({ message, onPin }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--assistant'}`}>
      <div className="chat-message__header">
        <span className="chat-message__role">
          {isUser ? 'あなた' : 'AI'}
        </span>
        <span className="chat-message__time">
          {formatTime(message.created_at)}
        </span>
      </div>

      <div className="chat-message__content">
        {message.content}
      </div>

      {/* 引用情報の表示 */}
      {message.citations && message.citations.length > 0 && (
        <div className="chat-message__citations">
          <div className="chat-message__citations-title">引用:</div>
          {message.citations.map((citation, index) => (
            <div key={index} className="chat-message__citation">
              <span className="chat-message__citation-path">
                {citation.file_path}
              </span>
              {citation.snippet && (
                <div className="chat-message__citation-snippet">
                  {citation.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ピン留めボタン（タスク 10.4 で有効化） */}
      {onPin && !isUser && (
        <button
          className="chat-message__pin-button"
          onClick={() => onPin(message)}
          aria-label="メモパッドにピン留め"
          title="メモパッドにピン留め"
        >
          📌 ピン留め
        </button>
      )}
    </div>
  );
}

/**
 * 時刻をフォーマット
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'たった今';
  } else if (diffMins < 60) {
    return `${diffMins}分前`;
  } else if (diffMins < 1440) {
    return `${Math.floor(diffMins / 60)}時間前`;
  } else {
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
