Verdict: CHANGES_REQUESTED
Round: 1

Reviewer: dedicated Reviewer-B, Codex GPT-6-Astra xhigh. Date: 2026-10-20.

Reviewed commit: `9964e6f132e6608216616bff621e3f9ba5667b04`.
Product code: `76b03c7f24c15de2f7e164b836b27a398d45158a` (unchanged by the harness supplement).
Accepted M0 behavior: `56591df0e71939d5d62c9042c630c841d01f84e8`.
Implementation comparison baseline: `294114092b643766b5f552150038b812513da1d0`.

This is an independent implementation and prepared-harness review. It is not a QA acceptance result or live-provider approval. Code was read from a detached external clone at the exact reviewed commit. No stack, tenant, sign-up, database migration on persistent data, or live provider check was run. Only these review reports change the integration checkout. The Lead requested round-1 delivery now; fixes need a separate review at their exact commits.

Related reports: [M2](../M2/reviewer-b.md) and [M3](../M3/reviewer-b.md).

## Result

Three open MAJOR findings prevent approval. The common redemption, ref-history and cleanup engine is a useful boundary: Canvas and Blackboard adapters supply target and request differences without duplicating the state machine. The remaining defects are in when that engine contacts the LTI service, when the score worker checks containment, and how the maintenance entry point proves services are stopped.

## Findings

### B-M1-01 — MAJOR — Score worker can start a POST after disable

Locations: `services/cogniate-app/src/worker/score-sync.ts:44`, `:61`, `:63`, `:92`; `services/cogniate-app/src/domain/score-syncs.ts` (`dueSyncs`, `beginSend`).

`dueSyncs` takes a snapshot of `connectionDisabled` for a batch. `sendOne` trusts that snapshot, including after an awaited line-item lookup. `beginSend` does not check the current connection status. A suspend or disconnect that commits after the snapshot can therefore be followed by a new score POST. Remote cleanup can be slow or fail, so the worker cannot rely on the remote binding being inactive.

Evidence: the local probe imports the actual score worker and repositories and uses an in-memory database. In case `next-batch-row`, the first POST disables the connection; the second row still starts a POST with connection status `disabled`. In case `after-line-item-lookup`, the lookup disables the connection before returning; that row still starts a POST. Both rows become `sent` with `tries: 1` in the controlled transport. This is a worker interleaving reproduction, not a running-stack grade test.

Impact: app contract disabled-connection containment and AC-M1-18 / AC-M1-38(a) require no new POST, `failed` with `CONNECTION_DISABLED`, and unchanged tries. The existing pre-disabled unit case and acceptance schedule with a future due time do not cover these interleavings.

Correction: use current connection state at the decision to send, including after awaited lookup. Make the begin-send decision enforce disable state with the score-row transition. Add meaningful regressions for both interleavings; verify no POST, unchanged tries, and the required error. Preserve the distinction between a request already in flight and a new request started after disable.

### B-M1-02 — MAJOR — Maintenance guard treats unknown service state as stopped

Location: `infra/scripts/stack-data.sh:12` (guard through line 19).

The shell initializes `running` to empty. Failed or unavailable Docker inspection leaves it empty. A failed compose `ps` is also swallowed by `|| true`. Both paths reach the Node backup/restore program, although neither proves that the app and LTI service are stopped.

Evidence: the shell-entry probe supplies inert Docker and Node executables through a temporary PATH. Case `docker-info` makes `docker info` fail. Case `compose-ps` makes Docker inspection succeed and compose inspection fail. In both cases the fake Node program prints `PROBE_REACHED_RESTORE_PROGRAM`. No real Docker command or database write is used. Unit tests of the Node helper do not exercise this shell guard.

Impact: AC-M1-23 / AC-M1-30 and ADR-011 maintenance rules require both services stopped before copying or restoring their paired SQLite state. With a broken Docker context, permissions or compose observation, restore can replace files still used by a running service; backup can capture an inconsistent pair.

