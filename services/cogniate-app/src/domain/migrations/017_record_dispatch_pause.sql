-- LA-E4-03 fix round 2 (A-LA-E4-03-03; LA-ADR-03 D7 "429"). A partition is paused while any of its dispatch rows has a
-- future not_before, whatever the row status: a row that failed at the end of its 24 h window still carries the
-- platform's Retry-After. This index serves that check (rows that were never throttled are not in it).
CREATE INDEX record_dispatch_pause ON record_dispatch (partition_key, not_before) WHERE not_before IS NOT NULL;
