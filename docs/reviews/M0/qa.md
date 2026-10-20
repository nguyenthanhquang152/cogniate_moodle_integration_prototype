Verdict: FAIL — FOR DESIGN TESTABILITY ONLY
Round: 1

# M0 independent acceptance plan

Date: 2026-10-20. Role: dedicated QA, Codex GPT-6-Astra, xhigh.
Task: `task_8b0eb55ffe6f`. Dispatch: `ctx_4d2994dbaa01`.
Frozen input: `51e69d1`, ADR-011 revision 4. All design line numbers below refer to that commit.

The design supplies useful HTTP, browser, log, and LMS-side oracles. It does not yet supply a consistent executable gate for every criterion.
Q-M0-01 to Q-M0-06 need design changes before implementation. These are design testability findings, not observed product failures.
No product test ran. No implementation, author audit, author message, or reviewer report was read.
Only this report was written. No test, stack, account, tunnel, commit, or subworker was created.

Inputs: AGENTS.md, charter, research inputs, phase plan, board, ADR-010/011, API contracts, security, data model, flows, task rules, M1–M4.
The existing QA harness and [QA-E2E preflight](qa-e2e-preflight.md) were read for feasibility.
The preflight's earlier L1/L2/L3 labels and proposed setup choices do not override the frozen M3 labels or Lead decisions.
Primary sources were checked independently; see §6.

## 1. Evidence and oracle rules

Every future result needs: AC and subcase, product SHA, test SHA, command, run id, image digests, profile, health output, time, and redacted artifact path.
Each result is PASS, FAIL, or an explicit not-run result. A skipped test or empty suite cannot satisfy an AC.
Expected AC inventories must be checked because the current runners allow selections with no matching tests.

| Label | Exact environment and oracle |
| --- | --- |
| `SIM` | Owned acceptance stack, QA simulator on `.sim.test`, trusted local CA, both simulation gates on. Signed requests, independently verified responses, recorded AGS traffic, public APIs, browser assertions, and logs. AC-M1-02 is its **default-profile negative control**, with no simulator. Profile constant checks are metadata checks, not signed interoperability evidence. |
| `MOODLE-LIVE` | Real local Moodle 5.2.4, recorded image, teacher/student accounts, Moodle grade oracle and browser. T7 uses default/no knobs/no simulations. Legacy fixture and TTL subcases need the corrected split in Q-M0-01; a signed QA platform subcase is labelled `SIM`, not real Moodle. |
| `CANVAS-LOCAL` | A real self-hosted Canvas build, pinned commit and flags, own issuer, real admin/teacher/student flow and Canvas gradebook/API read. Only after SIM passes; Canvas runs alone. |
| `CANVAS-HOSTED` | Authorized hosted instance, actual environment/profile, version if available, accounts, browser/OS/cookie setting, date, authorization reference, and provider grade evidence. |
| `BLACKBOARD-LIVE` | Authorized Learn instance and vendor application; same evidence fields, plus Ultra/Original distinction. |
| `DOC` | Design/source or artifact inspection. It proves neither execution nor live interoperability. This report is `DOC` evidence only. |

Hosted access remains unknown. All hosted and local-Canvas execution rows remain UNVERIFIED.
An unreachable JWKS endpoint or missing authorization is not a simulator PASS for that row.
The operator grant proves approval by the trusted operator. Automated tests cannot prove the quality of the human institution check.

Use a fresh resource link per independent grade case. Reuse identical `sub`, context, resource-link, and deployment strings across different tenants on purpose.
For “nothing sent” assertions, combine the error, the simulator/sink counters, and outbound logs over a bounded observation interval.
For “nothing stored”, compare public lists and status before and after, and attempt the forbidden launch.
These observations cannot prove “only a hash is stored” or a particular SQL transaction mode. Those internal properties need author checks and independent review, or a separately approved narrow storage inspection.

## 2. Acceptance-to-test map

All entries below are planned, not executed. Test groups are proposed stable names under `tests/acceptance/M1/`; QA-E2E owns `tests/e2e/M2/`.
Each grouped row will expand into individual AC/subcase results.

