-- Cogniate app (stand-in), T4a tables. data-model §2. Every row has library_id directly or through its parent.
-- Times are Unix milliseconds.

CREATE TABLE library (
  id         TEXT PRIMARY KEY,               -- lib_...
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE app_user (
  id            TEXT PRIMARY KEY,            -- usr_...
  library_id    TEXT NOT NULL REFERENCES library (id),
  email         TEXT NOT NULL UNIQUE,        -- lower case
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  password_hash TEXT NOT NULL,               -- scrypt$N$r$p$salt$hash
  created_at    INTEGER NOT NULL
);

CREATE TABLE app_session (
  token_hash TEXT PRIMARY KEY,               -- SHA-256 hex of the __Host-cog_session value
  user_id    TEXT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX app_session_expires ON app_session (expires_at);

CREATE TABLE package (
  id           TEXT PRIMARY KEY,             -- pkg_..., random, in the /pkg URL
  library_id   TEXT NOT NULL REFERENCES library (id),
  sha256       TEXT NOT NULL,                -- of the uploaded zip: data/uploads/{sha256}.zip
  total_bytes  INTEGER NOT NULL,
  file_count   INTEGER NOT NULL,
  storage_path TEXT NOT NULL,                -- relative to DATA_DIR: packages/{id}
  created_at   INTEGER NOT NULL
);

CREATE TABLE course (
  id         TEXT PRIMARY KEY,               -- crs_...
  library_id TEXT NOT NULL REFERENCES library (id),
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  variant    TEXT NOT NULL,
  lang       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX course_library ON course (library_id, created_at);

CREATE TABLE course_version (
  id                TEXT PRIMARY KEY,        -- ver_...
  course_id         TEXT NOT NULL REFERENCES course (id),
  version           INTEGER NOT NULL,
  format            TEXT NOT NULL CHECK (format IN ('scorm12', 'html')),
  package_id        TEXT NOT NULL REFERENCES package (id),
  validation_report TEXT NOT NULL,           -- JSON: report of contract §3
  tracking_profile  TEXT NOT NULL,           -- JSON: data-model §2
  created_at        INTEGER NOT NULL,
  UNIQUE (course_id, version)
);
