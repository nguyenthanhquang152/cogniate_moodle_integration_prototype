# Milestone LA plan: LTI as a Service v1

Status: **draft v0** (Lead, 2026-10-22). The Lead writes v1 after the P1 research (R1–R5). Rules: [charter-LA](charter-LA.md).

## 1. Goal

Make the Cogniate LTI service a multi-LMS "LTI as a service" with a **channel-adapter architecture**. A new LTI LMS must be one adapter folder and a profile. It must need **zero changes in core code**.

Moodle, Canvas and Blackboard are the baseline channels. They move into the new model with no behaviour change. One new channel proves that the model works.

## 2. Why: the DataCamp lesson

DataCamp runs 16 LMS/LXP channels on a few shared mechanisms and a few core models. Each channel is mostly settings, a field mapper and small quirks. Facts: [inputs-datacamp](../../research/ltiaas/inputs-datacamp.md).

Cogniate today:

- **Good.** The LTI service does not depend on one LMS. A new LTI LMS needs one profile row and tests (ADR-011 §17). The app has one provider registry (`services/cogniate-app/src/providers/index.ts`).
- **Gap.** `LmsType` is a closed list of 3 names (`providers/types.ts`). There are 28 product files outside the adapters that name an LMS. Capabilities have LMS names (`canvasConfiguration`, `webServices`). `lmsOfProfile` makes every unknown profile "moodle". The `attempt` and `score_sync` records are tied to LTI resource links. So a 4th LMS changes many core files.

## 3. Scope (draft; P1 research confirms it)

| Epic | Title | Draft priority |
| --- | --- | --- |
| E0 | Baseline intake: rebase on the accepted Blackboard and Canvas result; record the regression baseline | Must |
| E1 | Channel kernel for the LTI family: channel manifest and registry, generic capabilities, core without LMS names (CI check), portal cards and setup wizard driven by the manifest; Moodle, Canvas and Blackboard as adapters with no behaviour change | Must |
| E2 | Generic LTI 1.3 channel (manual registration, plus Dynamic Registration where the platform supports it) and one new named LMS profile on the simulator (candidate: D2L Brightspace) | Must |
| E3 | LTI Advantage completeness: Deep Linking with more than one item and ungraded links (D-11); NRPS use or drop (D-8); Canvas Dynamic Registration (D-1); LTI platform storage (D-4); new-window launch (D-10); Moodle claim minimization (D-9) | Must: D-11, D-8. Should: the rest |
| E4 | Learning-record core and dispatch: channel-neutral attempt and record model; generic outbox; AGS is the first reporter | Should |
| E5 | Service operability and security: admin API for tool accounts and platforms, key rotation with a test, a KMS interface, rate limits, metrics and health, audit log, storage path after ADR-012 | Should |
| E6 | Self-serve onboarding and connection health: a safe self-serve path in place of the operator CLI grant (D-3); a health page per connection | Could |
| E7 | Conformance kit: contract tests per port, simulator profiles, 1EdTech certification readiness checklist | Must |
| E8 | Docs and hand-over: admin guide per LMS, "Add a new LTI channel" developer guide, review pack | Must |

Not in LA (backlog milestones, each later goes plan → design → build):

| Milestone | Content |
| --- | --- |
| LB | Catalog and distribution: catalog model, catalog pull API, SFTP/CSV export |
| LC | Learning records out: xAPI to a customer LRS, events API |
| LD | Identity and SSO link launch: learner record, SAML/OIDC per library, account on first login |
| LE | Packaged delivery: thin SCORM 1.2 package, AICC, cmi5, SCORM 2004, Common Cartridge |
| LF | Vendor connectors: Degreed, Docebo, Cornerstone, Workday CCL, SAP SuccessFactors OCN, Viva Learning, 360Learning, Absorb |
| LG | Production platform: Postgres, queue, KMS, high availability, hosting (unless E5 takes part of it) |

The LA design must leave clean ports for LB–LF. LA does not build them.

## 4. Success measures (draft)

1. A new LTI LMS profile changes **0 core files**. A CI check measures this.
2. No LMS name appears in core code. A lint rule checks this.
3. M1, M2 and T7 pass with no change to their assertions after the refactor.
4. The generic LTI channel and the new named LMS pass the conformance kit on the simulator.
5. The "Add a new LTI channel" guide lets a new developer add a simulator profile in less than one day.

Live Canvas and Blackboard rows need human test sites (Q19, Q20). They are not an LA gate unless the product owner gives access.

## 5. Phases

See [charter-LA §2](charter-LA.md#2-phases-and-gates). P1–P3 change only docs, so they run now, in parallel with the Blackboard and Canvas run. P4 starts after G-DEV and G-BASE.

## 6. Decisions for humans (draft)

| Id | Decision | Needed by |
| --- | --- | --- |
| LA-H1 | Approve the LA scope, design and breakdown (G-DEV) | P4 start |
| LA-H2 | Q1 legal: the LTIAAS compatibility claim | Release claim |
| LA-H3 | Q19, Q20: real Canvas and Blackboard test sites; owner of the Blackboard app | Live rows |
| LA-H4 | Q3 privacy: the identifiers that a channel may receive | E4 design |
| LA-H5 | Postgres in LA (E5) or in LG | E5 design |
| LA-H6 | First new named LMS for E2 (candidate: D2L Brightspace) | E2 design |