| Criteria | Proposed test group and black-box oracle | Environment |
| --- | --- | --- |
| M1-01, 02, 03, 04 | `profiles`: compare all six real profile constants against QA-owned expected strings; inspect sim order and readiness; default-off refusal; standard compatibility; reserved issuers; reject each injected endpoint with no sink hit. Assert Blackboard JWKS client-id encoding. Extend the gate matrix per Q-M0-06. | `SIM`, including default negative control |
| M1-05 | `site-rules`: both service boundaries, each table row, `details.rule/field`, no network; valid site and split service origins. Add query, fragment, IPv6, nested localhost, own content/app host, fixed host with alternate port, and trailing-slash normalization cases. Resolve self-hosted split origins first. | `SIM`; Q-M0-05 |
| M1-06, 07 | `deployment-api`: shared singleton, CLI idempotency, illegal platform patch/delete, active-id list versus full list, exclusive diff, shared generations 1→2, exclusive generation 0. Probe encoded deployment ids and independent platforms with the same deployment string. | `SIM` |
| M1-08, 10 | `signed-deep-link`: actual browser OIDC round trip; exact opaque hints, state/cookie, auth host and JWKS path; verify returned JWS using tool JWKS; verify issuer, audience, deployment, dates, data, one item, points and target. Blackboard requires `sub`; Canvas omits it. Inspect picker CSP, form target, cross-library picker contents, and rejected foreign publication POST. | `SIM`; full flow needs M1b |
| M1-09, 11 | `grade-delivery`: verify the tool's client assertion cryptographically, including scope and audience form; use simulator token identity without printing it; inspect score body and endpoint, then independent stored result. Canvas assertion audience is a string; Blackboard is a one-element array. Test Canvas's signed `iframe` claim in a top-level tab and a real frame. | `SIM`; full flow needs M1b |
| M1-12, 13, 22, 25, 32 | `origin-routing`: signed wrong-origin claims; login/token deployment mismatch; unknown/inactive deployment; ambiguous issuer; stored site mismatch; split page/service success and reversed-host failures. Check error code, no ltik/attempt/picker, CSP, return link, and site/service/profile DTO fields. Exercise line-item and NRPS URL guards with an already issued key too. | `SIM`; Q-M0-04/05 |
| M1-14, 16 | `privacy-roles`: malicious extra claims and nested members; raw/reshaped ID token, removed-name log, blank SCORM student name. Test every role row, Student View, context subroles, learner plus institution instructor/admin, teacher preview and no grade POST. Keep standard-profile legacy behavior as its own control. | `SIM`, plus Moodle role regression |
| M1-15, 19 | `connection-config`: defaults, strict LMS/profile pairing, readiness, capabilities, no secret fields; exact ordered Moodle/Canvas/Blackboard rows. Compare JSON keys and scopes; one graded placement; anonymous privacy; download headers. Inline key equals current public JWKS and contains no private RSA members. | `SIM`; configuration checks only |
| M1-26 | `self-hosted`: register through an operator grant; signed DL and learner launch use `canvas-self.sim.test` as issuer; verify JWKS and token paths and received grade. No cloud issuer or SSO fallback. Apply the chosen split-origin policy separately. | `SIM`, not `CANVAS-LOCAL`; Q-M0-05 |
| M1-17, 20, 28, 29 | `grant-binding`: CLI issue/list/revoke plus actual library sessions; initial and add-deployment grants; absent, wrong-purpose, wrong-library/connection, mismatch, replay, expiry, revocation, squatting, conflict and concurrent requests. Compare platform/deployment lists and launch behavior. Assert a single successful redemption event and stable idempotent repeats. Run first-claim squatting for **both** providers, including Canvas's second deployment. | `SIM`; Q-M0-03/06 |
| M1-18, 27 | `disconnect-rebind`: retain old ltik/service key before disconnect; expect inactive refusal; rebind same library with a new grant; expect old credentials to remain invalid before and after new launch, including after restart. Other Blackboard deployment still launches and grades. Old publication stays unavailable; a new publication can grade. Raw LTI K2 issuance is distinct from app access to the old publication. | `SIM`; Q-M0-03 |
| M1-21 | `capabilities`: direct HTTP bypass of the UI for web services, course shell, registration URL, wrong add-deployment/config endpoint; exact code/capability, unchanged records, zero relevant network. Moodle retains those supported paths; `.mbz` remains course-scoped. | `SIM`; real Moodle T8 control |
| M1-23, 30 | `upgrade-rollback`: old-build Moodle setup, K0 and public state snapshot; coordinated backup, upgrade, byte-identical K0 through real service use; post-backup write; restore both databases, old binary start, lost-write and remote-grade checks. Tampered backup must leave both databases unchanged. | `MOODLE-LIVE`; Q-M0-02 |
| M1-24, 31, 33 | `logs-routes-errors`: documented events and redaction; authenticated/anonymous portal routes and publication fields; simulator 422/400 versus Moodle 409; exact status, tries and no automatic retry in the observation window. Explicit Resend follows best-result policy. | `SIM`, plus Moodle 409 control |
| M2-01, 02, 03 | QA-E2E `cards-connect`: per-LMS newest status, disabled Blackboard before setup, provider choices, field errors, separate page/service URLs and route-local state. | `SIM`, Chromium 1440×900 |
| M2-04, 05, 06, 07 | QA-E2E `wizard-config-grants`: exact copy/download bytes and inline kid; denied clipboard fallback; successful Canvas/Blackboard registration; API error texts; additional deployment and conflict. No endpoint/client-secret input. Redact approval input from retained artifacts. | `SIM` |
| M2-08, 09, 10, 13 | QA-E2E `capabilities-routes-results`: hidden unsupported controls, labelled Moodle export, disconnect wording/status, ready-only publish choices, correct LMS labels, foreign-library and wrong-LMS routes. Backend rejection is still tested separately. | `SIM` |
| M2-11, 12 | QA-E2E `keyboard-e2e`: keyboard/focus/live announcements; axe serious/critical count zero on every named state; complete each provider's portal→signed picker→learner→independent score path; screenshots of all steps. | `SIM` |
| M3-01, 03 | Coverage manifest: all 33 M1 and 13 M2 IDs, commands and redacted evidence; two complete M1 runs at the same product/test SHAs; no silent skip. | Per child row |
| M3-02 | T7's 15 ACs in three consecutive default-profile runs; all legacy T2a–T6 criteria in their necessary fixture/knob passes. Include T3c compatibility and T8 capability controls explicitly. Record every approved selector/expectation change. | Corrected split in Q-M0-01 |
| M3-04, 06, 07 | Simulator key/log hygiene, secret scan, start/end resource inventory, unchanged baseline volumes/containers, owned cleanup. Inspect generated files, not just `git status` (ignored private files would evade it). | `SIM` run evidence |
| M3-05 | One row per live check, authorization and exact environment, real provider setup/DL/launch/grade/privacy evidence or UNVERIFIED plus steps. No hosted row inherits local evidence. | `CANVAS-HOSTED`, `CANVAS-LOCAL`, `BLACKBOARD-LIVE` |
| M4-01, 02, 04 | Guide-step/evidence join; unsupported claims rejected; local versus hosted wording; source links and no copied provider/customer values. Source facts and executed steps remain distinct. | `DOC` |
| M4-03, 05 | Existing T9 language measurements; offline browser with network blocked; required diagram, approval boundary, profile table, matrix and decisions visible; three blocker statements. | `DOC`, local artifact/browser inspection |
| M4-06, 07 | Confirm final conformance artifact covers ADR/contracts and all deviations; no open major/blocker; decision list contains Q19–Q22 and D-1–D-11. QA does not author or substitute for the Architect's conformance review. | `DOC` |

Grade tests must include a non-100 result. Proposed independent fixtures: completed 7/10, failed 0/100, incomplete with no POST, and best-score 80→60→90.
Run HTML and SCORM paths for each provider; check emitted scores and simulator results rather than portal `sent` alone.
Use cached token and cold token cases. Do not demand one token request in every test without clearing or isolating the token cache.

## 3. Criteria gaps

### Q-M0-01 — MAJOR: the regression environment contradicts the required suites

Location: `docs/architecture/tasks/M3.md:65`; `tasks/README.md` §3–4; QA preflight §2.
AC-M3-02 applies default/no knobs/empty simulations to T7 **and** all T2a–T6 acceptance suites.
The latter need the acceptance hosts, sink, and TTL knob passes. `test:acceptance` deliberately switches profiles.
Thus the literal gate cannot pass without omitting required tests or violating its environment condition.

Required correction: split AC-M3-02 into (a) T7, default, no knobs, `simulation_profiles: []`, three runs;
(b) legacy acceptance, `acceptance` profile with documented per-test knobs, followed by default restoration checks.
Record real Moodle subcases as `MOODLE-LIVE` and synthetic platform subcases as `SIM`.
Explicitly include T3c and T8 controls; “T2a to T6” does not clearly include T8.
Changing the fixture profile is an environment correction, not permission to weaken legacy assertions.

### Q-M0-02 — MAJOR: the upgrade procedure invokes new tooling on the old checkout

Location: `docs/architecture/tasks/M1.md:25`, `:127`, `:129`; ADR-011 §14.
M1 introduces `stack:data-backup`, but AC-M1-23 calls it before switching the checkout from `b0b83a8`.
The contract does not provide an old-build invocation of that new command.
The restore contract also needs a declared scope for manifest validation and sidecar cleanup before claiming “nothing changes”.

Required correction: use the sequence in §5.2. Switch **code only**, with both services stopped, before invoking the new backup command.
No new service may start or migrate until the backup succeeds.
Define that all manifest entries are checked before either database changes; restore only the named pair and their matching sidecars.
Remove stale target WAL/SHM files when the backup has none. Missing files, a wrong digest, or wrong backup identity must fail without a partial restore.
The AC must permit checksums of the owned backup/restore files for this check; no table/ledger edits are needed.
Include a post-backup remote score: restoring Cogniate cannot erase a score already accepted by Moodle.

### Q-M0-03 — MAJOR: in-flight grant recovery and disconnect lack a complete observable contract

Location: `docs/architecture/contracts/cogniate-app-api.md:278`, `:283`, `:285`, `:364`, `:367`, `:372`, `:398`; M1-18/27/29.
The contract releases the database transaction during the LTI call and permits revocation of an unredeemed grant.
It does not state the outcome when revoke/replacement, expiry, disconnect, or a second request happens before final commit.
The generic “no longer pending” cleanup rule also needs a purpose-specific rule: Canvas add-deployment starts on a registered connection.
Two fast parallel PUTs in M1-29(h) do not prove crash recovery, late completion, or correct compensation.

Required correction: specify the final checks, error/status, grant state, binding state and retry result for:

1. LTI failure before write; LTI write with response lost; app exit after LTI success but before final commit.
2. Revoke or issue a replacement grant during redemption; retry after the 60-second mark expires.
3. Disconnect during initial redemption or Canvas add-deployment; old completion after a newer successful operation.
4. Blackboard disconnect failure, failed orphan deactivation, and rebind while older work is still completing.

