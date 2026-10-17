-- T3b: dynamic registration sessions (data-model §1, contract §2.4, §3.8, §6). A session expires with the
-- registration token (at most 1 h); rows are kept 24 h. The registration token is stored encrypted (AES-256-GCM).
CREATE TABLE registration_session (
  id TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  openid_configuration_url TEXT NOT NULL,
  registration_token_encrypted BLOB,
  platform_configuration TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('new', 'update')),
  existing_platform_id TEXT,
  privacy_level TEXT NOT NULL,
  passthrough_params TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completing', 'completed')),
  platform_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX registration_session_created ON registration_session(created_at);
