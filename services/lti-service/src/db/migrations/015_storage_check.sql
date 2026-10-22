-- LA-ADR-05 D1: checked launches await browser binding for at most 120 seconds.
CREATE TABLE storage_check (
  check_hash TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  platform_id TEXT NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
  state_hash TEXT NOT NULL,
  prepared_launch TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX storage_check_created ON storage_check(created_at);
