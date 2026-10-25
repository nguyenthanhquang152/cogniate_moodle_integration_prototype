# LA-D1: Architect A1 - channel kernel, generic LTI, learning-record core, overall consistency

Role: Architect A1 (dedicated). You own the consistency of the whole LA design.

Code areas for warm-up: services/cogniate-app/src/providers/**, services/lti-service/src/profiles/**, services/cogniate-app/src/app/connections.ts, app/binding-*.ts, app/operator.ts, domain/connections.ts, domain/publications.ts, domain/attempts.ts, domain/score-syncs.ts, worker/score-sync.ts, tool-pages/**, domain/migrations/*.sql, apps/portal/src/Integrations.tsx, apps/portal/src/connect/**, packages/tracking/**.

Your files (create under docs/architecture/ltiaas/):
- README.md: LA target architecture overview: context diagram, layers (core, channel kernel, adapters, shared drivers), the module/package layout after LA, the rule set that keeps core channel-neutral (and how CI checks it), the epic map E0-E8 with Must/Should/Could, the feature list per epic (one line each), and an index of all LA design files (include A2's files: adr/LA-ADR-05..08, contracts/lti-service-api-delta.md, operability.md, security-delta.md).
- terms.md: new LA terms (channel, channel adapter, channel manifest, capability, port, connection, profile, ... ) mapped to existing terms.
- adr/LA-ADR-01-channel-kernel.md: channel manifest, adapter contract, registry, capability model (generic names replacing canvasConfiguration/webServices/courseShell-style flags), where LTI provider profiles (lti-service) and app provider adapters fit, how the portal renders cards/wizards from the manifest, how Moodle-only and Canvas/Blackboard-only extras become capabilities, the "no LMS name in core" rule.
- adr/LA-ADR-02-generic-lti-channel.md: generic LTI 1.3 channel (manual registration; Dynamic Registration where supported), what a profile can configure, profile flags extension, the first new named LMS for E2 (use R2's recommendation; if a human must decide, record LA-H6 and design for the recommendation), simulator profile need.
- adr/LA-ADR-03-learning-record-core.md: channel-neutral attempt / learning-record model and a generic dispatch outbox (generalize score_sync; AGS reporter first), keeping ADR-010 grade policy and the existing retry/confirmation guarantees; ports for later xAPI/SFTP/vendor reporters (backlog LC/LF) without designing them.
- adr/LA-ADR-04-refactor-and-migration.md: how Moodle, Canvas and Blackboard move into the kernel with no behaviour change: refactor steps, data migrations (forward-only, with rollback notes), compatibility of app API and portal routes, and the regression proof (M1, M2, T7 unchanged).
- data-model.md: LA table changes (new/changed tables, state machines).
- contracts/cogniate-app-api-delta.md: app API changes (endpoints, DTOs, errors) relative to docs/architecture/contracts/cogniate-app-api.md.

Coordination with A2: A2 writes adr/LA-ADR-05..08 (LTI Advantage completeness, operability, security, onboarding), contracts/lti-service-api-delta.md, operability.md, security-delta.md. Write terms.md and the "Decision" section of LA-ADR-01 FIRST, as soon as plan v1 arrives, so A2 can align with your names. When they are written, tell the Lead with a short non-blocking message (preamble send, or the ask command if send is not available) that A2 can read them. Before worker_done, read A2's files and fix any inconsistency in YOUR files; list remaining A2 inconsistencies in README.md "Open consistency items".

Observable acceptance: all files exist; every Must feature in the epic map has a design decision; README index is complete; no open BLOCKER-level unknown without an LA-H id.
