-- LA-E2-01 (data-model §4): the client assertion audience of a platform (admin value or the DR authorization_server;
-- NULL = the profile default) and the scopes that the platform granted at Dynamic Registration (a JSON list;
-- NULL = today's scope set). Old rows get NULL in both columns, so their token requests do not change.
ALTER TABLE platform ADD COLUMN client_assertion_aud TEXT;
ALTER TABLE platform ADD COLUMN granted_scopes TEXT;