Correction: refuse missing or failed state inspection before opening backup or target files. Separate a successful empty result from an inspection failure. Exercise the actual shell entry point with both failure modes and with known stopped/running service results.

### B-M1-03 — MAJOR — Remote provider resolution runs before local grant refusal

Locations: `services/cogniate-app/src/app/connections.ts:253`; `services/cogniate-app/src/app/redemption.ts:149`; `services/cogniate-app/src/app/binding-targets.ts:33`.

The platform route calls `sharedClientIdOf` for Canvas as well as Blackboard before parsing and redemption. The engine then calls its target resolver, which fetches providers again, before phase 1. Contract §4.7.1 requires the ordered phase-1 transaction before any LTI service call. AC-M1-37(f) explicitly requires no new gate request for the replacement refused by a live lease.

Evidence: an API probe uses the actual Fastify route and engine, with the repository's in-memory LTI test transport. For a well-formed nonexistent Canvas code, it observes `403 GRANT_INVALID` plus two `GET providers` calls. If that transport fails, the same local invalid code instead produces `502 LTI_SERVICE_ERROR` plus one call. A valid grant with a local fixture of an unexpired connection lease produces `409 GRANT_IN_USE` plus two calls. The fixture is confined to the test database; it is not claimed as a complete held-S3 schedule. Static inspection confirms that `tests/acceptance/M1/canvas/51-canvas-races.test.ts:162` observes all API requests and its no-new-request assertion cannot pass this path.

Impact: local invalid-code and contention answers depend on remote availability and latency. The prepared Canvas acceptance oracle directly detects the extra calls. The same common engine is used for both providers; the concrete API probe above used Canvas.

Correction: remove remote provider resolution from local refusal paths and preserve the specified validation precedence and lease acquisition before outbound work. Keep authoritative shared-platform checks, target ownership and idempotent-repeat behavior. Add endpoint-level regressions for invalid-code refusal during a provider outage and live-lease refusal with zero outbound calls. Do not weaken the gate assertion to ignore provider GETs.

## Reproduction artifacts

The coordinator requested runnable diagnostics. They are outside the repository at:

`/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/reviewer-b-m1-probes-q0nwvjt3`

- `score-races.mjs` and `score-races.output.json`: B-M1-01, both interleavings.
- `maintenance-guard.py` and `maintenance-guard.output.jsonl`: B-M1-02, both observation failures.
- `grant-order.mjs` and `grant-order.output.jsonl`: B-M1-03, all three request cases.

Run the Node scripts with `node <script> <review-clone>` and the Python script with `python3 <script> <review-clone>`. The tested clone is `/tmp/cogniate-reviewer-b-76b03c7-ivj64s6o`. These scripts assert the current defect and must be adapted when checking corrected behavior. They are diagnostic fixtures, not acceptance tests or approved product changes.

## Independent checks

Root dependencies were installed in the external clone with `npm ci --ignore-scripts --no-audit --no-fund`. Focused Vitest execution passed 151 tests in 14 files, with zero skips:

- App: `redemption.test.ts`, `canvas-deployments.test.ts`, `canvas-configuration.test.ts`.
- App provider and player: `providers/canvas.test.ts`, `tool-pages/canvas-embedded.test.ts`.
- LTI: `http/routes/multi-lms.test.ts`, `profiles/registry.test.ts`, `profiles/canvas.test.ts`, `cli/stack-data.test.ts`.
- Shared: `origins.test.ts`, `roles.test.ts`.
- Portal: `multi-lms.test.ts`, `connect/canvas/canvas.test.ts`, `connect/blackboard/blackboard.test.ts`.

Command (run from the external clone):