Each case must prohibit a revoked/disabled operation from activating authority or disabling a newer binding.
Name a bounded recovery procedure when compensation fails.
Define whether expiry is checked at acquisition, completion, or both; QA must not invent that policy.
Add a black-box app↔LTI transport barrier for repeatable faults, restricted to acceptance and explicitly listed in task rules.
The LMS simulator cannot pause an internal app↔LTI registration response. Author owns the transport plumbing; QA owns fault scenarios and assertions.
No production SSRF relaxation, arbitrary endpoint override, database mutation, or unbound-launch exception is needed.

M1-27 also needs two distinct assertions: old credentials fail at the LTI API; old publication links still fail at the app after rebind.
A new raw LTI key for the same resource does not prove that an old Cogniate publication may be reopened.

### Q-M0-04 — MAJOR: “any third page host fails” is stronger than the defined checks

Location: `docs/architecture/adr/ADR-011-multi-lms.md:153`; LTI contract §9.7; app contract §6.1; `tasks/M3.md:91`.
Check 13 checks AGS, NRPS and Deep Linking return URLs.
A resource-link token need not contain a Deep Linking return URL. Its AGS/NRPS can remain on the approved service host.
The app compares stored site values and discards an off-site learner return URL.
Neither rule establishes that such a top-level learner launch came through the configured page host.
Frame CSP can block framing by another host; that is not a `SERVICE_ORIGIN_MISMATCH` response.

Required correction: specify separate third-host scenarios for Deep Linking, framed resource launch and top-level resource launch.
Either narrow L-C11 and the ADR claim to the checks actually specified, or define the additional trusted input and its exact rejection rule.
Do not use a browser `Referer` or a typed origin as installation proof.
Add a SIM resource launch with correct service URLs, no DL settings, and a different learner return URL; give it an explicit expected outcome.

### Q-M0-05 — MAJOR: self-hosted Canvas has two incompatible service-origin rules

Location: `docs/architecture/adr/ADR-011-multi-lms.md:140`, `:142`, `:165`; LTI contract §9.1/9.4; M1-04/26/32.
ADR §5 says self-hosted service origin equals issuer/site, with token endpoint on that site.
ADR §6 and the API contract allow a separate `serviceUrl` for self-hosted Canvas and derive the token endpoint from it.
A signed split-origin self-hosted scenario can therefore be either valid or invalid under the proposal.

Required correction: choose one policy and update every table. Add a self-hosted split-origin positive or negative AC with exact status.
State URL normalization before storage/grant comparison, including a trailing slash, host case and default HTTPS port.
QA will not derive expected origins by importing the shared production validator.

### Q-M0-06 — MAJOR: provider acceptance can pass without proving cryptographic refusal

Location: M1-08–14/16/29; `docs/architecture/tasks/M3.md:58`, `:64`.
The new criteria use signed positive tokens and invalid claims, but do not require invalid-signature/algorithm/replay tests for each new profile.
Legacy T2 negative tests on `standard` cannot prove that a new profile did not bypass those checks.
M1's self-check is author evidence, not independent acceptance.

Required correction: add a mandatory SIM matrix for `canvas-sim-cloud`, `blackboard-sim`, and `canvas-self-hosted`.
Cover altered signatures, wrong keys/kid, `none`/HS256, wrong issuer/audience/azp, expired/future tokens, wrong nonce, missing cookie and reused state.
Assert the existing security error, no redirect/ltik, and no application side effect. Use a fresh login for every negative except deliberate replay.
Also require all four profile/flag gate combinations, Blackboard first-claim squatting, and Canvas add-deployment code theft/replay.
Test service-key origin/path/query isolation after launch; rejecting a bad launch alone is insufficient.
Include the non-100 and best-score cases in §2 so “always send 100” cannot pass.

### Clarifications that should accompany the corrections

| Id | Severity | Location and needed clarification |
| --- | --- | --- |
| Q-M0-07 | MINOR | `tasks/M1.md:15`: M1a lists whole criteria that require the new app/player (05, 08–11, 14). Mark LTI-only subcases as partial evidence. M1b must run the full grant, picker and player paths before those ACs pass. |
| Q-M0-08 | MINOR | `tasks/M3.md:90`, `:114`: “record both results” for Safari has no functional PASS/FAIL rule. Define observation-complete separately from flow-success; blocked-cookie observations must not become a broad interoperability claim. At `:93`, key rotation does not invalidate an already issued OAuth token. Require a fresh assertion/token request before expecting grade authorization to fail. |
| Q-M0-09 | MINOR | M1-29 heading says no LTI row changes “in each case”, but concurrent success in (h) must create a binding. Exclude that positive race. M1-28's no-page-code rule must allow the approval input while entering it, then require clearing it. M3-07 must distinguish secret-bearing raw traces from redacted evidence; raw traces cannot satisfy a zero-hit scan. |

## 4. Independent simulator and tests that reject an enum-only change

QA will implement `tests/sim/server.mjs` and signing fixtures from standards and provider behavior.
Use Node crypto for fresh in-memory RSA-2048 keys and an independently authored verifier. No production schema, URL validator, claim filter, role helper or grade mapper enters the oracle.
Export only public JWKS. Check JWS signatures as well as the decoded body; reject tampered fixtures in simulator self-tests.
The tool JWKS endpoint supplies actual verification keys, not expected claims.

The control API needs scenario ids, reset/record cursors, explicit readiness, and request counts by host/method/path/resource.
Keep tokens and assertions in memory; record redacted identifiers and verification outcomes for evidence.
Validate token grant type, scopes, assertion issuer/subject/audience/dates/jti, then enforce token scope on AGS/NRPS.
Blackboard tokens span its two simulated sites; the oracle still records exactly which site received each call.
Pin the provider-source revision used for fixtures. A moving Canvas `master` page is not a tenant release identifier.

Specific failures an enum-only implementation must expose:

- Shared issuer cannot select a library; identical user/context/resource ids on A and B must remain isolated.
- Blackboard uses one application and distinct deployment owners; disconnect A leaves B and its grades working.
- A public client/deployment id, even before the real owner binds, cannot activate a connection without its grant.
- An added Canvas deployment needs its own approval; another library's code cannot grant it.
- Old Blackboard keys remain invalid after rebind and restart; old publications remain unavailable.
- Canvas auth/JWKS use the SSO host; token/AGS use the service host; frames/DL return use the page host.
- Blackboard DL needs `sub`, and its assertion uses array `aud`; valid signatures remain mandatory in both profiles.
- Canvas still sends `iframe` in a new tab; only the top-level Canvas embedded page automatically continues.
- Institution instructor plus context learner is graded; context staff is preview; Student View remains graded.
- A failed 0 or completed 7/10 is not silently changed to 100; 422/400 are terminal while 409 remains conflict.
- Hidden Moodle controls still fail at the API before outbound calls; old Moodle registrations and K0 survive migration.
- Real profile constants cannot be replaced by test hosts; simulation controls stay off outside acceptance.

Use only the named `.sim.test` aliases and local CA SANs. Do not map real vendor DNS, sign vendor certificates, or disable TLS verification.
The fixed production profile constants get exact metadata assertions; local simulations do not exercise vendor infrastructure.
Existing static `qa-platform.test` helpers cannot act as token/AGS/DL servers. The new simulator requires the M3 compose mount and inbound routing.
QA-E2E requests simulator changes through the Lead and owns its UI/E2E assertions.

## 5. Feasible run plan after the design gate

No commands in this section were executed for M0. New M1 runner and backup tools do not exist as verified deliverables yet.

### 5.1 Allocation and commands

The 04:59 UTC preflight recorded 7.75 GiB Docker memory, no containers, and seven existing volumes.
Recheck ports, subnets, disk and resource ownership at every run. Prefer one stack at a time on this VM; two is the maximum, not a target.

