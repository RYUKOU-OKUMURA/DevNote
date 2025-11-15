import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../../../shared/types';
import { ChatMessage } from './ChatMessage';
import './ChatHistory.css';

export interface ChatHistoryProps {
  /**
   * チャットメッセージの配列
   */
  messages: ChatMessageType[];
  /**
   * ストリーミング中のメッセージ
   */
  streamingMessage?: string;
  /**
   * ストリーミング中の引用情報
   */
  streamingCitations?: ChatMessageType['citations'];
  /**
   * ピン留めボタンのコールバック（タスク 10.4 で実装）
   */
  onPinMessage?: (message: ChatMessageType) => void;
}

/**
 * チャット履歴表示コンポーネント
 * タスク 9.2 で実装
 */
export function ChatHistory({
  messages,
  streamingMessage,
  streamingCitations,
  onPinMessage,
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  /**
   * 新しいメッセージが追加されたら自動スクロール
   */
  useEffect(() => {
    if (scrollRef.current) {
      // 初回マウント時はスムーズスクロールなし
      const behavior = isInitialMount.current ? 'auto' : 'smooth';
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
      isInitialMount.current = false;
    }
  }, [messages, streamingMessage]);

  return (
    <div className="chat-history" ref={scrollRef}>
      {messages.length === 0 && !streamingMessage && (
        <div className="chat-history__empty">
          <div className="chat-history__empty-icon">💬</div>
          <p className="chat-history__empty-text">
            まだメッセージがありません
          </p>
          <p className="chat-history__empty-hint">
            下のフォームからリポジトリについて質問してください
          </p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onPin={onPinMessage}
        />
      ))}

      {/* ストリーミング中のメッセージを表示 */}
      {streamingMessage && (
        <div className="chat-message chat-message--assistant chat-message--streaming">
          <div className="chat-message__header">
            <span className="chat-message__role">AI</span>
            <span className="chat-message__streaming-indicator">
              <span className="chat-message__streaming-dot"></span>
              入力中...
            </span>
          </div>

          <div className="chat-message__content">
            {streamingMessage}
            <span className="chat-message__cursor">▊</span>
          </div>

          {/* ストリーミング中の引用情報 */}
          {streamingCitations && streamingCitations.length > 0 && (
            <div className="chat-message__citations">
              <div className="chat-message__citations-title">引用:</div>
              {streamingCitations.map((citation, index) => (
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
        </div>
      )}
    </div>
  );
}
