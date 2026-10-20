Verdict: APPROVE
Round: 5

Latest verdict covers the bounded T7 `publishCourse` readiness repair at `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`; see Round 5 below. Round 5 is by a fresh dedicated Claude Reviewer-B (`claude-opus-5-5`, xhigh). Rounds 1–4 are by the earlier dedicated Codex GPT-6-Astra xhigh Reviewer-B and keep that attribution. No BLOCKER, MAJOR or MINOR Reviewer-B finding is open. One new NIT is open. This is not a T7 PASS, an M3 QA PASS, a completed full-run claim or a live-provider approval.

## Archived header through Round 4

Verdict: APPROVE
Round: 4

Latest verdict covers bounded harness preparation at `004568bd4ab8390d64945cb73f16cfdd51d566bf`, including the product/build repair reviewed at `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`; see Round 4 below. No new open Reviewer-B finding remains. This is not an M3 QA PASS, a completed full-run claim or a live-provider approval.

## Archived report through Round 3

Verdict: APPROVE
Round: 3

Latest verdict applies to harness preparation at `eb43247d02df622d5da72dafac41d919f65a91fe`; see Round 3 below. No Reviewer-B finding remains open. This is not the M3 acceptance verdict.

## Round 1 — historical review

Verdict: CHANGES_REQUESTED
Round: 1

Reviewer: dedicated Reviewer-B, Codex GPT-6-Astra xhigh. Date: 2026-10-20.

Reviewed commit: `9964e6f132e6608216616bff621e3f9ba5667b04`.
Product code: `76b03c7f24c15de2f7e164b836b27a398d45158a` (unchanged by the harness supplement).
Accepted M0 behavior: `56591df0e71939d5d62c9042c630c841d01f84e8`.
Implementation comparison baseline: `294114092b643766b5f552150038b812513da1d0`.

This is an independent implementation and prepared-harness review. It is not a QA acceptance result or live-provider approval. Code was read from a detached external clone at the exact reviewed commit. No stack, tenant, sign-up, database migration on persistent data, or live provider check was run. Only these review reports change the integration checkout. The Lead requested round-1 delivery now; fixes need a separate review at their exact commits.

## Result

Two open MAJOR harness findings prevent approval. The simulator, transport gate and host runners have useful boundaries and strict evidence accounting. Their self-tests pass, but the M2 UI recipes still contain assumptions that either stop execution before the intended checks or erase the state those checks need to observe.

## Findings

### B-M3-01 — MAJOR — Wizard and badge selectors do not match the implemented flow

Locations: `tests/e2e/M2/lib/m2.ts:178` through 194; `tests/e2e/M2/03-blackboard-wizard.m2.ts`; `tests/e2e/M2/06-keyboard-axe.m2.ts`; `tests/e2e/M2/04-detail.m2.ts:23` through 31.

Both `canvasToStep3` and `blackboardToStep3` click Next once to create the connection, then expect a second Next between setup and approval. The implemented pending wizard renders those two sections together and has no such second button (`apps/portal/src/connect/canvas/CanvasWizard.tsx:23`, and the equivalent Blackboard wizard). Direct Blackboard and keyboard/axe cases repeat the same assumption. These cases will wait for a nonexistent control instead of reaching approval, retry, keyboard or end-to-end checks.

The badge case goes to `/integrations` and searches for rows containing individual connection names and badges. The connection list is the `ConnectionOverview` shown by a connection detail; the Integrations page contains provider cards. That case cannot establish AC-M2-07 at its selected page.

Evidence: exact source comparison at `9964e6f`. This is a static harness defect, not a browser execution failure observed in this review. QA's H-1 already identified the second-Next and list-location assumptions as unresolved; they remain in the committed supplement.

Correction: align all shared and direct wizard callers with the actual visible setup/approval sections, preserving each step's assertions and screenshots. Navigate the badge test to the real connection list and retain assertions for all three LMS badges. Do not delete cases or loosen result requirements to get a passing run. Check related prepared selectors against the accepted product before the first product run.

### B-M3-02 — MAJOR — Route-state oracle reloads away its own observation

Locations: `tests/e2e/M2/08-routes.m2.ts:39` through 64; `tests/e2e/M2/lib/m2.ts:97` (`integrations`, the helper that calls `page.goto`).

The no-stale-values case installs a MutationObserver and `window.__staleSeen`, then clicks the client-side Integrations link. It next calls `integrations(page)`, which performs a hard navigation. This replaces the document and deletes the observer and captured array before the Blackboard transition. The final assertion expects the deleted value to equal `[]`; more fundamentally, the test no longer observes whether Canvas values appear on the Blackboard route.

The adjacent form-state case also uses a hard navigation from Canvas to Blackboard. It can show that a new document starts empty, but it cannot expose stale React form state during a client-side route change.

Evidence: the observer lifecycle and navigation calls are explicit in the source. No running-browser result is claimed.

Correction: use actual client-side navigation for the transitions under test. Preserve the same document and assert that its observation sentinel remains present. Check forbidden values during the transition, including late data responses, as well as after it finishes. Preserve library/provider mismatch assertions separately. Do not replace the observer check with a final-page-only assertion.

## Narrow contract and baseline follow-ups

These are specific open QA preparation items, not extra implementation requirements:

