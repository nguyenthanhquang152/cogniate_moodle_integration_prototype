# LA-E6-02 — Connection health view (`GET /app-api/connections/:id/health`, `016_connection_health.sql`, portal health panel)

QA-3 test-first suite for `docs/architecture/ltiaas/tasks/LA-E6-02.md` (`LA-ADR-08` D5, `cogniate-app-api-delta.md` §3.7, `data-model.md` §5a, and `BD-A2-100`).

## Modes

- `LA_LEVEL=k0` (`connection-health.k0.test.ts` — host-only, no Docker):
  - `AC-LA-E6-02-06` (UNIT): The writer keeps at most 100 rows per connection, and the retention removes rows older than 30 days (controlled clock, temporary database).
  - `AC-LA-E6-02-07` (UNIT): Migration `016` keeps old connections working, with `artifact_key_kid = NULL`.
  - `AC-LA-E6-02-08` (UNIT): Portal shows `"Paste a new {LMS} key JSON"` when `artifactKeyCurrent` is `false`, and a backlog warning when `oldestPendingAt` is older than 1 hour; collapsed `"Connection health"` section has no `role="alert"`.
  - `BD-A2-100` (a)–(g) + host-only in-process `testApp` verification for `AC-LA-E6-02-01`..`05`:
    - `GET /app-api/connections/:id/health` returns `404` for another library's connection (`AC-LA-E6-02-04`).
    - `keys.nextKid` is `null`; `keys.artifactKeyCurrent` is `null` when `artifactKeyKid` is `null`, `true` when equal to `activeKid`, and `false` when different (`BD-A2-100` (a), (b); `AC-LA-E6-02-02`, `-03` unit part).
    - `POST /app-api/connections/:id/check` writes a `check` row in `connection_event` with code `ok` or `jwks:<detail> token:<detail>`, and `lastCheck { at, jwks, token }` is derived from the newest `check` row (`BD-A2-100` (c)).
    - `dispatch.failedLast24h` is `1` and `dispatch.lastError.code` is the parsed `[A-Z][A-Z0-9_]*` code from `"<status> <CODE>: <text>"` (or `null` when unparseable, never free text) (`AC-LA-E6-02-05`, `BD-A2-100` (d)).
    - `events` are the kept rows (at most 100), newest first (`BD-A2-100` (e)).
- `LA_LEVEL=k1sim` (`connection-health.k1sim.test.ts` — SIM Docker window):
  - `AC-LA-E6-02-04`, `AC-LA-E6-02-05` (and `AC-LA-E6-02-01` once `LA-E6-06` lands; `AC-LA-E6-02-02`, `AC-LA-E6-02-03` once `LA-E6-05` lands).
