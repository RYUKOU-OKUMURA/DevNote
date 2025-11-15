/**
 * DashboardPage Component
 * Main dashboard showing all user's notes
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Note } from '../../../shared/types'
import { notesApi, authApi } from '../lib/api'
import { NoteCard } from '../features/notes/NoteCard'
import { CreateNoteDialog } from '../features/notes/CreateNoteDialog'
import './DashboardPage.css'

const POLLING_INTERVAL = 5000 // 5 seconds

export function DashboardPage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Fetch notes from API
  const fetchNotes = useCallback(async () => {
    try {
      const data = await notesApi.list()
      setNotes(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch notes:', err)
      setError(err instanceof Error ? err.message : 'ノートの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Polling for updates (only if there are indexing notes)
  useEffect(() => {
    const hasIndexingNotes = notes.some((note) => note.status === 'Indexing')

    if (!hasIndexingNotes) return

    const intervalId = setInterval(() => {
      fetchNotes()
    }, POLLING_INTERVAL)

    return () => clearInterval(intervalId)
  }, [notes, fetchNotes])

  // Handle note selection
  const handleNoteSelect = (noteId: string) => {
    navigate(`/workspace/${noteId}`)
  }

  // Handle note creation
  const handleCreateNote = async (repositoryUrl: string) => {
    const response = await notesApi.create({ repository_url: repositoryUrl })

    // Add the new note to the list
    setNotes((prev) => [response.note, ...prev])
  }

  // Handle note deletion
  const handleDeleteNote = async (noteId: string) => {
    await notesApi.delete(noteId)

    // Remove the note from the list
    setNotes((prev) => prev.filter((note) => note.id !== noteId))
  }

  // Handle note sync
  const handleSyncNote = async (noteId: string) => {
    await notesApi.sync(noteId)

    // Update the note status to Indexing
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, status: 'Indexing' as const }
          : note
      )
    )

    // Start polling to check for updates
    setTimeout(fetchNotes, 2000)
  }

  // Handle chat history export
  const handleExportNote = async (noteId: string) => {
    try {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return

      // This is a placeholder - actual implementation would fetch chat history
      // and export it as Markdown
      alert(`チャット履歴のエクスポート機能は近日実装予定です\n\nノート: ${note.repository_name}`)
    } catch (err) {
      console.error('Failed to export note:', err)
      alert('エクスポートに失敗しました')
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await authApi.logout()
      navigate('/')
    } catch (err) {
      console.error('Failed to logout:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-error">
          <h2>エラーが発生しました</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchNotes}>
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <h1>DevNote</h1>
            <p className="header-subtitle">
              リポジトリノート ({notes.length}/10)
            </p>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={notes.length >= 10}
            >
              + 新規ノート作成
            </button>
            <button className="btn btn-secondary" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {notes.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-icon">📝</div>
            <h2>ノートがまだありません</h2>
            <p>
              GitHubリポジトリを登録して、AIと対話的にコードを探索しましょう
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              最初のノートを作成
            </button>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onSelect={handleNoteSelect}
                onDelete={handleDeleteNote}
                onSync={handleSyncNote}
                onExport={handleExportNote}
              />
            ))}
          </div>
        )}
      </main>

      <CreateNoteDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateNote}
      />
    </div>
  )
}