- Canvas C-1: app contract §4.6 says the extension domain is the host of `PUBLIC_LTI_URL`; the prepared exact-JSON oracle accepts both URL host (with port) and hostname (without port). Architect must state one exact intended value, then QA must assert it. A test accepting both cannot prove an exact body. This review does not select a new product behavior from the ambiguity.
- Canvas C-2: the pending add-deployment route's `409 CONNECTION_NOT_READY` matches its stated endpoint precondition. It is not a new defect.
- Canvas C-3: reuse of an already redeemed initial code on add-deployment currently accepts `redeemed` or `purpose` in the audit reason. Phase 1 checks redeemed before purpose. Assert the required `redeemed` reason, while retaining the public `403 GRANT_INVALID` response. Architect clarification is queued by the Lead.
- Canvas C-4: a signing-key-rotation host action is not required by a SIM criterion. The existing inline-key snapshot check does not prove live rotation; L-C14 stays UNVERIFIED.
- M2 H-3: the unchanged Moodle disconnect baseline is `This stops launches through this connection. The tool stays in Moodle.` Use exact equality for the accepted text, not only presence of Moodle.
- M2 H-6: T7 still names old publish/connection/publication labels. Apply only the Lead-approved M2 label changes before AC-M3-02. Preserve the underlying Moodle workflow assertions.

## Infrastructure and oracle assessment

The provider-independent simulator core owns signing, JWT checks, token/score state and the public test-control boundary. Canvas and Blackboard modules supply their distinct issuer, endpoints, audience and Deep Linking behavior. Private RSA keys are generated in memory; reviewed outputs expose public keys only. Test oracles use independent expected values and public product interfaces rather than importing the implementation. These are simulation fidelity checks, not vendor interoperability evidence.

The transport gate sits between app and LTI service, can record caller disappearance and apply held upstream work after timeout, and leaves product timeouts unchanged. Its reviewed logs avoid headers and bodies. Race recipes record IDs/phases and separate remote activation from app approval. Tight live schedules fail as BLOCKED if they do not fit; they must not extend a product timeout.

The M1 host runner requires exact product/test SHAs and clean frozen test inputs. Its coverage checks reject missing providers, empty selection, duplicate results, skips, mixed SHAs, wrong evidence labels, expected browser failures and retries. The full path runs SIM and migration twice at the same SHAs, then legacy suites. M2 uses a separate manifest and isolated host entry. Preparation-only branches run before Docker or clone operations. The migration helper checks the old snapshot, paired files/sidecars, rejected damaged restore and old-stack behavior; the product shell defect B-M1-02 must be fixed before relying on this path.

Isolation code limits host actions to the designated project and records existing resources; no actual baseline-volume preservation is proven without a run. Browser screenshots mask approval inputs. Private raw artifacts and secret scanning are separate from shared evidence. No evidence from these code checks is relabeled CANVAS-LIVE, CANVAS-LOCAL or BLACKBOARD-LIVE.

## Criterion coverage

| Criterion | Reviewed preparation | Verdict limit |
| --- | --- | --- |
| AC-M3-01 | All 40 M1 criteria are in committed manifests; all 37/38 named variants are enumerated in this review's M1 report. Same-SHA accounting and no-empty/no-skip checks have self-tests. | NOT RUN acceptance. B-M1-01/02/03 remain open. No QA PASS report is supplied by preparation. |
| AC-M3-02 | M1 host runner separates final legacy regression; T7 label alignment is declared H-6. | NOT RUN. Align approved labels, then run both required Moodle regression parts on the final SHA. |
| AC-M3-03 | M2 manifest has 64 browser rows for all 13 criteria and screenshot recipes. | CHANGES_REQUESTED: B-M3-01 and B-M3-02 block meaningful execution/evidence. |
| AC-M3-04 | Simulator keys are memory-only in reviewed code; gate/simulator logs omit secret-bearing traffic fields. | Code reviewed; complete run artifact and generated-file hygiene scan NOT RUN. |
| AC-M3-05 | Live rows have separate labels/environment/authorization rules; step data remains unverified. | All live checks UNVERIFIED in this review. No tenant authorization or execution assumed. |
| AC-M3-06 | Host runners use isolated clones/projects and scoped actions; resource inventories are part of the recipe. | No stacks run. Existing volumes, baseline containers and concurrent-lane limits are not empirically verified here. |
| AC-M3-07 | Captured-secret leak scans, private raw evidence and masked browser artifacts are prepared. | Full run scan NOT RUN. Maintain separate private and shared artifacts when executing. |

## Independent checks

At exact `9964e6f` in the external clone:

- `node tests/host/run-m1.mjs --harness-only --provider all`: 21 self-tests passed, zero skipped; tests TypeScript passed; 359 API cases plus 19 host rows accounted; all simulator modules loaded.
- `node tests/e2e/host/run-m2.mjs --harness-only`: two self-tests passed, zero skipped; tests TypeScript passed; 64 browser cases accounted; T7 discovery excludes M2 files.

These commands passed and made no stack or live-provider calls. They verify manifests, types and discovery. They do not execute the failing wizard selectors or preserve a browser document through a route transition, so their success does not close either MAJOR.

## Next review gate

Review exact committed repairs to B-M3-01/02 and the narrow oracle/baseline items above, together with the product fixes. Then QA must produce actual per-case results and artifacts for the final frozen SHAs. This delivered round-1 report frees repair work; it does not pass the implementation, acceptance, migration, regression or live-provider gates.


