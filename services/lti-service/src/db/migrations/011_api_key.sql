-- LA-E5-07, LA-ADR-06 D5. The old account hash column stays, but authentication uses this table.
CREATE TABLE api_key (
  id TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  prefix TEXT,
  hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX api_key_account ON api_key(tool_account_id, revoked_at, expires_at);

-- The old hash cannot give the display prefix. A migrated key has no prefix until it is replaced.
INSERT INTO api_key (id, tool_account_id, prefix, hash, label, scopes, created_at, created_by)
  SELECT 'key_' || lower(hex(randomblob(16))), id, NULL, api_key_hash, 'bootstrap', '["launch","admin"]', created_at, 'system:bootstrap'
  FROM tool_account;
