Verdict: CHANGES_REQUESTED (STATIC CONTENT of provisional `fd87bf7`) — final-pack approval: PENDING
Round: 1 (preliminary, static only)

# M4 Reviewer-A: preliminary static guide review

## 0. Identity, scope and inputs

- Role: independent Reviewer-A, lens A ("Is it right and is it safe?"). Claude Code Opus 5.5, xhigh. Orca run `run_ebe671ad72a9`, task `task_514e1319ae47`, dispatch `ctx_2872987ddaf8`.
- I am not the author, the planner or the Architect. I used no subworkers, Docker, tests, npm, installs or browser. I made no commit and no source or guide change.
- Independence: I did not read any M4 Reviewer-B report or message.
- Time: 2026-10-22, 11:26–11:42 UTC.
- This is a STATIC review of unchanged provisional content. It gives no runtime credit and no final prototype approval.

Target: commit `fd87bf75f468839062ac41b4594c357d2bfb353b`. All ten files match the frozen SHA-256 values at that commit and in the worktree (`git show` and `shasum -a 256`).

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `README.md` | 8,263 | `814c32dca7134ff2fff6b2a8c099aadbfd5559b672da8de7da20dd3e11469026` |
| `docs/guides/blackboard-admin.md` | 7,294 | `6b4c0185f58765e835ccb60c6f419925dc71db7837dbd9acbb918c52532e8efb` |
| `docs/guides/canvas-admin.md` | 10,690 | `ae9041470087f1fdd3f7dff64d12fff131f53839427edf9a99cacb274e91b4f4` |
| `docs/guides/operator.md` | 16,696 | `1c40e0e5394050e8484b3bf65181e87b2a0a366eba76ea109cfeb9b4cad3deb8` |
| `docs/guides/teacher.md` | 10,284 | `35ec285743b3febd80ecd47084e95ff4f2ce1695e901175fb21ee0b4f200dcda` |
| `docs/guides/troubleshooting.md` | 13,031 | `53e498f3ea3df4e04cc70ebc9b14a492c4c33b61e61789beb84dbb2e6d52ea78` |
| `docs/human_review/START-HERE.md` | 6,527 | `c50777cf678c69c79b4c3e7c73ecdfd42d63b8f3fc63b11347f5ee17d4060718` |
| `docs/human_review/canvas-blackboard.html` | 22,070 | `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa` |
| `docs/human_review/deferred.md` | 19,839 | `af9e82deb3f327443b9726a34242e193d739cab0e7ebc4790f6b5c7b9adb3463` |
| `infra/README.md` | 61,032 | `78aecb02dab70c34f9885fda8575b17681116a3ad878a0a6077995e081445fdc` |

Reused, not repeated: Gemini preliminary guide QA `docs/reviews/M4/docs.md` (19,224 bytes, SHA-256 `a9b92890714badfebbdb805d0f47e51e1fce4b238ae0f3e50c2341e9e9451d2b`, commit `cce5736`): writing limits, links and anchors, offline `file://`, accessibility, desktop and mobile layout, the live-row note count and the DataCamp scan. Observation for the Lead: its §1.1 byte column gives `README.md` 6,419 and `infra/README.md` 63,323. The real sizes are 8,263 and 61,032. The SHA-256 values match, so the reuse stays valid.

Read for correctness: charter; `tasks/M4.md`, `T9.md`; ADR-011 §4–§17; ADR-012 §7; app contract §4.2–§4.9 and §6.1; LTI contract §7 and §9.1–§9.15; M1 AC-M1-07, -18, -37, -38, -39, -40; M3 §5 live matrix; research facts; board; phase-plan deferral records; `architect-conformance.md` (AR-M4-01..06). Source only where a guide statement needed it: `infra/scripts/storage-oplock.sh:110-115`, `stack-data.mjs:896-918`, `stack-data.sh:41-42`, `lib.sh:105-110`, `lti-bootstrap.sh`, `infra/compose.yaml:15-30,121-156`, `services/cogniate-app/src/app/binding-cleanup.ts:185-245`.

## 1. Static content verdict

**CHANGES_REQUESTED.** 1 BLOCKER (final pack), 0 MAJOR, 5 MINOR, 3 NIT.

