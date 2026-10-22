-- LA-E5-02 (LA-ADR-06 D4): the audit log of the LTI service. One row per authenticated admin or operator change.
-- Append only: the trigger refuses every UPDATE. Only the audit-retention job (LA-E5-19) deletes old rows (fitness rule
-- audit-event-delete). Forward only and additive: a new table, no change to old rows.
CREATE TABLE audit_event (
  id               TEXT PRIMARY KEY,         -- aud_ + 16 random bytes (base64url)
  ts               INTEGER NOT NULL,         -- epoch ms; rows sort by ts, then id
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('api_key', 'operator', 'system', 'platform')),
  actor_id         TEXT NOT NULL,            -- key id, operator name, command or job name, or platform id
  tool_account_id  TEXT,                     -- the tenant, or NULL for an operator-global action
  action           TEXT NOT NULL,            -- for example platform.create (contract delta §5)
  target_type      TEXT,
  target_id        TEXT,
  result           TEXT NOT NULL CHECK (result IN ('ok', 'refused')),
  code             TEXT,                     -- the details.message code of a refused answer
  trace_id         TEXT,
  client_ip        TEXT,
  details          TEXT                      -- JSON, at most 4 KB, after redact(); never a key, token or secret
);
CREATE INDEX audit_event_ts ON audit_event (ts, id);
CREATE INDEX audit_event_account ON audit_event (tool_account_id, ts, id);
CREATE TRIGGER audit_event_append_only BEFORE UPDATE ON audit_event
BEGIN
  SELECT RAISE(ABORT, 'audit_event is append-only');
END;
