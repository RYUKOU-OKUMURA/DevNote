-- Migration: Add file_paths column to Notes table
-- Created: 2025-11-17
-- Description: Store repository file paths as JSON array

ALTER TABLE Notes ADD COLUMN file_paths TEXT;
