-- LA-E5-10, LA-ADR-06 D7: keep the published set on upgrade. Times are epoch milliseconds.
ALTER TABLE tool_key ADD COLUMN published_at INTEGER;
ALTER TABLE tool_key ADD COLUMN activated_at INTEGER;
ALTER TABLE tool_key ADD COLUMN retired_at INTEGER;
ALTER TABLE tool_key ADD COLUMN removed_at INTEGER;

-- SQLite gives every use of 'now' in this statement the same migration time.
-- Cleanup clears the private blobs of removed rows at its first run.
UPDATE tool_key SET
  published_at = created_at,
  activated_at = created_at,
  retired_at = CASE WHEN status = 'retired' AND created_at > CAST(unixepoch('subsec') * 1000 AS INTEGER) - 2592000000
    THEN CAST(unixepoch('subsec') * 1000 AS INTEGER) END,
  removed_at = CASE WHEN status = 'retired' AND created_at <= CAST(unixepoch('subsec') * 1000 AS INTEGER) - 2592000000
    THEN CAST(unixepoch('subsec') * 1000 AS INTEGER) END,
  status = CASE WHEN status = 'retired' AND created_at <= CAST(unixepoch('subsec') * 1000 AS INTEGER) - 2592000000
    THEN 'removed' ELSE status END;

CREATE UNIQUE INDEX tool_key_one_active ON tool_key(tool_account_id) WHERE status = 'active';
CREATE UNIQUE INDEX tool_key_one_next ON tool_key(tool_account_id) WHERE status = 'next';
