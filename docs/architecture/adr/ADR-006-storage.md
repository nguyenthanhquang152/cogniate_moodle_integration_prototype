# ADR-006: Storage — SQLite per service, package files on disk, caches in memory

Status: Accepted (round 2). Date: 2026-10-16. The storage **location** of the SQLite files is amended by [ADR-012](ADR-012-sqlite-volume-storage.md) (proposed, revision 3.2, 2026-10-21); every other decision here stays. Tables: [`data-model.md`](../data-model.md).

## Context

The LTI service (registrations, keys, launches) and the Cogniate app (courses, packages, connections, attempts, score syncs) need state. Packages are up to 200 MB (our limit); the two fixtures are about 12 MB each. Node 24.21 has `node:sqlite` built in (SQLite 3.53.4), with no native build.

## Options

| | A. SQLite (`node:sqlite`), one file per service | B. Postgres, one database per service |
| --- | --- | --- |
| Setup | None. Reset = delete the file. | One more database and user per service |
| Unit tests | In-memory database per test | Test container or shared database |
| Concurrency | One writer, enough here | Full |
| Tenant isolation | In application code | Row-level security possible |
| Production fit | No | Yes (spec §8.4) |

## Decision

Option A.

- Each service keeps its data under `/data` in its container (env `DATA_DIR`): `/data/lti.db`; `/data/cogniate.db`, `/data/packages/`, `/data/uploads/`. **Amended by ADR-012:** `/data` of each service is a project-scoped Docker named volume (`ltidb`, `appdb`) that holds only the SQLite files, and `/data/packages` and `/data/uploads` are nested binds of the unchanged host folders `infra/.data/cogniate-app/packages` and `…/uploads`. A storage preflight checks real WAL lock exclusion and the pair state before every guarded start (ADR-012 §5–§7). `stack:reset` deletes the volumes and these folders; it is never a recovery step (ADR-012 §9). (Before ADR-012, `/data` was a bind mount of `infra/.data/<service>`; on the measured Docker Desktop host that bind mount does not enforce WAL locks between processes.)
- Plain SQL migrations at start. No ORM. Portable SQL only.
- **Migration rule (both services, one shared runner in `packages/shared` `migrations`):** each applied migration is stored with its SHA-256. If an applied migration file changed, the service stops at start with a clear message. Never edit an applied migration; add a new one.
- Repository modules are the only code that touches SQL. Every tenant-owned query takes the tenant id as a required argument.
- WAL mode, `foreign_keys=ON`, `busy_timeout=5000`.
- Secrets in rows: AES-256-GCM with the service master key. Tokens: SHA-256 hashes.
- **In memory, not in tables:** platform access tokens, the score timestamp clock, the platform JWKS cache. A restart only loses a cache. After a restart, the score clock floor is the start time + 2 s, so the next timestamp is later than any sent before the restart; a Moodle `409` is handled as `conflict` (ADR-010).
- Package store: `/data/packages/{packageId}/...` (extracted) and `/data/uploads/{sha256}.zip` (original, for download and the native channel). `packageId` is random. No dedupe.

## Consequences

- Fast start, fast tests, easy reset.
- `node:sqlite` may print an experimental warning; the services hide that one warning only.
- Production moves to Postgres with row-level security and object storage with signed URLs.
