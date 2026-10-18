-- A-T5b-03: the last accepted SCORM CMI of each play session. A late `finish` or `unload` (A-T5a-01) uses the data of
-- ITS OWN session, not the attempt's newest CMI, which another open window of the same attempt can have written.
ALTER TABLE play_session ADD COLUMN last_cmi TEXT;
