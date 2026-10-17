-- T3a: service keys (data-model §1, contract §3.3). One key per (platform, deployment, context, resource link).
-- Only the SHA-256 of the key is stored. The key itself is derived again (HMAC with a subkey of LTI_MASTER_KEY), so a
-- later launch of the same activity returns the same key without a stored secret.
CREATE TABLE service_key (
  key_hash TEXT PRIMARY KEY,
  tool_account_id TEXT NOT NULL REFERENCES tool_account(id),
  platform_id TEXT NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  resource_link_id TEXT NOT NULL,
  ags_claim TEXT,
  nrps_claim TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (platform_id, deployment_id, context_id, resource_link_id)
);