The core safety content is right: the shared engine and trust boundary, the grant rules, the nine Blackboard values, the Canvas site and service origins, the D-12 statement, the stopped-services upgrade and rollback, and the STOP/ESCALATE rule for `operation_lock_invalid`. No document makes a certification or "works with" claim. The BLOCKER is a missing set of accepted deferral records. The fix is additive and has no runtime effect.

## 2. Findings

### A-M4P-01 — BLOCKER (final pack) — accepted MINOR deferrals are missing from `deferred.md`

- **Where:** `docs/human_review/deferred.md:104-176` (M4 section). Line 108 says that the section records the accepted deferrals of the phase plan.
- **Problem:** The section omits Lead-accepted MINOR deferrals that the Lead sent to the M4 deferred list before `fd87bf7`.
- **Evidence:** charter §5, MINOR row: "listed in `docs/human_review/deferred.md`". `grep` of `deferred.md` finds none of the ids below. They are not "newly accepted": the Lead dispositions are in plan commits `0cb719e` to `e705336` (2026-10-21), before `fd87bf7`. Cross-checks: "B-BM-01, A-SOR-01/B-SOR-01 and the post-reset build-request coverage stay on the M4 deferred list" (`docs/reviews/M1/storage-full-triage-reviewer-b.md:248`); `docs/architecture/tasks/storage-full-round-triage.md:556`.
- **Severity reason:** a declared required outcome fails (Lead rule for charter §5). For B-BM-01 the Lead wrote: "Docs must add this test-coverage deferral to `docs/human_review/deferred.md` in M4." It blocks final-pack approval only.
- **Omitted items (exact ids, source, Lead disposition, suggested row):**

| Id | Sev. | Source finding | Lead disposition (`docs/team/multi-lms-plan.md`) | Suggested `deferred.md` row (section) |
| --- | --- | --- | --- | --- |
| B-BM-01 | MINOR | `docs/reviews/M1/backup-manifest-reviewer-b.md:132` | `:1519`, `:1522` (also `:1384`, `:1502`) | The migration-name self-test has no equal-count exchange of names between the two databases. The real oracle rejects that exchange. Fix: add the exchange case. (Storage harness) |
| A-CR-01 | MINOR | `docs/reviews/M1/content-refusal-reviewer-a.md:78` | `:1171-1172` | A package-folder lookup error can be reported as `content_missing`. It still refuses with no target write. Fix: give the lookup error its own result. (Storage commands) |
| A-CR-02 = B-CRR-02 | MINOR | `content-refusal-reviewer-a.md:88`; `content-refusal-reviewer-b.md:140` | `:1171`, `:1173` | Unit assertions do not detect a missing cleanup after a copy or verification failure. Fix: assert the cleanup. (Storage harness) |
| A-CR-03 | MINOR | `content-refusal-reviewer-a.md:97` | `:1171`, `:1174` | The frozen H1–H7 plan has no independent `content_check_failed` case. Reviewer probes cover examples. Fix: add one case. (Storage harness) |
| A-CR-04 | MINOR | `content-refusal-reviewer-a.md:105` | `:1171`, `:1175` | The older path rule accepts `packages/.` and `packages/..` in a crafted backup. Fix: refuse these path parts. (Storage commands) |
| B-CRR-01 | MINOR | `content-refusal-reviewer-b.md:130` | `:1171`, `:1176` | Unit tests do not distinguish a size-only copy check from the required size-and-hash check. Fix: add a case that only the hash catches. (Storage harness) |
| A-SOR-01 = B-SOR-01 | MINOR | `docs/reviews/M1/storage-oracle-repair-reviewer-a.md:128`; `storage-oracle-repair-reviewer-b.md:85` | `:1381-1382` | Two State OK assertions can pass without check-folder lines. Current product output supplies the lines. Fix: require the lines. (Storage harness) |
| B-SRP-03 (coverage part) | MINOR | `docs/reviews/M1/storage-reset-parent-reviewer-b.md:138` | `:1274`, `:1277`, `:1266` (text clarification committed in `51505bc`, `:1265`) | No gate sends a build request after a reset and a start, so the post-reset `build-queue` binds stay unmeasured. Fix: add one post-reset build request to an existing probe. (Storage harness) |

