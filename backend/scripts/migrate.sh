#!/bin/bash
# Run all migrations in order

wrangler d1 execute devnote-db --local --file=migrations/0001_initial_schema.sql
wrangler d1 execute devnote-db --local --file=migrations/0002_create_indexes.sql
wrangler d1 execute devnote-db --local --file=migrations/0003_add_file_paths.sql

echo "✅ Local migrations complete"
