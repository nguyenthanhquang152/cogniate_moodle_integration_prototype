-- T5a: runtime sessions and score syncs (app contract §7, §10; data-model §2; ADR-010).
-- One play session = one runtime session (sessionId): its commits are ordered by seq, and its session time counts once.
-- A-T4b2-03 (from T5a on): play_session.id and picker_session.id hold the SHA-256 hex of the capability id (the raw
-- ply_/pck_ id is only in the URL). Rows made before this change keep a raw id that no lookup can reach (inert).
ALTER TABLE play_session ADD COLUMN last_seq INTEGER NOT NULL DEFAULT 0;            -- last accepted seq (RuntimeState.lastSeq)
ALTER TABLE play_session ADD COLUMN max_session_time_cs INTEGER NOT NULL DEFAULT 0; -- largest session_time seen (centiseconds)
ALTER TABLE play_session ADD COLUMN entry TEXT;                                     -- cmi.core.entry, fixed at the first state read
ALTER TABLE play_session ADD COLUMN finished_at INTEGER;                            -- first accepted `finish`

CREATE TABLE score_sync (
  id               TEXT PRIMARY KEY,                -- sync_...
  attempt_id       TEXT NOT NULL REFERENCES attempt (id),
  resource_link_id TEXT NOT NULL REFERENCES resource_link (id),  -- the activity (best-result rule per learner and activity)
  user_sub         TEXT NOT NULL,
  payload          TEXT NOT NULL,                   -- JSON: the AGS score body (app contract §10)
  score_given      REAL NOT NULL,
  score_maximum    REAL NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'conflict', 'failed', 'superseded')),
  tries            INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  next_try_at      INTEGER,                         -- NULL when not pending
  sent_at          INTEGER,
  last_error       TEXT,                            -- short, safe text (no token, no key)
  updated_at       INTEGER NOT NULL
);
CREATE INDEX score_sync_due ON score_sync (status, next_try_at);
CREATE INDEX score_sync_learner ON score_sync (resource_link_id, user_sub);
CREATE INDEX score_sync_attempt ON score_sync (attempt_id);
