Verdict: PENDING (host-only preparation; this round gives no final APPROVE or CHANGES_REQUESTED)
Round: 1 (preparation, 2026-10-22)

# M4: Architect final conformance (AC-M4-06)

## Round 1 — host-only preparation (2026-10-22, about 11:00–12:10 UTC)

Author: fresh independent Architect, Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_0ed2aa21f05c`, dispatch `ctx_e95086e27835`, run `run_ebe671ad72a9`. Directive: [phase plan](../../team/multi-lms-plan.md) "Current directive — 2026-10-22, 10:55 UTC" and Lead message `msg_9f4c31796510`.

This round is a source-conformance map and a list of the evidence that is still pending. It is not a final verdict. The Lead supplies the remaining runtime evidence before the final round. I ran no test, no Docker command and no runtime check. I edited no product, test, criteria or architecture file.

### 1. Identity and method

| Item | Value |
| --- | --- |
| Tested runtime candidate | C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` (the two accepted full2 engine rounds). |
| Test-only correction | C5 `e1a057be9624a82949007b772e2bdf19bc55638b`, tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc`. `git diff --stat bf09cda e1a057b` shows only `tests/acceptance/T6/3-courses.spec.ts`, `tests/acceptance/T6/5-xss-a11y.spec.ts` and `tests/acceptance/T8/2-shell.spec.ts` under `tests/`. It has no runtime credit yet. |
| Product identity | `git diff --stat 9f8ac62 bf09cda -- services apps packages infra package.json package-lock.json`: only `infra/README.md` (prose). HEAD `69d94e7` against C4, outside `docs/` and `tests/`: only `README.md` and `infra/README.md` (prose). `infra/README.md` at HEAD: SHA-256 `78aecb02dab70c34f9885fda8575b17681116a3ad878a0a6077995e081445fdc` (the held hash of grant `msg_ddbd419caeff`). |
| Engine source since the final M1/M2 source approvals | `git diff --stat e3cd7db bf09cda -- services apps packages package.json package-lock.json`: only `package.json` (scripts) and `services/lti-service/src/cli/stack-data.test.ts`. So every engine, provider, portal and player source file at C4 is byte-equal to `e3cd7db` (M1 Reviewer-A Round 5 and Reviewer-B Round 4, M2 Reviewer-A Round 5 and Reviewer-B Round 4: APPROVE). The storage product is under `infra/**` and `package.json`. |
| Design references (HEAD, SHA-256) | ADR-011 `3d580ac5…`; ADR-012 `2b3b601b…` (revision 3.7 text, as recorded in the plan); LTI contract `f3e7d854…`; app contract `2ecf7256…`; M1 `ac444799…`; M2 `3f34ad38…`; M3 `414e5943…`; M4 `c3a0612a…`; data model `c3efc47a…`; security `7ae81993…`. |
| Method | Static reading of the C4 source (equal at HEAD) against each rule. Focus areas of the dispatch: tenancy and approval, disconnect and rebind isolation, generation, lease, ref and cleanup races, the Canvas origin split, product family and D-12, Moodle compatibility, and the shared engine and provider boundary. I did not repeat the broad M1, M2 or storage source reviews. |
| Severity | Charter §5. A failing required criterion or control is a BLOCKER. |

Runtime SHA and documentation SHA stay separate. The tested runtime is C4 (product) with tests tree `8283d90` for the engine rounds. The final documentation SHA is not known yet. The provisional guide is `fd87bf7`; its preliminary independent QA is at `cce5736` ([docs.md](docs.md)).

### 2. Preliminary result

- BLOCKER: none found in source.
- MAJOR: none found in source.
- New items from this round: six NITs (§4). None of them blocks approval. None needs a repair before the final verdict.
- Two documentation closure steps for the final round (§5). They are not deviations today.
- Genuine pending evidence: §6. The final verdict waits for it.

### 3. Conformance map: rule → code → accepted evidence

Evidence labels: `SIM` = QA-owned signed platform simulation (ADR-011 §13). Accepted runtime at C4: full2 Round 1 and Round 2, 488/488 PASS each, byte-equal per-case results (`97e37fa1…`), Lead acceptance `msg_953de7771af3` (Round 1) and `msg_bdb3feab05d2` (Round 2 and raw R4/R5). Independent Canvas judgment: 233/233 PASS in each round with exact 233/488 equality, Lead acceptance `msg_486a0d5f48c7`. Records: [M1 qa.md "Full run retry (`full2`)"](../M1/qa.md) and [qa-canvas.md §22](../M1/qa-canvas.md), committed at `7ab9f16`. The full2 attempt as a whole is **FAILED** (legacy T6; T8 not run; Common settlement `msg_a3becde5d99e`, outcome failed). Only its two engine rounds carry credit, at their true C4 and `8283d90` identity.

#### 3.1 Shared engine and provider boundary (team brief "One common engine")

| Rule | Code at C4 | Status |
| --- | --- | --- |
| One redemption engine for Canvas `initial`, Canvas `add_deployment` and Blackboard `initial` | `services/cogniate-app/src/app/redemption.ts:59-422`. Canvas deployments call it: `app/canvas-deployments.ts:22-29`. Canvas and Blackboard `PUT …/platform`: `app/connections.ts:257-264`. | Conforms |
| One cleanup engine (disconnect, suspend, revoke cleanup, release) | `app/binding-cleanup.ts:70-249`; used by `app/connections.ts:327-329` and `app/operator.ts:126`, `:164`, `:176` | Conforms |
| Adapters give data only (body parse, target, S1 body, tool rows); no adapter sequences or authorizes | `providers/canvas.ts:14-57`, `providers/blackboard.ts`, `app/binding-targets.ts:98-127` (the engine adds `active: false` and the ref, `:121`, `:124`) | Conforms |
| Profiles are data; launch code reads flags, not LMS names | LTI `lti/launch.ts:90-115` reads `profile.flags.serviceOriginCheck`, `profile.lms`, `profile.flags.minimizeClaims` | Conforms |
| One canonical-origin and site-rule function for both services | `packages/shared/src/origins.ts:19-30`, `:74-89`; app use `app/connections.ts:208-219` | Conforms |

#### 3.2 Tenancy and approval (ADR-011 D4, D5, §4 rules 1–7, §4a; app contract §4.4, §4.7.1, §6.1)

| Rule | Code at C4 | Evidence (`SIM`, both rounds) | Status |
| --- | --- | --- | --- |
| §4.4 first-failure order: 404, adapter 409, strict body 422, finalized repeat, phase 1 | `app/connections.ts:156-160`, `:259-262`; `redemption.ts:141-144`, `:72-79` | M1-37 (v12), M1-17, M1-20 | Conforms |
| Phase 1 in one transaction, checks 1–7 with 4a, no LTI call, target from local rows, event after commit | `redemption.ts:82-136` (checks `:88-124`; target `:104`; attempt, lease, reservation `:125-133`); event `:147`; `binding-targets.ts:98-113` | M1-29 (a)–(m), M1-37 (v1)–(v12), (i1)–(i5) | Conforms |
| Check 5 before check 7 (`GRANT_MISMATCH` before `DEPLOYMENT_IN_USE`/`DEPLOYMENT_FIXED`) | `redemption.ts:107-112` before `:116-124` | M1-37 (l), (v9) | Conforms |
| Authority only from a phase-2 approval of exactly (platform, deployment) with a `registered`/`connected` Canvas or Blackboard connection | approval write only in `redemption.ts:384`; routing `domain/connections.ts:203-212`; `tool-pages/launch.ts:77-94`, `:151-152`, `:208-209` | M1-37 (c2), (i), (m), (p), (s); I2 rows | Conforms |
| DTO lists only approved deployments | `app/connections.ts:58-65`, `:86-88` | M1-37 (c), (p) | Conforms |
| Blackboard: one reservation per connection, fixed deployment, same-library move only from a `disabled` connection | `redemption.ts:116-124`, `:131-133`; `domain/bindings.ts:230-236` (unique index, data model §4.2) | M1-29 (j), M1-27, M1-37 (l), (v7) | Conforms |
| Operator CLI issue checks; replacement revokes older grants | `app/operator.ts:56-117` (replace `:102`) | M1-28, M1-29 (k)–(k3) | Conforms |
| Shared platform never changed by the app | the engine and cleanup send only deployment calls for `shared_deployment` targets (`redemption.ts:361-369`, `:411-412`; `binding-cleanup.ts:91-94`, `:219`) | M1-06, M1-18 | Conforms |

#### 3.3 Disconnect and rebind isolation (ADR-011 §4b, §12; app contract §4.7.2, §4.9; LTI contract §9.6, §9.14)

| Rule | Code at C4 | Evidence | Status |
| --- | --- | --- | --- |
| Disconnect: one transaction (`disabled` + revoke), then fence-out of every owned record; Moodle unchanged | `app/connections.ts:319-331` | M1-18, M1-37 (g), (h), (k), (u) | Conforms |
| Fence-out finds records through saved targets, also without a platform id; owned = current ref in C's history; one reread after a mismatch | `binding-cleanup.ts:52-68`, `:96-121` | M1-37 (k), (u), (z5); M1-38 (f), (g) | Conforms |
| Suspend without a library session; repeatable | `operator.ts:156-169` | M1-38 (a) | Conforms |
| Release preconditions, then Canvas conditional delete, Blackboard `kept_inactive`, Moodle delete; only C's own reservation and approvals are deleted | `binding-cleanup.ts:191-246` (local delete `:225`) | M1-38 (b)–(g), (h5) | Conforms |
| Disabled Canvas/Blackboard score rows: no POST, `failed`/`CONNECTION_DISABLED` at the due pass; Resend and Refresh 409 | `domain/score-syncs.ts:29`, `:48-52`, `:88`; `app/results.ts:45-47`, `:68-70` | M1-18, M1-38 (a) | Conforms |
| Shared deployment: new binding = generation + 1 (activation, or adoption with a new ref); disable keeps the generation | LTI `http/routes/platforms.ts:268-301` (`:282`, `:288`) | M1-07, M1-27, M1-38 (c) | Conforms |
| Old key or ltik after a new binding → 401; inactive → 403, in the contract order | LTI `http/service-context.ts:29-42` | M1-13 (d), M1-27 | Conforms |
| Nothing moves between libraries | release deletes only C's rows (`binding-cleanup.ts:225`); routing by approval (`domain/connections.ts:203-212`) | M1-38 (c), (e); M1-10 | Conforms |

#### 3.4 Generation, lease, ref and cleanup races (app contract §4.7.1 S0–S3, I1–I6; LTI contract §9.15)

| Rule | Code at C4 | Evidence | Status |
| --- | --- | --- | --- |
| I1: one live attempt per connection (60 s lease; takeover marks the old attempt `abandoned`) | `domain/bindings.ts:190-202`; `redemption.ts:114`, `:130` | M1-37 (d), (f), (j), (v4)–(v6) | Conforms |
| S0 before every call: lease holds this attempt with ≥ 6 s left; grant and state before V and S1–S3 | `redemption.ts:153-165`; call sites `:231`, `:247`, `:268`, `:275`, `:286`, `:407` | M1-37 (d), (e), (o) | Conforms |
| Post-V decision: cancellation first, then readiness | `redemption.ts:200-224`; `binding-targets.ts:54-81` | M1-37 (w), (x1)–(z5), (aa) | Conforms |
| I3/I6: write-ahead, never-reused random refs; every activation, adoption, switch-off and delete is a compare-and-set with rotation | `domain/bindings.ts:162-177`; `redemption.ts:252`, `:289`, `:408`; `binding-cleanup.ts:107`, `:168`, `:233`; LTI `store/platforms.ts:157-161`, `:222-226`, `:267-276` (one transaction each) | M1-07, M1-37 (d), (i), (n), (q), (r); M1-38 (f), (g) | Conforms |
| I4: adoption rows A1–A3 on exact values; `history_floor` defines "older" | `redemption.ts:337-358`; floor `domain/bindings.ts:119` | M1-37 (b), (c), (t), (u); M1-38 (h5) | Conforms |
| Two S3 mismatches → `409 GRANT_IN_USE` | `redemption.ts:295-300` | M1-37 (r) | Conforms |
| Compensation only on our own activation ref; failure logs and leaves no authority | `redemption.ts:406-421` | M1-37 (m), (n) | Conforms |
| Revoke cleanup: only records whose ref this grant wrote and without approval; no call while its attempt holds a live lease | `binding-cleanup.ts:148-184`; `operator.ts:120-129` | M1-37 (e), (m), (p) | Conforms |
| I5: late create is inactive; a create never replaces a record | engine creates only with `active: false` (`binding-targets.ts:121`, `:124`) | M1-37 (p), (q); M1-38 (g) | Conforms |

#### 3.5 Canvas origin split (ADR-011 D3, §5; LTI contract §9.4, §9.7, §9.9, §9.10; app contract §6.1)

| Rule | Code at C4 | Evidence | Status |
| --- | --- | --- | --- |
| Site and service origins of a launch come from stored rows, never from a claim | LTI `lti/launch.ts:103`, `:116-119` | M1-25, M1-32 | Conforms |
| Check 13: AGS and NRPS on the service origin; `deep_link_return_url` on the site origin; detail `claim= host=` | LTI `lti/checks.ts:224-239`; flag gate `lti/launch.ts:105` | M1-12, M1-26, M1-32, M1-40 (a) | Conforms |
| App site check compares `siteUrl` and `serviceUrl`; LMS check after it | `tool-pages/launch.ts:77-94` | M1-22, M1-39 | Conforms |
| `frame-ancestors {site}` for picker and embedded pages; return target on `{site}`; "Back to …" only on `{site}` | `tool-pages/picker.ts:126`, `:159-161`, `:175`; `tool-pages/play.ts:54`, `:109-111`; `tool-pages/launch-rules.ts:35-44` | M1-09, M1-32, M1-40 (b), (c) | Conforms (see NIT AR-M4-02) |
| Canvas token endpoint `{serviceUrl}/login/oauth2/token`; self-hosted issuer = canonical site | profile data `services/lti-service/src/profiles/canvas.ts`; snapshot `binding-targets.ts:42-47` | M1-04, M1-26, M1-38 (i2) | Conforms |

#### 3.6 Product family and D-12 / A-M0-10 (ADR-011 §4 rule 4, §4b accepted limit; app contract §4.9)

| Rule | Code at C4 | Evidence | Status |
| --- | --- | --- | --- |
| Check 14 on every profile; before the allowlist and before storage | LTI `lti/checks.ts:246-251`; order `lti/launch.ts:105-119` | M1-39 (`squat-refused`, `blackboard-family-on-canvas`, `upper-case-family`, `missing-family-control`) | Conforms |
| App second line: profile LMS and signed family must match the connection | `tool-pages/launch.ts:89-92` | M1-39 | Conforms |
| Residual race: after a release, a grant-free `standard` connect can take a freed `canvas-self-hosted` issuer and client id; the rightful redemption gets `409 PLATFORM_IN_USE`; check 14 still refuses Canvas launches before storage | S1 `409` → one qualified lookup with the profile filter → no record → `PLATFORM_IN_USE` (`redemption.ts:261`, `:272-279`); hosted issuers reserved (LTI contract §9.1) | M1-39 `operator-order`, `residual-race` | Conforms to the accepted limit |

The accepted D-12 / A-M0-10 statement stays unchanged: reoccupation of a self-hosted Canvas identifier after a release can block setup; check 14 prevents Canvas access before storage; prompt rightful redemption narrows the window but cannot close it; an enterprise service needs a reservation or quarantine design. Recovery of `operation_lock_invalid` stays STOP/ESCALATE; this report adds no recovery procedure.

#### 3.7 Moodle compatibility (ADR-011 D1, §10, §14; M1 design notes)

| Rule | Code at C4 | Evidence | Status |
| --- | --- | --- | --- |
| Generation 0 keeps the old HMAC input | LTI `store/service-keys.ts:32-38` | M1-07, M1-23 (`K0` same after upgrade) | Conforms |
| `standard`: no check 13, no allowlist; check 14 passes `moodle` and a missing family | `lti/launch.ts:105`, `:115`; `lti/checks.ts:246-251` | M1-12 (standard control), M1-14 (standard control), M1-39 controls | Conforms |
| Moodle connect, PUT, disconnect and routing unchanged | `app/connections.ts:193-201`, `:267-317`, `:321-325`; `domain/connections.ts:188-191` | legacy groups; M1-38 (i5) | Conforms in source; runtime partly pending (§6) |
| Role change: graded = context learner and no context staff; Deep Linking = context staff or admin | `packages/shared/src/roles.ts:28-36`; `tool-pages/launch.ts:162`, `:207` | M1-16 | Conforms (see NIT AR-M4-01) |
| Upgrade and rollback with the maintenance commands | storage commands under `infra/**` (ADR-012) | M1-23 and M1-30 rows in phase `migration`, 12/12 in both rounds | Conforms at C4 for the `MOODLE-LIVE` route rows |

#### 3.8 Storage (ADR-012, summary only)

The storage rows of AC-M1-41 passed 70/70 in each full2 round, with raw R4/R5 evidence accepted in `msg_bdb3feab05d2`. The R5 host results (source `27e1f61`, host 154/154, affected 52/52, two independent approvals) are source evidence only; they give no runtime credit. Failed C3 and the passing zero-credit diagnostics do not transfer. I did not repeat the storage source reviews. The accepted storage deferrals are in §7.

### 4. New findings of this round (charter §5)

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| AR-M4-01 | NIT | `services/cogniate-app/src/tool-pages/launch-rules.ts:10-16` | `hasStaffRole` keeps the pre-M1 institution-role rule, and its comment says "The same rule marks a launch as a preview". This contradicts ADR-011 §10. No production code calls it. | Only `tool-pages/launch.test.ts:8`, `:86-91` use it. Runtime uses `isGradedLaunch` and `canSelectContent` (`tool-pages/launch.ts:162`, `:207`). M1-16 passed. | At the next authorized product edit, remove it or mark it obsolete. No repair now. |
| AR-M4-02 | NIT | `services/cogniate-app/src/tool-pages/page.ts:37-38`, `:40` | The CSP comment and the option name say `{issuer}`, but the callers pass the connection site origin. | `tool-pages/picker.ts:126`, `:175`; `tool-pages/play.ts:109`, `:111`. Behaviour conforms to app contract §6.1. | Rename the option and the comment at the next edit. |
| AR-M4-03 | NIT | `docs/architecture/data-model.md:383` | The comment says `connection_deployment.binding_ref` is the attempt id. App contract §4.7.1 phase 2 stores ref `a` there. | Code does both: `redemption.ts:132` (phase 1, attempt id), `:391` (phase 2, ref `a`). No decision reads the value. | One comment: "attempt id after phase 1; activation ref after phase 2 (record only)". Architect text; needs a Lead grant. |
| AR-M4-04 | NIT | `services/cogniate-app/src/app/connections.ts:299-301`; app contract §4 and §4.9 | ADR-011 §4b, app contract §4.9 and the operator guide say a `standard` connect with a reserved issuer gets `400 ISSUER_RESERVED`. That is true at the LTI API (AC-M1-03). Through the portal, the app answers `422 INVALID_PLATFORM_VALUES`, `fields: ["issuer"]`, "This address belongs to a hosted LMS. Connect it as Canvas or Blackboard." No contract row states this mapping. | Nothing is stored in both paths. No AC covers the portal answer. | Add one sentence to app contract §4 / §4.9 that names the portal answer. Guides can keep the LTI code with its evidence label. Architect text; needs a Lead grant. |
| AR-M4-05 | NIT | `docs/architecture/adr/ADR-012-sqlite-volume-storage.md:253` (§7 A3) | A3 says "manual exit: the M4 guide". The Lead decision and the held texts say STOP/ESCALATE: no validated manual procedure exists. | `infra/README.md:128` (`78aecb02…`); [troubleshooting](../../guides/troubleshooting.md) storage note. The refusal behaviour does not change. | Wording: "no validated manual exit in this prototype: stop and escalate (M4 operator guide §4.3)". Architect text; needs a Lead grant. |
| AR-M4-06 | NIT | ADR-011 §4b step 2 | The ADR says Moodle and Canvas release use a conditional delete. App contract §4.9 and the code use the unchanged unconditional delete for Moodle, which has no refs (LTI contract §9.15 "Compatibility"). | `binding-cleanup.ts:233` | Wording: "Canvas: conditional delete; Moodle: the unchanged delete". Architect text; needs a Lead grant. |

I sent no design change. AR-M4-03 to AR-M4-06 change only text and no approved behaviour. If the Lead grants the edit, I will make them in the final round. Else they stay recorded NITs.

### 5. Documentation closure steps for the final round (not deviations today)

| Id | Item | Needed |
| --- | --- | --- |
| DC-1 | ADR-011 status line still says "Proposed (M0, revision 6 …)". The board and the team brief record the accepted revision 6 (M0 design gate at `158a4d8`). | At final closure, state the accepted design and the evidence boundary (`SIM` and `MOODLE-LIVE` only; all live rows `UNVERIFIED`). Lead grant for the Architect edit. |
| DC-2 | ADR-012 status line: revision 3.3 accepted as design only; revisions 3.4 to 3.7 "proposed and not accepted"; "No implementation and no runtime result is accepted". | It stays correct until the Lead's final runtime decision. After that decision, update the status and history only. Lead grant for the Architect edit. |

### 6. Genuine pending evidence (final verdict waits for all of it)

| Id | Evidence | Why conformance needs it |
| --- | --- | --- |
| PE-1 | Fresh legacy run: all 12 groups at C4 product with C5 tests (D-T6L), including T6 and T8 | Moodle compatibility and M2 label changes (ADR-011 §14, AC-M3-02 (b)). At C4, T6 failed on stale labels and T8 never ran. |
| PE-2 | Settled independent source reviews of the C5 test diff and the launcher: Reviewer-A `ctx_3e704f419d7e`, Reviewer-B `ctx_3bb7b60adf5c` | D-T6L condition. I do not anticipate their verdicts. |
| PE-3 | Independent Canvas T6/T8 judgment (`task_73d57f11a485`) | D-T6L condition. |
| PE-4 | Fresh M2 browser run at C4 with unchanged e2e | AC-M4-06 compares the M2 code. The 64/64 result at `aff4882` is history (B-M3-06). Portal code is equal, but the stack storage differs. |
| PE-5 | Fresh T7 (three runs) at C4 | Real Moodle regression (AC-M3-02 (a)). |
| PE-6 | Final W4, scans and owned cleanup of these runs, with Lead acceptance messages | Isolation and evidence integrity (AC-M3-06, AC-M3-07). |
| PE-7 | Final documentation SHA with independent Docs QA, including A-SI-05 and B-SI-09 closure | Conformance of the human documents to ADR-011 (no claim beyond evidence). Kept separate from the runtime SHA. |
| PE-8 | Lead's final runtime and conformance binding | Closes AC-M4-06 for one exact product, test and documentation identity. |

Any fresh failure, or any extra product or test change, voids the narrow D-T6L exception. Then I re-assess.

### 7. Accepted deferrals carried (no optional repair scope)

These stay as recorded in [deferred.md](../../human_review/deferred.md) and the phase plan. This report changes none of them.

- A-M0-10 / D-12: MINOR, accepted limit (§3.6).
- Engine and tests: A-M1-02 NIT; A-M3-05 NIT (optional); B-M3-05 open NIT, no deferral entry needed.
- Storage product: A-SFT-08 MINOR; **R1-A QA O-1 MINOR** (quiet A6 release; open); A-QR1-01 / B-RR-01 MINOR; A-SI-04 NIT; B-SI-08 NIT; B-RR-02 NIT; B-RR-03 NIT; O-A2 context.
- Storage harness: B-HR-03 (rest) MINOR; B-HR-04 MINOR (M5-4b stays masked and NOT DETECTED, not equivalent); B-HR-06 MINOR; A-SH-10 (= B-HR-11) MINOR; A-SH-11 MINOR (`stopCheck` can accept an earlier same-point stop event); A-SH-12 NIT (require an explicit present, 64-hex kept `lti.db` hash); A-SH-13 NIT (case name); B-HR-05, B-HR-07, B-HR-08, A-SH-07, A-SH-08, A-SH-09 (= B-HR-09), B-HR-10, B-HR-12 NIT.
- Guide: Q-M4-P01 and Q-M4-P02 cosmetic NITs (accepted in `msg_00d52fb2bfe2`).
- Not open: **ADR-012 O-1 CLOSED** (revision 3.6 precision); **Q-R1A-01 CLOSED** (product repair at `9f8ac62`). Both are different from the open R1-A QA O-1 above. M4-8f is an equivalent mutant, not a finding. A-SI-05 and B-SI-09 wait for independent document closure.

### 8. AC-M4-06 trace

| Clause | Where |
| --- | --- |
| "compares the M1 and M2 code with ADR-011 and both contracts" | §3 (M1 engine, provider, LTI and app code), §1 (M2 portal code equal to the approved `e3cd7db`; fresh M2 runtime pending, PE-4) |
| "lists every deviation with severity (charter §5)" | §4 (six NITs); carried deferrals §7 |
| "gives APPROVE or CHANGES_REQUESTED" | Pending. A final round section will give it after §6 is complete. |
| "APPROVE needs no open BLOCKER or MAJOR deviation" | Today: 0 BLOCKER, 0 MAJOR in source. |

### 9. Evidence limits

- All engine runtime evidence is `SIM` (signed simulation) on C4, plus the `MOODLE-LIVE` upgrade and rollback rows on a local Moodle 5.2.4 container. Fresh legacy and fresh T7 real-Moodle evidence at C4 are pending.
- Local Canvas (`CANVAS-LOCAL`) is DEFERRED. Hosted Canvas (`CANVAS-HOSTED`) and real Blackboard (`BLACKBOARD-LIVE`) have no evidence. All 32 live LMS rows are `UNVERIFIED`.
- This report makes no claim that the service "works with Canvas", "works with Blackboard" or is certified.
- Host checks, failed C3 and zero-credit diagnostics give no runtime credit. The full2 attempt stays FAILED; this report does not relabel it.
