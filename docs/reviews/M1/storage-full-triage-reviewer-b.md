Verdict: CHANGES_REQUESTED
Round: 1

# Storage full-round triage — Reviewer-B design review

Reviewer: Reviewer-B (lens: simplicity, operability, test quality). Claude Code Opus 5.5, xhigh, no subworkers. Task `task_a574d344c4aa`, dispatch `ctx_1efdadcf9b2c`, run `run_ebe671ad72a9`. Date: 2026-10-21.

Blind review: I did not read the other review of this triage, its worker output, its messages or a summary of it. I read only my own worker inbox.

This is a bounded design review. It gives no acceptance credit and makes no runtime claim. It changes no product, test, architecture, team or evidence file.

## 1. Target, inputs and method

| Item | Value |
| --- | --- |
| Triage report | `docs/architecture/tasks/storage-full-round-triage.md` at commit `2b0081d8c1bcd404c044363d5385693b9e41ae12`, SHA-256 `d0f013ce3b44705f5460c196b834d7c3ea760ae8f68ebc6760bd8a82a10b2597` (I computed it) |
| Product and test candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3`; tests tree `4c7e067feedc644f955afee37806f06e7273dd04` (both resolved with `git rev-parse`) |
| Frozen source `F` | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source`: `HEAD` = `aaa823b…`, no tracked change |
| Normative text | `docs/team/charter.md`; `docs/team/multi-lms-plan.md` (current checkpoint, B-SI-07 lines 2480–2500); `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` revision 3.3 with proposed 3.4 and 3.5 (§4, §7, §8, §9, §10, §11, §15); `docs/architecture/tasks/M1.md` lines 222–253 and 265–269; `docs/architecture/tasks/M3.md:93`; `docs/architecture/tasks/storage-reset-parent-repair.md` §1–§3 |
| Independent evidence (input, not a verdict) | Common QA `docs/reviews/M1/qa.md` at `ef787d1` (round-1 result, diagnosis summary, observed permissions); Canvas QA `docs/reviews/M1/qa-canvas.md` §19.3 at `fcb1041` |

Method: host-only reads of source (`git show aaa823b:<path>`), evidence files and file metadata. No Docker or Compose command, no product or test run, no reproduction, no mode change, no deletion, no live call. I read private logs only for event names, `command` nullness, run ids, codes and counts. This file has no secret value.

Independent checks that I did:
- The 12 source files of triage §1 hash-equal `git show aaa823b:<path>` (for example `tests/host/storage-rows.mjs` `c94b0ad6…`, `infra/scripts/storage-oplock.sh` `1d2be154…`).
- The evidence files `A/summary.json` (`81214d35…`), `A/m1-case-results.json` (`e3a4f381…`), `A/cmd/59-a-serialize-up.log` (`1c498b3c…`), `A/cmd/131-fixture-list.log` (`fae55fd7…`) and `A/service-logs/cogniate-app.jsonl` (`389ff661…`) equal the triage table.
- Lock events in `A/cmd/*.log` and `A/service-logs/storage-lock.jsonl`: 87 `storage_lock_released`, all `"command": null`; 86 acquired, 3 wait, 3 refused, 3 reclaimed and 2 cleanup events, all with a command string. In `59-a-serialize-up.log`, the `storage_lock_wait` owner is run `79dc99c4…` with command `stack:data-backup`.
- `131-fixture-list.log` has `EACCES: permission denied, scandir '/v/appdb/packages'`. The fixture container mounts only the two lane volumes (`tests/host/storage-docker.mjs:125–131`).
- `A/service-logs/cogniate-app.jsonl` has one `csrf_rejected` line.
- Metadata of the storage private root `P8` (`stat` only): `bin/storage-fixture-script.mjs` is `-r-xr-xr-x`; `out/content-target-3d51…/qa.txt` is `-rw-r--r--`; every other regular file is `-rw-------` (the hold copy after the Lead-authorized correction, the backups, the quarantine copy, the d-symlink target).

## 2. Summary

