Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-A: design review of the storage full-round triage

Role: independent Reviewer-A (lens: right and safe — correctness, security, data integrity, exact contract compliance). Task `task_258c14eec9f8`, dispatch `ctx_070c92998668`, run `run_ebe671ad72a9`. Model: Claude Code Opus 5.5, xhigh. No subworker. Date: 2026-10-21.

Status: bounded design review of one frozen proposal. It is not final conformance. It gives no runtime or acceptance credit. It authorizes no implementation, no requirement change and no runtime action. The full result at `aaa823b` stays FAIL.

## 1. Reviewed objects

| Object | Identity |
| --- | --- |
| Target report | `docs/architecture/tasks/storage-full-round-triage.md` at commit `2b0081d8c1bcd404c044363d5385693b9e41ae12`, SHA-256 `d0f013ce3b44705f5460c196b834d7c3ea760ae8f68ebc6760bd8a82a10b2597` (equal in the commit and in the work tree at `f7fb974`; later commits change only `docs/team/**`) |
| Product candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3` |
| Tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` (`git rev-parse aaa823b:tests`) |
| Frozen source `F` | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source`: `HEAD` = `aaa823b`, no tracked change. The 12 source files of the triage table (§1) have the listed SHA-256 in `F` and in `git show aaa823b:<path>`. |
| Evidence `A`, `E` | The 14 `A` files and the 4 `E/public` files of the triage table have the listed SHA-256. |
| Common QA diagnosis (input evidence) | `E/public/diagnosis-storage-round1.md`, SHA-256 `dc167072facccba619442e03c0906d6894c2285a253774cd8024233c58c8eba3`; `docs/reviews/M1/qa.md` at `ef787d1edaee6713402dd43333a146391a883666` (file SHA-256 `f9dd2811…4591`) |
| Canvas QA (input evidence) | `docs/reviews/M1/qa-canvas.md` §19.3 at `fcb104162990147d0e00c787e93e14006a5212cb` (file SHA-256 `2c643e0d…36f0`) |

Normative text read: `docs/team/charter.md`; `docs/team/board.md`; the phase plan at `2b0081d` (the 12:03 UTC checkpoint and the earlier checkpoints of 2026-10-21, and the B-SI-07 rows); ADR-012 §4, §7, §8 backup, §9, §10, §11, §12, §15 (revision 3.5 text); `docs/architecture/tasks/M1.md` AC-M1-41 rules and rows (`:215–275`); `docs/architecture/security.md` §6; `docs/architecture/tasks/storage-reset-parent-repair.md` §1–§3.

## 2. Method and independence

- Host-only reads of source, evidence and documents. No Docker or Compose command, no product or test run, no reproduction, no mode change, no deletion, no live service, no external transfer.
- From private logs I read only event names, timestamps, counts, codes and the `command` field shape. This report has no secret value and no private database content.
- I checked RC-1, RC-2 and RC-3 in source and evidence before I read the Common QA diagnosis and the Canvas §19.3 text. I used those two as independent input evidence, not as verdicts.
- Blind review: I did not read the other reviewer's report, worker output, messages or summary. I read only my exact worker inbox. It had one Lead status request (`msg_8b3699d4c9f0`), which I answered with a scope checkpoint and no findings.

## 3. Summary

The three proven causes are correct. I verified each in source and evidence:
- **RC-1.** `storage_lock_release` calls the helper without `--command` (`infra/scripts/storage-oplock.sh:386`), so `eventLine` writes `command: null` (`:64`). Counts in `A/cmd/*.log` plus the final lane log: 87 of 87 `storage_lock_released` events have `"command":null`; 86 `storage_lock_acquired`, 3 `wait`, 3 `refused`, 3 `reclaimed` and 2 `cleanup` events name a command. ADR-012 §7 (line 311) marks only `owner`, `reason` and `container` as `| null`. The product does not conform. The QA selector (`tests/host/storage-rows.mjs:407`) then found no release.
- **RC-2.** `A/cmd/130-fixture-plant.log` shows the root `chown`; `A/cmd/131-fixture-list.log` shows `EACCES: permission denied, scandir '/v/appdb/packages'` from the `501:20` listing. The fixture mounts only the two lane volumes (`tests/host/storage-docker.mjs:122–131`). So the path is the in-volume mountpoint, not the host bind. The row has no `finally` (`storage-rows.mjs:530–553`).
- **RC-3.** `portal()` and `app()` send no `Origin` (`tests/host/storage-lane.mjs:168–185`). The product hook refuses every write without exact `Origin` = `PUBLIC_APP_URL`, also the login (`services/cogniate-app/src/app/server.ts:135–143`; `docs/architecture/security.md` §6). The app log has one `csrf_rejected` line.

The triage is careful and honest about limits. I agree with its main decisions: R1-A product conformance, rejection of a silent `null`, a strict `listRoot`, a fail-closed quarantine, the exact-origin rule, and no waiver.

I request changes because the verification plan and two proposals are not yet safe to implement as written:
- the planned storage-only diagnostic cannot be complete (A-SFT-01);
- the private-copy repair names too few copy sites, and its scan fails every row as written (A-SFT-02);
- P-1a, as written, can be implemented with a child rename, which is the same unmeasured topology class that the triage itself identified (A-SFT-03).

All requested changes are bounded text corrections of the triage. None needs a new design round.

## 4. Findings

### A-SFT-01 — MAJOR — the storage-only diagnostic cannot run all 70 rows

- **Where:** `docs/architecture/tasks/storage-full-round-triage.md:222` (§8 step 6).
- **Problem:** Step 6 asks for "one complete 70-row storage phase" before the full rounds. A storage-only run cannot complete `e-old-schema` and `e-content-missing`.
- **Evidence:**
  - `M1.md:265`: `e-old-schema` uses "this round's AC-M1-23 step 4 backup" and "the AC-M1-23 clone of the same round".
  - `tests/host/storage-rows.mjs:1024–1025`: `@old-schema-setup` throws `StorageBlocked` when the migration-phase handoff (`m123Backup`, `m123Clone`) is absent.
  - `tests/host/run-m1.mjs:147–156`: only the `full` mode writes the handoff file per round. `:359–361`: `--phase storage` reads it only from `QA_M1_HANDOFF_FILE`.
  - Result of `--phase storage` alone: `@old-schema-setup` BLOCKED, so `e-old-schema` and `e-content-missing` BLOCKED. The V3-R sign-in and v10-connection check (line 167) cannot be read. A handoff from the failed round at `aaa823b` is another candidate and another round. The row text does not allow it.
- **Fix:** Define the diagnostic as the `migration` phase (12 rows) and then the `storage` phase (70 rows), on the same frozen candidate, in one Lead-granted window, with one handoff file that this migration run writes. Both phases give zero credit. G1, W1–W4, the §15 ownership record, cleanup and scans cover both lanes (the default lane and the `-st` lane). If the Lead accepts a smaller diagnostic, the triage must state before the run that these two rows are BLOCKED by design and that the RC-3 sign-in path stays unread until step 7. A side benefit: the migration phase runs the old-build route with the R1-A lock helper and its new compatibility hash early.

### A-SFT-02 — MAJOR — P-3 names too few copy sites, and its scan fails every row as written

- **Where:** `storage-full-round-triage.md:203–211` (P-3 and V4-1 to V4-3); `:217` (P-3 listed as a Lead option).
- **Problem 1 (inventory):** V4-1 checks three sites: `stash`, `copyOut` and `place`. The harness makes more QA copies of protected files. A weaker repair that fixes only the three named functions passes V4-1 to V4-3.
  - Source at the volume mode (`0644` today), so non-compliant now: fixture `stash`/`unstash` (`tests/host/storage-fixture-script.mjs:186–193`), `copyOut` (`:229–231`), the in-container `logicalRead` scratch copies (`:115`), the `copy` plant op (`:177`).
  - Copy, then `chmod`, so a window at the source mode: `LegacyFixtures.place` (`tests/host/storage-oracle.mjs:238`); `copyCredentials` for API keys and `seed.json` (`tests/host/storage-rows.mjs:1346`).
  - Compliant today only because the product backup files are `0600`, not by construction: `backupLogical` in host `os.tmpdir()` (`tests/host/storage-lane.mjs:224`); `storagePaths` in host `os.tmpdir()` (`storage-rows.mjs:1309`); `cpSync` of backup folders (`storage-rows.mjs:687`, `:707`, `:709`, `:992`; `tests/host/m1-migration.mjs:218`).
- **Problem 2 (scan scope):** The per-row scan FAILs a row on "a regular file with any group or other bit" in the private root (line 206). QA's own fixture script is `0555` by design in `bin/` of the private root (`storage-lane.mjs:35`, `:46`). The `d-content-folder` scratch file `qa.txt` gets the default mode, `0644` under umask 022 (`storage-rows.mjs:558`). So the scan as written FAILs every row. The implementer must then invent a scope while coding. That invites an unreviewed relaxation.
- **Problem 3 (coverage):** Host scratch copies in `os.tmpdir()` are outside the scanned root.
- **Problem 4 (status):** The Lead already requires `0600` from creation (`2b0081d:docs/team/multi-lms-plan.md:38`). This is the second window with the deviation: four copies in the targeted retry (`:89`) and one in the full run (triage §7). P-3 is a precondition of the next runtime window, not an option.
- **Fix:**
  - One QA helper for every QA copy of a protected file outside the product volumes: exclusive create (`wx`) with mode `0600`, then the bytes, `fsync`, and a hash check. Copies into a volume (`unstash`, the `copy` op) use a second helper that sets the recorded original mode or the planted mode. Make every site above use these helpers.
  - Define the protected classes by name: `*.db`, `*.db-wal`, `*.db-shm`, `*.db-journal`, `.storage-identity.json`, `.storage-journal.json`, copies of `.env` and `infra/.secrets/**`, keys and certificates.
  - Scan these classes in every QA-made root: the private root, the legacy placements in the clone, and QA scratch folders. Give the runner a `TMPDIR` inside the private root (mode `0700`), or scan each scratch folder before its removal. Non-sensitive QA files keep their reviewed modes (the script can become `0500`).
  - Controls: V4-1 for **each** listed site, with a `0644` source each time (by construction, not by source mode); V4-3 negative cases (a `0644` database, sidecar, identity and secret each FAIL; the script and a `0644` course file do not); one source-inventory self-test that fails on any `copyFileSync`, `copyFile` or `cpSync` of a protected class outside the helpers.
  - Move P-3 from the Lead options in §8 step 1 to the mandatory work of §8 step 2.

### A-SFT-03 — MAJOR — P-1a must delete the children, and P-1b cannot turn a sample into a guarantee

- **Where:** `storage-full-round-triage.md:184–187` (P-1a, P-1b); `:221` (D-1).
- **Problem (a):** P-1a "makes only `packages` and `uploads` absent (topology R3)". R3 measured a **deletion** of the child under a kept parent (`docs/architecture/tasks/storage-reset-parent-repair.md:29`). The current harness makes folders absent by **rename** (`storage-rows.mjs:559` for `uploads`, `:574` for the parent). A child rename is not R3. It is unmeasured, the same gap that the triage found for the parent (line 180). So P-1a, as written, can reintroduce an unmeasured bind topology.
- **Problem (b):** a-fresh gets "one precondition record: `P` is absent". A record with no stated outcome can be ignored in silence.
- **Problem (c):** The criterion text must say why the case moves. Otherwise the change reads as a weakening to gain PASS.
- **Problem (d):** P-1b would narrow the ADR-012 §15 Limit (line 734) with 20 trials of an unknown Docker Desktop mechanism. The ADR binds its other measured guarantee (gate G-1, §7 "Lock records") to exact measured identities. D-1 also does not reproduce the row: it does not require `--mount type=bind` (the same as compose `create_host_path: false`, `infra/compose.yaml:186–195`); it does not keep the earlier service containers stopped but not removed (as `stopped()` leaves them); and it does not use the real start delay of `stack:up` (the `report` and `check` containers run first).
- **Fix (recommended minimum: P-1a with three conditions):**
  1. The `d-content-folder` second case **deletes** `packages` and `uploads` (QA may copy them first as evidence; course content is not a protected class), keeps `P`, then runs `stack:up`. It never renames them.
  2. `a-fresh` asserts `P` absent (`lstat` → `ENOENT`) before its `stack:up`. `P` present → the row is never PASS (BLOCKED, setup cause).
  3. The revised `M1.md` text says that a deletion or move of `P` by hand on a used lane is outside the ADR-012 §15 guarantee, so it is not a row. "`P` absent → created `0700` → start" stays covered by `a-fresh` in a fresh clone (topology R1). No row id or count changes.
  4. This is a criterion change. It needs the Architect revision, QA, both reviewers and Lead acceptance **before** QA writes the code (see A-SFT-06).
- **P-1b:** reject as written. D-1 is not needed for P-1a. If the Lead still wants D-1, it is information only. A later narrowing of §15 needs its own reviewed design, bound to the measured identities (OS, Docker Desktop version and file-sharing mode, Docker CLI and Compose versions and SHA-256), with the exact row sequence above.

### A-SFT-04 — MINOR — the RC-1 oracle needs a run binding and observable controls

- **Where:** `storage-full-round-triage.md:88–92` (oracle steps), `:100–104` (V1 table), `:191` (N-3).
- **Problem (a), identity:** Step 1 takes the backup `runId` from "its `storage_lock_acquired` event". The present wait loop accepts any acquired event whose command matches `/backup/` in the whole lane log (`storage-rows.mjs:399`). An earlier backup in the same lane log gives a wrong `runId` and ends the wait too early. No row runs a backup before `a-serialize` today (`storage-rows.mjs:26–43`), but a correct oracle must not depend on that order. V1-2 covers a wrong-run release, not a wrong-run acquire.
- **Problem (b):** V1-3 ("selects X, not Z") has no observable result.
- **Problem (c), clocks:** The release time is on the host clock; `State.StartedAt` is on the Docker engine clock. N-3 records both clocks, but gives no rule. An engine clock ahead of the host clock can hide a start before the release.
- **Problem (d):** Step 4 saves the backup output, but does not say through which path.
- **Fix:**
  - Read the lane-log offset before the spawn. Accept only acquired events after it whose `pgid` equals the spawned group (`spawnGroup` is detached), or at least exactly one new backup acquire. None or more than one → FAIL "backup run not identified". Use the same rule in the wait loop.
  - Add V1-6: an older backup acquire/release pair `W` before the offset → the oracle selects `X`, never `W`.
  - Make the oracle one pure function that returns the selected `runId` and the verdict. In V1-3, set `Z`'s release after a service `StartedAt` and `X`'s release before it. A "last release" selector then FAILs on time.
  - Compare fail-closed. Measure the engine-minus-host offset before and after the row. When the margin is smaller than the measured offset plus its uncertainty, the row FAILs as clock uncertainty, never PASS.
  - Save the backup output through the same redaction and secret scan as the other command logs.

### A-SFT-05 — MINOR — the RC-2 repair needs four precision points; per-row isolation is recommended

- **Where:** `storage-full-round-triage.md:118` (smallest repair), `:122–125` (V2).
- **Problem and fix:**
  - (a) The `finally` restore is a root write-mode fixture. ADR-012 §11 (line 541) allows it only under QA's lock with both services positively stopped. `storage-docker.mjs:126–127` allows root only in write mode for `d-owner` and `d-mountpoint`. State this rule. Add it to V2-3: the stop check comes before the restore.
  - (b) The restore must not change the row's result or first cause. The row stays FAIL with its own cause. The restore result is a separate note.
  - (c) V2-1 must use the names `packages` and `uploads` in an app-role root, and one other name, so it catches a relaxation that targets those names. The control must check its own precondition: a plain `readdir` of the `000` folder fails with `EACCES`, and the self-test refuses to run as root. Otherwise the control can pass with no effect.
  - (d) V2-2 needs a concrete discriminator: the metadata operation on a `000` named folder succeeds and returns no entry list.
  - (e) Add V2-5: a mock `stack:up` that changes one unrelated entry → the row FAILs "nothing else changed". The new pre-`chown` baseline must not drop this check.
  - (f) When the phase stops as BLOCKED, every later row still gets a result (BLOCKED, with the cause). The coverage check then sees all 70 ids (`tests/acceptance/M1/common/coverage.mjs:76`).
  - (g) Recommended: after each row, one `HOST_UID` read-mode listing of both volumes and an `lstat` of the three host content folders. A failure stops the phase as BLOCKED and names that row. This catches the next carry-over of the same class, for example a failed `d-owner` restore (`storage-rows.mjs:527`), not only `d-mountpoint`.
  - (h) NIT: the second `@seed` uses `NEEDS['@seed'] = ['a-fresh']` (`storage-rows.mjs:47`). After a failed `a-first-start-resume` it runs on stopped services and records a second failure (as in `A/cmd/186-seed.log`). It should also need `a-first-start-resume`.

### A-SFT-06 — MINOR — the plan must bind one candidate and order the criterion change

- **Where:** `storage-full-round-triage.md:217–223` (§8), `:227` (O-1).
- **Problem and fix:**
  - (a) Bind steps 6 and 7 to one frozen product SHA and one tests tree. Any change after step 6, to product or tests, returns to step 2 and needs a new step 6.
  - (b) P-1a changes a criterion. QA writes tests from criteria (charter §1). Add a step between 1 and 2: Architect revision of `M1.md` (`d-content-folder`, `a-fresh`), its reviews, and Lead acceptance.
  - (c) Make P-3 mandatory in step 2 (A-SFT-02).
  - (d) O-1 needs an owner and a gate: an Architect precision item, closed before M4 conformance (decision matrix, O-1).
  - (e) For R1-A, step 3 names `npm run test:infra` (it runs `infra/scripts/storage-compat.test.mjs:334`, which checks the hash list) and the root `npm run check`.

### A-SFT-07 — NIT — four wording points

- `storage-full-round-triage.md:61`: "The runner stops at the first non-PASS row." The storage phase runs every row (`storage-rows.mjs:79–110`). The round check fails at the first non-PASS row (`coverage.mjs:78`), so the run stops before round 2 and legacy. The effect is right; the wording is not.
- `:84`: "release and lost events carry the holder's command." The emitter of `storage_lock_lost` is not the holder. Write: "the command that the emitting process gave to its own acquire".
- `:167`: V3-R cites only `tests/acceptance/T4a/security.test.ts:25–37`, an authenticated write. The pre-auth login refusal without `Origin` is pinned by `services/cogniate-app/src/app/app.test.ts:123–126`. Cite both, so both negative paths stay pinned after the harness sends `Origin`.
- `:73`: the 2 `storage_lock_cleanup` events also name a command. No effect on the result.

### A-SFT-08 — MINOR — product copies of secret files also exist briefly at the source mode (outside the triage scope)

- **Where:** `infra/scripts/stack-data.mjs:153–154` (legacy backup), `:694–695` (volume backup), `:785` (quarantine copy).
- **Problem:** The product copies each database file, then sets `0600`. The volume database is `0644`, so each copy exists at `0644` for a short time. If the process ends between the copy and the `chmod`, a `0644` copy stays (with no manifest, so not a valid backup). ADR-012 §8 (line 362): the backup "stays outside the checkout, at mode `0600`".
- **Evidence class:** source fact only. No runtime observation. The `0700` parent folder limits the exposure.
- **Fix:** the same pattern as P-3 (exclusive create at `0600`, then the bytes). To keep R1-A minimal, do not add it to the R1-A candidate. Record it for a later bounded product candidate or for M4, by Lead decision. It is not a precondition of the diagnostic.

## 5. Decision matrix

| # | Item (triage ref) | Decision | Reason or condition |
| --- | --- | --- | --- |
| 1 | RC-1 cause: release events have `command: null`; the selector filters on `command` (§3) | **APPROVE** | Verified in `storage-oplock.sh:64`, `:364–387`, and in evidence (87/87). |
| 2 | RC-1 class: "contract mismatch, not a lock release defect" (§3) | **APPROVE** with sharper wording | It is a product nonconformance with ADR-012 §7 line 311. Separately, the selector has an attribution weakness. Both need repair. |
| 3 | Serialization: "supported, not proven compliant" (§3) | **APPROVE** | `A/cmd/59-a-serialize-up.log`: wait 11:32:14.041Z (owner `79dc99c4…`), acquire 11:32:15.044Z (`waitedMs` 1005), check pass 11:32:16.117Z. Order supports serialization. It proves nothing about the log contract. No runtime credit. |
| 4 | Log race analysis (§3) | **APPROVE** | `appendFileSync` before exit (`storage-oplock.sh:63–72`); the row reads after `await backup.done`. |
| 5 | **R1-A** product conformance (§3, line 84) | **APPROVE — required** | Scope in §6.1. It closes a required-field failure. Its cost is not a reason to defer. |
| 6 | **R1-B / P-2a** `command` nullable on release and lost (line 85) | **REJECT** | Unjustified requirement regression. The field list states nullability per field, and `command` is required. The holder knows its command at release; the `null` is an omission at `storage-oplock.sh:386`, not a constraint. A `null` forces operators to join lines by `runId` to see who released. The only gain is convenience (no product candidate, no hash update, no re-review). The defect was visible since `9cdd768`: QA copied a real release line with `"command":null` into `tests/host/storage-rows.selftest.mjs:33`. A late contract change would bless a missed conformance check. |
| 7 | Oracle steps 1–5 (lines 88–92) | **APPROVE with changes** | A-SFT-04. Required in both paths: `runId` attribution is better whatever the schema decision. |
| 8 | RC-1 "not acceptable" list (line 94) | **APPROVE** | Each listed shortcut would hide the failure or change the criterion. |
| 9 | V1-1, V1-2, V1-4 | **APPROVE** | Each has one discriminator. |
| 10 | V1-3 | **CHANGES** | No observable result (A-SFT-04). |
| 11 | V1-5 (product) | **APPROVE**, extended | Also the `storage_lock_lost` path and the `TERM` trap path (§6.1). |
| 12 | V1-6 (new) | **REQUIRED** | Wrong-run acquire selection (A-SFT-04). |
| 13 | V1-R | **APPROVE** + clock rule | A-SFT-04 (c). |
| 14 | RC-2 cause and class: harness (§4) | **APPROVE** | Verified (§3 of this report). |
| 15 | RC-2 cascade, 47 rows (§4) | **APPROVE** | 7 + 1 + 1 + 38, consistent with `NEEDS` (`storage-rows.mjs:45–70`) and the QA diagnosis. |
| 16 | §4.1 in-volume mountpoint versus host bind | **APPROVE** | Fixture mounts only volumes at `/v/<vol>`; the maintenance entry is relative to `/check`, with the host bind at `/content/packages` (`compose.yaml:391–401`). The Canvas candidate cause (host folder) is excluded. |
| 17 | §4.2 `a-first-start-resume` assessment | **APPROVE** | The `source_unreadable` refusal is fail-closed (ADR-012 §9 step 1). Its own result is unknown. |
| 18 | RC-2 smallest repair (1)–(5) (line 118) | **APPROVE with changes** | A-SFT-05 (a), (b), (f). `listRoot` stays strict; quarantine stays fail-closed. |
| 19 | RC-2 "not acceptable" list (line 119) | **APPROVE** | |
| 20 | V2-1 to V2-4 | **APPROVE with changes** | A-SFT-05 (c), (d). |
| 21 | V2-5 (new) | **REQUIRED** | A-SFT-05 (e). |
| 22 | V2-R | **APPROVE** | |
| 23 | Per-row isolation guard (new) | **RECOMMENDED** | A-SFT-05 (g). |
| 24 | RC-3 cause and class: harness (§5) | **APPROVE** | The `onRequest` hook runs before body and session (`server.ts:137`, `:145`), so the 403 says nothing about the password, the database or a session. |
| 25 | RC-3 repair: `Origin` = lane `PUBLIC_APP_URL` on every non-GET of `portal()` and `app()` (line 159) | **APPROVE** | Matches `WRITE_METHODS` (`server.ts:82`) and the acceptance helper (`tests/acceptance/lib/app.ts:62`). |
| 26 | RC-3 "not acceptable" list (line 160) | **APPROVE** | Exact-origin rule and product negative coverage stay. |
| 27 | V3-1, V3-2 | **APPROVE** | They catch a missing and a wrong origin. |
| 28 | V3-R | **APPROVE** + citation | A-SFT-07 (pre-auth unit test). |
| 29 | N-1: RC-2 and RC-3 in one freeze | **APPROVE**, extended | All three repairs (and P-3) go into one frozen candidate. |
| 30 | N-2: manual parent move is a possible, unmeasured hazard | **APPROVE** | The triage does not claim a failure. It correctly finds that the accepted row asks for a start in a case that ADR-012 §15 excludes. |
| 31 | **P-1a** | **APPROVE with conditions** | A-SFT-03 fix 1–4. This aligns the criterion with the design. It is not a weakening to gain PASS, if the text says so. |
| 32 | **P-1b** and D-1 | **REJECT as written** | A-SFT-03 (d). D-1 is optional and gives information only. |
| 33 | N-3 clock domains | **APPROVE** + rule | A-SFT-04 (c). |
| 34 | N-4 never-run rows | **APPROVE** | Their result stays unknown. |
| 35 | §7 deviation statement | **APPROVE** | The post-run correction at 11:47:11.753Z does not make the run compliant. The deviation stands. |
| 36 | **P-3** bullets 1–3 | **APPROVE the rule; CHANGES to scope and controls; mandatory** | A-SFT-02. |
| 37 | V4-1 to V4-3 | **CHANGES** | A-SFT-02. |
| 38 | §8 plan, steps 1–7 | **APPROVE the structure; CHANGES** | A-SFT-01, A-SFT-06. |
| 39 | O-1 ADR §4 text precision | **APPROVE the class; owner and gate required** | ADR-012 line 101 says `report` and `mark-started` drop privilege at once. `stack:up` runs `report` before the preflight (§10 step 3). `readFolder` reads each subfolder to test emptiness (`sqlite-lock-probe.mjs:76–80`), and `report` reads as root before it drops (`:567`, `:573`). `d-mountpoint` (`M1.md:252`) needs `stack:up` to pass on root-owned `0700` mountpoints. So literal compliance would break an accepted row. The ADR text must change, not the product. Close it before M4. |
| 40 | Accepted historical deferrals (B-BM-01, A-SOR-01/B-SOR-01, post-reset build-request coverage, A-T9-C01; closed B-SI-07) | **Unchanged** | No new evidence in this triage changes their severity. |

## 6. Smallest safe implementation scope

### 6.1 Backend Author (R1-A only)

| File | Change |
| --- | --- |
| `infra/scripts/storage-oplock.sh` | In `storage_lock_acquire` (`:364–377`), keep the command, for example `STORAGE_LOCK_COMMAND="$command"`. In `storage_lock_release` (`:383–387`), pass `--command "$STORAGE_LOCK_COMMAND"`. For uniformity, also in `storage_lock_add_container` (`:379–381`; it writes no event). No change to the event shape, the lock algorithm, `release()` or any other function. |
| `infra/compat/storage-compat.sha256` | The new SHA-256 of `storage-oplock.sh` (line 4), in the same commit (ADR-012 §12). |
| `infra/scripts/storage-oplock.test.mjs` | Assert values, not only keys (`:69`, `:85`): on the `run --` path, `released.command === acquired.command === record.command`; in the lost test (`:195`), `lost.command === 'test-lost'`; in the `TERM` test (`:207`), `released.command === 'test-term'`; every event of every test has a non-empty string `command`. |
| `infra/scripts/storage-compat.test.mjs` (optional) | The released event of the compatibility `run` names the same command as its acquire (`:145`, `:217`). |

No ADR change. No other product file. Author checks: `npm run test:infra` and the root `npm run check`. Two blind source reviews. The new candidate needs fresh runtime evidence for every phase; `j-migration` and `j-snapshot` use the new lock-helper hash through the old-build route.

### 6.2 Independent common QA (`tests/**` only)

| File | Change |
| --- | --- |
| `tests/host/storage-rows.mjs` | `a-serialize`: run-bound identity, `runId` release selection, schema step, saved output, fail-closed clock compare (A-SFT-04). `d-mountpoint`: full listing before the `chown`, `lstat`-only planted-state check, real `stack:up`, full listing after, `finally` under §11 write mode, phase stop as BLOCKED (A-SFT-05). After P-1a acceptance only: `d-content-folder` deletes the two children and keeps `P`; `a-fresh` asserts `P` absent first (A-SFT-03). The runner gives every later row a BLOCKED result after a phase stop. Recommended: the per-row isolation guard and the second `@seed` need. P-3 sites: `storagePaths`, `copyCredentials`, the `cpSync` copies. |
| `tests/host/storage-fixture-script.mjs` | One metadata operation (`lstat` of named entries, no `readdir`). P-3 helpers in `stash`, `copyOut`, `logicalRead`; `unstash` and `copy` set the recorded or planted mode. `listRoot` unchanged. |
| `tests/host/storage-lane.mjs` | `Origin` on every non-GET of `portal()` and `app()`. `backupLogical` through the P-3 helper. Script mode `0500`, or a reviewed scan exception. |
| `tests/host/storage-oracle.mjs`, `tests/host/m1-migration.mjs` | P-3 helper at `:238` and `:218`. |
| Self-tests | V1-1 to V1-6, V2-1 to V2-5, V3-1, V3-2, V4-1 (each site), V4-3 (positive and negative), the source-inventory check, and a mock-lane dry run of the full `SEQUENCE`, `NEEDS` and every `finally`. |

### 6.3 Architect

- P-1a text in `M1.md` (`d-content-folder` second case; `a-fresh`), with the §15 Limit reason (A-SFT-03).
- O-1: one ADR-012 §4 sentence: `report` and `mark-started` may read as root, read only, before they drop privilege, because §10 step 3 runs `report` before the preflight can fix a root-made mountpoint. Gate: before M4.
- Triage revision 3 for A-SFT-01 to A-SFT-07.

## 7. Coverage map after the repairs

| Rows | Repair that unblocks them | Runtime evidence still needed |
| --- | --- | --- |
| `a-serialize` | R1-A + oracle repair | V1-R |
| `d-mountpoint` | RC-2 | V2-R |
| `d-content-folder` | RC-2 + P-1a | first half refusal; children made `0700` and start |
| `a-fresh` | P-1a precondition | `P` absent before, `0700` after |
| `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`, `f-originals-back` | RC-2 + P-3 | each refusal and "originals back" |
| `a-first-start-resume`, `@seed`, `e-not-same-import` | RC-2 | both quarantines exit 0 with `storage_quarantine_copy` |
| `@backup-B`, `@post-B` and the 37 rows that need them | RC-2 + RC-3 | platform 201 and connection 201 at each marker write |
| `e-old-schema`, `e-content-missing` | RC-3 + same-round migration handoff (A-SFT-01) | sign-in 204, v10 platform and connection listed, migration names |
| all 70 storage rows | P-3 per-row scan; recommended isolation guard | zero scan hits; no `EACCES`; no `source_unreadable`; zero `csrf_rejected` |
| `c-host-negative` | none | the same result in both rounds |
| the other 418 rows | none (harness unchanged) | full rerun on the new candidate |

## 8. Plan order that I can approve

1. Lead decisions: R1-A (R1-B rejected), P-1a, P-3 as mandatory, and the diagnostic form (A-SFT-01).
2. Architect: triage revision 3; `M1.md` P-1a text; reviews; Lead acceptance.
3. QA and Author, host only: the repairs of §6, every control with its mutation, the mock-lane dry run; Author host checks.
4. Two blind source reviews of the harness diff and of the product diff.
5. One frozen candidate (product SHA and tests tree).
6. Diagnostic, own grant, zero credit: `migration` phase, then all 70 `storage` rows, one handoff; fresh G1, W1–W3, ownership record, strict W4, cleanup and scans. Any failure returns to triage. No silent rerun, no waiver.
7. On the same candidate: two complete 488-row rounds with the same per-row results, all 12 legacy groups, strict W4, cleanup and scans; then fresh M2 and T7.

## 9. What this review does not claim

- No runtime result, no PASS, no retrospective green. The full result at `aaa823b` stays FAIL (438 PASS, 50 FAIL).
- No claim that the rename case of N-2 fails or passes. It is unmeasured.
- No claim that the 38 never-run rows, the bodies of the EACCES rows, or `e-old-schema` after sign-in pass. Their result is unknown.
- All 32 live LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. No push or main merge is implied.
