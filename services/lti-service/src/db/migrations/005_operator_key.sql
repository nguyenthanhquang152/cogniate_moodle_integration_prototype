-- LA-E5-01 (LA-ADR-06 D3): the operator keys of the operator listener. One key per person. Only the SHA-256 hash of a
-- key is stored. Forward only and additive: a new table, no change to old rows.
CREATE TABLE operator_key (
  id            TEXT PRIMARY KEY,          -- opk_ + 16 random bytes (base64url)
  operator      TEXT NOT NULL,             -- operator name (the audit actor is operator:<name>)
  key_hash      TEXT NOT NULL UNIQUE,      -- SHA-256 hex of ltio_ + 43 base64url characters
  created_at    INTEGER NOT NULL,          -- epoch ms
  expires_at    INTEGER NOT NULL,          -- epoch ms; the key works while now < expires_at
  last_used_at  INTEGER,                   -- epoch ms of the last accepted request, or NULL
  revoked_at    INTEGER                    -- epoch ms, or NULL
);
