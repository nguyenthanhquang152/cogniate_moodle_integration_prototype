-- T8 (stretch, ADR-007): native channel (.mbz builds) and the course shell (web services).
CREATE TABLE mbz_build (
  id          TEXT PRIMARY KEY,                  -- bld_ + 24 hex (also the Build Runner project id: cogniate-build-<hex>)
  library_id  TEXT NOT NULL REFERENCES library (id),
  course_id   TEXT NOT NULL REFERENCES course (id),
  version_id  TEXT NOT NULL REFERENCES course_version (id),
  status      TEXT NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
  step        TEXT,                              -- start, course, scorm, backup, copy, done
  reason      TEXT,                              -- why a build failed (from the Build Runner)
  bytes       INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX mbz_build_version ON mbz_build (version_id, created_at);

-- Web services token of a connection (course shell): AES-256-GCM (APP_MASTER_KEY); the site name and release it gave.
ALTER TABLE connection ADD COLUMN ws_token_encrypted BLOB;
ALTER TABLE connection ADD COLUMN ws_site_name TEXT;
ALTER TABLE connection ADD COLUMN ws_release TEXT;

-- The Moodle course shell of a publication (createMoodleCourse on publish).
ALTER TABLE publication ADD COLUMN moodle_course_id INTEGER;
ALTER TABLE publication ADD COLUMN moodle_course_idnumber TEXT;
ALTER TABLE publication ADD COLUMN shell_status TEXT CHECK (shell_status IN ('created', 'exists', 'failed'));
ALTER TABLE publication ADD COLUMN shell_error TEXT;
