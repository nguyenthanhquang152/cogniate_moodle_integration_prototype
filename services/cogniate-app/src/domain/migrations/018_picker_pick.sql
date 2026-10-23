-- LA-E3-05 (LA-ADR-05 D3b, LA data model §5b, A-LAD-10): one row per picked publication of a picker session.
-- Multi-select Deep Linking picks 1 to 20 publications in one session; picker_session.publication_id keeps one.
CREATE TABLE picker_pick (
  picker_id_hash   TEXT NOT NULL REFERENCES picker_session (id) ON DELETE CASCADE,  -- the retention delete of a session removes its picks (A-LAD-21)
  publication_id   TEXT NOT NULL REFERENCES publication (id),
  resource_link_id TEXT REFERENCES resource_link (id),   -- set at the first launch of that pick
  PRIMARY KEY (picker_id_hash, publication_id)
);
CREATE INDEX picker_pick_publication ON picker_pick (publication_id, resource_link_id);
-- Every pick before this migration was a single pick in picker_session: copy it, so each activities stat stays equal.
INSERT INTO picker_pick (picker_id_hash, publication_id, resource_link_id)
  SELECT id, publication_id, resource_link_id FROM picker_session WHERE used_at IS NOT NULL AND publication_id IS NOT NULL;