## Round 2 — CHECKPOINT: committed QA and Learn instruction repairs

Date: 2026-10-20. This is a bounded supplement, not the final feature or QA gate. Exact reviewed checkout/harness: `0008bdef092b866a361d57ab705b581cd16312a5`; product: `9f96f7b24cd0aed702e4dc40373bdda4307aad31`. Product files at these two commits are identical. The harness comparison is against `9964e6f132e6608216616bff621e3f9ba5667b04`. Clarification: `ca14de6360021af4ce3692f1a0073fe4ec92633d`; accepted architecture: ADR-011 revision 6 at `56591df0e71939d5d62c9042c630c841d01f84e8`.

All source reads and checks used the clean detached clone `/tmp/cogniate-reviewer-b-76b03c7-ivj64s6o`. No uncommitted author regression or Architect proposal was read. No stack or product acceptance was run. Earlier report sections are preserved.

### B-M3-01 — CLOSED for the original wizard and badge defects

`pendingWizard()` waits for `/integrations/<lms>/<connection id>`, the setup heading and the approval input. Both shared helpers and every changed direct, keyboard and axe path use that state after one Next. No second-Next transition remains in those paths. The screenshots and semantic approval/error assertions are retained. One axe scan of the combined setup/approval page still covers both sections.

The badge case now visits each connection detail, where the product's `ConnectionOverview` actually renders the badge and selector. It checks the open connection's exact name and LMS badge, then all expected `<name> (<LMS>, <host>)` options. It no longer looks for individual connection rows on the provider-card page.

The adjacent alignment changes also match the product: configuration row Copy buttons are named `Copy <label>`, and a download-error case rejects `URL.createObjectURL` because the file is made from an already loaded export. It retains an error alert, zero-download and no-success assertions. This is source-level closure; a product browser run is still required.

### B-M3-02 — CLOSED for the reload-masked observation defect

The route observer now attaches to `document.documentElement`. A unique sentinel must remain equal after navigation; the stale-value array must remain present and empty. The detail test navigates through the overview's connection selector. The form test navigates through the real Integrations and Blackboard links. Neither invokes the hard-navigation helper after installing the observer. The form case also polls input values and checks them explicitly at the end.

The detail test intercepts a Canvas detail request, starts Refresh status, changes the selected connection, and keeps the observer installed while the delayed request and subsequent polling window are handled. It checks that a Canvas request was intercepted, then checks observed and final forbidden values. This repairs the original loss of the entire observation document. The code delays a request before continuation; it does not independently prove that a response was delivered after the transition. Correct product abort handling can cancel that request. Actual execution evidence must distinguish delayed/cancelled requests from delivered late answers and must not label a cancellation as a delivered-response result.

### B-M3-03 — MINOR — C-2/C-3 no-attempt subclaim is not directly observed

Locations: `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:209` through 213 and `:236` through 240.

The revised rejection cases compare the connection DTO and then redeem a proper grant. This proves the visible connection was unchanged and no live lease prevents the follow-up. It does not prove that no historical binding-attempt row was created: an implementation could store a failed attempt, clear its lease and still satisfy every one of these assertions. The DTO does not expose binding-attempt history. The pending-case comment explicitly infers both no attempt and no lease from the follow-up success.

Impact: the exact C-2/C-3 no-attempt subclaim in the clarified AC-M1-20 can be reported as proved without an observation of that state. This is a narrow evidence gap, not a demonstrated product state corruption, and does not reopen the corrected wizard or route-navigation findings.

Correction: before the positive follow-up, compare an approved observation of binding-attempt creation across the refused request. A before/after connection-scoped audit count can be used if the existing `grant_attempt_started` event is accepted as the stable oracle; otherwise use an approved read-only inspection. Preserve the current public status, grant-state, exact-reason and all-method no-call checks. Until that observation exists, leave the no-attempt subclaim unverified rather than treating subsequent redemption as proof of it. The coordinator received this finding in `msg_9f5267d2025b`.

### Other required checks

- C-1: the exact independent host/port oracle replaces the two-form acceptance. It rejects a bare host at non-443 ports.
- C-2: both random and issued initial codes are exercised while pending; status, no rejection audit, issued state and all-method zero-call assertions are present. B-M3-03 qualifies the no-attempt claim.
- C-3: the redeemed initial code is sent for a new unapproved deployment; exactly one `redeemed` rejection and zero remote calls are required. B-M3-03 qualifies the no-attempt claim.
- B-M1-03: GET requests are still included by `noRemoteCall` and race-f gate observation. This open product defect is not hidden by the repair.
- H-3: exact Moodle warning equals the accepted `9e24137` baseline, independently read.
- H-6: only `tests/e2e/lib/portal.ts` changes outside the M2 suite. Its four label changes match the approved M2 list. The selected publish option now matches the exact connection name, Moodle LMS and Moodle site host. Existing Available/Selected in Moodle, grade, result and learner-identity assertions remain; the other T7 case files are unchanged.

### Independent checks

```sh
node tests/host/run-m1.mjs --harness-only --provider all
node tests/e2e/host/run-m2.mjs --harness-only
QA_SUITE=e2e tests/node_modules/.bin/playwright test --config tests/playwright.config.ts --list
```

