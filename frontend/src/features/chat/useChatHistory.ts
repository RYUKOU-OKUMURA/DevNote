import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../../../../shared/types';

export interface UseChatHistoryOptions {
  /**
   * ノートID
   */
  noteId?: string;
  /**
   * APIのベースURL
   */
  apiBaseUrl?: string;
}

export interface UseChatHistoryReturn {
  /**
   * チャット履歴
   */
  messages: ChatMessage[];
  /**
   * ローディング中かどうか
   */
  isLoading: boolean;
  /**
   * エラー
   */
  error: Error | null;
  /**
   * チャット履歴を再読み込みする
   */
  reload: () => Promise<void>;
  /**
   * 新しいメッセージを追加する（楽観的更新用）
   */
  addMessage: (message: ChatMessage) => void;
}

/**
 * チャット履歴取得のカスタムフック
 * タスク 9.2 で使用
 */
export function useChatHistory({
  noteId,
  apiBaseUrl = '/api',
}: UseChatHistoryOptions = {}): UseChatHistoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * チャット履歴を取得する
   */
  const fetchHistory = useCallback(async () => {
    if (!noteId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/chat/history?note_id=${noteId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // クッキーを含める
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch chat history: ${response.status}`);
      }

      const data: ChatMessage[] = await response.json();
      setMessages(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Failed to fetch chat history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [noteId, apiBaseUrl]);

  /**
   * チャット履歴を再読み込みする
   */
  const reload = useCallback(async () => {
    await fetchHistory();
  }, [fetchHistory]);

  /**
   * 新しいメッセージを追加する（楽観的更新用）
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  /**
   * noteIdが変わったら履歴を取得
   */
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    messages,
    isLoading,
    error,
    reload,
    addMessage,
  };
}
