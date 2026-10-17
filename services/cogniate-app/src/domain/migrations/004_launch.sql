-- T4b2: launch handoff, picker sessions, resource links, attempts and play sessions (data-model §2, security §4).
-- Times are Unix milliseconds. Capability ids (pck_, ply_) have 128 random bits.

CREATE TABLE handoff (
  ltik_hash TEXT PRIMARY KEY,                      -- SHA-256 hex of the ltik: one use of /tool/launch or /tool/deep-link
  used_at   INTEGER NOT NULL
);

CREATE TABLE resource_link (
  id                    TEXT PRIMARY KEY,          -- rl_...
  connection_id         TEXT NOT NULL REFERENCES connection (id),
  publication_id        TEXT NOT NULL REFERENCES publication (id),  -- from the SIGNED launch.target (security §4)
  deployment_id         TEXT NOT NULL,
  context_id            TEXT NOT NULL,
  resource_link_id      TEXT NOT NULL,
  context_title         TEXT NOT NULL,             -- Moodle course name (untrusted text, escaped on output)
  title                 TEXT NOT NULL,             -- Moodle activity name (untrusted text, escaped on output)
  line_item_id          TEXT,                      -- AGS line item URL; NULL without AGS
  service_key_encrypted BLOB,                      -- AES-256-GCM (APP_MASTER_KEY); used by the score sync (T5a)
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  UNIQUE (connection_id, deployment_id, context_id, resource_link_id)
);
CREATE INDEX resource_link_publication ON resource_link (publication_id);

CREATE TABLE picker_session (
  id               TEXT PRIMARY KEY,               -- pck_..., in the /tool/picker URL
  connection_id    TEXT NOT NULL REFERENCES connection (id),
  ltik_encrypted   BLOB NOT NULL,                  -- AES-256-GCM (APP_MASTER_KEY). Only here: a play session has no ltik.
  issuer_origin    TEXT NOT NULL,                  -- frame-ancestors of the picker pages (security §5)
  deployment_id    TEXT NOT NULL,
  context_id       TEXT NOT NULL,
  context_title    TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  used_at          INTEGER,
  publication_id   TEXT REFERENCES publication (id),     -- the picked course (set with used_at)
  resource_link_id TEXT REFERENCES resource_link (id)    -- the activity that the pick became at its first launch (stats)
);
CREATE INDEX picker_session_pick ON picker_session (connection_id, context_id, publication_id);

CREATE TABLE attempt (
  id                TEXT PRIMARY KEY,              -- att_...
  resource_link_id  TEXT NOT NULL REFERENCES resource_link (id),
  user_sub          TEXT NOT NULL,
  course_version_id TEXT NOT NULL REFERENCES course_version (id),
  preview           INTEGER NOT NULL CHECK (preview IN (0, 1)),
  cmi_or_progress   TEXT,                          -- JSON (T5a)
  last_seq          INTEGER NOT NULL DEFAULT 0,
  outcome           TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (outcome IN ('not_started', 'in_progress', 'completed', 'passed', 'failed')),
  score_given       INTEGER,
  score_maximum     INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (resource_link_id, user_sub, course_version_id)
);

CREATE TABLE play_session (
  id                 TEXT PRIMARY KEY,             -- ply_..., in the /play URL
  attempt_id         TEXT NOT NULL REFERENCES attempt (id),
  runtime_token_hash TEXT NOT NULL UNIQUE,         -- SHA-256 hex of the runtime token (/rt/{token} on the content origin)
  session_id         TEXT NOT NULL,
  roles              TEXT NOT NULL,                -- JSON array of the launch roles
  return_url         TEXT,                         -- "Back to Moodle": the launch return URL, only if on the platform origin
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL
);
CREATE INDEX play_session_attempt ON play_session (attempt_id);
