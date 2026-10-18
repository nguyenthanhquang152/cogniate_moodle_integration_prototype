-- A-T4b2-02 retention (data-model §2.1): expired play sessions are deleted. Before that, the cleanup adds their
-- counted session time here, so cmi.core.total_time does not shrink (total = this + the remaining sessions).
ALTER TABLE attempt ADD COLUMN archived_session_time_cs INTEGER NOT NULL DEFAULT 0;