Results: M1 has 21 passing self-tests, tests TypeScript and 359 API plus 19 host rows; M2 has two passing self-tests, tests TypeScript and all 64 browser cases. Both self-test runs report zero skips. The explicit T7 listing is 18 tests in six files and contains no M2 file. The 30 focused portal units named in the M2 checkpoint also pass.

Independent JSON comparison confirms every common/Blackboard/Canvas and M2 manifest ID, order, criterion, kind and evidence label is unchanged from `9964e6f`; only the documented titles change. No case was removed to close a finding.

### Remaining gate

The original B-M3-01/02 MAJOR source defects are closed in this bounded supplement. B-M3-03 is open MINOR, and B-M1-03 is still an open product MAJOR. No new BLOCKER or MAJOR was found in this supplement. These preparation results do not approve the full M3 acceptance gate: final grant-order repair, final reviewed SHAs and actual SIM/browser, migration/rollback and Moodle regression results remain. Local Canvas, hosted Canvas and Learn live evidence stays UNVERIFIED.

## Round 3 — final combined prepared-harness review

Verdict: **APPROVE** for source/preparation review, with no open finding. Date: 2026-10-20. This is not QA PASS for M3 or a claim that any prepared acceptance schedule ran.

Candidate: `eb43247d02df622d5da72dafac41d919f65a91fe`. Applied contract: `ccdd9ef67cdd2be4c6af374136777fda4e081943`. Common/Blackboard/011 harness repair: `3fef85f51ea798ac6bf3245dba632131f4e38dda`; Canvas snapshot supplement: the candidate. Source reads and preparation checks used the clean detached clone `/tmp/cogniate-reviewer-b-76b03c7-ivj64s6o`. No other reviewer's new report or conclusions were read.

### Prior findings

B-M3-01 and B-M3-02 remain **CLOSED** for the wizard/badge and hard-navigation defects. The current code preserves the repaired paths and observation sentinel. The Round 2 qualification about a delayed request versus a delivered late response still applies.

B-M3-03 is **CLOSED** for the bounded no-attempt evidence gap. C-2 and C-3 now take a healthy-process cursor, observe the refused request's own same-trace `http_request` completion, and require zero connection-scoped start events within that window. Their valid follow-up redemptions require exactly one event. A final total check also rejects a delayed extra refusal event. Exact statuses, the `redeemed` reason, issued-grant checks and zero outbound assertions remain.

The common oracle rejects a missing boot/completion control, log truncation, process changes and a start event after completion. It counts every received gate request without filtering GET. Its self-tests inject hidden attempts and invalid ordering. An absent audit event remains a bounded healthy-process observation, not a database or rollback oracle; the product's transaction-failure unit test supplies separate rollback evidence.

B-M1-03, the last product MAJOR from these reports, is closed at the reviewed candidate. The independent local API proof and complete product disposition are in the M1 report.

### Preliminary B-M3-04 — WITHDRAWN after the applied-contract check

At `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts:68`–`:70`, Canvas v4/v6 reach held S3 and restart without first confirming capture of the first attempt's audit line. Proposal D R3.7 rule 5 contains that extra pre-kill confirmation sentence. However, the normative applied M1 evidence rule 4 at `ccdd9ef` requires the restarted process's own new cursor and completion control, with no comparison across a kill; it does not repeat the pre-kill sentence.

The current cases satisfy that applied rule. Held S3 and the subsequent 409 exercise the lease. The new healthy-process cursor, same-trace completion and separate positive V control bound the refusal's no-event claim. They do not claim that the killed process's buffered event survived. The earlier proposal wording alone does not establish a defect against this review's applied-contract target, so the preliminary MINOR is withdrawn and needs no deferral. The preliminary message was `msg_9fac9a00748f`; the correction is `msg_59b0f18c82eb`.

### Integrated harness assessment

The full M1 entry now runs four phases twice at the same frozen product/test SHAs: ordinary SIM, isolated profile/shared-platform drift, populated 011-to-012, and Moodle migration/rollback. It then runs the legacy regression entry points. Exact per-case inventory checks still reject missing/duplicate cases, wrong labels, mixed SHAs, skips and non-PASS results. A missed timing schedule remains `BLOCKED` and fails the gate.

The populated route freezes its old product at `9f96f7b24cd0aed702e4dc40373bdda4307aad31`, checks that 011 exists and 012 does not, seeds through public APIs/CLI, stops both data services, and verifies a paired private backup before starting the candidate. It checks the new migration ledger and keeps the h1 source SHA explicit. h2–h5 retain old-grant refusal, registered repeats, both seeded and new added-deployment grants, and suspend/release recovery through saved orphan targets. Unrelated approvals, launches and stored keys are checked throughout. The separate released-version Moodle route retains actual grade, backup corruption, restore-byte and lost-write checks. No SQL mutation or ledger editing is used to simulate these acceptance migrations.

All new local-refusal recipes prepare provider/CLI reads before the gate cursor. Blackboard positives prove V is observable under the same faults. Canvas initial positives require POST first and no provider GET. Post-V cancellation tests distinguish the inactive or absent remote record from app authority, and late/time-limited schedules retain the existing five-second and 60-second budgets. Audit observations do not claim durability across a killed process.

Host controls remain limited to the scoped QA project and named operator/profile/restart actions. Raw credential-bearing state and private backups stay outside shared evidence; copied textual evidence is redacted and scanned. The source supplies those checks, but resource preservation and zero-leak results still need an actual run. SIM remains separate from MOODLE-LIVE, CANVAS-LOCAL, CANVAS-HOSTED and BLACKBOARD-LIVE.

