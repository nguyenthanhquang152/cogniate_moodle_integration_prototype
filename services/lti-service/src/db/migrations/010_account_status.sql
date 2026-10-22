-- LA-ADR-06 D2: old accounts keep their tool URLs and claim behaviour.
ALTER TABLE tool_account ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE tool_account ADD COLUMN status_changed_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tool_account ADD COLUMN public_base_url TEXT;
ALTER TABLE tool_account ADD COLUMN limits TEXT;
ALTER TABLE tool_account ADD COLUMN claim_policy TEXT;
ALTER TABLE tool_account ADD COLUMN service_key_write_scope TEXT NOT NULL DEFAULT 'context';
UPDATE tool_account SET status_changed_at = created_at;
