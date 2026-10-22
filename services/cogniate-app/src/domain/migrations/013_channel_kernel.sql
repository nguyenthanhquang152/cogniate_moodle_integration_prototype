-- LA-ADR-04 D4: channel identity and binding authority. Forward only; all old fields stay unchanged.
ALTER TABLE connection ADD COLUMN channel TEXT;
ALTER TABLE connection ADD COLUMN binding_authority TEXT
  CHECK (binding_authority IN ('self', 'operatorGrant', 'verifiedAdminLaunch'));
UPDATE connection SET channel = lms;
UPDATE connection SET binding_authority = CASE WHEN lms = 'moodle' THEN 'self' ELSE 'operatorGrant' END;

ALTER TABLE binding_attempt ADD COLUMN target_kind TEXT
  CHECK (target_kind IN ('exclusive_platform', 'platform_deployment', 'shared_deployment'));
UPDATE binding_attempt SET target_kind = (
  SELECT CASE WHEN c.lms = 'blackboard' THEN 'shared_deployment'
              WHEN binding_attempt.purpose = 'add_deployment' THEN 'platform_deployment'
              ELSE 'exclusive_platform' END
  FROM connection c WHERE c.id = binding_attempt.connection_id);

ALTER TABLE binding_grant ADD COLUMN bound_values TEXT;
CREATE INDEX connection_channel ON connection (library_id, channel);
