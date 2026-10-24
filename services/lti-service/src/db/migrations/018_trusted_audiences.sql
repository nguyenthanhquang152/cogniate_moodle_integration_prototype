-- LA-E3-12: existing platforms permit only their client id as a launch audience.
ALTER TABLE platform ADD COLUMN trusted_audiences TEXT NOT NULL DEFAULT '[]';
