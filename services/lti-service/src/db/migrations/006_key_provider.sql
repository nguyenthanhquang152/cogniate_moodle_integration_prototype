-- LA-E5-08 (LA-ADR-06 D6, LA data-model §4): the key version that derives each service key. Old rows get "legacy", the
-- version of today's LTI_MASTER_KEY subkey, so every existing service key keeps its exact value. A new derivation
-- version is an incident step only: it changes each activity's key at its next launch.
ALTER TABLE service_key ADD COLUMN derivation_version TEXT NOT NULL DEFAULT 'legacy';
