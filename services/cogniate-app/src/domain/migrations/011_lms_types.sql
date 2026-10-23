-- M1 (ADR-011, data-model §4.2): LMS types, provider profiles, operator approval grants, redemption attempts, the
-- write-ahead binding ref history, approvals and Blackboard reservations. Forward only and additive: old rows keep
-- today's behaviour (LMS moodle, profile standard, routing by lti_platform_id).
ALTER TABLE connection ADD COLUMN lms TEXT NOT NULL DEFAULT 'moodle' CHECK (lms IN ('moodle', 'canvas', 'blackboard'));
ALTER TABLE connection ADD COLUMN lti_profile TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE connection ADD COLUMN service_url TEXT;           -- Canvas service origin; NULL = site_url
ALTER TABLE connection ADD COLUMN lti_binding_ref TEXT;       -- Canvas: the activation ref of the committed binding (history)
ALTER TABLE connection ADD COLUMN redeeming_attempt TEXT;     -- connection lease: the attempt that may call the LTI service
ALTER TABLE connection ADD COLUMN redeeming_since INTEGER;    -- connection lease start; live for 60 s

ALTER TABLE picker_session ADD COLUMN site_origin TEXT;       -- frame-ancestors and return URL origin (else issuer_origin)

CREATE TABLE connection_deployment (
  lti_platform_id TEXT NOT NULL,                       -- the shared platform (LTI service id)
  deployment_id   TEXT NOT NULL,
  connection_id   TEXT NOT NULL REFERENCES connection (id),
  library_id      TEXT NOT NULL REFERENCES library (id),
  binding_ref     TEXT,                                -- attempt id of the latest redemption of this reservation
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (lti_platform_id, deployment_id)          -- one owner per school deployment
);
CREATE UNIQUE INDEX connection_deployment_connection ON connection_deployment (connection_id);  -- at most one reservation per connection

CREATE TABLE binding_grant (
  id              TEXT PRIMARY KEY,                     -- grt_...
  code_hash       TEXT NOT NULL UNIQUE,                 -- SHA-256 of the approval code; the code is shown once to the operator
  library_id      TEXT NOT NULL REFERENCES library (id),
  connection_id   TEXT NOT NULL REFERENCES connection (id),
  lms             TEXT NOT NULL,                        -- canvas or blackboard
  lti_profile     TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN ('initial', 'add_deployment')),
  site_url        TEXT NOT NULL,
  service_url     TEXT NOT NULL,                        -- Canvas service origin; equals site_url for Blackboard
  client_id       TEXT NOT NULL,
  deployment_id   TEXT NOT NULL,
  note            TEXT NOT NULL,                        -- operator evidence reference (never shown in the portal)
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  redeemed_at     INTEGER,
  revoked_at      INTEGER,
  revoked_reason  TEXT CHECK (revoked_reason IN ('operator', 'replaced', 'disconnect', 'suspend'))
);
CREATE INDEX binding_grant_connection ON binding_grant (connection_id, purpose);

CREATE TABLE binding_attempt (
  attempt_id      TEXT PRIMARY KEY,                     -- random
  seq             INTEGER NOT NULL UNIQUE,              -- order of attempts in this database
  connection_id   TEXT NOT NULL REFERENCES connection (id),
  grant_id        TEXT NOT NULL REFERENCES binding_grant (id),
  purpose         TEXT NOT NULL,                        -- initial or add_deployment (copy of the grant)
  lti_profile     TEXT NOT NULL,                        -- target: profile
  issuer          TEXT NOT NULL,                        -- target: canonical issuer
  client_id       TEXT NOT NULL,                        -- target: client id
  deployment_id   TEXT NOT NULL,                        -- target: deployment id
  lti_platform_id TEXT,                                 -- target platform; set at phase 1 when known, else by S1 or S2
  history_floor   INTEGER NOT NULL,                     -- highest binding_ref_history.seq at phase 1; refs at or below it are "older"
  state           TEXT NOT NULL CHECK (state IN ('open', 'committed', 'cancelled', 'failed', 'abandoned')),
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER
);
CREATE INDEX binding_attempt_connection ON binding_attempt (connection_id);

CREATE TABLE binding_ref_history (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,    -- write order
  ref             TEXT NOT NULL UNIQUE,                 -- random, 22 characters [A-Za-z0-9_-]
  connection_id   TEXT NOT NULL REFERENCES connection (id),
  attempt_id      TEXT REFERENCES binding_attempt (attempt_id),  -- NULL for operator and disconnect writes
  grant_id        TEXT REFERENCES binding_grant (id),   -- the attempt's grant, or the grant of a revoke cleanup
  action          TEXT NOT NULL CHECK (action IN ('create', 'activate', 'compensate', 'fence_out', 'revoke_cleanup')),
  lti_platform_id TEXT,                                 -- NULL until known (Canvas initial create)
  deployment_id   TEXT,
  created_at      INTEGER NOT NULL                      -- committed before the LTI call is sent
);
CREATE INDEX binding_ref_history_connection ON binding_ref_history (connection_id);

CREATE TABLE approved_deployment (
  lti_platform_id TEXT NOT NULL,
  deployment_id   TEXT NOT NULL,
  connection_id   TEXT NOT NULL REFERENCES connection (id),
  library_id      TEXT NOT NULL REFERENCES library (id),
  binding_ref     TEXT NOT NULL,                        -- the activation ref that phase 2 committed
  grant_id        TEXT NOT NULL REFERENCES binding_grant (id),
  approved_at     INTEGER NOT NULL,
  PRIMARY KEY (lti_platform_id, deployment_id)           -- one approved owner per remote deployment
);
CREATE INDEX approved_deployment_connection ON approved_deployment (connection_id);
