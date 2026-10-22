-- LA-E5-03: operator overrides. A setting and its audit event commit together.
CREATE TABLE service_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- BD-A2-20: old sessions have no client key and do not count toward the cap.
ALTER TABLE registration_session ADD COLUMN client_key TEXT;
CREATE INDEX registration_session_client ON registration_session(tool_account_id, client_key, status);
