-- T5b: Resend (app contract §5, ADR-010 rule 10) and "Refresh from Moodle" (AGS results read).
-- resent_at: the 24 h retry window of a resent row counts from the resend, not from created_at.
ALTER TABLE score_sync ADD COLUMN resent_at INTEGER;

-- The last gradebook value read from Moodle per learner and activity (ResultRow.gradebook).
CREATE TABLE gradebook_read (
  resource_link_id TEXT NOT NULL REFERENCES resource_link (id),
  user_sub         TEXT NOT NULL,
  result_score     REAL,                           -- NULL: Moodle has no grade for the learner
  result_maximum   REAL,
  read_at          INTEGER NOT NULL,
  PRIMARY KEY (resource_link_id, user_sub)
);