- The three causes are proven, and the classifications are right. I approve RC-1, RC-2 and RC-3 as causes.
- RC-1: the product must carry `command` (R1-A). The contract change P-2a (R1-B) is an unjustified requirement regression. I reject it. Section 5 gives the exact Author scope.
- RC-3: the repair is approved as written.
- RC-2: the repair is right in direction. It needs a defined phase stop and stronger controls (B-SFT-06).
- P-1: P-1a is the minimum sound correction, with conditions (B-SFT-04). P-1b is not a good gate (B-SFT-05).
- P-3: the creation rule is right. The per-row scan conflicts with two existing harness files and would FAIL every row (B-SFT-01). Its copy-site list is incomplete (B-SFT-08), and its controls depend on the umask (B-SFT-09).
- Plan: a storage-only run cannot reach `e-old-schema` and `e-content-missing`, because they need the migration phase's handoff (B-SFT-02).
- Four MAJOR findings are in the verification and coverage design, not in the causes. So the verdict is CHANGES_REQUESTED.

## 3. Findings

Evidence class: **demonstrated** = shown by source or evidence. **Unmeasured** = a hypothesis that no run has tested. No finding below claims a runtime result.

### B-SFT-01 — MAJOR — P-3 per-row scan conflicts with QA's own non-secret files

- File: `docs/architecture/tasks/storage-full-round-triage.md:206`; `tests/host/storage-lane.mjs:46`; `tests/host/storage-rows.mjs:558`.
- Problem: the scan FAILs a row for "a regular file with any group or other bit" in the private root. The harness itself makes two such files, so as written every scan FAILs, or an implementer adds an exemption that nobody reviewed.
- Evidence (demonstrated): `boot()` copies the QA script and sets mode `0555` (`storage-lane.mjs:46`). `d-content-folder` writes the marker `qa.txt` without a mode (`storage-rows.mjs:558`), so it is `0644` under umask 022. Both files exist with these modes in `P8` now. Common QA's permission table lists `qa.txt`.
- Fix:
  - Scan `out/`, `backups/` and `quarantine/` completely, with no name exemption.
  - For `bin/`: assert that it holds exactly one entry, the QA script, with the SHA-256 that `boot()` records (`scriptSha`). Keep its mode. It is not a copy of private data. (A change to `0500` is possible, but this review did not measure how root and `HOST_UID` fixture containers read such a bind on Docker Desktop.)
  - Write every QA marker and scratch file with `{ mode: 0o600, flag: 'wx' }`, as `d-symlink` does (`storage-rows.mjs:502`).
  - Scan after every `SEQUENCE` step, also the `@` fixtures. Else a fixture's file is charged to the next row.
  - On a hit: record path, mode, size, SHA-256, device and inode, and FAIL that step. The FAIL stays. I recommend that the harness then sets `0600` through an `O_NOFOLLOW` descriptor (the method of `permission-correction-hold-db.json`), because a kept `0644` copy only extends the exposure; the record is the evidence. The Lead decides whether to pre-authorize that correction.
  - Add V4-4: a planted `0555` non-secret file in `out/` FAILs; a second file in `bin/` FAILs.

### B-SFT-02 — MAJOR — The storage-only diagnostic cannot run `e-old-schema` and `e-content-missing`

- File: triage `:222`; `tests/host/storage-rows.mjs:1023–1025`; `tests/host/run-m1.mjs:148–156`, `:357–361`.
- Problem: `@old-schema-setup` needs this round's AC-M1-23 backup and clone from the migration phase. A `--phase storage` run alone has no handoff file. So the fixture is BLOCKED, and both rows do not run.
- Evidence (demonstrated): `if (!h?.m123Backup || !h?.m123Clone) throw new StorageBlocked(…)`. Only the `full` path gives `QA_M1_HANDOFF_FILE` to the migration and storage children.
- Effect: step 6 would not run the `e-old-schema` sign-in (the RC-3 row and the main V3-R check) or the restore half of `e-content-missing`, which never ran. Their first result would come in the full rounds. Step 6 exists to prevent this.
- Fix: in the same diagnostic grant and window, run `--phase migration`, then `--phase storage`, on the same frozen candidate, with one `QA_M1_HANDOFF_FILE`. Neither phase gives credit. Before the grant, QA shows host-only (mock or dry run) that a standalone migration child writes the handoff. If the Lead does not grant the migration phase, the plan must say that these two rows are BLOCKED by design in step 6 and that their first result comes in step 7. I recommend the first option.