| Lane | Project example | Port / subnet | Work |
| --- | --- | --- | --- |
| QA | `qa-multi-r1` | 8443 / `172.29.0.0/16` | M1 simulation, then isolated migration and legacy acceptance runs |
| QA-E2E | `qa-e2e-m3-r1` | 8543 / `172.31.0.0/16` | Default-profile T7, three runs |
| QA-E2E SIM | `qa-e2e-sim-r1` | 8643 / `172.27.0.0/16` | M2 using QA's simulator |
| Author | `cogniate-multi-author` | 8743 / `172.26.0.0/16` | Separate smoke lane, coordinated by Lead |

From a QA working copy, with `candidate_sha` set to the Lead's immutable candidate:

```sh
course_fixtures=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses
export COURSE_FIXTURES_DIR="$course_fixtures"

COMPOSE_PROJECT_NAME=qa-multi-r2 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t2.mjs --sha "$candidate_sha" --tasks T2a,T2b,T3a,T3b
COMPOSE_PROJECT_NAME=qa-multi-r3 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t3c.mjs --sha "$candidate_sha"
COMPOSE_PROJECT_NAME=qa-multi-r4 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t4a.mjs --sha "$candidate_sha"
COMPOSE_PROJECT_NAME=qa-multi-r5 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t4b.mjs --sha "$candidate_sha"
COMPOSE_PROJECT_NAME=qa-multi-r6 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t5.mjs --sha "$candidate_sha" --tasks T5a,T5b,T6
COMPOSE_PROJECT_NAME=qa-multi-r7 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t8.mjs --sha "$candidate_sha"
```

QA-E2E separately runs the existing T7 host runner:

```sh
COMPOSE_PROJECT_NAME=qa-e2e-m3-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 \
  node tests/e2e/host/run-t7.mjs --sha "$candidate_sha" --runs 3 --demo --check-confirm
```

Each runner creates an isolated clone and guards its own resources. Record the exact test overlay if tests are newer than the candidate.
Do not call an old runner's hard-coded expected-count check a complete M1 inventory.
QA will add a host entry point for M1 after authorization; proposed invocation:
`COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-m1.mjs --sha "$candidate_sha" --runs 2`.
This is a **planned command**, not an existing one. Its ownership must be included in the next QA brief.
It must separate default-off controls, SIM, and migration passes; copy `tests/sim` into the tested clone; verify all expected subcase ids; and clean up on failure.

Current harness entry point for the in-container M1 selection is `QA_TASK=M1 npm run test:acceptance`.
The new host runner must retain that entry point's profile restoration and existing host-control boundaries.
The 63-second grant expiry and 60-second no-retry observation need explicit test timeouts above the current 60-second API default.
No clock changes or TTL shortcuts should silently replace those cases.

Budget execution time after build: two complete M1 runs plus migration/rollback; legacy suites sequentially; three T7 runs plus demo.
The preflight measured about three minutes per T7 run, excluding builds. No measured M1 or Canvas duration exists.
Reserve a separate work block for local Canvas build/assessment; stop on resource failure, without changing Docker Desktop.
Local Canvas needs its own issuer, RSA keys, TLS and real grade oracle. It must not run beside Moodle.

### 5.2 Old build → backup → new build → restore → old build

Proposed replacement for M1-23/30:

1. In an owned clone at `b0b83a8`, build and start the baseline. Keep its generated environment, master keys and data.
2. Through Moodle and public APIs, create the legacy connection/publication/activity/attempt/sent score. Capture K0 securely and a redacted state snapshot.
3. Stop `cogniate-app` and `lti-service` with the old checkout's compose configuration. Confirm they stopped. Do not reset data.
4. Check out the candidate **while both services stay stopped**. Install/build the new code without service startup.
5. Run the candidate's `npm run stack:data-backup -- --out "$backup_dir"` against that same owned project and unchanged old databases.
6. Verify the complete manifest, then start the candidate so migrations run. Check K0, IDs, old records, a new launch and grade.
7. Make a distinct post-backup attempt and accepted Moodle grade. Preserve both portal and remote-grade evidence.
8. Stop both services. First test a damaged **copy** of the backup: restore must exit 1 and preserve both target databases. Then restore the valid pair using the candidate's restore command.
9. Check out `b0b83a8`, install/build it, and start it with the original environment/keys. No ledger edit and no reset.
10. Prove healthy old services, K0 service access, old activity launch, absent post-backup portal write, and retained remote Moodle grade.

Keep backup folders outside checkout switching paths and out of shared evidence. They contain secrets.
Record code/build changes separately from data changes. Assert no new process opens either old database before step 5.
This sequence needs the Architect's corrected AC, plus the manifest/sidecar refusal semantics in Q-M0-02.

Preserve redacted results before cleanup. Remove only this run's containers, networks, volumes, generated secrets, clones and test image.
Do not remove the seven existing volumes, unrelated images, or earlier QA folders.

## 6. Independent primary-source checks

Read on 2026-10-20. These support fixture design only; none is live product evidence.

