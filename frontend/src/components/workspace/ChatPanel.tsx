import { useCallback } from 'react';
import type { ChatMessage, ChatRequest } from '../../../../shared/types';
import { ChatHistory } from '../../features/chat/ChatHistory';
import { ChatInput } from '../../features/chat/ChatInput';
import { useChatHistory } from '../../features/chat/useChatHistory';
import { useChatStream } from '../../features/chat/useChatStream';
import './ChatPanel.css';

export interface ChatPanelProps {
  /**
   * ノートID
   */
  noteId?: string;
  /**
   * 選択されたファイルパスの配列
   * undefinedの場合はリポジトリ全体をコンテキストとする
   */
  selectedFiles?: string[];
}

/**
 * チャットパネルコンポーネント
 * タスク 9.1-9.4 で実装
 */
export function ChatPanel({ noteId, selectedFiles }: ChatPanelProps) {
  // チャット履歴を取得
  const { messages, isLoading, error, reload, addMessage } = useChatHistory({
    noteId,
  });

  // ストリーミング処理
  const {
    streamingMessage,
    streamingCitations,
    isStreaming,
    startStreaming,
    resetStreaming,
  } = useChatStream({
    onComplete: () => {
      // ストリーミング完了後、履歴を再読み込み
      reload();
      resetStreaming();
    },
    onError: (error) => {
      alert(`メッセージの送信に失敗しました: ${error.message}`);
      resetStreaming();
    },
  });

  /**
   * メッセージ送信処理
   * タスク 9.4: 選択ファイルをチャットリクエストに含める
   */
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!noteId) {
        alert('ノートIDが指定されていません');
        return;
      }

      // 楽観的更新: ユーザーメッセージをすぐに表示
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        note_id: noteId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);

      // チャットリクエストを作成
      const chatRequest: ChatRequest = {
        note_id: noteId,
        message,
        selected_files: selectedFiles, // タスク 9.4: 選択ファイルを含める
      };

      // ストリーミング開始
      await startStreaming('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(chatRequest),
      });
    },
    [noteId, selectedFiles, addMessage, startStreaming]
  );

  // ノートIDが指定されていない場合
  if (!noteId) {
    return (
      <div className="chat-panel">
        <div className="chat-panel__error">
          <p>ノートが選択されていません</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="chat-panel">
        <div className="chat-panel__error">
          <p>チャット履歴の取得に失敗しました</p>
          <button onClick={reload}>再試行</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">対話: チャット</h2>
        {selectedFiles && selectedFiles.length > 0 && (
          <div className="chat-panel__context">
            📄 コンテキスト: {selectedFiles.join(', ')}
          </div>
        )}
      </div>

      {/* チャット履歴表示（タスク 9.2, 9.3） */}
      <ChatHistory
        messages={messages}
        streamingMessage={streamingMessage}
        streamingCitations={streamingCitations}
      />

      {/* チャット入力フォーム（タスク 9.1） */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isSending={isStreaming}
      />

      {/* ローディング表示 */}
      {isLoading && messages.length === 0 && (
        <div className="chat-panel__loading">
          チャット履歴を読み込み中...
        </div>
      )}
    </div>
  );
}
