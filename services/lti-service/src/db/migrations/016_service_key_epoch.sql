-- LA-E5-15: old keys keep epoch 0. A launch after revocation increments this value before deriving its new key.
ALTER TABLE service_key ADD COLUMN issue_epoch INTEGER NOT NULL DEFAULT 0 CHECK (issue_epoch >= 0);