| Source | Fact used for the oracle |
| --- | --- |
| [1EdTech Core](https://www.imsglobal.org/spec/lti/v1p3), [Security](https://www.imsglobal.org/spec/security/v1p0), [Deep Linking](https://www.imsglobal.org/spec/lti-dl/v2p0), [AGS](https://www.imsglobal.org/spec/lti-ags/v2p0) | Registration/deployment identity, login deployment agreement, signed message validation, content-item response and grade-service exchange. |
| [Blackboard registration](https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application), [OIDC](https://docs.blackboard.com/docs/blackboard/lti/1.3/core/oidc-auth) | One vendor application; institution deployments; issuer and client/deployment hints. The OIDC page's current flow says Learn supplies the client id; use that rather than the older registration paragraph that says it is absent. |
| [Blackboard subsystem authentication](https://docs.blackboard.com/docs/blackboard/lti/1.3/lti-subsystems/lti-sub-authentication), [DL response](https://docs.blackboard.com/docs/blackboard/lti/1.3/dl/dl-return-token) | Gateway token endpoint, array audience example, Learn-host service URLs, and required DL `sub`/deployment/data. |
| [Canvas launch documentation](https://raw.githubusercontent.com/instructure/canvas-lms/master/doc/api/lti_launch_overview.md), [developer key configuration](https://raw.githubusercontent.com/instructure/canvas-lms/master/doc/api/lti_dev_key_config.md) | Separate cloud issuers, SSO auth/JWKS, self-hosted issuer setting, inline versus URL public key configuration. |
| [Canvas JWT message](https://raw.githubusercontent.com/instructure/canvas-lms/master/lib/lti/messages/jwt_message.rb), [DL request](https://raw.githubusercontent.com/instructure/canvas-lms/master/lib/lti/messages/deep_linking_request.rb) | `iframe` launch claim; AGS/NRPS use the root account's environment domain; DL return derives from the controller request; assignment selection accepts window/iframe. Hosted domain resolution remains an inference until a tenant check. |
| [Canvas score controller](https://raw.githubusercontent.com/instructure/canvas-lms/master/app/controllers/lti/ims/scores_controller.rb), [OAuth endpoints](https://raw.githubusercontent.com/instructure/canvas-lms/master/doc/api/oauth_endpoints.md) | Older timestamp gives 400; non-student/score validation can give 422; service access uses a signed client assertion. These facts do not change Cogniate's best-result policy. |

The next QA dispatch should implement tests from the corrected, approved criteria before reading M1 product code.
This report does not approve implementation, verify any product behavior, or establish Canvas/Blackboard interoperability.

---

## 7. Round 2 — 2026-10-20

**Verdict: FAIL — FOR DESIGN TESTABILITY ONLY.**

Frozen design: **`bd9fe36edbe59143b914d7ccac424efd1db2c335`**, ADR-011 revision 5.
Task: `task_f0190c5eafe4`. Dispatch: `ctx_d667c956a9d5`.
This section supplements the unchanged round-1 report. All line references in this section refer to the frozen design.
It is `DOC` evidence, not a product verification result.

I checked the Architect's response against the revised ADR, contracts, data model, security rules and M1–M4 criteria.
I did not read product implementation or author audit notes, and did not use either reviewer report to form these findings.
The round-1 primary-source checks and independent fixture rules still apply; this round adds no live-provider claim.
No code, test, stack, tenant, account, tunnel, commit or subworker was created.

Revision 5 makes most previous criteria executable and supplies a useful remote binding-ref comparison.
Three MAJOR gaps remain in the recovery contract and its fault oracles. Three MINOR AC conflicts also need correction.
The design gate must stay closed until the major gaps have explicit outcomes and reproducible tests.

### 7.1 Disposition of every previous QA finding

| Finding | Disposition at revision 5 | Evidence and remaining work |
| --- | --- | --- |
| Q-M0-01 | CLOSED for design | M3 AC-M3-02 separates three default-profile T7 runs from legacy acceptance/knob passes, includes T3c and T8, and assigns labels per real or simulated subcase. Default restoration is explicit. |
| Q-M0-02 | CLOSED for design | M1-23/30 and ADR-011 §14 now switch code while both services are stopped, back up before migration, validate the whole backup before replacement, remove obsolete sidecars, and preserve the remote Moodle-grade oracle. QA may damage backup copies and compare file hashes. |
| Q-M0-03 | PARTLY CLOSED; still MAJOR | Phase-1 expiry policy, phase-2 checks, attempt history, conditional remote mutation, containment commands and the gate are specified. M1-27 separates old-key rejection from old-publication rejection. The remaining problems are Q-M0-R2-01 to 03 below; a named fault case alone is not an executable oracle. |
| Q-M0-04 | CLOSED for design | M1-40 separately tests wrong-host DL refusal, browser CSP refusal and successful top-level launch with its foreign return URL discarded. It no longer claims that the backend can infer an unsigned source page. |
| Q-M0-05 | CLOSED for design | M1-05/26 and the profile contract agree: self-hosted issuer/auth/JWKS use the page origin, token/AGS use the separately stored service origin. Canonical expected values are explicit and need no production validator in QA. |
| Q-M0-06 | CLOSED for design | M1-34/35/36 add per-profile cryptographic refusal, all simulation-gate combinations and post-launch service URL isolation. M1-29 adds both-provider squatting and Canvas add-deployment theft/replay. M1-09/11 require non-100 and best-result fixtures. |
| Q-M0-07 | CLOSED for design | M1 line 15 and M3 separate partial M1a evidence from full-AC completion after M1b. |
| Q-M0-08 | CLOSED for design | M3 §5 defines browser PASS by flow success, separates blocked-cookie observation, and forces a cold token cache for L-C14 while retaining the existing-token caveat. |
| Q-M0-09 | CLOSED for design | The positive parallel case moved to M1-37(j). M1-28, M2-05 and M3-07 distinguish intentional input/CLI display, clearing the input, raw private traces and redacted retained evidence. |

### 7.2 Remaining criteria gaps

#### Q-M0-R2-01 — MAJOR: the stale-attempt scenario cannot reach its specified answer

Locations: app contract lines 375, 377–381, 394–395; M1 lines 137, 142–143; M3 lines 65–74.

M1-37(i) holds the first LTI response for more than 60 seconds, completes a second redemption, then expects the first request to return `403 GRANT_INVALID` from phase 2.
The same contract requires a normal **5-second** outbound timeout and says a missing answer returns `502`, clearing that attempt's lease.
With the specified transport gate, the first request has therefore finished before the second starts. Releasing its old response cannot make it enter phase 2.
Stopping the app does not solve this: the old handler dies, as the separate M1-37(d) case already recognizes.

M1-37(n) also needs a reachable trigger for compensation after loss of the lease; M1-37(o) needs an exact point for its “release before lease ends” check because successful cancellation clears the attempt fields.
The gate does not say whether a held request survives downstream disconnect, whether a late `hold_before` release still forwards it, or how QA observes “held before”, “forwarded” and “upstream completed”.
Those distinctions are essential for M1-38(f), not implementation details of the QA assertions.

Required correction:

1. Split a timed-out request (`502`, lease cleared, possible later remote write) from a still-running request that actually reaches phase 2.
2. Give M1-37(i/n/o) reachable schedules under the real timeout. A practical stale-compensation case is: revoke within five seconds, release the initial response, hold its compensation before forwarding, issue/redeem a replacement grant, then release the old compensation. Expect remote `409`, the new ref still active, and a working new launch.
3. For the genuine 60-second lease case, use the documented app crash/restart and assert takeover by a new request; do not expect a response from the dead request. If another paused-process mechanism is required, specify and authorize it before QA uses it.
4. Define gate lifecycle events and behavior after a caller closes. Record a request id and phase without headers, bodies or secrets. A late-mutation test must prove that the gate really forwarded the old request after the newer state existed.

Do not increase a production timeout, alter clocks, or add an unapproved test bypass merely to force the current oracle to pass.

#### Q-M0-R2-02 — MAJOR: release has no complete contract for an unfinalized Canvas platform

Locations: app contract lines 278, 377, 388, 444–446; data model lines 367, 408–414; M1-37(c), M1-38(d).

Reproducible design sequence: create a pending Canvas connection with the wrong service URL; issue a matching grant; let the remote platform create succeed but drop its answer.
The app returns `502`; phase 2 never stores the platform binding on the connection.
The LTI platform exists with an attempt ref, but `connection.lti_binding_ref` is still null and the connection has not saved its platform id.
Suspend permits discovery/use of an old attempt ref. Release instead specifies deletion with the **connection binding ref**.
It does not specify how to locate and conditionally delete this unfinalized platform.
The normal recovery exception cannot correct its service URL because it requires an exact service-URL match.

Required correction: define release of a platform made by one of this connection's attempts, including lookup when the connection has no saved platform id/ref.
Use the verified remote ref from that attempt's history as the condition; refuse deletion if ownership changed.
Keep final connection history distinct from an unfinalized attempt, and define the already-absent/repeated-release result.

Add an explicit `SIM` AC: lost create response → pending connection → suspend → release → old remote record absent → new connection with the same client id and corrected service URL successfully redeems and grades.
Repeat with a held old delete delivered after a newer binding: it must not delete the newer platform.
These outcomes must use APIs/CLI and logs, without QA editing database rows.

#### Q-M0-R2-03 — MAJOR: Canvas added-deployment authority and retry bypass the final grant step

Locations: ADR-011 lines 85, 137–141; app contract lines 375–381, 401, 516; LTI contract lines 560–564; M1-20, M1-37(h).

The new two-phase contract needs a distinct Canvas add-deployment fault case.
Its LTI `POST` creates an **active** deployment before phase 2. Unlike initial Canvas setup, the parent platform already belongs to a registered connection.
App launch routing uses that platform id and does not require the deployment to be in a finalized app binding.
Following these written rules therefore permits a launch from the new deployment while its grant has not completed redemption.
This is a design consequence, not an observed product failure.

After `drop_after`, the grant remains unredeemed and the remote row active.
The deployment endpoint then says an already-active id returns `200`, no change, **without using a grant**.
That is not a complete recovery oracle: it does not require finalization of the pending attempt, storage of its binding ref or a `grant_redeemed` event.
Revocation after the timeout likewise has no running phase-2 handler to compensate.
M1-37(h) only tests disconnect during the call, which disables the entire connection and misses this case.

Required correction: state exactly when a new Canvas deployment gains launch/grade authority, and gate that authority on final grant redemption.
Distinguish an idempotent repeat of a finalized deployment from an active remote row left by an incomplete attempt.
Define recovery for the latter, including ref adoption, final grant state and cancellation cleanup, without treating “remote active” as proof of completed approval.

Add `SIM` cases on a connection with an existing working deployment:

- Hold the new-deployment response before phase 2 and launch the new deployment; it must not produce an authorized picker, attempt or grade. The old deployment must still work.
- Drop that response, retry with the same grant, and require one finalized new binding, one redemption event and the deployment in the connection DTO.
- Drop the response, revoke/replace the unredeemed grant, then try the old code and a new-deployment launch. Specify the denial/repair result and prove no cancelled authority survives.
- Race replacement with an old compensation; the new ref and new deployment must survive the stale conditional mutation.

#### Q-M0-R2-04 — MINOR: encoded-id positive violates the declared input alphabet

Locations: M1 line 73; LTI contract lines 556, 568.
M1-07 requires `a/b c` to round-trip through create and patch, but the create schema forbids spaces.
Use a valid id such as `a/b:c` for the encoded-path positive, and make the space-containing id a separate rejection case with its exact error.
The fixture must not depend on relaxing the production schema.

#### Q-M0-R2-05 — MINOR: the fixed-deployment error has conflicting precedence

Locations: M1 line 140; M2 AC-M2-06; app contract lines 369–371, 427.
After a failed `dA` redemption leaves a reservation, M1-37(l) expects a direct request for another id to give `409 DEPLOYMENT_FIXED`.
With the original grant, ordered phase-1 check 5 instead gives `422 GRANT_MISMATCH`.
The CLI refuses to issue the matching other-id grant needed to reach check 7.

Choose the observable precedence and align the app contract and both ACs.
If the mismatch check stays first, test that exact `422`, the CLI refusal and unchanged reservation; cover any unreachable defensive `DEPLOYMENT_FIXED` branch in the author's unit tests.
Do not seed a forbidden grant directly into the database to claim black-box coverage.

#### Q-M0-R2-06 — MINOR: suspend's score-row timing differs from the worker contract

Locations: M1 line 145; app contract line 404; ADR-011 §12.
M1-38(a) requires all pending score rows to become failed “at once”; the API/ADR requires this when a row is **due**.
A future retry row distinguishes these outcomes.
Specify either synchronous failure on suspend or failure at the next due worker pass, with a bounded observation interval.
In both cases, assert zero score POSTs after disable, unchanged tries, and `409` for Resend/Refresh.

### 7.3 Revised acceptance-to-test plan

The round-1 mapping remains the baseline. Its old “33 M1” inventory becomes **40 M1 + 13 M2 + 7 M3 + 7 M4 = 67 ACs**.
Expand all listed subcases and per-profile matrices; an AC name alone is not a result.
Every following row is planned work after design approval, not executed evidence.

| Criteria / change | Independent black-box oracle | Environment and dependency |
| --- | --- | --- |
| M1-07, 37(n), 38(f) remote fence | Read ref R1; arrange new binding R2; deliver the captured old conditional mutation; require `409`, unchanged R2/generation and working new launch/grade. Exercise platform and shared-deployment boundaries. A log of a local pre-check is insufficient. | `SIM`, full M1; Q-M0-R2-01 |
| M1-37(a–d, j–k) failure/retry | Gate proves before-write failure versus write-with-lost-response; compare public records, CLI grant state, generation, response and one redemption event. For crash recovery retain the dead lease for its full duration, then retry. | `SIM`, owned app restart; no database edits |
| M1-37(e–i, m–o) cancellation | Use named barriers before the five-second deadline for live cancellation; assert exact HTTP/CLI/log outcomes and final remote state. Separately test timed-out late writes and failed compensation followed by operator repair. | `SIM`; do not mark complete until Q-M0-R2-01 is resolved |
| M1-20, 37(h) add-deployment recovery | Existing deployment remains usable; unfinalized new deployment has no app authority; successful retry finalizes exactly once; revocation/replacement and stale compensation preserve the selected final authority. | `SIM`; Q-M0-R2-03 |
| M1-38 containment/recovery | CLI without library session; disable/revoke; cross-library denial; same-client corrected Canvas setup; release of finalized and unfinalized bindings; late old operations leave new owner intact. Compare old/new histories and credential outcomes separately. | `SIM`; Q-M0-R2-02/06 |
| M1-39 signed family | Self-hosted Canvas through standard/manual and DR paths; signed refusal before usable idtoken/picker/attempt; unknown/missing and matching-case controls; release wrong binding then rightful grant. | `SIM`, independent RSA signer and primary-source family fixture |
| M1-34/35/36 | Each crypto/session failure per new profile; all four simulation-gate combinations including stored-row behavior; service-key origin/path/query attacks with no outbound traffic. | `SIM`, including default/off negative controls; no vendor DNS/certificate impersonation |
| M1-08/10, 19 | Canvas return-query `data` preserved byte for byte with no JWT data claim; Blackboard claim echoed; signed response verified independently; exact anonymous configuration and inline public-key snapshot. | `SIM`; does not prove a real vendor accepted the export |
| M1-05/26/32/40 | Explicit canonical values, self-hosted split services, signed wrong-host rejection, browser frame refusal and top-level return-link fallback. | `SIM`; no production validator imported into fixtures |
| M1-09/11/27/29/33 | HTML and SCORM 7/10, 0/100, incomplete, 80→60→90; independent token/score oracle; squatting, replay, old keys before/after restart; permanent 422 and retained best result. | `SIM`; no enum-only implementation can satisfy these |
| M1-23/30; M3-02 | Corrected two-database upgrade/rollback; default T7 three times; all named legacy suites with their actual profiles and permitted knobs; remote Moodle grade survives local rollback. | `MOODLE-LIVE` for real Moodle, `SIM` for signed QA-platform subcases |
| M2 changes | QA-E2E tests approval-field clearing, exact error mapping, retry UI, unchanged Moodle capabilities and revised disconnect/attempt-limit text. Backend fault scenarios use QA-owned gate rules. | `SIM`; Q-M0-R2-05 must settle the error oracle |
| M3 live matrix | Browser flow success, cold-cache rotation and recorded cross-site Blackboard-token observation; every absent authorized environment remains UNVERIFIED. | Exact `CANVAS-HOSTED`, `CANVAS-LOCAL` or `BLACKBOARD-LIVE` label only |

For every race, retain: product/test SHAs, initial public state, grant state, gate request id and event sequence, both client outcomes, final ref/active/generation, launch result and redacted logs.
Never use a naked sleep as proof that a write happened. Poll a documented gate phase or public state with a deadline.
A physical remote row left after a failed request and actual app authority must be reported separately.
“No active binding” must state whether it is required before or after the documented operator repair.

### 7.4 Commands, resources and handoff

The existing host commands and resource lanes in §5 still apply; no stack was started to re-measure them.
The earlier 7.75 GiB Docker limit is preflight evidence, not a new capacity measurement.
Keep QA on `qa-multi-rN`, port 8443, subnet `172.29.0.0/16`; keep QA-E2E on its separate named lanes.
Prefer sequential stacks and never exceed two. Local Canvas runs alone only after SIM passes, with no Docker Desktop setting change.
Preserve the seven baseline volumes and all other-owner resources.

M3 now explicitly assigns QA `tests/host/run-m1.mjs`, so the planned command has an owner:

```sh
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-m1.mjs --sha "$candidate_sha" --runs 2
```

This runner is still **planned**, not claimed to exist or pass.
It must record a separate test SHA, validate all 40 M1 IDs and their expected subcases, split profile-off/SIM/migration passes, restore the default profile and clean only owned resources.
Keep `QA_TASK=M1 npm run test:acceptance` as its in-container suite entry point.
Use explicit per-test timeouts of at least 120 seconds for the real 60-second lease/expiry and no-retry observations; this changes a QA test deadline, not a product deadline.
Live cancellation schedules must fit the actual five-second call, using acknowledged barriers.
Allow two full M1 runs, a separate migration/rollback pass, the legacy suites and three T7 runs; there is still no measured M1 runtime.

The Author owns compose/TLS/routing and the transport-gate service in `infra/**`.
QA owns simulator behavior, in-memory signing fixtures, gate scenarios, expected values and assertions under `tests/**`.
QA-E2E consumes those interfaces and owns portal/browser evidence.
No shared production URL validator, claim filter, role helper or grade mapper may become a QA oracle.
Neither a profile's constants nor a passing simulation establishes live interoperability.

Required next step: Architect resolves Q-M0-R2-01 to 06 in the contracts and ACs, then the same QA instance rechecks the frozen correction.
No M1 product verification or design approval is claimed by this report.

---

## 8. Round 3 — 2026-10-20

**Verdict: PASS — FOR DESIGN TESTABILITY ONLY.**

Reviewed SHA: **`158a4d86fb5764f597ff20e3f652ae6d5225f96b`**, ADR-011 revision 6.
Task: `task_15510d66f895`. Dispatch: `ctx_e5ddff18c81b`.
Comparison: revision 5 at `bd9fe36`; completed round-2 reports at `706a278`.
All source line references in this section refer to the reviewed SHA.
Rounds 1 and 2 above are unchanged.

The corrected design gives the required fault cases reachable schedules and separate remote-state and app-authority oracles.
No BLOCKER or MAJOR design-testability finding remains open in this assessment.
A-M0-10 is the Lead's one accepted MINOR deferral; it is not resolved by this verdict.
This is `DOC` evidence only. No product behavior, test result or live interoperability is verified.

I read the charter, phase plan, completed M0 reports and the Architect's round-2 response.
I traced the changed contracts, data model, security rules, flows and affected acceptance criteria.
The source checks from round 1 remain the provider-fixture basis; unrelated provider research was not repeated.
No implementation or author audit was used to construct this plan.
Only this report was changed; no product/design/test file, stack, tenant, account, tunnel, commit, push or subworker was created.

### 8.1 Remaining finding dispositions

“Closed” here means that the design now supplies a consistent test oracle, not that the future implementation has passed it.

| Finding | Round-3 disposition | Contract and acceptance evidence |
| --- | --- | --- |
| Q-M0-R2-01; B-M0-09 | CLOSED for design testability | App lines 389–412 and 429–440 distinguish live replies, timed-out late writes and dead handlers. M1-37(d–g, i, n–r) names reachable schedules. M3 lines 71–78 define request ids, phases, caller disconnect, late forwarding and limits. No old request is expected to resume after a timeout. |
| Q-M0-R2-02; B-M0-08; A-M0-09, and the outstanding part of A-M0-02 | CLOSED for design testability | Targets are saved before calls (app lines 365–368; data model lines 411–439); exact lookup filters are defined (LTI line 552). Fence-out and release use current owned refs, not a missing final connection ref (app lines 461–465, 509–511). M1-37(c/c2, t, u) and M1-38(f/g) cover lost replies, cancellation, corrected values, late creates and an old delete against a newer binding. |
| Q-M0-R2-03; B-M0-07 | CLOSED for design testability | Phase 2 alone commits approval (app line 408); launch routing requires that deployment's approval (line 582); a remote active row is not an idempotent repeat (line 458). M1-37(p/s) keeps `dA` usable while denying unapproved `dA2`, then tests retry and grant-specific cleanup. |
| B-M0-03 | CLOSED for design testability | One lease per connection, S0 before calls, older-ref rules, ref rotation and activation in the same conditional request address both reported schedules. App lines 382–406; LTI lines 658–664; M1-37(f, n, q, r). Explicit traces are below. |
| Q-M0-R2-04 | CLOSED for design testability | M1-07 now uses valid `a/b:c`; `a/b c` has a precise `400 INVALID_REQUEST`/`deploymentId` refusal in the LTI schema, line 556. |
| Q-M0-R2-05 | CLOSED for design testability | App line 385 fixes check-5 precedence; M1-37(l) and M2-06 expect `422 GRANT_MISMATCH`. The unreachable defensive `DEPLOYMENT_FIXED` branch is explicitly an author unit test, not a database-seeded QA case. |
| Q-M0-R2-06 | CLOSED for design testability | App line 469 and M1-38(a) specify a future-due row, two real 503 score answers, due-time failure, unchanged tries, no further POST, and a finite polling deadline. |
| Q-M0-03 from round 1 | CLOSED for design testability | Its remaining gaps were carried into Q-M0-R2-01 to 03. Their closure now completes the earlier recovery finding. Other round-1 QA closures in §7.1 remain closed. |
| A-M0-10 | ACCEPTED MINOR DEFERRAL; remains a limitation | Lead direction, ADR-011 lines 165–167, D-12/R-M-16, app line 512, M1-39 and M4-08 accurately preserve the race and require its documentation. See §8.4. |

### 8.2 Traces of the disputed schedules

These are deductions from the frozen protocol, not execution results.
Reviewer-A's round-2 statement that held writes and stale compensation were already safe was broader than the schedules justified.
B-M0-03 and B-M0-07 remain the controlling counterexamples to revision 5; their closure relies on revision 6's new rules.

**B-M0-03, schedule 1: replacement before the old create returns.**
M1-37(q) holds attempt A's S1 before forwarding it.
Issue G2 while A still holds the connection lease; G2's first redemption must return `409 GRANT_IN_USE` and send no LTI call.
A's five-second timeout returns `502` and ends its handler.
G2 can then create, activate and commit B.
Only then release A's old S1: uniqueness gives upstream `409 …_ALREADY_EXISTS`; the dead handler cannot read B's ref or adopt it.
The resulting platform/deployment must retain B's ref and working launch.
M1-37(f) separately tests a live S3 reply: replacement still waits, A cancels and compensates, then B starts.
An older-attempt/newer-ref defensive branch is also required in the author's unit tests (M1 line 180); QA does not invent an impossible overlapping app handler to reach it.

**B-M0-03, schedule 2: compensation between read and activation.**
Use M1-37(n) to obtain a held compensation, with its new ref already recorded before B starts.
Let that compensation's caller time out; A returns `403`, logs compensation failure and releases the lease.
B reads the still-active old ref. Hold B's first S3.
Now deliver A's compensation: it succeeds and changes both `active` and the ref.
B's first S3 therefore gets `409`, even though its earlier read was valid.
Its second S2 sees an inactive adoptable record, and its second S3 sets `active: true` with a fresh ref before phase 2 commits.
M1-37(r) requires `200`, the final active state, and a working launch/grade.
The compensation ref is in B's older history because it was recorded before B's phase 1; its later network delivery does not make the history entry newer.

**Remote comparison is not ref-history enforcement.**
LTI lines 657–661 require rotation on a conditional PATCH and atomically compare only the current value.
A raw API holder can still create an ABA sequence (`r1 → r2 → r1`); the LTI service promises no history-based prevention.
The app's guarantee depends on unique, never-reused refs recorded before transmission (app lines 368, 420; data model lines 429–438, 516).
M1-07 tests the remote comparison and rotation; M1-37(n/r) tests delayed app writes.
These tests must not claim to prove the app's write-ahead transaction or uniqueness implementation; the specified author checks and independent code review cover those internal properties.

**B-M0-07 / Q-M0-R2-03: Canvas D2 before approval.**
M1-37(p) starts from an approved, working D1.
After a timed-out D2 create, revoke finds nothing; the late S1 then creates an inactive D2, whose launch gives `DEPLOYMENT_NOT_ACTIVE`.
A repeated revoke finds and fences it.
The late-S3 variant creates an active D2 without approval: the app returns `UNKNOWN_PLATFORM` with `deployment_not_approved`, and creates no picker, attempt or service-key use.
M1-37(s) adds lost-S3-response retry and a dead-handler case before approval; only a successful phase-2 commit adds D2 to the connection DTO and permits its launch.
The finalized-repeat shortcut cannot bypass this because line 458 requires an existing approval.
Check D1's existing key, launch and actual grade throughout; merely observing D2's denial does not prove isolation.

**A-M0-09 / B-M0-08 / Q-M0-R2-02: incomplete Canvas recovery.**
M1-37(c/c2) distinguishes lost creation from lost activation: inactive versus active remote platform, with no final app binding in either case.
Saved profile/issuer/client/target data permits discovery without `lti_platform_id`.
Cancel and same-value retry are covered by M1-37(t/u); corrected-service recovery is M1-38(f).
For the held old DELETE variant, let release return exit 1 at its timeout, let a new same-value connection adopt the inactive platform, then deliver the old DELETE.
Its expected old ref no longer matches, so upstream `409` must leave the new binding intact.
The API lookup, CLI per-record results, connection DTO, and new signed launch/grade are sufficient public oracles.

**Late writes after release, including an absent Blackboard row.**
M1-38(g) distinguishes an existing deployment, whose ref is changed by suspend, from a row that never existed when cleanup ran.
The existing row rejects old S3 after the new binding.
The absent-row case permits late S1 to create only an inactive generation-0 row; a repeat cleanup finds it, and the next authorized binding activates generation 1.
For Canvas, a late inactive platform with the wrong service URL blocks corrected-value adoption; repeat release must locate and delete it before the corrected redemption succeeds.
An “absent” cleanup result is a point-in-time observation, not proof that a held create cannot arrive later.

### 8.3 Executable evidence plan

The plan now covers **40 M1 + 13 M2 + 7 M3 + 8 M4 = 68 ACs**.
M1-37 contains (a) through (u), plus (c2); M1-38 contains (a) through (g).
The runner must also enumerate the named variants, profile matrices and both DL/resource launch paths.
All rows below are future `SIM` checks on the owned acceptance stack; no row has run.

| Schedule group | Required event ordering and final oracle |
| --- | --- |
| M1-37(a/b/c/c2, k, t, u) | Prove failure-before-write versus successful write/lost reply. Match remote active state, CLI grant state and DTO. Retry or cancel through the documented endpoints; require one record and a functioning approved result. |
| M1-37(d/o), (s) dead variant | App stops while the selected call is held; observe `caller_gone` and app restart. Assert a request is refused before 60 seconds and accepted after lease expiry. A dead process never supplies a later HTTP answer. For (d/o), the S3 held before forwarding gets upstream `409` after takeover or fence-out. For (s), S3 already completed upstream; discard its held answer and test approval denial before recovery. |
| M1-37(e/f/g/h/m) live cancellation | Reach `held_after` on S3; run the specified revoke, replacement or DELETE; release while the caller is still live. Capture `delivered`, exact `403`/`409`, cleanup result and final authority. Log measured time for every step. |
| M1-37(i/p/q), M1-38(g) late writes | First capture the client's `502` and `caller_gone`; only then release the held request. Require `forwarded` followed by `upstream_completed` with the specified 201/200/409. Assert denial before reconciliation and success only after the defined new commit. |
| M1-37(n/r/s) delayed compensation | Keep the old compensation held through its own timeout. Record whether it lands before or after B's S3. The two schedules have different intermediate statuses but both must end with B active, approved and usable. |
| M1-37(j/l) parallel/precedence | One redemption event and record; exact permitted repeat/conflict answers; no manufactured grant for the defensive fixed-deployment branch. |
| M1-38(a) score timing | Take the second actual 503 score event as the retry reference; disable before its 30-second due time. Pending before due, then failed by due + 4-second polling allowance + 5 seconds; unchanged tries and no score POST after disable. |
| M1-38(b–f) release/isolation | Record per-target CLI result and old/new public state. Never infer successful release from exit code alone. Old library history stays private; old credentials stay invalid after a new binding; newer/foreign binding remains usable. |

For each subcase preserve product SHA, test SHA, run id, exact command, profile/health, image digests, timestamps, gate event cursor/request ids, HTTP and CLI outcomes, and redacted state/launch/grade evidence.
Install a final matching `pass` rule for the relevant API paths when asserting that a request emitted **no** LTI call; otherwise unmatched traffic would not receive a gate request id.
Use ordered rules and `times` to distinguish S3 from compensation on the same path.
Poll the documented gate phases with deadlines; reset the gate at the end of each subcase, which drops held requests without forwarding and preserves events.
No token, body, query or authorization material enters gate evidence.

For live schedules, prepare fixtures and clients before the hold, and measure completion against the unchanged five-second timeout.
If the local machine cannot complete a required live sequence in time, record `BLOCKED` and the timings; that result does not satisfy its AC.
Use at least a 120-second QA test deadline for lease/crash cases, while retaining the product's five-second call and 60-second lease.
Bound phase 1 between the initial request submission and its first gate event: use the earlier bound for a before-expiry check and the later bound for an after-expiry check.
No clock manipulation, direct database writes or silent timeout extensions are needed.
The record kept for a disabled connection is history, not effective approval authority: assert denial by connection status, and assert removal of its local approval on release as specified in app line 467 and data-model line 513.

The planned M1 command remains:

```sh
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-m1.mjs --sha "$candidate_sha" --runs 2
```

This is a future QA-owned runner, not an executed command or claimed existing result.
The in-container entry point, migration/rollback command sequence, legacy host commands and T7 command in §§5 and 7.4 remain applicable.
Use two full M1 runs at fixed product/test SHAs, separate upgrade/rollback evidence, the named legacy suites, and three default-profile T7 runs.
Keep real-Moodle subcases `MOODLE-LIVE` and synthetic subcases `SIM`.
The added approval tables must not enter Moodle routing; M1-23/30, M1-39's standard-path recovery and the regression suites remain required controls.

Resource lanes are unchanged: QA `qa-multi-rN`/8443/`172.29.0.0/16`, separate QA-E2E lanes, at most two stacks, preferably sequential.
No fresh resource measurement was made in this review.
Preserve baseline volumes and other-owner resources. Local Canvas remains a separate, solitary assessment after simulations pass, with no Docker Desktop setting changes.
QA owns simulator behavior, signing fixtures, expected values and gate scenarios; Author owns infrastructure/gate plumbing.
No production validator or mapper enters the independent oracle.

### 8.4 Accepted MINOR boundary and completion gate

A-M0-10 is accurately bounded in revision 6:

- A grant-free standard/Moodle registration can occupy the released self-hosted Canvas issuer/client pair before the rightful Canvas redemption.
- Check 14 still rejects its Canvas-signed launch before claim storage; the residual impact is blocked setup, not Canvas access.
- Issue the rightful grant, suspend, release, then redeem promptly. The text explicitly says this order **does not prevent the race**.
- M1-39 deliberately reproduces the race and its operator repair. D-12/R-M-16 and M4-08 require the limitation in the operator/troubleshooting guides and `docs/human_review/deferred.md`, with reserved identifiers or quarantine needed before enterprise reliance.

No other BLOCKER or MAJOR is waived by that decision.
M4-08 is a future deliverable, not a claim that its guide/deferred artifact already exists.
Hosted Canvas, local Canvas and Blackboard execution remain UNVERIFIED until evidence from their own authorized environments exists.

The next QA dispatch may implement the approved simulator and tests once the Lead confirms both design reviews and the overall gate.
This PASS closes only the independent **design-testability** assessment at the exact SHA above.
It does not mark M1/M2/M3 complete, authorize a live tenant action, or verify the product.