### B-SFT-03 — MAJOR — The V1 controls miss two tempting weaker `a-serialize` oracles

- File: triage `:88–90`, `:98–104`; `tests/host/storage-rows.mjs:398–402`, `:407`; `tests/host/storage-oracle.mjs:279–285`.
- Problem (a), schema step: V1-1 uses only `command: null`. A check "the command is a non-empty string" passes V1-1 to V1-4. Step 3 of the triage asks for equality with the acquire command, but no control proves it.
- Problem (b), identity step: "from its `storage_lock_acquired` event" does not say which event. The current wait loop already uses `.some()` over the whole lane log (`:399`). A whole-log or first-match selector picks an earlier backup run W when the log has one. No V1 control has an earlier backup pair. The frozen `SEQUENCE` has no backup before `a-serialize`, so such a selector passes today only because of the order. The wait can then also end early, so `stack:up` can start before the backup holds the lock, and the row tests nothing.
- Evidence (demonstrated for the control set; no runtime defect claimed): the cited source.
- Fix:
  - Before the spawn, take the length of the lock log. The backup's acquire is the first `storage_lock_acquired` after that offset whose `pgid` equals `backup.pgid`. (`spawnGroup` starts the backup as its own group, `storage-oracle.mjs:279–285`. The guarded script inherits that group unless it starts a new one; ADR-012 §7 "Process ownership" relies on the caller's group in the same way. QA proves the match in a host-only control and records it in V1-R.) The lock-record path of the wait uses the same `pgid` test.
  - Cross-check: when `stack:up` logs `storage_lock_wait`, its `owner.runId` and `owner.pgid` equal the selected run.
  - V1-1b: release X with `command: "stack:up"` (not null, wrong) → the schema FAIL. Detects a non-null-only check.
  - V1-6: an earlier pair W (backup command, before the offset, released before the service `StartedAt`), then X, released after a service `StartedAt` → FAIL on time. Detects a whole-log or first-match selector.
  - V1-7: with W in the log before the spawn, the wait does not end until X appears. Detects the `.some()` wait.

### B-SFT-04 — MAJOR — P-1a is right in direction but can lose coverage silently

- File: triage `:185`; `docs/architecture/tasks/M1.md:230`, `:253`; `tests/host/storage-rows.mjs:571–579`; ADR-012 line 734.
- Problem (a): "a-fresh adds one precondition **record**". A record is a note. If `P` exists before `a-fresh`, `a-fresh` still PASSes, and the moved assertion ("three folders absent → created `0700` → starts") has no result anywhere.
- Problem (b): P-1a does not say how the two children become absent. The measured topology R3 is "delete and make only the child again" (`storage-reset-parent-repair.md` §1). A rename of the bound children to a hold folder is another operation: the moved inode stays alive. It is not measured.
- Problem (c): no check proves that `P` stays the same folder.
- Evidence: the text conflict is demonstrated. M1 line 253 asks for a start after the harness moves `P` by hand (`storage-rows.mjs:574`). ADR-012 §15 Limit (line 734) puts "a deletion or a move of `P` by hand" outside the guarantee. The runtime result of that case is unmeasured.
- Fix (Architect text first, then QA):
  - `a-fresh`: before its `stack:up`, `lstat` of `P`, `P/packages` and `P/uploads` gives `ENOENT`. Else `a-fresh` is BLOCKED (lane not fresh) with that cause, never PASS. After the start: the three existing checks.
  - `d-content-folder`, second case: record `P`'s device, inode, owner and mode. Record QA's listing of the two children (names, sizes, SHA-256) as evidence. Delete the two children; do not rename them. Both `lstat` give `ENOENT`. `stack:up` exits 0, and both services are healthy. Both children are directories of the host user with mode `0700`. `P` has the same device and inode, the host user and mode `0700`.
  - M1 states that "`P` absent after an earlier nested bind" is outside the ADR-012 §15 guarantee, so no row covers it. This is a stated limit, not a PASS.
  - No ADR-012 change, no row id or count change. Architect revision, QA, Reviewer-A, Reviewer-B and Lead acceptance come before QA writes the code.
