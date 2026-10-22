# Milestone LA plan: LTI as a Service v1

Status: **v1.2** (Lead, 2026-10-22). v1.2 adds LA-H21..LA-H24 from the design. v1 replaced draft v0; v1.1 adds the R2 facts to §2, E2, LA-H3 and LA-H6. Inputs: [R1 spec coverage](../../research/ltiaas/R1-spec-coverage.md), [R2 LMS landscape](../../research/ltiaas/R2-lms-landscape.md) (v1.1 patch: E2, LA-H3, LA-H6), [R3 extensibility audit](../../research/ltiaas/R3-extensibility-audit.md), [R4 ops readiness](../../research/ltiaas/R4-ops-readiness.md), [R5 test baseline](../../research/ltiaas/R5-test-baseline.md), [DataCamp facts](../../research/ltiaas/inputs-datacamp.md). Rules: [charter-LA](charter-LA.md).

## 1. Goal

Make the Cogniate LTI service a multi-LMS, multi-tenant "LTI as a service" with a **channel-adapter architecture**:

- A new LTI LMS is **one adapter folder plus profile data**. It changes **zero core files**.
- Moodle, Canvas and Blackboard move into the model with **no behaviour change**.
- One new named LMS and one generic LTI 1.3 channel prove the model.
- The service is **production-shaped** for a pilot: rate limits, tenant model, admin API, audit, key lifecycle.
- The design leaves clean ports for the backlog milestones LB–LG. LA does not build them.

## 2. Facts that shape the plan

| Fact | Source |
| --- | --- |
| The launch and security engine is strong: 134 spec rows, YES 76, PARTIAL 34, NO 19, N-A 5. | R1 §Summary |
| The largest protocol gap: no Platform Storage / postMessage. Canvas frames every launch; Safari blocks the state cookie. | R1 #1 |
| Certification blocker: the app refuses a valid launch without a context. | R1 #3 |
| Tool key retirement uses `created_at`; an old key can drop out at rotation (`services/lti-service/src/store/tool-keys.ts:36`). | R1 #7, R4 J-2 |
| Product code has 214 code lines in 60 files that branch on an LMS name, a profile id or an LMS-only feature. 145 more lines in 19 files tie core records to LTI. | R3 §1 |
| "Add D2L Brightspace today" changes 36 files; 25 of them are core files. | R3 §3 |
| Two blockers for a 4th LMS: the SQLite `CHECK (lms IN (...))` on `connection`, and the closed Zod enum in `app/clients/lti-client.ts:55` (one unknown profile breaks `GET /api/providers`). | R3 §1 |
| A non-LTI channel (for example SFTP) cannot plug in today. | R3 §1 |
| Ops BLOCKERs for a paid service: no rate limits; every tool account launches to `PUBLIC_APP_URL` (one tenant only); single-host SQLite with cold backup. 26 MAJORs. | R4 §Summary |
| `npm run check` passes: 1,123 tests + 5 fixture skips, 111 infra tests, 69 s. No stack suite has run at HEAD. | R5 §3 |
| M1 and M2 assert closed lists (6 profiles, 2 sim profiles, 6 capability keys, 3 cards). | R5 §4c |
| The Docker VM (7.75 GiB) allows 2 stacks at the same time. | R5 §4d |
| The storage harness (8,076 lines) and serial windows made the last phase slow. | R5 §5 |
| 14 of 18 LMSs launch LTI 1.3 tools. Google Classroom, Microsoft Teams, SAP SuccessFactors and Workday have no LTI 1.3 platform (backlog LF/LC). All fixed values in our 3 profiles still match. | R2 §Summary |
| Two code rules stricter than the specs block a generic profile: every endpoint must be on the issuer origin, and Dynamic Registration expects a Moodle-style registration token. | R2 §Summary 5 |
| A profile needs more data than the 4 flags: client assertion `aud`, endpoint-origin policy, platform storage data, Deep Linking item limit, launch target rule, product family from data. | R2 §Summary 6 |
| D2L Brightspace has only 2 quirks: the token host `auth.brightspace.com` and the audience `https://api.brightspace.com/auth/token`. Product family `desire2learn` is UNVERIFIED. | R2 §5.4 |
| Free test sites: only Moodle, Sakai, Open edX and self-hosted Canvas. Canvas Free-for-Teacher is gone. The Blackboard VMDK costs about USD 0.05/hour plus AWS. D2L and Canvas cloud need a partner program. | R2 §Summary 8 |

