/**
 * NoteCard Component
 * Displays a single note card with status, actions, and metadata
 */

import { useState } from 'react'
import type { Note } from '../../../../shared/types'
import './NoteCard.css'

interface NoteCardProps {
  note: Note
  onSelect: (noteId: string) => void
  onDelete: (noteId: string) => void
  onSync: (noteId: string) => void
  onExport?: (noteId: string) => void
}

export function NoteCard({
  note,
  onSelect,
  onDelete,
  onSync,
  onExport,
}: NoteCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(`「${note.repository_name}」を削除してもよろしいですか？\n\nこの操作は取り消せません。チャット履歴とメモも削除されます。`)) {
      return
    }

    setIsDeleting(true)
    try {
      await onDelete(note.id)
    } catch (error) {
      console.error('Failed to delete note:', error)
      alert('ノートの削除に失敗しました')
      setIsDeleting(false)
    }
  }

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation()

    setIsSyncing(true)
    try {
      await onSync(note.id)
    } catch (error) {
      console.error('Failed to sync note:', error)
      alert('同期の開始に失敗しました')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onExport) {
      onExport(note.id)
    }
  }

  const handleCardClick = () => {
    if (note.status === 'Ready') {
      onSelect(note.id)
    }
  }

  const getStatusBadge = () => {
    switch (note.status) {
      case 'Indexing':
        return <span className="status-badge status-indexing">準備中...</span>
      case 'Ready':
        return <span className="status-badge status-ready">利用可能</span>
      case 'Failed':
        return <span className="status-badge status-failed">同期失敗</span>
      case 'Auth Required':
        return <span className="status-badge status-auth-required">認証エラー</span>
      default:
        return null
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未同期'

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'たった今'
    if (diffMins < 60) return `${diffMins}分前`
    if (diffHours < 24) return `${diffHours}時間前`
    if (diffDays < 7) return `${diffDays}日前`

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className={`note-card ${note.status === 'Ready' ? 'note-card-clickable' : ''} ${isDeleting ? 'note-card-deleting' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="note-card-header">
        <div className="note-card-title">
          <h3>{note.repository_name}</h3>
          {getStatusBadge()}
        </div>
      </div>

      <div className="note-card-body">
        <div className="note-card-meta">
          <div className="meta-item">
            <span className="meta-label">最終同期:</span>
            <span className="meta-value">{formatDate(note.last_synced_at)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">作成日:</span>
            <span className="meta-value">{formatDate(note.created_at)}</span>
          </div>
        </div>

        {note.status === 'Failed' && note.error_message && (
          <div className="note-card-error">
            <p className="error-title">エラー詳細:</p>
            <p className="error-message">{note.error_message}</p>
          </div>
        )}

        {note.status === 'Auth Required' && (
          <div className="note-card-warning">
            <p>GitHubへのアクセス権限が必要です。再認証してください。</p>
          </div>
        )}
      </div>

      {showActions && !isDeleting && (
        <div className="note-card-actions">
          {note.status !== 'Indexing' && (
            <button
              className="action-btn action-btn-sync"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? '同期中...' : '再同期'}
            </button>
          )}

          {note.status === 'Ready' && onExport && (
            <button
              className="action-btn action-btn-export"
              onClick={handleExport}
            >
              エクスポート
            </button>
          )}

          <button
            className="action-btn action-btn-delete"
            onClick={handleDelete}
          >
            削除
          </button>
        </div>
      )}

      {note.status === 'Indexing' && (
        <div className="note-card-progress">
          <div className="progress-bar">
            <div className="progress-bar-fill"></div>
          </div>
          <p className="progress-text">リポジトリを同期中...</p>
        </div>
      )}

      {isDeleting && (
        <div className="note-card-overlay">
          <p>削除中...</p>
        </div>
      )}
    </div>
  )
}