### Independent preparation evidence

```sh
node tests/host/run-m1.mjs --harness-only --provider all
node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs
node tests/e2e/host/run-m2.mjs --harness-only
```

Results: M1 has **27 passing self-tests**, tests TypeScript and **392 API + 24 host/browser rows**. The separately executed Canvas oracle has **three passing self-tests** covering forbidden provider GETs, S1-only readiness and missed lease windows. M2 has **two passing self-tests**, tests TypeScript and **64 discovered browser rows**, with T7 kept separate. No self-test reported a skip.

Independent manifest comparison against `0008bdef092b866a361d57ab705b581cd16312a5`:

| Owner | Prior rows retained | Current rows | Added |
| --- | ---: | ---: | ---: |
| Common | 36 | 42 | 6 |
| Blackboard | 120 | 141 | 21 |
| Canvas | 222 | 233 | 11 |
| M2 | 64 | 64 | 0 |

Every prior M1 case ID retains its criterion, kind and evidence label. The M2 manifest is identical. Existing race variants were not removed to obtain the larger inventory. The 209 focused product tests, app/portal typechecks and 12 independent local API probes documented in the M1 report also passed; they are not acceptance results.

### Remaining gate

No Reviewer-B finding remains open in the reviewed implementation or prepared harness. The separate startup-smoke handoff was not reviewed as a completed result. QA must still execute the frozen full runs, M2 browser checks, migration/rollback, legacy and default-profile T7/Moodle regression, resource checks and final evidence scans. Every live-provider row remains UNVERIFIED until its own authorized evidence exists. This review therefore approves preparation, not the M3 QA verdict or task completion.


## Round 4 — gate capture, CLI, browser evidence and readiness repairs

Verdict: **APPROVE** for the bounded source/preparation review. Date: 2026-10-20. The earlier approvals are historical and do not prove the later-discovered capture and browser defects were absent.

### Scope

Comparison starts at `eb43247d02df622d5da72dafac41d919f65a91fe`. Reviewed repairs include `41ee174ddcd4cd5c925b09d7c57ef9f8ceaa03b9`, `feb36b112edd4173094e0ba3d38ccfc0a549fb35`, `ae130a3501f3a2502c6a34e36319629e3dcdfb09`, `832f8c8ac437c7fd93425d7152f865a8ffb13eaa`, `7ddff36ccc58ebc9218c7e1bca646f28067c891b` and final product/build `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`.

The authorized later source supplement is `004568bd4ab8390d64945cb73f16cfdd51d566bf`, containing the changes from 504421b and 004568b in exactly seven reviewed paths: legacy `tests/acceptance/lib/t5.ts`, `tests/acceptance/M1/canvas/browser-diagnostics.mjs`, and M2's detail, publish/results, keyboard/axe, scenario and browser-secrets-selftest files. Product/build source is identical to e3cd7db. Applied contracts remain `ccdd9ef67cdd2be4c6af374136777fda4e081943`.

I used a clean detached external clone and private probes. Earlier submitted A reports at the frozen e3cd snapshot were allowed inputs. No concurrent new Reviewer-A report, later QA report prose or uncommitted source was read. No stack/browser/live-tenant run was made. The only integration edits are these three reports; earlier text remains intact.

### Gate and caller dispositions

**A-M3-01 is CLOSED** for the narrow-gate false negative. `common/gate-capture.mjs` installs specific faults first, then catch-all rules for all seven methods at `^/`, before reading the event cursor. Reset paths re-arm before a measured window. Common, Blackboard, Canvas race/snapshot and populated migration callers use this setup. This captures provider reads and unexpected paths as well as expected platform mutations, without allowing the generic rule to consume the intended hold/failure first.

**A-M3-02 is CLOSED** for the older Blackboard callers. `blackboard/30-grants.test.ts:16` now resets and captures all methods rather than only four under `/api`. In `blackboard/50-races.test.ts`, the catch-alls remain behind the one-shot S3 hold, so a replacement request cannot become invisible after that hold rule is consumed. The held request, exact refusal status, unchanged state and later valid retry assertions remain.

The self-tests exercise the actual gate module with controlled Node edges, not a separate copy of its matching logic. They reproduce the old narrow-rule blind spot, verify priority and reset/re-arm, then transpile the actual older Blackboard no-mutation helper and race-f caller. Injecting each of the seven methods or the tested out-of-prefix request makes the relevant negative assertion fail; the no-injection positive controls pass. The race control injects while the real hold rule is active. These passed in my run. They establish observer sensitivity and caller wiring; they are not product acceptance.

Exact-trace completion/start-event checks, healthy-process controls and separate positive V controls remain. The sampled negative window ends before the positive control starts. No absent event is promoted into a database-state or crash-durability proof. B-M3-03 stays closed for its bounded no-attempt oracle. Preliminary B-M3-04 remains withdrawn under the applied contract; this round does not revive the superseded proposal sentence.

### CLI and full-run preparation

`tests/host/m1-control.mjs:20` supplies `docker compose exec -T --workdir /repo <service> npm run <script> -w services/<service> -- ...`. This uses the root workspace from the actual container working-directory/mount layout. The command remains restricted to approved scripts/actions. Its self-test observes real constructed argv, argument forwarding, output and status, and rejects invalid actions before a subprocess. It does not claim an actual operator command was run in a container.

