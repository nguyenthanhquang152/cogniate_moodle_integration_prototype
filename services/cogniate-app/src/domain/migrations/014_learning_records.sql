-- LA-E4-02: neutral records and runner state. The legacy tables stay unchanged.
CREATE TABLE placement (
  id             TEXT PRIMARY KEY,                    -- = resource_link.id for LTI (rl_...)
  connection_id  TEXT NOT NULL REFERENCES connection (id),
  publication_id TEXT NOT NULL REFERENCES publication (id),
  external_key   TEXT NOT NULL,                       -- LTI: json_array(deployment_id, context_id, resource_link_id), one encoding function; context_id may be ""
  graded         INTEGER NOT NULL DEFAULT 1 CHECK (graded IN (0, 1)),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (connection_id, external_key)
);
CREATE INDEX placement_publication ON placement (publication_id);

CREATE TABLE learning_record (
  id                TEXT PRIMARY KEY,                 -- rec_...
  attempt_id        TEXT NOT NULL REFERENCES attempt (id),
  placement_id      TEXT NOT NULL REFERENCES placement (id),
  learner_subject   TEXT NOT NULL,                    -- LTI sub
  course_version_id TEXT NOT NULL REFERENCES course_version (id),
  kind              TEXT NOT NULL CHECK (kind IN ('final', 'started', 'progressed', 'submitted')),  -- LA Must: final
  outcome           TEXT NOT NULL,
  score_given       REAL,
  score_maximum     REAL,
  started_at        INTEGER,                          -- Should
  submitted_at      INTEGER,                          -- Should
  occurred_at       INTEGER NOT NULL,
  created_at        INTEGER NOT NULL
);
CREATE INDEX learning_record_learner ON learning_record (placement_id, learner_subject);

CREATE TABLE record_dispatch (
  seq                INTEGER NOT NULL,               -- insertion order, also when created_at ties (BD-A2-40)
  id                 TEXT PRIMARY KEY,                -- sync_... for lti-ags (the old score_sync ids)
  record_id          TEXT NOT NULL REFERENCES learning_record (id),
  reporter           TEXT NOT NULL,                   -- 'lti-ags'
  placement_id       TEXT NOT NULL REFERENCES placement (id),
  learner_subject    TEXT NOT NULL,
  partition_key      TEXT NOT NULL,                   -- fairness key (lti-ags: LTI platform id; shared platform: platform id + ':' + deployment id)
  payload            TEXT NOT NULL,                   -- reporter body (lti-ags: AGS score body)
  score_given        REAL NOT NULL,
  score_maximum      REAL NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'conflict', 'failed', 'superseded')),
  tries              INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL,
  next_try_at        INTEGER,
  not_before         INTEGER,                         -- 429 Retry-After pause of the partition
  sent_at            INTEGER,
  last_error         TEXT,
  resent_at          INTEGER,
  send_started_at    INTEGER,                         -- P2 in-flight marker
  delivery_uncertain INTEGER NOT NULL DEFAULT 0 CHECK (delivery_uncertain IN (0, 1)),
  confirmation_after INTEGER,
  lease_owner        TEXT,
  lease_until        INTEGER,
  updated_at         INTEGER NOT NULL
);
CREATE UNIQUE INDEX record_dispatch_seq ON record_dispatch (seq);
CREATE INDEX record_dispatch_due ON record_dispatch (status, next_try_at, partition_key);
CREATE INDEX record_dispatch_learner ON record_dispatch (placement_id, learner_subject, reporter);
CREATE INDEX record_dispatch_record ON record_dispatch (record_id);

CREATE TABLE job_instance (                          -- one heartbeat row per runner instance (LA-ADR-03 D7)
  instance_id  TEXT PRIMARY KEY,                      -- JOB_INSTANCE_ID
  boot_id      TEXT NOT NULL,                         -- random per process; part of lease_owner
  role         TEXT NOT NULL DEFAULT 'web' CHECK (role IN ('web', 'worker')),  -- P3 (LA-E4-05): the production check "both on"
  started_at   INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL                       -- stop() deletes the row; a fresh row of another boot id makes a start wait, not exit
);

CREATE TABLE job_lease (
  name         TEXT PRIMARY KEY,                      -- interval job name
  owner        TEXT,
  lease_until  INTEGER,
  last_run_at  INTEGER,
  last_result  TEXT
);
CREATE INDEX record_dispatch_started ON record_dispatch (send_started_at) WHERE send_started_at IS NOT NULL;

INSERT INTO placement (id, connection_id, publication_id, external_key, graded, created_at, updated_at)
SELECT id, connection_id, publication_id, json_array(deployment_id, context_id, resource_link_id), 1, created_at, updated_at
FROM resource_link;

INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind, outcome,
  score_given, score_maximum, occurred_at, created_at)
SELECT 'rec_' || substr(s.id, 6), s.attempt_id, s.resource_link_id, s.user_sub, a.course_version_id, 'final', a.outcome,
  s.score_given, s.score_maximum, s.created_at, s.created_at
FROM score_sync s JOIN attempt a ON a.id = s.attempt_id;

INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key,
  payload, score_given, score_maximum, status, tries, created_at, next_try_at, sent_at, last_error, resent_at,
  send_started_at, delivery_uncertain, confirmation_after, updated_at)
SELECT ROW_NUMBER() OVER (ORDER BY s.created_at, s.rowid), s.id, 'rec_' || substr(s.id, 6), 'lti-ags', s.resource_link_id, s.user_sub,
  COALESCE(c.lti_platform_id,
    (SELECT ad.lti_platform_id || ':' || ad.deployment_id FROM connection_deployment ad
      WHERE ad.connection_id = c.id),
    c.target_platform_id || ':' || rl.deployment_id, c.id),
  s.payload, s.score_given, s.score_maximum, s.status, s.tries, s.created_at, s.next_try_at, s.sent_at, s.last_error, s.resent_at,
  s.send_started_at, s.delivery_uncertain, s.confirmation_after, s.updated_at
FROM score_sync s JOIN resource_link rl ON rl.id = s.resource_link_id JOIN connection c ON c.id = rl.connection_id;