- Why P-1a is the smaller design: after revision 3.4, `stack:reset` keeps `P` empty, and the next `stack:up` makes the two children under the kept `P`. So the P-1a case is the product's real post-reset path. The old case is a hand operation that the ADR does not support. P-1a removes only that unsupported part, and it says so.

### B-SFT-05 — MINOR — If P-1b is chosen, D-1 cannot tell a correct bind from a stale bind

- File: triage `:186`, `:221`.
- Problem: D-1 records only "Docker error or no error". After a rename of `P`, the old inode still exists at the hold path. "No error" does not prove that the container sees the new child. It can see the moved child. That case is worse than an error, because a service then writes into the hold folder.
- Evidence: unmeasured hypothesis. R3b (move of a grandchild → `ENOENT`, no stale view) is a different topology.
- Fix: in each trial, write one unique marker into the new child and another into the moved child. The container must read the new marker and not the old one. Report three outcomes apart: error, correct bind, stale bind. Bind any narrowing of the §15 Limit to the measured host and Docker identities, as gate G-1 does. 20 of 20 correct binds still do not bound the window. I recommend P-1a and no D-1 gate.

### B-SFT-06 — MINOR — The RC-2 phase stop has no mechanism, and V2-4 can pass with a row-only BLOCKED

- File: triage `:118`, `:125`; `tests/host/storage-rows.mjs:79–117` (loop), `:94`, `:530–552`.
- Problem: `StorageBlocked` marks only the row that throws. The `f-*` rows need only `a-fresh` and `@seed`, so they still run after a BLOCKED `d-mountpoint`. That gives the same misattributed cascade that the repair wants to prevent.
- Fix:
  - Add one abort signal to `storagePhase`. On it, the loop records every remaining `SEQUENCE` step as BLOCKED with "phase stopped after `<step>`: `<cause>`", records all 70 rows and returns, so the phase teardown runs.
  - V2-4 asserts the status and cause of every later row and the 70-row count, not only `d-mountpoint`.
  - The same rule applies to the restores of the file and symlink subcases (`:543–552`) and of `d-content-folder`.
  - The `finally` step first makes sure that both services are stopped (write mode needs it), then restores, then lists.
  - V2-5: the root plant has no effect (the `lstat` after the `chown` shows `HOST_UID`) → the row FAILs "precondition not made". Without it, a no-op plant passes the row.
  - V2-1 and V2-2 use a mode-`000` folder. Root can read it, so the control is empty when it runs as root. Each control first proves that a direct `readdirSync` of that folder throws `EACCES`; else the control is BLOCKED.
  - Optional and simpler for the long term: one post-step lane check in the loop (each present volume lists as `HOST_UID`; the `appdb` mountpoints are `HOST_UID:HOST_GID 0700` and empty). It finds carry-over from any row, not only from `d-mountpoint`. It costs one listing per step.

### B-SFT-07 — MINOR — Runtime absence checks read logs that the phase deletes

- File: triage `:77`, `:127`, `:167`; `tests/host/core.mjs:368–376`; `tests/host/storage-rows.mjs:1004`, `:1027`.
- Problem: V3-R ("zero `csrf_rejected` lines") reads `infra/.logs`. `stack:reset` deletes that folder (three times in `b-sequence`, once in `@old-schema-setup`). `collectLogs` copies it only at the end. So V3-R covers only the time after the last reset, and the `@backup-B` and `@post-B` writes come before it. An absence check over a partial log passes for the wrong reason. Triage §3 "Evidence limit" names the same loss for the lock log.
- Fix: before each product `stack:reset` and at the phase end, append `infra/.logs/*.jsonl` to the phase artifacts (redacted like other evidence). Evaluate V1-R, V2-R and V3-R over that archive and the final copy, and state the window in each result. (`source_unreadable` is also in the command logs `cmd/*.log`, so that part of V2-R is already complete.)

### B-SFT-08 — MINOR — P-3 names three copy sites; the frozen harness has more

