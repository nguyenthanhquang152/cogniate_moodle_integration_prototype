-- LA-E2-02 (LA-ADR-02 D5 item 3): the kind of registration token that the start page found: 'scope-jwt' (a verified
-- registration JWT with the scope claim reg or reg-update) or 'opaque-bearer' (only sent back as the Bearer token).
-- complete applies the exact rule of the chosen profile to it. NULL = an old row, read as today's rule.
ALTER TABLE registration_session ADD COLUMN token_kind TEXT;
