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