- **Correction:** add the eight rows above to the M4 section of `deferred.md`, each with its review link. Add no other change.

### A-M4P-02 — MINOR — the general correction order does not send self-hosted Canvas to the D-12 order

- **Where:** `docs/guides/operator.md:104-108` (step 5 issues the grant after `release`), `:129`; `docs/guides/troubleshooting.md:74` (`SERVICE_ORIGIN_MISMATCH` fix), `:78` (`PROVIDER_PROFILE_MISMATCH` fix).
- **Problem:** For `canvas-self-hosted`, these steps free the issuer and client ID first and issue the grant later. This makes the D-12 window longer than the accepted order.
- **Evidence:** ADR-011 §4b: "Operator order: issue the rightful grant first, then suspend, then release, then ask the rightful library to redeem at once." App contract §4.9 "After a release" gives the same order. AC-M1-39 uses "grant first, then suspend, release, redeem" for exactly the `PROVIDER_PROFILE_MISMATCH` case. `operator.md:138-145` (§3a) is correct, but §3 and the two troubleshooting fixes do not point to it.
- **Correction:** `operator.md` §3, before step 1: "Self-hosted Canvas: use the order of section 3a. The library makes the new connection first. Issue its grant before you suspend and release." Add the same pointer to `:129` and to the fix cells of `troubleshooting.md:74` and `:78`. This adds no stronger claim (AC-M4-08).

### A-M4P-03 — MINOR — the `operation_lock_invalid` text points to a "manual exit" that the guides do not name

- **Where:** `docs/guides/operator.md:202`, `:205`; `infra/README.md:128`; `docs/guides/troubleshooting.md:86`.
- **Problem:** The command prints: "The lock folder `<path>` has no valid record. Follow the manual exit of the operator guide (only when no storage command of this checkout runs)." (`infra/scripts/storage-oplock.sh:114`). The guides correctly say STOP/ESCALATE. But no guide quotes this text or says that the "manual exit" is stop and escalate. `operator.md:202` also says "The manual recovery procedure is pending Architect and QA validation", which suggests that a procedure exists.
- **Risk:** an operator can look for, or improvise, a manual exit. The guides forbid a move or removal, so the risk is low.
- **Correction:** `operator.md:202`, last sentence: "The message says 'Follow the manual exit of the operator guide'. In this prototype the manual exit is: stop and escalate. No validated manual recovery procedure exists." Use the same sentence in the granted `infra/README.md:128` row. Add no procedure. The product text and ADR-012 A3 wording stay with AR-M4-05 (no new scope).

### A-M4P-04 — MINOR — "These refusals change no data" also covers `storage_lock_lost`

- **Where:** `docs/guides/operator.md:196`, with the row at `:203`.
- **Problem:** `storage_lock_lost` is not a refusal. The command can finish its work, then exit 1 when it finds another owner's record (ADR-012 §7, Release step 1). So data can have changed. The row at `:203` says "not proven safe", but the lead sentence says "no data".
- **Correction:** `:196`: "The first three messages are refusals: they change no data. `storage_lock_lost` is not a refusal: your command ran, and it can have changed data."

### A-M4P-05 — MINOR — where to run the operator commands

- **Where:** `docs/guides/operator.md:9-13`, `:214`.
- **Problem 1 (confirmed in source):** `:9` says "Run each command inside its service container." `lti:bootstrap` (`:214`) is a host wrapper: `services/lti-service/package.json` runs `bash ../../infra/scripts/lti-bootstrap.sh`, which calls `dc exec` itself. The containers do not mount `/repo/infra` (`infra/compose.yaml:23-30`, `:144-150`). Every `stack:*` command in §4 is also a host command.
- **Problem 2 (static evidence, not executed):** the example `docker compose exec cogniate-app …` has no compose file or project. The repository has no root compose file; only `infra/compose.yaml`, which needs the required `${…:?run npm run gen-env}` values from the root `.env`. The repo's own helper uses `--project-directory infra -p $COMPOSE_PROJECT_NAME -f infra/compose.yaml --env-file .env` (`infra/scripts/lib.sh:105-110`). `infra/README.md:69-70` (outside the M4 grant) has the same short form.
- **Correction:** `:9`: "Run `app:grant`, `app:binding` and `lti:shared-platform` inside their service container. Run `lti:bootstrap` and every `stack:*` command on the host, in the repository folder." Examples: `docker compose --project-directory infra -p <COMPOSE_PROJECT_NAME of .env> -f infra/compose.yaml --env-file .env exec cogniate-app npm run app:grant -w services/cogniate-app -- list --connection <con_id>`.

