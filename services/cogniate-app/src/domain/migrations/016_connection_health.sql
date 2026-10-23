-- LA-E6-02 (A2 LA-ADR-08 D5, LA data model §5a): the connection health view.
-- connection_event: launch and Deep Linking refusals that name a connection, connection checks, and later disconnect
-- and suspend events. At most 100 rows per connection (the writer trims) and 30 days (the app retention job).
CREATE TABLE connection_event (
  id            TEXT PRIMARY KEY,                     -- cev_...
  connection_id TEXT NOT NULL REFERENCES connection (id),
  library_id    TEXT NOT NULL REFERENCES library (id),
  kind          TEXT NOT NULL,                        -- launch_refused, deep_link_refused, check, disconnect, suspend
  code          TEXT,                                 -- for example site_mismatch, lms_mismatch, deployment_not_approved, a check result
  trace_id      TEXT,
  at            INTEGER NOT NULL
);
CREATE INDEX connection_event_connection ON connection_event (connection_id, at);

-- The key id inside the last exported setup artifact with an embedded key (today the inline key of a developer key
-- JSON); NULL for a key URL or no such export. A generic name: core has no channel-named column.
ALTER TABLE connection ADD COLUMN artifact_key_kid TEXT;