- File: triage `:200`, `:204`, `:209`; `tests/host/storage-rows.mjs:687`, `:707`, `:709`, `:992`, `:1309`, `:1346`; `tests/host/storage-lane.mjs:224`; `tests/host/storage-fixture-script.mjs:115`.
- Problem: the rule says "every QA copy", but the cause and V4-1 name only `stash`, `copyOut` and `place`. Other QA copies of databases or secret files:
  - `copyCredentials` copies four secret files, then sets `0600` (`:1346`): a copy-then-`chmod` window when a source is wider.
  - `storagePaths` and `backupLogical` copy databases into host scratch folders (`:1309`; `storage-lane.mjs:224`).
  - `cpSync` copies whole backups for `g-damaged`, `h-nomanifest` and `h-old-manifest` (`:687`, `:707`, `:709`, `:992`).
  - `logicalRead` copies databases inside the fixture container (`storage-fixture-script.mjs:115`).
  These copies keep the source mode. The product backups are `0600` today, so most of them are `0600` by chance, not by design.
- Fix: one private-copy helper (exclusive create with mode `0600`, write, `fsync`, hash check) for every QA copy of a database, sidecar, identity, journal, manifest or secret file. One "into volume" helper that sets the recorded original mode. A host-only source check (a selftest) FAILs on `copyFileSync` or `cpSync` in `tests/host/storage-*.mjs` outside the two helpers; each exception is listed in that check with its reason, so review sees it. State whether the migration and snapshot private folders are in scope (QA found `0600` files there, but not "from creation").

### B-SFT-09 — MINOR — V4 controls depend on the umask, and V4-2 names a compare that does not exist

- File: triage `:209–211`; `tests/host/storage-rows.mjs:1130`; `tests/host/storage-fixture-script.mjs:83–98`.
- Problem (a): under umask 077 (QA prepares with it), a mutation that creates a copy without an explicit mode makes `0600`. V4-1 and V4-3 then pass.
- Problem (b): V4-2 says "fails the listing compare". `identityCase` compares file sets (size and SHA-256). `fileset` has no mode. A `0600` return into the volume passes it.
- Fix: each V4 control sets umask 022 (or 000) itself and asserts it. V4-1 checks the mode at creation: the open call is exclusive with mode `0600`, and `fstat` on the descriptor before the first write shows `0600`. V4-2 compares the modes of the returned entries with QA's listing before the row. Add that check to `identityCase` and to the `d-symlink` unstash.

### B-SFT-10 — MINOR — R1-A wording is ambiguous for `storage_lock_lost`

- File: triage `:84`; `infra/scripts/storage-oplock.sh:170–175`, `:194`, `:364–387`.
- Problem: "release and lost events carry the holder's command". For `lost`, the lock record belongs to another owner. An implementation that reads `command` from the current record logs the other owner's command.
- Fix: `command` is always this process's own command from acquire. Section 5 gives the exact change and test.

### B-SFT-11 — MINOR — O-1 must be closed before acceptance, not "later"

- File: triage `:227`; ADR-012 line 101; `infra/scripts/sqlite-lock-probe.mjs:567`, `:573`.
- Problem: the `d-mountpoint` product path needs `report` to read root-owned mountpoints as root before it drops privilege. ADR-012 §4 says that `report` drops privilege "at once". A PASS then depends on behavior that the literal text excludes.
- Fix: the Architect's precision text, reviewed, before the Lead's acceptance decision on the full rounds. No product change.

### B-SFT-12 — NIT — Plan precision

- File: triage `:213–223`.
- Add the Architect revision and its reviews for P-1a between step 1 and step 2.
- Step 3 is required (R1-B is rejected). It is not "R1-A only".
- Steps 6 and 7 run on one frozen candidate (product and tests). A change after step 6 repeats step 6. Fresh M2 and T7 use the same candidate, because R1-A changes a file that every `stack:up` uses.
- V3-R's product control (`tests/acceptance/T4a/security.test.ts:30–34`) runs in the step-7 legacy T4a group (`M3.md:93`), not in step 6.
- Optional for V1-4: when the margin between the release time and `StartedAt` is not larger than the measured engine-to-host offset, the row FAILs "clock margin too small". It does not PASS.