### A-M4P-06 — MINOR — two SIM-verified launch outcomes have no troubleshooting row

- **Where:** `docs/guides/troubleshooting.md:76`, `:80`; `docs/guides/canvas-admin.md:139`.
- **Problem (a):** A Canvas disconnect or suspend makes the platform inactive. Login and launch then give `PLATFORM_NOT_ACTIVE`, not `DEPLOYMENT_NOT_ACTIVE` (LTI contract §9.2: `DEPLOYMENT_NOT_ACTIVE` is "checked after `PLATFORM_NOT_ACTIVE`"; ADR-011 §12; SIM: AC-M1-07 "login and launch give `PLATFORM_NOT_ACTIVE`", AC-M1-38 (g) Canvas "its launch → `PLATFORM_NOT_ACTIVE`"). Row `:76` maps "disconnected or suspended" to `DEPLOYMENT_NOT_ACTIVE` only, which is the Blackboard result.
- **Problem (b):** Row `:80` (`UNKNOWN_PLATFORM`) names only `site_mismatch` and `lms_mismatch`. App contract §6.1 also gives `UNKNOWN_PLATFORM` with reason `deployment_not_approved`: an active record without an approval, for example after a lost activation answer (AC-M1-37 (c2)).
- **Correction:** add a row `PLATFORM_NOT_ACTIVE` (Canvas): "The Canvas connection was disconnected or suspended", with the fix of `:76` and `[SIM AC-M1-07, M1-38.canvas.g-late-create]`. Write "(Blackboard)" in the cause of `:76`. Add to `:80`: "or `reason: deployment_not_approved`: a Save did not finish. Click Save again with the same code; if it stays, the operator suspends the connection."

### A-M4P-07 — NIT — `deleted` is also the result of a Moodle release

- **Where:** `docs/guides/operator.md:117`; used by the D-12 recovery at `:147`.
- **Evidence:** a Moodle release deletes its owned platform and prints `deleted` (`binding-cleanup.ts:228-234`; app contract §4.9 "Moodle: `DELETE /api/platforms/{id}` (unchanged)").
- **Correction:** "`deleted`: a Canvas or Moodle `release` deleted the switched-off platform, with its keys."

### A-M4P-08 — NIT — Procedure 6 has no actor, and nobody gives the new key id

- **Where:** `docs/guides/canvas-admin.md:123-129`; `docs/guides/operator.md:216`.
- **Problem:** Steps 1–2 need a Cogniate portal session (library user). Step 3 needs the Canvas admin. Step 2 compares with "the new key id", but the operator step does not pass it on. `lti:bootstrap` prints it as `kid=` (`lti-bootstrap.sh`).
- **Correction:** name the actor of each step. `operator.md:216`: "… and give them the new key id (`kid=` in the `lti:bootstrap` output)." The procedure stays `[L-C14 UNVERIFIED]`.

### A-M4P-09 — NIT — the rollback warning omits one ADR-011 §14 consequence

- **Where:** `docs/guides/operator.md:179-181`.
- **Problem:** ADR-011 §14 WARNING also says: "Canvas and Blackboard records made after the upgrade stay configured in the LMS, but their launches fail with `UNKNOWN_PLATFORM` after the restore."
- **Correction:** add that sentence to `:181`, with the same label as the other untested losses ("no QA case checked them one by one").

## 3. Lens-A checks that pass (reusable for byte-identical files)