```sh
npx --no-install vitest run services/cogniate-app/src/app/redemption.test.ts services/cogniate-app/src/app/canvas-deployments.test.ts services/cogniate-app/src/app/canvas-configuration.test.ts services/cogniate-app/src/providers/canvas.test.ts services/cogniate-app/src/tool-pages/canvas-embedded.test.ts services/lti-service/src/http/routes/multi-lms.test.ts services/lti-service/src/profiles/registry.test.ts services/lti-service/src/profiles/canvas.test.ts services/lti-service/src/cli/stack-data.test.ts packages/shared/src/origins.test.ts packages/shared/src/roles.test.ts apps/portal/src/multi-lms.test.ts apps/portal/src/connect/canvas/canvas.test.ts apps/portal/src/connect/blackboard/blackboard.test.ts
```

 These tests passed before the test-only supplement; product code is identical at `9964e6f`. The four B-M1-01/02 probes and the three B-M1-03 request cases reproduce the defects despite these passing unit tests.

At `9964e6f`, `npm --prefix tests ci --ignore-scripts --no-audit --no-fund` and `node tests/host/run-m1.mjs --harness-only --provider all` passed: 21 harness self-tests, tests TypeScript check, and discovery/accounting of 359 API cases plus 19 host rows. The earlier Blackboard/common-only self-check also passed 16 tests. Neither command ran product acceptance, browser journeys, migration or rollback. The Lead's reported full root check is author evidence, not independently rerun here.

## Architecture and operator assessment

The reviewed design has one lease, grant, attempt and ref-history model; conditional activation and cleanup use the same recorded ownership. Operator suspend/release and ordinary disconnect share cleanup. Canvas added deployments use the common engine. Blackboard changes deployments of the shared platform and guards against deleting that shared platform. Approval rows, remote activation and connection state have distinct roles, which the race tests usually assert separately.

The new schema migrations are additive. The Node restore helper validates the whole manifest and file hashes before target changes, retains paired database/sidecar state, and does not edit migration ledgers. The host migration runner separates upgraded writes from the old snapshot and checks rollback behavior. These are sound code-level choices, but B-M1-02 blocks confidence in their public entry point. No actual upgrade, old-key continuity, rollback, or retained Moodle-grade result was established in this review.

The only accepted residual race is ADR-011 D-12: a self-hosted Canvas identifier can be taken again by a new standard registration after release and before rightful redemption. The Canvas containment suite records that race and refuses the wrong signed family. No broader proof or ownership deferral is accepted.

## Criterion coverage

Every row below is a code/harness review entry, not an acceptance PASS. All product acceptance rows are NOT RUN in this review. Counts are the committed common, Blackboard and Canvas manifest inventory at `9964e6f`; they establish selection coverage, not successful behavior. File paths are relative to `tests/`.

