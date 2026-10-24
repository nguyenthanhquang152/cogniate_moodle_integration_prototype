-- LA-E5-11, LA-ADR-06 D4 and BD-A2-45. No foreign keys: audit history survives deletion of its target.
CREATE TABLE audit_event (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('operator', 'system')),
  actor_id TEXT NOT NULL,
  library_id TEXT,
  connection_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('ok', 'refused')),
  code TEXT,
  trace_id TEXT,
  client_ip TEXT,
  details TEXT
);
CREATE INDEX audit_event_library ON audit_event (library_id, ts);
CREATE INDEX audit_event_connection ON audit_event (library_id, connection_id, ts);
CREATE TRIGGER audit_event_append_only BEFORE UPDATE ON audit_event
BEGIN
  SELECT RAISE(ABORT, 'audit_event is append-only');
END;
CREATE TRIGGER audit_event_replace_guard BEFORE INSERT ON audit_event
WHEN EXISTS (SELECT 1 FROM audit_event WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_event is append-only');
END;
