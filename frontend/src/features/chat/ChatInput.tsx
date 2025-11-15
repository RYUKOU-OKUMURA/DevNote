import { useState, KeyboardEvent } from 'react';
import './ChatInput.css';

export interface ChatInputProps {
  /**
   * メッセージ送信時のコールバック
   */
  onSendMessage: (message: string) => void;
  /**
   * 送信中かどうか
   */
  isSending: boolean;
  /**
   * プレースホルダーテキスト
   */
  placeholder?: string;
}

/**
 * チャット入力フォームコンポーネント
 * タスク 9.1 で実装
 */
export function ChatInput({
  onSendMessage,
  isSending,
  placeholder = 'リポジトリについて質問してください...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const maxLength = 5000;

  /**
   * メッセージ送信処理
   */
  const handleSend = () => {
    const trimmedMessage = message.trim();

    // 空メッセージチェック
    if (!trimmedMessage) {
      return;
    }

    // 最大長チェック
    if (trimmedMessage.length > maxLength) {
      alert(`メッセージは${maxLength}文字以内で入力してください`);
      return;
    }

    // メッセージ送信
    onSendMessage(trimmedMessage);
    setMessage('');
  };

  /**
   * Enterキーで送信（Shift+Enterは改行）
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="chat-input">
      <div className="chat-input__container">
        <textarea
          className="chat-input__textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSending}
          rows={3}
          aria-label="チャットメッセージ入力"
        />
        <div className="chat-input__footer">
          <div className={`chat-input__counter ${isOverLimit ? 'chat-input__counter--error' : ''}`}>
            {characterCount} / {maxLength}
          </div>
          <button
            className="chat-input__button"
            onClick={handleSend}
            disabled={isSending || !message.trim() || isOverLimit}
            aria-label="メッセージを送信"
          >
            {isSending ? '送信中...' : '送信'}
          </button>
        </div>
      </div>
      <div className="chat-input__hint">
        Enterキーで送信、Shift+Enterで改行
      </div>
    </div>
  );
}
