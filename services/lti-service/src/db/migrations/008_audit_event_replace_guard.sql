-- LA-E5-02 (A-LA-E5-02-01): refuse an insert that would replace an existing audit row.
-- This guard also works with recursive_triggers off, which is SQLite's default.
CREATE TRIGGER audit_event_replace_guard BEFORE INSERT ON audit_event
WHEN EXISTS (SELECT 1 FROM audit_event WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_event is append-only');
END;
