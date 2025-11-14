-- Migration: Create Indexes
-- Created: 2025-11-14
-- Description: Add indexes for optimized queries

-- Notes table indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON Notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON Notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_last_accessed_at ON Notes(last_accessed_at);

-- ChatMessages table composite index
CREATE INDEX IF NOT EXISTS idx_chat_messages_note_id_created_at ON ChatMessages(note_id, created_at);

-- PinnedLogs table index
CREATE INDEX IF NOT EXISTS idx_pinned_logs_note_id ON PinnedLogs(note_id);
