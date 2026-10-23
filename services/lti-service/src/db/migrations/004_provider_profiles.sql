-- M1 (ADR-011, data-model §4.1): provider profiles, site and service origins, deployment state, binding generations
-- and binding refs. Forward only and additive: old rows keep today's behaviour (standard profile, site = issuer
-- origin, active deployments, generation 0, byte-identical service keys).
ALTER TABLE platform ADD COLUMN profile TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE platform ADD COLUMN site_url TEXT;
ALTER TABLE platform ADD COLUMN service_url TEXT;
ALTER TABLE platform ADD COLUMN binding_ref TEXT;

ALTER TABLE deployment ADD COLUMN site_url TEXT;
ALTER TABLE deployment ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deployment ADD COLUMN binding_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deployment ADD COLUMN binding_ref TEXT;
ALTER TABLE deployment ADD COLUMN created_at INTEGER;

ALTER TABLE oidc_state ADD COLUMN login_deployment_id TEXT;

ALTER TABLE launch ADD COLUMN site_origin TEXT;
ALTER TABLE launch ADD COLUMN service_origin TEXT;
ALTER TABLE launch ADD COLUMN binding_generation INTEGER NOT NULL DEFAULT 0;

ALTER TABLE service_key ADD COLUMN binding_generation INTEGER NOT NULL DEFAULT 0;

CREATE INDEX platform_profile ON platform (tool_account_id, profile);