| Area | Result and evidence |
| --- | --- |
| Shared engine, tenancy, trust boundary | HTML §1–§2 (`canvas-blackboard.html:97-163`) match ADR-011 §4, §4a: tenant key, exclusive and shared platforms, eight grant steps, the trust table word for word in meaning. |
| Grant rules | `operator.md:57-91` match app contract §4.8: options, 43-character code shown once, 60 s–7 days, default 24 h, refusals exit 1 and store nothing, replacement, `add_deployment`, Moodle refused, list states, revoke lines and the 60 s running-redemption text, redeemed grant → suspend. |
| Suspend, release, rebind | `operator.md:93-129` match ADR-011 §4b and app contract §4.9: order, "binding still active" refusal, lease wait text, six result lines, no transfer, late record found again, Canvas correction without a new key. Release message texts match `binding-cleanup.ts:191-195`. |
| Blackboard nine values and portal setup | `blackboard-admin.md:46-56` equal app contract §4.5 rows 1–9. `operator.md:25-32` equal ADR-011 §7 (one Target Link URI, Deep Linking, student access off, RS256). Role-only user fields, grade and membership on. |
| Canvas origins | `canvas-admin.md:21-27`, `troubleshooting.md:74-75`: page host = site, account domain = service; check 13 claim names `dl_return`, `ags_…`, `nrps` match LTI contract §9.9 (`ags_lineitems`, `ags_lineitem`, `nrps`, `dl_return`); third host D-2 (AC-M1-40). |
| Canvas JSON and keys | Paste JSON only, anonymous, no custom fields, `assignment_selection` only; inline snapshot, `X-Cogniate-Key-Id`, "Copy JSON" only while pending: app contract §4.6, M2 spec. Rotation stays `[Not verified by QA]` and `[L-C14 UNVERIFIED]`. |
| Deep Linking, new tab, attempts | `teacher.md:83-110`: graded assignment, "Load This Tool In A New Tab", unlimited attempts (ADR-011 §8, §9; F-CV-11, F-CV-23), Save & Publish, Student View graded (ADR-011 §10). Blackboard Ultra and Original paths match F-BB-11. |
| Upgrade and rollback | `operator.md:155-192` follow ADR-011 §14 step by step: code switched while both services stay stopped, backup outside the checkout, restore, `enable`, old build only through `storage-compat.sh run --`, rollback-mode rules, `stack:reset` never a recovery step. Lost-write warning present (see A-M4P-09). |
| D-12 / A-M0-10 | `operator.md:131-149`, `troubleshooting.md:63`, `deferred.md:112-123`, `canvas-blackboard.html:242-245`: scope only `canvas-self-hosted`; can block setup; check 14 refuses before storage, so no Canvas access; prompt redemption narrows but cannot close the window; reserved-identifier or quarantine design needed before an enterprise service. No stronger claim. |
| `operation_lock_invalid` | Every text says stop, do not remove or move the folder, escalate; no invented procedure (see A-M4P-03 for the message mapping). The 10 s window matches `storage-oplock.sh:111-114` (20 × 500 ms). |
| Evidence labels | Every live-row step carries the exact note "Not yet tested on a real Canvas site." or "… Blackboard site." (also counted by Gemini: 79). `SIM` is "signed simulation" (`README.md:19-21`, `:42`). `MOODLE-LIVE` is the local container. L-C13 stays deferred and `UNVERIFIED`; a self-hosted result never fills a hosted row (`canvas-admin.md:119`). |
| Claims | No "works with", "certified" or equivalent in the ten files. "1EdTech certification" appears only under "Not proven yet" (`START-HERE.md:30`). No DataCamp value or copied provider prose; provider facts cite `docs/research/multi-lms.md`. |
| Portal texts not verified | `GRANT_IN_USE` and `ISSUER_RESERVED` portal or page texts: "Not verified by QA"; `DEPLOYMENT_FIXED` portal text: "Author unit test only" (`troubleshooting.md:61`, `:65`, `:79`). |
| Decisions | Q19–Q22 link and D-1..D-12 defaults (`canvas-blackboard.html:220-239`) match ADR-011 §15. No human approval is implied. |

## 4. Accepted limits (not new findings)

