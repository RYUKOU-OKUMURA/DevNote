import { useState, useCallback, useRef } from 'react';
import type { ChatStreamChunk, Citation } from '../../../../shared/types';

export interface UseChatStreamOptions {
  /**
   * ストリーミング完了時のコールバック
   */
  onComplete?: () => void;
  /**
   * エラー発生時のコールバック
   */
  onError?: (error: Error) => void;
}

export interface UseChatStreamReturn {
  /**
   * ストリーミング中のメッセージ
   */
  streamingMessage: string;
  /**
   * ストリーミング中の引用情報
   */
  streamingCitations: Citation[];
  /**
   * ストリーミング中かどうか
   */
  isStreaming: boolean;
  /**
   * ストリーミングを開始する
   */
  startStreaming: (url: string, options: RequestInit) => Promise<void>;
  /**
   * ストリーミングをリセットする
   */
  resetStreaming: () => void;
}

/**
 * チャットストリーミング処理のカスタムフック
 * タスク 9.3 で実装
 */
export function useChatStream({
  onComplete,
  onError,
}: UseChatStreamOptions = {}): UseChatStreamReturn {
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * ストリーミングを開始する
   */
  const startStreaming = useCallback(
    async (url: string, options: RequestInit = {}) => {
      // 既存のストリーミングをキャンセル
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 新しいAbortControllerを作成
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 状態をリセット
      setStreamingMessage('');
      setStreamingCitations([]);
      setIsStreaming(true);

      try {
        const response = await fetch(url, {
          ...options,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // デコードしてバッファに追加
          buffer += decoder.decode(value, { stream: true });

          // 行ごとに処理
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 最後の不完全な行はバッファに残す

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // "data: "を除去

              try {
                const chunk: ChatStreamChunk = JSON.parse(data);

                switch (chunk.type) {
                  case 'chunk':
                    if (chunk.content) {
                      setStreamingMessage((prev) => prev + chunk.content);
                    }
                    break;

                  case 'citation':
                    if (chunk.citation) {
                      setStreamingCitations((prev) => [...prev, chunk.citation!]);
                    }
                    break;

                  case 'done':
                    setIsStreaming(false);
                    onComplete?.();
                    return;

                  default:
                    console.warn('Unknown chunk type:', chunk);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }

        // ストリーミング完了
        setIsStreaming(false);
        onComplete?.();
      } catch (error) {
        if (error instanceof Error) {
          // Abortエラーは無視
          if (error.name === 'AbortError') {
            return;
          }

          console.error('Streaming error:', error);
          setIsStreaming(false);
          onError?.(error);
        }
      }
    },
    [onComplete, onError]
  );

  /**
   * ストリーミングをリセットする
   */
  const resetStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStreamingMessage('');
    setStreamingCitations([]);
    setIsStreaming(false);
  }, []);

  return {
    streamingMessage,
    streamingCitations,
    isStreaming,
    startStreaming,
    resetStreaming,
  };
}
