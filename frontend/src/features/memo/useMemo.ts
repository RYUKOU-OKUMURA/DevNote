import { useState, useEffect, useRef, useCallback } from 'react'
import type { Memo } from '../../../../shared/types'

const DEBOUNCE_DELAY = 2000 // 2 seconds
const MAX_MEMO_SIZE = 100 * 1024 // 100KB

interface UseMemoOptions {
  noteId?: string
}

interface UseMemoReturn {
  content: string
  isLoading: boolean
  isSaving: boolean
  error: Error | null
  hasUnsavedChanges: boolean
  updateContent: (newContent: string) => void
  saveNow: () => Promise<void>
}

/**
 * メモパッドの状態管理、自動保存、復元を提供するカスタムフック
 * タスク 10.2, 10.3
 */
export function useMemo({ noteId }: UseMemoOptions): UseMemoReturn {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedContentRef = useRef('')

  /**
   * メモパッドの内容をサーバーに保存する
   */
  const saveMemo = useCallback(
    async (contentToSave: string) => {
      if (!noteId) return

      try {
        setIsSaving(true)
        setError(null)

        const response = await fetch('/api/memo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            note_id: noteId,
            content: contentToSave,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to save memo')
        }

        lastSavedContentRef.current = contentToSave
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('Failed to save memo:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsSaving(false)
      }
    },
    [noteId]
  )

  /**
   * メモパッドの内容を更新する
   * debounce付き自動保存をトリガーする
   */
  const updateContent = useCallback(
    (newContent: string) => {
      // サイズチェック
      const contentSize = new TextEncoder().encode(newContent).length
      if (contentSize > MAX_MEMO_SIZE) {
        setError(new Error(`メモパッドの内容が最大サイズ（${MAX_MEMO_SIZE} bytes）を超えています`))
        return
      }

      setContent(newContent)
      setHasUnsavedChanges(newContent !== lastSavedContentRef.current)

      // 既存のタイマーをクリア
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // 2秒後に自動保存
      saveTimeoutRef.current = setTimeout(() => {
        saveMemo(newContent)
      }, DEBOUNCE_DELAY)
    },
    [saveMemo]
  )

  /**
   * 即座に保存する（debounceをスキップ）
   */
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveMemo(content)
  }, [content, saveMemo])

  /**
   * ワークスペース訪問時にメモパッドを復元する
   * タスク 10.3
   */
  useEffect(() => {
    if (!noteId) return

    const fetchMemo = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/memo?note_id=${noteId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to fetch memo')
        }

        const memo: Memo = await response.json()
        setContent(memo.content)
        lastSavedContentRef.current = memo.content
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('Failed to fetch memo:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchMemo()
  }, [noteId])

  /**
   * コンポーネントのアンマウント時に保留中の保存を実行
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  /**
   * ページ離脱時に未保存の変更がある場合、警告を表示
   * タスク 10.3
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = '未保存の変更があります。ページを離れますか？'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  return {
    content,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    updateContent,
    saveNow,
  }
}
