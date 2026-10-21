# LA-R4: Service operability, security and LTIAAS-compatibility audit

Output file (the only file you write): docs/research/ltiaas/R4-ops-readiness.md

Target: services/lti-service/**, services/cogniate-app/** (jobs, workers, storage, CLIs), packages/shared/**, infra/**, docs/architecture/security.md, docs/architecture/data-model.md, docs/architecture/adr/ADR-006*.md, ADR-012*.md, docs/architecture/contracts/lti-service-api.md (§3, §8 "differences from LTIAAS", §9), docs/architecture/open-questions.md, docs/human_review/decisions-needed.md, docs/human_review/deferred.md.

Change: assess what "LTI as a service v1, production-shaped" needs, area by area. For each area give: current state (evidence path:line) | gap | severity for a paid multi-tenant service (BLOCKER / MAJOR / MINOR) | suggested fix | epic (E5 or other) or backlog LG.
Areas: tenancy and tool accounts; admin API for tool accounts, platforms and deployments; API keys and service keys (issue, rotate, revoke); tool signing keys and JWKS rotation (A-T0-16); master key and KMS; storage (SQLite, ADR-012 status) and the path to Postgres; background jobs, the score-sync outbox and retries; idempotency; rate limiting and abuse control; observability (logs, metrics, traces, health, alerts); audit log; data retention and deletion (privacy); backup and restore; configuration and secrets; deployment topology (TLS, hosts, cookies, CORS); dependency and supply-chain posture; the LTIAAS-compatible API surface (which public endpoints in docs/research/inputs.md §3 exist, differ or are missing; paths, auth header schemes, field names and error shape only).

Constraints: the LTIAAS comparison is about API shape only. Use docs/research/inputs.md §3 and our own contract docs. Do not quote .research_cache text.

Observable acceptance: the area table; a ranked "must fix for v1" list (max 15); a short list of what belongs to LG instead; recommendations.
