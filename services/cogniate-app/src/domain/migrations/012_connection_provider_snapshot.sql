-- M1, B-M1-03 accepted design (data model §4.3, app contract §4.7.3): the provider snapshot of a Canvas or Blackboard
-- connection. Only POST /app-api/connections writes it, in its insert, from its one GET /api/providers answer; nothing
-- updates it. Forward only and additive: no backfill (a Canvas or Blackboard row of an 011 build keeps NULL), and 011
-- is not edited. Moodle rows keep NULL.
ALTER TABLE connection ADD COLUMN target_issuer TEXT;       -- canonical issuer of the provider target
ALTER TABLE connection ADD COLUMN target_platform_id TEXT;  -- Blackboard: the shared platform id at create
ALTER TABLE connection ADD COLUMN target_client_id TEXT;    -- Blackboard: the shared client id at create
