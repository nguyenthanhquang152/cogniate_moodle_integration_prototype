-- LA-E3-01 (LA-ADR-05 D1 rule 4): old logins keep the cookie path.
ALTER TABLE oidc_state ADD COLUMN storage_target TEXT;
ALTER TABLE oidc_state ADD COLUMN storage_origin TEXT;