| Criterion | Reviewed concern | Prepared rows | Test sources | Review qualification |
| --- | --- | ---: | --- | --- |
| AC-M1-01 | Profile metadata and readiness | 2 | `acceptance/M1/common/00-profiles.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-02 | Default profile excludes simulation | 1 | `host/run-m1.mjs` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-03 | Standard compatibility and reserved issuers | 10 | `acceptance/M1/common/00-profiles.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-04 | Provider-owned endpoints | 10 | `acceptance/M1/blackboard/10-deployments.test.ts`<br>`acceptance/M1/canvas/11-canvas-platforms.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-05 | Canonical origins and site rules | 33 | `acceptance/M1/blackboard/10-deployments.test.ts`<br>`acceptance/M1/canvas/11-canvas-platforms.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-06 | One Blackboard shared platform | 2 | `acceptance/M1/blackboard/10-deployments.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-07 | Deployment diff, activation and generations | 13 | `acceptance/M1/blackboard/10-deployments.test.ts`<br>`acceptance/M1/canvas/11-canvas-platforms.test.ts`<br>`acceptance/M1/common/80-standard-controls.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-08 | Canvas login and Deep Linking | 2 | `acceptance/M1/canvas/21-canvas-protocol.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-09 | Canvas player and grades | 12 | `acceptance/M1/canvas/41-canvas-grades.test.ts`<br>`acceptance/M1/canvas/70-canvas-browser.spec.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-10 | Blackboard Deep Linking | 1 | `acceptance/M1/blackboard/40-routing-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-11 | Blackboard grades and audience | 9 | `acceptance/M1/blackboard/40-routing-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-12 | Service-origin checks | 9 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts`<br>`acceptance/M1/common/80-standard-controls.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-13 | Routing and deployment state | 9 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-14 | Claim minimization | 6 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/blackboard/40-routing-grades.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts`<br>`acceptance/M1/canvas/41-canvas-grades.test.ts`<br>`acceptance/M1/canvas/70-canvas-browser.spec.ts`<br>`acceptance/M1/common/80-standard-controls.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-15 | Connection DTO and capabilities | 10 | `acceptance/M1/canvas/11-canvas-platforms.test.ts`<br>`acceptance/M1/common/00-profiles.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-16 | Staff, learner and preview roles | 10 | `acceptance/M1/canvas/41-canvas-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-17 | Canvas initial approval | 7 | `acceptance/M1/canvas/31-canvas-grants.test.ts` | B-M1-03: remote lookup precedes phase 1. |
| AC-M1-18 | Disconnect and score containment | 5 | `acceptance/M1/blackboard/60-containment.test.ts`<br>`acceptance/M1/canvas/41-canvas-grades.test.ts` | B-M1-01: new POST can start after disable. |
| AC-M1-19 | Configuration exports and public keys | 7 | `acceptance/M1/blackboard/30-grants.test.ts`<br>`acceptance/M1/canvas/31-canvas-grants.test.ts`<br>`acceptance/M1/common/00-profiles.test.ts` | QA C-1 needs exact domain wording before exact-JSON acceptance. |
| AC-M1-20 | Canvas added deployment approval | 7 | `acceptance/M1/canvas/31-canvas-grants.test.ts` | QA C-3 must assert redeemed reason before purpose. |
| AC-M1-21 | Provider capability guards | 5 | `acceptance/M1/blackboard/30-grants.test.ts`<br>`acceptance/M1/canvas/31-canvas-grants.test.ts`<br>`acceptance/M1/common/00-profiles.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-22 | Site checks and LMS texts | 7 | `acceptance/M1/blackboard/40-routing-grades.test.ts`<br>`acceptance/M1/canvas/41-canvas-grades.test.ts`<br>`acceptance/M1/canvas/70-canvas-browser.spec.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-23 | Upgrade and old-key continuity | 4 | `host/m1-migration.mjs` | B-M1-02: unknown service state passes shell guard; MOODLE-LIVE not run. |
| AC-M1-24 | Audit events and secret handling | 3 | `acceptance/M1/canvas/99-canvas-secrets.spec.ts`<br>`acceptance/M1/common/99-logs.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-25 | Idtoken platform metadata | 4 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts`<br>`acceptance/M1/common/80-standard-controls.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-26 | Self-hosted Canvas paths | 5 | `acceptance/M1/canvas/41-canvas-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-27 | Old keys, old links and rebind | 1 | `acceptance/M1/blackboard/40-routing-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-28 | Operator grant issuance and redemption | 2 | `acceptance/M1/blackboard/30-grants.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-29 | Grant rejection order | 42 | `acceptance/M1/blackboard/30-grants.test.ts`<br>`acceptance/M1/canvas/31-canvas-grants.test.ts` | B-M1-03: invalid code can become 502 during outage. |
| AC-M1-30 | Paired rollback and lost post-backup writes | 7 | `host/m1-migration.mjs` | B-M1-02 blocks maintenance entry; MOODLE-LIVE not run. |
| AC-M1-31 | Portal routes and publication LMS fields | 6 | `acceptance/M1/blackboard/30-grants.test.ts`<br>`acceptance/M1/blackboard/40-routing-grades.test.ts`<br>`acceptance/M1/canvas/31-canvas-grants.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-32 | Split page/service origins | 5 | `acceptance/M1/canvas/41-canvas-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-33 | Grade errors and retry classification | 8 | `acceptance/M1/blackboard/40-routing-grades.test.ts`<br>`acceptance/M1/canvas/41-canvas-grades.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-34 | Signature, session and replay negatives | 42 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-35 | Simulation/profile gates | 3 | `acceptance/M1/common/90-simulation-gates.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-36 | Service-key path and origin isolation | 10 | `acceptance/M1/blackboard/20-protocol.test.ts`<br>`acceptance/M1/canvas/21-canvas-protocol.test.ts` | No additional issue found in the reviewed path; acceptance not run. |
| AC-M1-37 | Redemption failures and races | 37 | `acceptance/M1/blackboard/50-races.test.ts`<br>`acceptance/M1/canvas/51-canvas-races.test.ts` | B-M1-03 affects f; all named variants listed below. |
| AC-M1-38 | Operator containment and correction | 13 | `acceptance/M1/blackboard/60-containment.test.ts`<br>`acceptance/M1/canvas/61-canvas-containment.test.ts` | B-M1-01 affects a; all named variants listed below. |
| AC-M1-39 | Signed family and accepted D-12 race | 6 | `acceptance/M1/canvas/21-canvas-protocol.test.ts`<br>`acceptance/M1/canvas/61-canvas-containment.test.ts`<br>`acceptance/M1/common/80-standard-controls.test.ts` | D-12 is the sole accepted residual race. |
| AC-M1-40 | Third page host, CSP and return link | 3 | `acceptance/M1/canvas/21-canvas-protocol.test.ts`<br>`acceptance/M1/canvas/70-canvas-browser.spec.ts` | No additional issue found in the reviewed path; acceptance not run. |

