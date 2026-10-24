-- LA-E5-19: the shared runner owns leases and one heartbeat per process instance.
CREATE TABLE job_instance (
  instance_id TEXT PRIMARY KEY,
  boot_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'web' CHECK (role IN ('web', 'worker')),
  started_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL
);
CREATE TABLE job_lease (
  name TEXT PRIMARY KEY,
  owner TEXT,
  lease_until INTEGER,
  last_run_at INTEGER,
  last_result TEXT
);