Independent comparison confirms that all four manifests and both host runners are unchanged from the previous reviewed candidate. M1 still accounts for **416 rows: 392 API plus 24 host/browser**. The full entry executes ordinary SIM, isolated drift, populated 011-to-012 and Moodle migration/rollback **twice**, compares per-case results at the frozen SHAs, then runs legacy suites. The populated old-product boundary, backup/restore recipe, fail-on-missed-window rule, no-skip accounting and separate T7 selection remain. No case was removed to improve the result.

### Browser evidence and supplemental readiness

The request listener is attached before navigation and records query/form `ltik`, `id_token`, `state` and `nonce`, plus runtime, play and picker path capabilities, through the existing private recorder. Path values are also recorded decoded where needed. The supplemental form mapping records each Deep Linking response `JWT` as `id_token`, including multiple values. The listener is removed at cleanup; private values are not printed by this helper.

`diagnosticUrl` removes query, fragment and URL credentials and replaces runtime/play/picker capabilities while preserving useful route shape. Both M1/M2 frame-wait failure branches use it. The supplemental legacy `t5.ts` edit changes only failure formatting; raw frame matching, the 200 ms poll and the original deadline remain. This closes the inspected legacy diagnostic exposure without weakening the match predicate.

Independent probes compile the actual legacy function before and after repair. The former timeout message contains all **14** synthetic secret values; the new message contains **zero**. A raw-URL match still returns the original frame even at an already expired deadline, matching the old ordering. A controlled 300 ms deadline takes two 200 ms polls before refusing, and a frame arriving after one poll is returned. A separate real event-listener probe captures two form JWT values plus an existing ID token, state and nonce, then confirms listener removal. Probe and safe result files are in the private scratch directory listed in M1 as `supplement-probes.mjs` and `supplement-probes.results.json`.

The six final M2 self-tests include request-before-frame-failure capture, Deep Linking JWT capture with a missing-capture negative control, safe route formatting, real M1/M2 timeout branches and inventory rules. A synthetic string-hit control proves sensitivity to the recorded value, not the outcome of a full artifact scan. Runtime/play/picker completeness and zero leaks still require successful real paths and the final scan of their actual artifacts.

The supplemental readiness edits wait for expected connection options before a one-shot label/snapshot read and for the first labeled field before keyboard traversal. Existing exact positive/negative assertions remain. The pending/disabled exclusions still run against the loaded option list. Keyboard readiness performs no focus/click/fill and preserves the visible-focus failure check. There is no new fixed sleep, test retry, skip, timeout extension or removed case. The complete 64-case manifest is unchanged. The configuration-row repair also retains all Copy assertions and measures row order before Copy can change layout. The M2 report records the product-router/player checks separately.

### Independent checks and external results

At e3cd7db:

```sh
node tests/host/run-m1.mjs --harness-only --provider all
node --test tests/acceptance/M1/canvas/snapshot-oracle.selftest.mjs
node tests/e2e/host/run-m2.mjs --harness-only
```

Results: **33 M1 self-tests**, **three Canvas oracle self-tests**, **five M2 self-tests**, tests TypeScript, 416 M1 rows and 64 M2 rows; zero skips. The final 004568b supplement reran the M2 harness-only entry: **six self-tests**, tests TypeScript and the same 64-case accounting passed, with T7 separate. M1 host/gate source is unchanged by the supplement. The 247 product tests, four workspace typechecks, 18 local API/transport probes and actual CLI player build in M1/M2 are also independent evidence from this review. No additional full-root run is claimed.

The coordinator's external e3cd browser result was **60 PASS / 4 FAIL**, zero skips/retries. M2-13 passed. One Canvas M2-08 option read, both M2-12 option reads and the Blackboard keyboard start failed before readiness. Both learner paths stopped before launch, so this run does not verify runtime execution or complete runtime/play collection. The supplement fixes the identified source causes; the new all-64 run was still in progress at this review cutoff. The reported 19 synthetic Chrome readiness controls are QA evidence, not a run by this reviewer. Reported baseline-volume preservation and zero containers likewise belong to that executor run and cannot stand in for the final full acceptance runs.

### Final disposition and remaining gate

No new Reviewer-B source finding remains open in this bounded review. A-M1-02 is still an accepted open NIT; the M1 report records it. The repaired observer, CLI, build and browser-preparation source is approved. This is **not M3 QA PASS**. Full M1 four-phase runs twice, required migrations/rollback, legacy/default-profile T7/Moodle regression, the final complete M2 browser run, resource checks and complete artifact scans remain independent gates. Every Canvas-local, Canvas-hosted and Blackboard-live row remains UNVERIFIED until its own authorized evidence exists.


## Round 5 — T7 `publishCourse` readiness repair

Verdict: **APPROVE** for this bounded one-file source review. Date: 2026-10-20.

Reviewer: fresh dedicated Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, no delegation. This reviewer is independent of both Authors, both QA workers and Reviewer-A. Rounds 1–4 above stay unchanged with their Codex GPT-6-Astra attribution. The owner instruction in `c5c3cf3` assigns remaining Reviewer-B work to Claude.

### Scope and method