## 4. Decision matrix

`APPROVE` = accepted as written. `APPROVE+C` = accepted with the named conditions, which are required. `REJECT` = not accepted.

| Item (triage section) | Decision | Reason or condition |
| --- | --- | --- |
| RC-1 cause and class (§3): release events have `command: null`; contract mismatch; not a lock defect | APPROVE | `storage-oplock.sh:383–387` passes no `--command`; `:194` makes it `null`; 87 of 87 events. ADR-012 §7 marks only `owner`, `reason` and `container` nullable. |
| RC-1 serialization statement: order supports serialization, does not prove the schema | APPROVE | `59-a-serialize-up.log`: wait on run `79dc99c4…`, acquire after 1005 ms. Ordering evidence is not log-contract evidence. |
| R1-A product conformance | APPROVE+C | Required. Exact scope in §5. B-SFT-10 wording. |
| R1-B / P-2a: allow `command: null` on `released` and `lost` | REJECT | See §4.1. |
| RC-1 oracle steps 1–5 | APPROVE+C | B-SFT-03: identity by `pgid` and log offset; equality, not non-null; the wait uses the same identity. |
| V1-1 to V1-4 | APPROVE+C | Add V1-1b, V1-6 and V1-7 (B-SFT-03). |
| V1-5 | APPROVE+C | Add the `lost` case (§5). |
| V1-R | APPROVE+C | Evaluate over complete logs (B-SFT-07). |
| RC-1 "Not acceptable" list | APPROVE | — |
| RC-2 cause and class (§4) | APPROVE | `storage-rows.mjs:532–533` plants root, then lists as `501:20`; `EACCES` on `/v/appdb/packages`; no `finally`. |
| §4.1 in-volume mountpoint versus host bind | APPROVE | The fixture mounts only the lane volumes (`storage-docker.mjs:125–131`). This answers the open Canvas QA hypothesis (`qa-canvas.md` §19.3). |
| §4.2 `a-first-start-resume`: correct fail-closed refusal; `FIRST_START` result unknown | APPROVE | ADR-012 §9 step 1 and B-SI-07. No product change. |
| Cascade count (§4): 7 + 1 + 1 + 38 = 47; total 1 + 47 + 2 = 50 | APPROVE | Matches the QA diagnosis. |
| RC-2 repair steps 1–5 | APPROVE+C | B-SFT-06: defined phase stop; services stopped before restore; all three subcases; V2-5. Keep `listRoot` strict and the quarantine fail-closed. |
| RC-2 "Not acceptable" list | APPROVE | — |
| V2-1 to V2-4 | APPROVE+C | Non-root precondition for V2-1 and V2-2; V2-4 checks every later row (B-SFT-06). |
| V2-R | APPROVE+C | Complete logs (B-SFT-07). |
| RC-3 cause and class (§5) | APPROVE | `server.ts:135–143` refuses a write without `Origin` before the session hook; `storage-lane.mjs:168–185` sends none; one `csrf_rejected` line. |
| RC-3 repair (`Origin` = lane `PUBLIC_APP_URL` on non-GET in `portal()` and `app()`) | APPROVE | Smallest change. Product CSRF rule and exact-origin requirement stay. |
| RC-3 "Not acceptable" list | APPROVE | — |
| V3-1, V3-2 | APPROVE | They detect a missing and a wrong `Origin`. |
| V3-R | APPROVE+C | Complete app logs (B-SFT-07); the T4a negative runs in step 7 (B-SFT-12). |
| N-1: ship RC-2 and RC-3 together | APPROVE | `writeMarkers` uses `portal()` (`storage-lane.mjs:187–199`). |
| N-2 statement (text conflict; runtime unmeasured) | APPROVE | It does not claim a failure. |
| P-1a | APPROVE+C | B-SFT-04 conditions. |
| P-1b and D-1 as a gate | REJECT | B-SFT-05. If the Lead still selects it, D-1 needs a content-identity check and a bounded claim. |
| N-3 clock domains | APPROVE | Low risk; optional margin rule (B-SFT-12). |
| N-4 rows never run | APPROVE | Their result stays unknown. |
| §7 deviation: noncompliant during the run; the post-run correction does not cure it | APPROVE | Matches QA and the Lead record. |
| P-3 bullet 1: `0600` from creation | APPROVE+C | Every copy site, one helper, source check (B-SFT-08). |
| P-3 bullet 2: return into a volume with the recorded mode | APPROVE+C | An explicit mode compare (B-SFT-09). |
| P-3 bullet 3: per-row private scan | REJECT as written | Scope conflict and step granularity (B-SFT-01). Approve the revised scan of B-SFT-01. |
| V4-1 to V4-3 | APPROVE+C | Pinned umask, creation-time check, V4-4 (B-SFT-01, B-SFT-09). |
| §8 step 1 Lead decisions | APPROVE+C | Add the Architect revision for P-1a (B-SFT-12). |
| §8 step 2 host-only QA controls and mock dry run | APPROVE+C | With the added controls of this review. |
| §8 step 3 Author host checks | APPROVE+C | Required, not conditional. |
| §8 step 4 two blind reviews per diff | APPROVE | — |
| §8 step 5 D-1 | REJECT as a gate | B-SFT-05. |
| §8 step 6 storage-only diagnostic (no credit, own grant, fresh lane, G1, W1–W4, scans, cleanup) | APPROVE+C | Add the migration handoff (B-SFT-02), complete logs, the private scan. |
| §8 step 7 full gates | APPROVE+C | Same frozen candidate as step 6. |
| O-1 | APPROVE+C | Close before acceptance (B-SFT-11). |