### AC-M1-37 and AC-M1-38 named variants

The prepared test IDs below were matched to the task specification and manifest. `k` and `u` have both required antecedents; `p` has create/activate; `s` has retry/dead/compensation; `f` recovery has the held-delete variant; and late release includes existing/absent cases. Every entry remains NOT RUN as product acceptance. The special review flags do not imply that other entries passed.

| Criterion | Provider and exact case suffix | Review result |
| --- | --- | --- |
| AC-M1-37 | `M1-37.blackboard.a` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.b` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.d` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.e` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.f` | NOT RUN; common product defect B-M1-03 |
| AC-M1-37 | `M1-37.blackboard.g` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.i` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.j` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.k-after-a` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.k-after-b` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.l` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.m` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.n` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.o` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.q` | NOT RUN |
| AC-M1-37 | `M1-37.blackboard.r` | NOT RUN |
| AC-M1-38 | `M1-38.blackboard.a` | NOT RUN; worker defect B-M1-01; add race regressions |
| AC-M1-38 | `M1-38.blackboard.b` | NOT RUN |
| AC-M1-38 | `M1-38.blackboard.c` | NOT RUN |
| AC-M1-38 | `M1-38.blackboard.e` | NOT RUN |
| AC-M1-38 | `M1-38.blackboard.g-absent` | NOT RUN |
| AC-M1-38 | `M1-38.blackboard.g-existing` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.c` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.c2` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.d` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.e` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.f` | NOT RUN; common product defect B-M1-03 |
| AC-M1-37 | `M1-37.canvas.g` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.h` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.i` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.j` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.m` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.n` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.p-activate` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.p-create` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.q` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.r` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.s-compensation` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.s-dead` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.s-retry` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.t` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.u-after-c` | NOT RUN |
| AC-M1-37 | `M1-37.canvas.u-after-c2` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.a` | NOT RUN; worker defect B-M1-01; add race regressions |
| AC-M1-38 | `M1-38.canvas.b` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.d` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.e` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.f` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.f-held-delete` | NOT RUN |
| AC-M1-38 | `M1-38.canvas.g-late-create` | NOT RUN |

## Remaining evidence and correction gate

Close B-M1-01, B-M1-02 and B-M1-03 at exact committed code, with the stated regressions. Resolve the two narrow Canvas oracle questions in the M3 report. Then QA must run the full same-SHA SIM suite, both required migration/rollback passes and Moodle regression. Simulator conformance cannot prove hosted Canvas or Learn interoperability; all live rows remain UNVERIFIED unless their own authorized evidence is supplied.


## Round 2 — CHECKPOINT: first repair slice

Checkpoint date: 2026-10-20. Disposition: **B-M1-01 and B-M1-02 CLOSED for this repair slice; overall CHANGES_REQUESTED remains.** This is not a complete M1, M2 or M3 approval.

The Lead narrowed this dispatch in message `msg_b9d86bd1e03e` to finish the independent B-M1-01/02 recheck now and free capacity for the remaining design and implementation repairs. The same reviewer must review those later exact commits in a fresh dispatch. Round 1 above is preserved.

### Exact scope

- Product repair: `9aeeddc58444dd60c7ac36e24f570f4b3ad75237`, compared with product `76b03c7f24c15de2f7e164b836b27a398d45158a`.
- Detached review clone: `/tmp/cogniate-reviewer-b-76b03c7-ivj64s6o`, checked out at `83ebcb85ed9ed9ad4eadebcd7ca185527f417b1b`. Its product files equal `9aeeddc`; the intervening paths are architecture clarification, review reports and team records. No uncommitted product or QA work was read.
- Accepted architecture baseline: ADR-011 revision 6 at `56591df0e71939d5d62c9042c630c841d01f84e8`.
- Contract clarification read: `ca14de6360021af4ce3692f1a0073fe4ec92633d`, including `docs/architecture/review-response-M1.md`. It specifies the exact Canvas domain host/port, the pending add-deployment preconditions, and `redeemed` before `purpose`. ADR-011 is unchanged. QA alignment to those clarifications remains outside this checkpoint.

Only this M1 report is changed by this checkpoint. No product, tests, architecture, team file, stack, tenant, or commit was changed. The temporary probes below use in-memory data or isolated fixture files and inert Docker stubs.

### B-M1-01 — CLOSED at the reviewed repair

The worker no longer stores disabled state in the due-row snapshot. It checks current state when processing each row. `beginSend` now combines the current score-row and connection-state checks with the send marker and try increment in a `BEGIN IMMEDIATE` transaction. After line-item lookup, the worker calls this decision and then invokes `postScore` without another await between the decision and client invocation. If lookup fails or returns no line item after disable, the no-POST branch still records `CONNECTION_DISABLED`. A POST already started retains its actual result.

The correction covers ordinary and confirmation sends. A future-due disabled row stays pending. A due disabled row fails with `CONNECTION_DISABLED`, unchanged tries and no new POST. The log preserves the correct `send` or `confirmation` phase. Moodle stays outside this new provider-specific containment rule.

Independent evidence:

- Reran the nine committed worker regressions. They pass, including suspension through a second database connection during an earlier row's POST and during this row's line-item lookup; successful, empty and failed lookup outcomes; active-connection controls; future due time; Moodle behavior; and direct begin-send decisions.
- Adapted the original independent reproduction to assert the corrected behavior. All 16 combinations pass: Canvas and Blackboard × ordinary and confirmation phase × earlier-row suspension, suspension during lookup, already disabled due row, and already disabled future-due row. Every prevented send retains `tries: 3`; due rows have the required error and phase. Only the first, already started POST in the batch schedule is allowed.
- Reran 52 existing runtime-path regression tests. All pass, including durable confirmation, uncertainty, supersession and retry behavior. The app TypeScript check passes.

This closes the two reproduced interleavings and the inspected decision path. It does not claim an actual LMS score/containment acceptance run.

### B-M1-02 — CLOSED at the reviewed repair

The maintenance shell now requires a successful Docker check and a successful `compose ps -a` before starting the Node backup/restore program. It accepts only absent containers or `exited`, `created` and `dead` states for the two data services. Running, paused, restarting and other observed states refuse. Failed observation no longer falls through to file operations.

The additional Node entry-point correction compares real filesystem paths and uses `fileURLToPath`. It avoids a successful no-op when the checkout is reached through a symlink such as macOS `/tmp` or `/var`, and handles a path containing spaces.

Independent evidence:

- Reran all 16 committed maintenance tests. They pass. The shell tests exercise inspection failures for both backup and restore, running/restarting/paused states, missing Docker, and stopped/created/absent positives. Positive paths use the real Node maintenance program on fixture databases and compare restored bytes; failure paths prove the program was not invoked and targets did not change.
- Reran the two original independent shell probes with corrected assertions. A failed Docker-info check and a failed compose-ps check both exit 1, emit a clear refusal, and never reach the fake Node program.
- Added six independent positive shell-entry probes: stopped, absent, and created/dead container results, each through a real directory and an explicit directory symlink. Every directory also contains spaces. All six create a real manifest containing both fixture databases, then restore both databases to their original hashes after a fixture write. Docker is always an inert stub; no actual daemon or stack is contacted.

These checks establish the corrected maintenance entry behavior. Full upgrade, rollback, old-service-key continuity and retained Moodle-grade evidence still require QA's separate MOODLE-LIVE run.

### Commands and artifacts

Commands run at the exact detached review checkout:

```sh
npx --no-install vitest run services/cogniate-app/src/worker/score-sync.test.ts services/lti-service/src/cli/stack-data.test.ts
npx --no-install vitest run services/cogniate-app/src/runtime-path.test.ts
npm run typecheck -w services/cogniate-app
```

Results: 25 tests in the first run and 52 in the second, all passed with zero reported skips; app typecheck passed. Author mutation evidence was not treated as independent proof and was not rerun against modified product files.

Independent diagnostic files and captured outputs are in the existing external directory:

`/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/reviewer-b-m1-probes-q0nwvjt3`

- `r2-score-fences.mjs` / `r2-score-fences.output.json`: 16 combinations. Run `node <script> <review-clone>`.
- `r2-maintenance-guard.py` / `r2-maintenance-guard.output.jsonl`: both original unknown-state failures. Run `python3 <script> <review-clone>`.
- `r2-maintenance-positive.py` / `r2-maintenance-positive.output.jsonl`: six real/symlink entry and paired-restore cases. Run `python3 <script> <review-clone>`.

The original round-1 defect probes and outputs are preserved. These new probes assert corrected behavior and do not edit repository source or existing stack data.

### Still open / not reviewed in this checkpoint

| Item | Disposition |
| --- | --- |
| B-M1-03, remote provider calls before local grant checks | **OPEN.** No repair reviewed. The Lead reports an Architect dependency for locally available target data; no weaker validation order is authorized. |
| B-M2-01, final Learn Submit instruction | **OPEN / repair NOT REVIEWED.** |
| B-M3-01, wizard and badge harness flow | **OPEN / repair NOT REVIEWED.** |
| B-M3-02, route observer and form-state navigation | **OPEN / repair NOT REVIEWED.** |
| C-1/C-2/C-3 exact Canvas oracles, Moodle baseline and H-6 labels | Clarified contract read; committed QA repair NOT REVIEWED. |
| Final author acceptance-startup smoke | NOT REVIEWED; exact evidence handoff still needed. |
| Full M1 and M2 harness-only checks on final repaired SHAs | Not repeated in this bounded checkpoint; both complete checks remain required for the final round-2 review. |
| SIM/browser acceptance, migration/rollback and Moodle regression | NOT RUN here; separate evidence gates remain. |
| Local Canvas, hosted Canvas and Blackboard Learn live evidence | UNVERIFIED; no live check or authorization assumed. |

No new BLOCKER or MAJOR was found in the bounded first repair slice. The remaining open findings keep the overall review at CHANGES_REQUESTED, and neither unchanged M2 nor M3 report is superseded by this checkpoint.
