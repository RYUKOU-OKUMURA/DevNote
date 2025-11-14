-- Migration: Initial Schema
-- Created: 2025-11-14
-- Description: Create Users, Notes, ChatMessages, and PinnedLogs tables

-- Users table
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  github_username TEXT NOT NULL UNIQUE,
  github_access_token TEXT, -- Encrypted
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notes table
CREATE TABLE IF NOT EXISTS Notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Indexing', 'Ready', 'Failed', 'Auth Required')) DEFAULT 'Indexing',
  file_store_id TEXT,
  last_synced_at TEXT,
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  latest_commit_sha TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- ChatMessages table
CREATE TABLE IF NOT EXISTS ChatMessages (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations TEXT, -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE
);

-- PinnedLogs table
CREATE TABLE IF NOT EXISTS PinnedLogs (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES ChatMessages(id) ON DELETE CASCADE
);
