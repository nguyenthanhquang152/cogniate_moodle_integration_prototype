-- LA-E5-16, BD-A2-51: one client key names one request per account.
CREATE TABLE idempotency_record (
  tool_account_id TEXT NOT NULL REFERENCES tool_account (id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  params TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  owner TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'completed')),
  status INTEGER,
  body TEXT,
  target_type TEXT,
  target_id TEXT,
  code TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tool_account_id, key)
);
CREATE INDEX idempotency_record_created ON idempotency_record (created_at);