## 3. Scope

Priority: **Must** = needed for LA done. **Should** = in LA if the Must work is on time. **Could** = only if there is spare capacity.

### E0 Baseline intake — Must

- Rebase LA on the G-BASE commit (see §6 LA-H10).
- QA records the regression baseline: `npm run check`, M1 sim rows (394), M2 64/64, T7 3×17, golden outputs, Docker engine and VM size.
- QA rewrites the closed-list assertions in M1 and M2 to an open-world form, once, and proves the rewrite on the baseline SHA. Both reviewers review the list (Lead decision LD-1).
- ADR-012 is a dev-stack rule only. LA tasks do not depend on its open runtime gates.

### E1 Channel kernel for the LTI family — Must

- First: fix the two blockers (closed Zod enum; `connection.lms` CHECK through an additive change).
- One channel registry is the only list of channels. A channel manifest describes each channel.
- The 44 "B" sites become five generic traits: binding authority, platform sharing, capability guards, the registry, profile flags.
- Moodle-only code moves to a Moodle adapter folder (web-services course shell, `.mbz` as a capability, Dynamic Registration).
- The portal renders cards, routes and setup wizards from the registry ("show, collect, verify, enable").
- `PUBLIC_MOODLE_URL` leaves the LTI service config.
- CI fitness checks: an LMS-name lint for core paths (ratchet from today's baseline), and a branch-diff gate "an add-channel change touches only the channel folder and profile data".
- Design constraint: no change to storage commands. Only additive schema changes, each with a migration test.

### E2 Generic LTI 1.3 channel and one new named LMS — Must

- A generic LTI 1.3 channel on the `standard` profile path: manual registration, and Dynamic Registration where the platform supports it.
- Generic Dynamic Registration fixes: issuer with a path (Q18), `authorization_server` as token audience, capability checks, neutral texts, stored granted scopes.
- Profile data additions: token audience, product family for every profile, `deployment_id` in the client assertion behind a flag.
- Remove the two rules that are stricter than the specs: endpoints only on the issuer origin (replace with an endpoint-origin policy in profile data), and the Moodle-style Dynamic Registration token.
- Profile data that R2 lists: client assertion `aud`, endpoint-origin policy, platform storage data, Deep Linking item limit, launch target rule, product family.
- One new named LMS profile on the simulator: **D2L Brightspace** (R2 recommendation; LA-H6 confirms). The token URL and the audience come from the admin values on the D2L registration page; fixed values are defaults only.
- A generic LTI provider in the simulator.
- Could: the DR management flow (`registration_client_uri`).

### E3 LTI Advantage completeness — Must and Should

- **Must:** Platform Storage and client-side postMessages for launches with no third-party cookies (D-4).
- **Must:** accept a valid launch without a context. Keep the refusal of a missing `sub`.
- **Must:** Deep Linking: multi-select when `accept_multiple` is true, "Cancel" with an empty response, `acceptLineItem` and `acceptMediaTypes`.
- **Must:** a decision on D-8 (NRPS). Lead input: keep the NRPS service for the service API and certification; stop requesting the scope in the Cogniate app channel settings.
- **Should:** ungraded links (D-11, after the E4 record model), Canvas Dynamic Registration (D-1), new-window launch (D-10), AGS score extensions and submission fields.
- **Should:** a claim and privacy policy per tool account (custom, lis, names, email). It replaces the LMS-named `minimizeClaims` flag and covers D-9. It needs LA-H4.

### E4 Learning-record core and dispatch — Must (core), Should (extras)

- **Must:** additive channel-neutral tables (`placement`, `learning_record`, `record_dispatch`). They keep the existing ids and the API and log names (`resourceLinkId`, `score_sync`).
- **Must:** AGS is the first `RecordReporter`. Keep the ADR-010 grade policy and the retry and confirmation guarantees.
- **Must:** a generic outbox with leases, fairness per platform, bounded parallelism, and platform `429` / `Retry-After` handling.
- **Should:** progress states (`Started`, `InProgress`, `Submitted`) and submission times.
- Ports only, not built: `CatalogExporter`, a job scheduler, a secrets slot per connection for LB, LC and LF.

### E5 Service operability and security — Must and Should

- **Must**, in this order:
  1. Rate limits.
  2. Tenant model (LA-H7), per-account tool URLs and account status.
  3. Operator admin API with its own credential; the LTI service CLIs become clients of it. The app CLIs (`app:grant`, `app:binding`, `app:audit`) stay shell commands in LA and write audit events (Lead decision OC-9, A-LAD-17).
  4. Append-only audit log.
  5. API key lifecycle (scopes, two active keys, revoke, expiry).
  6. `KeyProvider` port with versioned envelope encryption.
  7. Signing-key lifecycle `next` → `active` → `retired`, with `retired_at` and the A-T0-16 tests.
- **Should:**
  - Pilot backup and restore (LA-H8).
  - Metrics and alert rules.
  - Tenant id in logs, and a readiness endpoint.
  - Service key revoke.
  - `Idempotency-Key`.
  - A fail-closed production profile.
  - An async storage port in the LTI service (Postgres engine in LG, LA-H5).

### E6 Self-serve onboarding and connection health — Could

- Self-serve onboarding where it is safe (D-3), only after E5 rate limits and audit.
- A health view per connection: last launch, last dispatch, errors, key state.

### E7 Conformance kit and CI — Must

- K0: a Vitest contract suite per port, no Docker, run for every registered channel.
- K1: a simulator protocol suite per port.
- K2: optional browser checks.
- Pass rule: N/A is allowed only for a false capability whose guard passes. Nothing skips.
- A data-driven simulator: modules come from data, and one host manifest makes the compose aliases, hosts and certificate SANs.
- The fitness checks of E1 run in `npm run check`.
- A local CI script: `npm ci --ignore-scripts`, check, vulnerability scan, SBOM, secret scan.
- **Should:** a certification reference tool that uses only the public service API and covers the public 1EdTech test areas (LA-H9).

### E8 Docs and hand-over — Must

- An "Add a new LTI channel" developer guide. A person or agent new to the repo uses it once; record the time.
- An admin guide per LMS, including the new named LMS.
- An operator runbook: key rotation, master key re-wrap, backup and restore drill, tenant suspend, first steps in an incident.
- The deliberate deviations from the spec (R1 §4), and new contract §8 rows.
- The review pack in `docs/human_review/ltiaas/`.

### Not in LA (backlog milestones)

| Milestone | Content | LA prerequisite |
| --- | --- | --- |
| LB | Catalog and distribution: catalog model, catalog pull API, SFTP/CSV export | E4 ports, `CatalogExporter` |
| LC | Learning records out: xAPI to a customer LRS, events API | E4 `RecordReporter` |
| LD | Identity and SSO link launch: learner record, SAML/OIDC per library, account on first login, the `lti1p1` claim | E4, LA-H4 |
| LE | Packaged delivery: thin SCORM 1.2, AICC, cmi5, SCORM 2004, Common Cartridge; `.mbz` as the first `PackageExporter` | E1 capability model |
| LF | Vendor connectors: Degreed, Docebo, Cornerstone, Workday CCL, SAP SuccessFactors OCN, Viva Learning, 360Learning, Absorb | E4, E5 secrets |
| LG | Production platform: Postgres engine, cloud KMS, secret manager, high availability, managed backup, hosting and edge, tracing, billing, OAuth2 endpoints | E5 ports |

## 4. Success measures

1. A new LTI LMS profile changes **0 core files**. The branch-diff gate F2 measures the add-LMS task (E2-N, D2L Brightspace) against the SHA where the E2 core work (E2-K: generic DR fixes, new profile traits) is done (README OC-1, Lead decision).
2. No LMS name appears in core code. The lint ratchet reaches zero for core paths.
3. M1, M2 and T7 pass. Their assertions do not change, except (a) the closed-list rewrite of E0 (LD-1) and (b) the reviewed test-change list of each intended change `LA-IC-nn` (LD-9). Both reviewers approve each list.
4. The generic LTI channel and the new named LMS pass the conformance kit (K0 + K1) on the simulator.
5. A person or agent new to the repo adds a simulator LMS with the guide in less than one day.
6. The E5 Must items pass their acceptance tests on the simulator (rate limit `429`, audit event per admin route, key rotation with a launch and a score during rotation).

Live Canvas and Blackboard rows need human test sites (LA-H3). They are not an LA gate.

## 5. Delivery plan

### 5.1 Phases

See [charter-LA §2](charter-LA.md#2-phases-and-gates). P1–P3 change only docs. They run now, in parallel with the Blackboard and Canvas run.

### 5.2 Design split (P2)

| Worker | Owns |
| --- | --- |
| A1 | Overview, terms, kernel (E1), generic LTI (E2), record core (E4), refactor and migration, data model, app API delta, overall consistency |
| A2 | Advantage completeness (E3), operability (E5), security and tenancy, onboarding (E6), LTI service API delta, operability and security docs |
| QA | Test strategy, conformance kit (E7), fitness checks, regression plan |

### 5.3 Build lanes (draft; the P3 breakdown fixes the file ownership)

| Lane | Main area | Epics |
| --- | --- | --- |
| K | App kernel: providers, registry, binding and connection code | E1, E2 |
| P | Portal: registry-driven cards, routes, wizards | E1, E6 |
| S1 | LTI service operations: rate limits, tenant model, operator API, audit | E5 |
| S2 | LTI service key lifecycle: API keys, `KeyProvider`, signing keys, service keys | E5 |
| L | LTI service protocol: platform storage, Dynamic Registration, Deep Linking, launch without context | E2, E3 |
| L2 | B3 only: E3 Should tasks on the launch, picker and claims files (LD-11) | E3 |
| R | App records: placement, learning record, outbox, AGS reporter | E4 |
| QA / QA-E2E | Tests, data-driven simulator, conformance kit, CI script | E0, E7 |
| Docs | Guides and runbook | E8 |

Wave order (draft):

1. **B1:** E0, E1 blockers (K), E5 Must 1–4 (S), simulator data-driven (QA-E2E).
2. **B2:** E1 rest (K, P), E3 platform storage (L), E4 core (R), E5 Must 5–7 (S).
3. **B3:** E2 (K, L), E3 rest (L), E4 extras (R), E5 Should (S), E6 (P).
4. **B4:** E7 full kit run, E8 docs, regression, conformance.

Docker: at most 2 stacks at the same time, by booked slot (Lead decision LD-2). Authors work without Docker (unit and K0) by default.

## 6. Decisions

### 6.1 Lead decisions (process; recorded here)

| Id | Decision |
| --- | --- |
| LD-1 | Closed-list assertions in M1 and M2 get one open-world rewrite in E0. QA does it; both reviewers review it. Success measure 3 allows only this change. |
| LD-2 | Docker by booked slot: at most 2 stacks (one simulator lane, one Moodle lane). The Lead books the slots. This replaces "own stack per Author lane" in charter-LA §3. |
| LD-3 | ADR-012 stays a dev-stack rule. LA does not build on its open runtime gates. E5 changes no storage engine. |
| LD-4 | Evidence stays proportional: one focused test per acceptance criterion; harness work only when an AC needs it; one full regression gate at the end of each wave. |
| LD-5 | Test ownership (QA strategy §9.2 items 1–3): K0 is the QA channel contract suite over the public kernel and registry entry points, with no Docker. Kernel internals (controlled clock, temporary database, port fixtures, code rules) are Author unit tests; Reviewer-B checks their quality. Points that need a running service are K1 or acceptance on the SIM lane, owned by QA in `tests/ltiaas/**`. QA-E2E owns K2 and the simulator modules. The architects align the test sections of their ADRs to this rule. |
| LD-6 | LA-IC-09: after migration `014`, the T5b P5 fixture deletes the same failed row in `record_dispatch`. The assertions do not change. Both reviewers review the fixture diff (same rule as LD-1). |
| LD-7 | Golden outputs: one fixed golden script per channel (G2) plus the M1 `sim` assertions. A per-scenario record diff only if a reviewer shows a gap. |
| LD-8 | A short Moodle regression ("R2-lite": T7 once plus the area groups) runs after each E1 step that moves Moodle code (S3, S5, S6, S7). Cost: about 10–25 min of the Moodle slot per step. |
| LD-9 | An intended change `LA-IC-nn` (LA-ADR-04 D8) may change frozen assertions in M1, M2, T7 or other legacy suites. Each `LA-IC` lists the exact assertions it changes. QA makes the change as one reviewed list per `LA-IC`, at the task that ships the change; both reviewers approve the list. No other assertion may change (Reviewer-B B-LAD-08). |
| LD-10 | Lane S splits into two Author lanes so E5 is not the critical path (Reviewer-B B-LAB-02): **S1** = rate limits, tenant model and account status, operator API, audit; **S2** = key lifecycle (API keys, `KeyProvider`, signing keys, service keys). `services/lti-service/src/http/operator/**` splits per endpoint group so each lane owns its files; a shared mount file has one owner (S1). |
| LD-11 | Lane L in B3 (epics.md OI-1): (a) L's Could tasks (for example LA-E2-07, LA-E6-06) are deferred by default; the Lead builds them only if capacity remains at the end of B3. (b) A second protocol lane **L2** works in B3 on the tasks of A1's L2 list (LA-E3-03, LA-E3-05, LA-E3-08, LA-E3-10, LA-E3-13, LA-E5-18, LA-E6-06; Must and Should, Reviewer-B B-LAB-13), with A1's disjoint file split (L2: app `tool-pages/launch.ts`, `tool-pages/picker.ts`, `domain/pickers.ts`, `domain/launch.ts`, the `picker_pick` migration, LTI `lti/{login,launch,claims,idtoken,deep-linking,service-keys}.ts`; L keeps `lti/{registration,checks,platform-rules,codes}.ts`, `http/routes/**`, `store/**`, `profiles/**`, `platform/**`, the LTI `testkit.ts`). The Lead still cuts Should items at the end of B2 if the Must path slips (plan §7). |
| LD-12 | epics.md OI-2: app migration `016` becomes two files, numbered by the Lead in landing order (RQ-5). OI-7: the LA-E2-07 Author proposes the operator route and audit action to A2 through the Lead before the build. OI-8: confirmed; a guarded capability whose route only a Should or Could task builds is `notBuilt` in the kit fixture until that task lands. |
| LD-13 | QA capacity (QA Q-LAB-10): the build has three independent QA test authors plus QA-E2E. **QA** (lead QA) owns E0, the kit, the fitness checks, shared test helpers, `docs/reviews/LA-*/qa.md`, all gate runs and the Docker slot schedule. **QA-2** writes the test-first acceptance tests for lanes S1 and S2. **QA-3** writes them for lanes K, R and P; **QA-4** for lanes L and L2 (LD-17). Each owns a disjoint folder under `tests/ltiaas/**` (the breakdown names them); LD-17 replaces the run rule: each test author also runs its own task suites (Reviewer-B B-LAB-19). All are Claude Code Opus 5.5 xhigh, never Authors, Architects or Reviewers. epics.md §8 and §9 show a QA cost per task. |
| LD-14 | (a) LA-E5-03 and LA-E5-06 move from B1 to B2 to shorten the B1 critical path (A2 option), if A1 confirms the DAG. (b) The Should restore drill LA-E5-24 may use the existing `stack:data-backup` and `stack:data-restore` commands on a fresh QA project (tasks README form (g)). LA does not change those commands (LD-3). A failure caused by the open ADR-012 runtime gates is not an LA defect; then the Lead cuts LA-E5-24. |
| LD-15 | Rolling starts (Reviewer-B B-LAB-11): a task starts when all its dependencies are done (QA PASS, both reviews) and the ownership matrix gives its files to its lane at that time. Waves stay as ownership windows and as regression points (M1, M2, T7 at each wave end), not as start barriers. Docs may start in B3 on Must features that are done. The Lead keeps the start list in the board. |
| LD-16 | Done-order loops between a Could task and its companion (epics.md OI-11, for example LA-E6-02 with LA-E6-05/06, LA-E6-03 with LA-E6-07): the partner lands first; the companion depends on it; the partner's ACs that need the companion are marked "pending: <task id>" and close when the companion lands (tasks README §1 done rule per AC). If the Lead cuts the companion, the partner's pending ACs are cut with it and recorded in `deferred.md` (Reviewer-B B-LAB-17). |
| LD-17 | QA capacity option Q2 (epics.md OI-10): QA-2 (lanes S1, S2), QA-3 (lanes K, R, P) and a new **QA-4** (lanes L, L2) each write AND run their own task suites: K0 with no Docker, K1-SIM on the simulator slot by booking. The lead QA keeps E0, the kit, the fitness checks, the wave-end regressions (M1, M2, T7), the Moodle slot and the slot schedule, and writes `docs/reviews/LA-*/qa.md` from the suite reports. Docker stays at 2 slots (LD-2). The Lead may add a third simulator-only slot if the E0 memory record shows that it fits. A1 estimate: Must chain about 51.5 days; with review turnaround on the 15-step Must chain, about 58 days (Reviewer-B B-LAB-18). SIM-slot load is about 28–31 Must slot-days, so the third simulator slot is the main lever. |

### 6.2 Human decisions

| Id | Decision | Lead recommendation | Needed by |
| --- | --- | --- | --- |
| LA-H1 | Approve the LA scope, design and breakdown (G-DEV) | — | P4 start |
| LA-H2 | Q1 legal: the LTIAAS compatibility claim | Keep "API-shape compatible" wording until legal review | Release claim |
| LA-H3 | Q19, Q20: real test sites and budget (Canvas, Blackboard, D2L); owner of the Blackboard app | Free now: self-hosted Canvas and Moodle. Budget for the Blackboard VMDK (about USD 0.05/hour plus AWS; image expires 2026-12-04). Ask D2L for partner access. | Live rows |
| LA-H4 | Q3 privacy: claims a channel may receive; retention periods; learner erase scope | Pseudonymous default; claim policy per tool account | E3 claim policy, E4 |
| LA-H5 | Postgres in LA or LG | Engine in LG; async storage port in LA (LTI service first) | E5 design |
| LA-H6 | First new named LMS for E2 | D2L Brightspace (R2 §5.4: 2 quirks, LTI Advantage Complete, Dynamic Registration) | E2 design |
| LA-H7 | The v1 tenant: only Cogniate libraries, or external tool vendors (the LTIAAS model); host per tool account or path per account | Build the vendor-model controls in E5; sell only to Cogniate libraries in v1; one host per tool account | E5 design |
| LA-H8 | Pilot RPO, RTO and SLO | RPO 1 h, RTO 4 h for the pilot | E5 backup |
| LA-H9 | 1EdTech membership and the certified product shape (service plus reference tool, or the Cogniate app) | Certify the service with a reference tool | E7 reference tool |
| LA-H10 | G-BASE: wait for the full Blackboard and Canvas acceptance, or start LA build on the frozen candidate C (product `9f8ac62`) and merge the final result later | Start on the frozen candidate; E0 runs its own regression | P4 start |
| LA-H21 | Operator policy: who holds an operator key, key life, two-person rule for account close and forced key activation (A2, LA-ADR-06, LA-ADR-07) | Named staff only; 90-day keys; second operator as a Could | E5 build |
| LA-H22 | Offer ungraded items (D-11) (A2, LA-ADR-05 D5) | Yes for Canvas `link_selection` and `lti-generic`; no for Moodle | E3 Should |
| LA-H23 | Moodle manual connect authority: keep `self` (residual R-LA-1) or require a verified admin launch or a grant (A2, LA-ADR-07) | Keep `self` for the pilot | E5/E6 |
| LA-H24 | Approve the verified-admin-launch authority (E6 D3, Could) after a security review (A2, LA-ADR-08) | Only if E6 gets capacity | E6 |

## 7. Risks

| Risk | Effect | Control |
| --- | --- | --- |
| Scope is large for one milestone | LA takes too long | Strict Must/Should/Could; the Lead cuts Should items at the end of B2 if Must items slip |
| The Blackboard and Canvas run changes product code after the LA rebase | Merge conflicts in E1 files | LA-H10; rebase at each wave end; E1 lane K owns the conflict merge |
| Two Docker stacks only | QA waits | LD-2 slots; no-Docker K0 first; targeted re-runs |
| Brightspace product family unverified (R2 §5.4) | E2 profile wrong | Token URL and audience from admin values; the simulator first; confirm at the first live launch (LA-H3) |
| The refactor changes behaviour without notice | Regression in Moodle, Canvas, Blackboard | E0 baseline and golden outputs; M1, M2, T7 at each wave end |
