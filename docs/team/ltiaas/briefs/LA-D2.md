# LA-D2: Architect A2 - LTI Advantage completeness, operability, security, onboarding

Role: Architect-2 A2 (dedicated). A1 owns overall consistency and the kernel terms; you align with A1.

Code areas for warm-up: services/lti-service/** (lti/*, http/routes/*, platform/*, store/*, cli/*), services/cogniate-app/src/tool-pages/**, services/cogniate-app/src/app/canvas-configuration.ts, app/redemption.ts, app/operator.ts, cli/*, packages/shared/** (logger, crypto, outbound client), infra/** (compose, Caddy), docs/architecture/open-questions.md, docs/human_review/decisions-needed.md, docs/human_review/deferred.md, ADR-011 §15 follow-ups D-1..D-12.

Your files (create under docs/architecture/ltiaas/):
- adr/LA-ADR-05-lti-advantage-completeness.md: Deep Linking with more than one item and ungraded links (D-11); NRPS: use it or drop the scope (D-8); Canvas Dynamic Registration (D-1); LTI Client Side postMessages / Platform Storage for third-party-cookie-free launch (D-4, R4, Safari Q16); new-window launch (D-10); Moodle claim minimization (D-9); anything from R1's top gaps that belongs to LA. Mark each Must/Should/Could.
- adr/LA-ADR-06-service-operability.md: admin API for tool accounts, platforms, deployments (LTIAAS-compatible shape only where it exists); API key and service key lifecycle; tool signing key and JWKS rotation with test (A-T0-16); master key behind a KMS interface; rate limits; metrics, health, structured audit log; job runner shape; storage path after ADR-012 (decide what LA does and what moves to backlog LG; record LA-H5 if a human must decide Postgres).
- adr/LA-ADR-07-security-and-tenancy.md: tenant isolation for many LMS channels, secrets per connection, operator role and grant evidence (Q22), threat model deltas from the new kernel and features.
- adr/LA-ADR-08-onboarding-and-connection-health.md: self-serve onboarding where it is safe (D-3) versus the operator grant; connection verification step; a connection health view (last launch, last score dispatch, errors, key state). Mark Could items clearly.
- contracts/lti-service-api-delta.md: LTI service API changes relative to docs/architecture/contracts/lti-service-api.md.
- operability.md: runbook-level design: config, deploy topology, observability signals, alerts, backup/restore, key rotation procedure.
- security-delta.md: deltas to docs/architecture/security.md.

Coordination with A1: A1 writes docs/architecture/ltiaas/terms.md and adr/LA-ADR-01-channel-kernel.md first. Express your features as capabilities/ports of A1's kernel. Until A1's files exist, use the plan v1 terms and mark names "(align with LA-ADR-01)". The Lead will tell you when A1's kernel decision is ready; re-read and align before worker_done. Do not edit A1's files; send term or interface requests to the Lead via the ask command (non-blocking question is fine).

Observable acceptance: all files exist; each D-1, D-3, D-4, D-8, D-9, D-10, D-11 and A-T0-16 has a decision (do / defer to backlog with reason); each Must item has acceptance-level detail the breakdown can turn into criteria.