- Frozen source and repair commit: `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. The Lead confirmed both in the reply to this task and in handoff `msg_97bd6afbe05e`.
- Base: `004568bd4ab8390d64945cb73f16cfdd51d566bf`. Outside `docs/**`, the only changed path is `tests/e2e/lib/portal.ts`. The change is three added lines in `publishCourse` (lines 116–118).
- `portal.ts` SHA-256: base `6fba5d83e7be676b6b86fd3dbce81afd13b6235a3f0b9676f521343c6faf9e1d`, repair `b9e75a8d97fb49ac965749e06944500f64df6e7d8ea10d4d694c23180cd07a3b`.
- Product and build: no path outside `docs/**` and `tests/**` differs from `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`.
- I read these unchanged files to establish the effect. Callers: A3 (`1-scenario-a.spec.ts:188`, call at `:199`) and B3 (`2-scenario-b.spec.ts:142`, call at `:152`). Also the `need()` dependents, the names `Dev Moodle` and `Dev Moodle B` (`lib/e2e.ts:20`–`:21`), `tests/playwright.config.ts`, `run-t7.mjs`, the Playwright 1.56.0 lockfile pin and the product `apps/portal/src/courses/PublishDialog.tsx`.
- Clean detached clone: `/tmp/cogniate-reviewer-b-claude-aff4882-DtkFjV/src`. The clone's only addition is a symlink to the installed `tests/node_modules` of the integration checkout. The tests lockfile is unchanged.
- I ran no Docker, stack, browser or live tenant, and I inspected no real secret. I edited no source, test or architecture file. I did not repeat the 1,039 product tests.
- Inputs: completed history A `601386f` and B `00f1717`. The QA report text in `aff4882` and the QA folder `publish-repair` are executor claims. I did not read a new Reviewer-A supplement.

### Root cause, from source

While `GET /connections` loads, `data` is undefined (`PublishDialog.tsx:22`–`:24`). The check at `:83` is then false, so the dialog renders the form. The `LMS connection` select holds only `Choose a connection` (`:109`). The old helper read the options once, at that moment. This agrees with the QA claim for A3: the SCORM publish passed, and the HTML publish threw `has no connection option`. The source dependency chain explains the nine failures: A4 to AC-T7-06 need A3/A4 state, B5 needs A4, and B6's Thanh results row needs A5. I did not run these T7 runs.

### Repair assessment

- Line 117 builds `^\s*<escaped expected text>\s*$`. The escape class is the standard metacharacter set. There is no flag, so the match is case-sensitive.
- Line 118 waits up to 15 s for exactly that option in state `attached`. The comment says why it uses `attached`: options in a closed select are not visible.
- Playwright 1.56, read from the shipped source:
  - `filter({ hasText: RegExp })` becomes `internal:has-text=/…/`.
  - The injected matcher runs `re.test(elementText.full)`. `full` is the raw text of the option, with no whitespace normalization.
  - `locator.waitFor` sends `strict: true`.
- These parts are unchanged:
  - the expected text `<name> (Moodle, <site host>)`
  - the label read `o.text.trim() === w`
  - the missing-option throw
  - `selectOption({ label })`
  - the Publish click
  - the dialog-detached wait
  - the `Available in Moodle` wait
- There is no `startConnect` edit. There is no added sleep, retry, skip, test timeout or config change.
- The T7 inventory is identical: 18 tests in 6 files, with the same titles and case IDs. `demo-check.spec.ts` is unchanged, so DEMO stays demo-only.
- Effect on a passing run: the wait returns when the option attaches, so the earlier passing SCORM and B3 publishes behave as before. A failure adds at most 15 s. This fits the A3 (300 s) and B3 (240 s) budgets. It equals the suite's standard 15 s action and expect bound and does not increase any existing timeout.
- Strictness: two identical exact options now cause a strict-mode error. The old code silently picked the first. Each T7 run does its own `e2e:reset`, and each library has one such connection. So this is a fail-closed improvement, not a regression.
- Diagnostics (observation, not a finding): a missing or wrong option now fails at the wait, with a Playwright 15 s timeout for that locator. The explicit message at line 120 is now a backstop. It shows only if the option is removed after it attaches, or in the divergence below. People who triage the new runs must expect the timeout form. QA P3–P5 saw a timeout-form message. I did not see the exact call-log text.
- Residual divergence: the wait tests the raw text, but the label read uses `HTMLOptionElement.text`, which collapses ASCII whitespace. So an option with an internal run of spaces would time out at the wait, although the old read would accept it. The product JSX (`PublishDialog.tsx:112`) renders single separators, and both T7 names have single spaces. So T7 cannot reach this case, and it fails closed.

### Independent probe

```sh
node /tmp/cogniate-reviewer-b-claude-aff4882-DtkFjV/probe/publish-wait-probe.mjs \
  /tmp/cogniate-reviewer-b-claude-aff4882-DtkFjV/src/tests/e2e/lib/portal.ts \
  /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/lti-multi-lms/tests/node_modules/playwright-core/lib \
  /tmp/cogniate-reviewer-b-claude-aff4882-DtkFjV/probe/publish-wait-probe.results.json
```

Result: exit 0, `PROBE PASS`. Script SHA-256 `1f70767cfadbf9279b983caac967f5e0a229f81bbc80c6239cfebd1d880bee41`. Results SHA-256 `32576ac084e86d7852244a7b32ca183d326285cd15a85de5ab3f7b6051247d25`.

The probe takes the verbatim line 117 and the verbatim label predicate from `portal.ts`. It sends the RegExp through Playwright 1.56's own client serializer and selector parser, and through `createTextMatcher` taken from the shipped injected source.

| Group | Option text | Wait | Label read |
| --- | --- | --- | --- |
| Valid | exact A and B text as React text nodes; outer whitespace; a name with every RegExp metacharacter, `/`, quotes, backtick and `>>` | match | match |
| Missing or wrong | placeholder only; wrong host; wrong port; `moodleXtest` for `moodle.test`; wrong LMS; A wants B; B wants A; prefix; suffix; wrong case; metacharacter name with one changed character | no match | no match |
| Divergence | internal double space | no match | match |

All 16 cases give the expected result. Four mutants show that the probe is sensitive:

- Unescaped text: rejects the real option, so a valid run would always time out.
- Escaped text except `.`: accepts `moodleXtest:8543`.
- No anchors: accepts the prefix and suffix decoys.
- Playwright string `hasText`: accepts the case, prefix and suffix decoys.

The actual line rejects all of these decoys. Limit: the probe uses no browser and does not test wait timing. QA P1 and P2 cover timing.

### QA control evidence (executor claims, assessed)

- `held.patch` SHA-256 is `b340e4fe3c2e1bd580449f96bdce51a7d00ffcb7dcf099073a5fbab9affc480c`. Its `portal.ts` added and removed lines are identical to the commit.
- `publish-sources.json` records the base hash (equal at `004568b` and `601386f`) and the repair hash.
- I extracted both functions again from both commits. `publish.spec.ts` contains each one verbatim.
- `pc-results.json`: 6 expected, 0 unexpected, 0 flaky, 0 skipped, retries 0, Playwright 1.56.0. Durations: P1 0.16 s, P2 0.97 s, P3–P5 15.1–15.2 s, P6 31.0 s. These agree with the 15 s option wait, then the detached and `Available in Moodle` waits.
- What the controls prove:
  - P1 and P2 run the old and new helper on the same list that loads after 400 ms. The old helper fails with the A3 message, and the new helper publishes.
  - P6 shows that `Available in Moodle` still fails closed.
  - In P3–P5 the page publishes for any selected value. So if the helper accepted a wrong option, the control would fail.
- Gaps in the controls (not findings; the probe above covers them):
  - The P5 decoys do not contain the expected text, so P5 does not test the anchors.
  - P4 does not test the escaped `.`.
  - `/Timeout|waiting for/` does not tie the failure to the option wait.
  - The synthetic option has one text node and React makes several. Playwright joins them, so the result is the same.
- The synthetic controls do not show that `/connections` loads within 15 s on the real stack. Only the fresh runs can show this.

### Other independent checks

```sh
node tests/e2e/host/run-m2.mjs --harness-only
cd tests && QA_SUITE=e2e node_modules/.bin/playwright test --config playwright.config.ts --list
git diff --name-only 004568bd4ab8390d64945cb73f16cfdd51d566bf aff48823a4c6206d6314d91a95f5eb0979d3e0e7 -- . ':(exclude)docs'
git diff --stat e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63 aff48823a4c6206d6314d91a95f5eb0979d3e0e7 -- . ':(exclude)docs' ':(exclude)tests'
```

Results:

- M2 harness-only: six self-tests pass with zero skips, tests TypeScript passes, all 64 M2 cases are accounted for, and the T7 selection excludes M2.
- T7 list: 18 tests in 6 files, identical to QA `t7-list.log`.
- The first diff lists only `tests/e2e/lib/portal.ts`. The second diff is empty.

### Findings

**B-M3-05 — NIT — duplicate RegExp escape.**

- Location: `tests/e2e/lib/portal.ts:117`.
- Problem: the line has its own copy of the escape class. `escapeRegExp`, with the same class, is already at `tests/e2e/lib/e2e.ts:29`, and `portal.ts` already imports `urls` from that module.
- Evidence: the behavior is the same; the probe passes with the inline form.
- Suggested fix: the next time this file changes for another reason, import `escapeRegExp` and use it on line 117.
- This NIT does not need a new freeze or a deferral entry.

Prior Reviewer-B findings are unchanged: B-M3-01, B-M3-02 and B-M3-03 are CLOSED, and B-M3-04 is WITHDRAWN. A-M1-02 stays an accepted open NIT, as recorded in the M1 report.

### Evidence note for `004568b`

At `004568b`, C1 passed with B6's learner form, not A5's. `learnerRun` stores the first captured form (`lib/flows.ts:42`–`:46`), and A5 did not run. The `need()` label at `3-scenario-c.spec.ts:20` still names A5. C1's assertions do not depend on the source of the form. At the new SHA, A5 runs first and gives the form. This is outside the repair and is context only.

### Remaining gate

This is source approval only. It is not a T7 PASS, an M3 QA PASS or runtime evidence. Before any T7 or M3 verdict, these must pass at `aff4882`:

- a fresh full 64-case M2 run;
- three consecutive default T7 runs, each with 17 PASS, 0 FAIL and only the demo-only DEMO skip;
- the demo pass and the confirmation checks;
- default health, the privacy scan and cleanup.

Common QA still owns both full M1 runs, migration/rollback and the legacy suites. All 32 live LMS rows stay UNVERIFIED. The Lead will forward fresh executor evidence separately. This review does not assess that evidence.