### 4.1 Why P-2a (R1-B) is a requirement regression

- The approved field list makes `command` a required field. It marks only `owner`, `reason` and `container` as nullable. P-2a would weaken an approved contract only because the product does not meet it.
- Operability: each lock line goes to the command's stdout and to `infra/.logs/storage-lock.jsonl`. `stack:reset` deletes that log. A release line with `command: null` cannot name its command without the matching acquire line, which can be in another output or already gone. This run lost the backup's own lines for the same reason (triage §3).
- `runId` correlation makes the QA oracle exact. It does not replace a field that an operator reads in one line.
- Cost: the harness repairs already need a new frozen candidate, two source reviews, the diagnostic and both full rounds. R1-A adds one small Author diff to that same candidate. The compatibility hash and the `j-migration` and `j-snapshot` evidence rerun in the full rounds anyway.
- No technical reason favors `null`. So the field stays required, and the product must carry it.

## 5. Smallest safe implementation scope

1. **Backend Author (owns `infra/**`; R1-A).** Only these files:
   - `infra/scripts/storage-oplock.sh`: `storage_lock_acquire` keeps its command in a shell variable (for example `STORAGE_LOCK_COMMAND`, set next to `STORAGE_LOCK_RUN_ID`, not exported). `storage_lock_release` passes `--command "$STORAGE_LOCK_COMMAND"`. The JavaScript `release` needs no change, because `ctxOf` reads `--command` (`:194`). `command` is this process's own acquire command for both `storage_lock_released` and `storage_lock_lost`; `owner` keeps the other record for `lost`.
   - `infra/scripts/storage-oplock.test.mjs`: assert the `command` value, not only the keys (today `:85` checks keys only). Cases: `run -- true` gives acquired and released lines with the same command; a planted other record before release gives `storage_lock_lost` with the own command and the other record in `owner`. Mutation check: without `--command` on release, the test FAILs.
   - `infra/compat/storage-compat.sha256`: the new hash of `infra/scripts/storage-oplock.sh` (ADR-012 §12), in the same commit.
   - Self-check: `npm run check` and the infrastructure tests. No ADR, M1, `stack-data` or other product change.
