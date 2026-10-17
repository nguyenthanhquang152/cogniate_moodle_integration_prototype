-- T4b1: connections and publications (data-model §2, app contract §4, §5).
CREATE TABLE connection (
  id                  TEXT PRIMARY KEY,          -- con_...
  library_id          TEXT NOT NULL REFERENCES library (id),
  name                TEXT NOT NULL,
  site_url            TEXT NOT NULL,             -- https origin of the Moodle site
  method              TEXT NOT NULL CHECK (method IN ('dynamic', 'manual')),
  status              TEXT NOT NULL CHECK (status IN ('pending', 'registered', 'connected', 'disabled')),
  lti_platform_id     TEXT UNIQUE,               -- a platform belongs to one connection only
  platform_json       TEXT,                      -- { id, issuer, clientId, deploymentIds, productFamilyCode }
  ref_token_hash      TEXT UNIQUE,               -- SHA-256 of the registration ref (single use)
  ref_token_encrypted BLOB,                      -- AES-256-GCM (APP_MASTER_KEY): the portal shows the URL again while pending
  ref_expires_at      INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  last_launch_at      INTEGER
);
CREATE INDEX connection_library ON connection (library_id, created_at);

CREATE TABLE publication (
  id                 TEXT PRIMARY KEY,           -- pub_...
  connection_id      TEXT NOT NULL REFERENCES connection (id),
  course_id          TEXT NOT NULL REFERENCES course (id),
  current_version_id TEXT NOT NULL REFERENCES course_version (id),
  status             TEXT NOT NULL CHECK (status IN ('available', 'withdrawn')),
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE (connection_id, course_id)
);
