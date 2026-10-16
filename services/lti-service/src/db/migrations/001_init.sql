-- LTI service schema v1 (docs/architecture/data-model.md §1). Times are epoch milliseconds.
CREATE TABLE tool_account (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  launch_url TEXT NOT NULL,
  deep_linking_url TEXT NOT NULL,
  registration_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE tool_key (
  kid TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  public_jwk TEXT NOT NULL,
  private_jwk_encrypted BLOB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX tool_key_account ON tool_key(tool_account_id, status);

CREATE TABLE platform (
  id TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  auth_endpoint TEXT NOT NULL,
  token_endpoint TEXT NOT NULL,
  jwks_url TEXT NOT NULL,
  product_family_code TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tool_account_id, issuer, client_id)
);

CREATE TABLE deployment (
  platform_id TEXT NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL,
  PRIMARY KEY (platform_id, deployment_id)
);

CREATE TABLE oidc_state (
  state_hash TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL,
  platform_id TEXT NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
  nonce TEXT NOT NULL,
  target_link_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE launch (
  id TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL,
  platform_id TEXT NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  claims TEXT NOT NULL,
  ltik_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