2. **Architect (only if the Lead selects P-1a).** `docs/architecture/tasks/M1.md` text for `a-fresh` (the `ENOENT` precondition as an assertion, BLOCKED when not met) and for `d-content-folder` (the second case of B-SFT-04, and the stated limit). The O-1 precision text in ADR-012 §4. No other ADR text, row, id or count change.
3. **Independent common QA (owns `tests/**`).**
   - `tests/host/storage-lane.mjs`: `Origin` on non-GET in `portal()` and `app()`; the `bin/` rule of B-SFT-01.
   - `tests/host/storage-rows.mjs`: `a-serialize` (identity by `pgid` and log offset, equality check, saved backup stdout and stderr, both clocks); `d-mountpoint` (before listing, root plant, `lstat`-only check, `stack:up`, full listing, `finally` restore, phase stop); `d-content-folder` and `a-fresh` per the accepted P-1 text; `qa.txt` at `0600`; the log archive before each reset; the private scan after each step; the abort signal in `storagePhase`.
   - `tests/host/storage-fixture-script.mjs`: the `lstat`-only op (no `readdir`); the private-copy helper; the "into volume" helper with the recorded mode.
   - `tests/host/storage-oracle.mjs`: `LegacyFixtures.place` through the helper.
   - Selftests: V1-1 to V1-7, V2-1 to V2-5, V3-1, V3-2, V4-1 to V4-4 and the source check of B-SFT-08. Each control has its mutation and shows that the mutation fails it. Then the mock-lane dry run of the whole `SEQUENCE`.
4. **Reviews.** Two blind source reviews of the QA diff and two of the Author diff, on the frozen candidate.
5. **Runtime, separately granted.** Step 6 (migration as handoff producer, then all 70 storage rows; no credit), then step 7 (two complete 488-row rounds with the same result per row, all 12 legacy groups, fresh M2 and T7) on the same frozen candidate. Strict W4, cleanup and scans in each window.

## 6. Coverage map after the repairs

| Group | Rows | Repair | First runtime check | Acceptance |
| --- | --- | --- | --- | --- |
| RC-1 | `a-serialize` (1) | R1-A and the oracle | step 6: V1-R | step 7, both rounds |
| RC-2 direct | `d-mountpoint`, `d-content-folder`, five `f-*` (7) | fixture sequence and restore | step 6: V2-R, no `EACCES` in any listing | step 7 |
| RC-2 prerequisite | `f-originals-back` (1) | follows the five `f-*` | step 6 | step 7 |
| RC-2 carried state | `a-first-start-resume` (1) | the restored mountpoints | step 6: both quarantines exit 0 | step 7 |
| Never run behind `@seed` and `@backup-B` | the 38 rows of triage §4 | RC-2 and RC-3 together | step 6 (first runtime result of 37 of them in any round) | step 7 |
| RC-3 | `e-old-schema`, `e-content-missing` (2) | `Origin` in the helpers | step 6 only with the migration handoff (B-SFT-02) | step 7 |
| Passed in round 1 | the other 20 rows | none; R1-A changes a file they use | step 6 (regression) | step 7 |
| P-1a coverage change | `a-fresh` (adds the `P`-absent assertion), `d-content-folder` (kept `P`, deleted children) | Architect text, then QA | step 6 | step 7 |

Total: 1 + 7 + 1 + 1 + 38 + 2 + 20 = 70. No row id or count changes. `c-host-negative` stays the conditional row: PASS or NOT_APPLICABLE, the same in both rounds, never counted as PASS when NOT_APPLICABLE.

Deferred items: B-BM-01, A-SOR-01/B-SOR-01 and the post-reset build-request coverage stay on the M4 deferred list. This evidence does not change their severity.

## 7. Limits

- No runtime result is claimed. The 38 never-run rows, the `FIRST_START` path of `a-first-start-resume` and the copied-password sign-in of `e-old-schema` stay unknown until a storage run.
- The renamed-parent bind behavior (N-2, B-SFT-05) is unmeasured. The R2 evidence is for a deletion.
- I read only metadata of the private root and only event names, codes, counts and run ids in the private logs.
- The full round-1 result on `aaa823b` stays FAIL (438 PASS, 50 FAIL). Round 2 and the legacy groups did not run. Fresh M2 and T7 are pending. All 32 live rows stay UNVERIFIED; local Canvas stays DEFERRED. No push or merge is implied.
- The untracked `pnpm-workspace.yaml` is unchanged.