- Q-M4-P01, Q-M4-P02: cosmetic NITs (decision-id wrap; small SVG text on mobile). No CSS work.
- AR-M4-01..06 (Architect NITs). AR-M4-04: the portal answers `422 INVALID_PLATFORM_VALUES` for a reserved issuer; the guides keep the LTI code `ISSUER_RESERVED` with its label. AR-M4-05: ADR-012 A3 wording.
- All 32 real-LMS rows `UNVERIFIED`; local Canvas (L-C13) DEFERRED. L-C14 rotation and the portal texts of `GRANT_IN_USE`, `DEPLOYMENT_FIXED`, `ISSUER_RESERVED` stay unverified.
- A-M0-10 / D-12 and every existing deferral in `deferred.md`, including B-RR-02, R1-A QA O-1, O-A2, A-SFT-08, A-QR1-01/B-RR-01 and the harness rows.
- A-CR-05 and B-CRR-06 (NITs) are for the later infra README owner: the restore order list (`infra/README.md:139`) does not name the content check, and no text names `content_check_failed`.
- Intentionally pending runtime stamps (section 6) are not content defects.

## 5. Preparation for A-SI-05 / B-SI-09 closure (infra README)

- Row 128 (granted): agrees with source for the 10 s window, the named folder and STOP/ESCALATE. Gap: A-M4P-03.
- Lines 146–157 (`5a5453c` text): agree with source. A coded refusal writes one `storage_refused` line on stdout, then the text on stderr (`lib.sh:335-341`; `stack-data.mjs:907-911`). The shell folder refusals write the line on stderr (`stack-data.sh:41-42`).
- The README does not say that every refusal prints "No target changed". That is correct: `stack-data.mjs:910` adds it unless the text has "Nothing was"; `stack-data.sh:41-42` print "Nothing was changed."; `stack-data.mjs:684` prints "Nothing was copied."; `operation_lock_invalid` prints neither; exit 2 never says it.
- For closure, use captured output, not this text. Show for each command: (1) one coded refusal with the stdout JSON and the stderr text, for example `docs/reviews/M1/qa-canvas.md:647` (`source_unreadable`, "… No target changed."); (2) a folder refusal for backup and for quarantine, and which emitter ran (two exist: `stack-data.sh:41-42` and `stack-data.mjs:140-141`, `:684`); (3) each listed text-only stop with exit 1 and no JSON line; (4) the `container` fields.
- NIT for the closer: one text-only exit 1 is not listed. A backup or quarantine copy with an unexpected failure prints "Failed: … The volumes were only read." with no JSON line (`stack-data.mjs:915`).

## 6. PENDING final-pack approval: evidence still needed

1. Fix A-M4P-01 and decide A-M4P-02..09.
2. Final source stamps instead of "Draft basis `82aff91` / C4 `bf09cda` / draft": `README.md:9-11`, `canvas-admin.md:3`, `blackboard-admin.md:3`, `operator.md:3`, `teacher.md:74`, `:114`, `troubleshooting.md:46`, `START-HERE.md:3-7`, `canvas-blackboard.html:10`, `:83`, `deferred.md:3`, `:106`. Bind the product SHA (C4) and the D-T6L tests revision C5 `e1a057be9624a82949007b772e2bdf19bc55638b` with its tests tree.
3. Runtime status text: `README.md:13`, `:29-33`; `START-HERE.md:7`; `canvas-blackboard.html:191-195`, `:200`. Current text says "one round only" and asks for a second round and equality. Final text must state the facts: two 488-row rounds passed; Canvas 233/233 passed twice with exact equality; the full2 ATTEMPT is FAILED (T6 stale labels, T8 not run); fresh legacy with C5 tests and fresh M2/T7 at C4 and their results. It must not call full2 passed as a whole.
4. `MOODLE-LIVE` and `SIM AC-M2` rows (`README.md:29-31`, `operator.md:153`, `canvas-blackboard.html:191`, `:195`) bound to the fresh M2/T7 and final M1 migration results.
5. Final Architect conformance (AC-M4-06) and the newly accepted deferral records (AR-M4-01..06, Q-M4-P01/P02) in `deferred.md`.
6. Independent closure of A-SI-05 / B-SI-09 (section 5).
7. Independent final Docs QA of the changed lines (writing limits, links) and two blind final reviews.
8. Live rows stay `UNVERIFIED`; local Canvas stays DEFERRED. AC-M4-07 was checked by the Lead; this report implies no human approval.

## 7. Reuse rule for the final reviewer

For a file whose SHA-256 still equals section 0, the checks of section 3 apply unchanged. For a changed file, review only the changed lines and the new bindings, plus the disposition of A-M4P-01..09.
