/**
 * CreateNoteDialog Component
 * Dialog for creating a new note from a GitHub repository URL
 */

import { useState } from 'react'
import './CreateNoteDialog.css'

interface CreateNoteDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (repositoryUrl: string) => Promise<void>
}

const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/

export function CreateNoteDialog({
  isOpen,
  onClose,
  onCreate,
}: CreateNoteDialogProps) {
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate URL format
    if (!GITHUB_REPO_PATTERN.test(repositoryUrl.trim())) {
      setError(
        'GitHubリポジトリのURL形式が正しくありません。\n例: https://github.com/owner/repo'
      )
      return
    }

    setIsSubmitting(true)

    try {
      await onCreate(repositoryUrl.trim())
      setRepositoryUrl('')
      onClose()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'ノートの作成に失敗しました'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setRepositoryUrl('')
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>新規ノート作成</h2>
          <button
            className="dialog-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <div className="form-group">
              <label htmlFor="repository-url">
                GitHubリポジトリURL
              </label>
              <input
                id="repository-url"
                type="text"
                className="form-input"
                placeholder="https://github.com/owner/repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <p className="form-hint">
                公開リポジトリまたは自分がアクセス可能なプライベートリポジトリのURLを入力してください
              </p>
            </div>

            {error && (
              <div className="form-error">
                <p>{error}</p>
              </div>
            )}

            <div className="form-info">
              <h3>ノート作成について</h3>
              <ul>
                <li>リポジトリのコードとドキュメントがAIによって学習されます</li>
                <li>初回の同期には数分かかる場合があります</li>
                <li>最大10個までノートを作成できます</li>
                <li>同期中もダッシュボードからいつでも進捗を確認できます</li>
              </ul>
            </div>
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !repositoryUrl.trim()}
            >
              {isSubmitting ? '作成中...' : 'ノートを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
