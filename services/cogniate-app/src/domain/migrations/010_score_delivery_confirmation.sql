-- P2: a timed-out POST can still write to Moodle. Keep this uncertainty across retries and restarts.
ALTER TABLE score_sync ADD COLUMN send_started_at INTEGER;
ALTER TABLE score_sync ADD COLUMN delivery_uncertain INTEGER NOT NULL DEFAULT 0 CHECK (delivery_uncertain IN (0, 1));
-- After the first accepted best score, wait at least 5 s before its one successful confirmation.
ALTER TABLE score_sync ADD COLUMN confirmation_after INTEGER;
