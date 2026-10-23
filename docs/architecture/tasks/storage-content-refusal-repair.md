# Storage content refusal repair (ADR-012 revision 3.5)

Owner: Architect (design). Implementation: backend Author. Verification: independent QA. Review: Reviewer-A and Reviewer-B review this brief, [ADR-012](../adr/ADR-012-sqlite-volume-storage.md) revision 3.5 and the implementation together. Status: **proposed, not accepted**. Date: 2026-10-21. Task `task_d4c38a8b5bf7`. Finding: QA-RP-01.

## 1. Facts

| Input | Value |
| --- | --- |
| QA report | `docs/reviews/M1/reset-parent-q1q2-qa.md`, committed at `faa77a2`, SHA-256 `6158c9ea47eb9074e01dc120add81516e48d59919e85e0222b062fccf23c70b5`. Verdict FAIL. Q1 PASS (3 of 3 cycles). Q2 FAIL at `Q2-IMPORT-REFUSAL`. |
| Candidate | `89fb4b48ee388faff3060fe1a161a9f9d064de93`; tests tree `4c7e067feedc644f955afee37806f06e7273dd04`. No product or test change from `89fb4b4` to `faa77a2`. `stack-data.mjs`, `sqlite-lock-probe.mjs`, `stack-data.sh` and `stack-data.test.ts` have no change from `a784522` to `89fb4b4`. |
| Evidence | run root `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-89fb4b48-20261021T0919Z`; `review/evidence-manifest.sha256` (69 files) `06644b10e932d129df5e0645ffee571fa97ad869f49c37ad0724d26fd222b402`; host reproduction results `repro-result.json` `4be9b08f66389c442ac16bfc232f810ff877a2729ae1404b70d4acd4f8472914` and `repro-restore-result.json` `b92030ffada873782fb9566621a55109ad9b947d4189aeaab15dd4df45cecb75` |

Observed (QA report §4, §5):
- The import refused correctly: exit 1, `content_missing`, one `storage_content_check` line with `checked: 1` and the missing folder, and no bind error.
- After the refusal, each new volume held `.storage-journal.json` (mode `0600`, 560 and 565 bytes). The approved oracles `nothingChanged` and `freshVolume` failed for both volumes.
- Host reproduction A (empty target): both journals `rolled_back`, `before: []`, `identityBefore: null`, 560 and 565 bytes. B (control, folder present): exit 0, journals `committed`. C (restore into an `OK` pair): both `committed` journals changed to `rolled_back` with a new `opId`.
- Limits (kept): the runtime journal bytes were not read; `rolled_back` is an inference from the code path, the product message and the exact sizes. One host, one attempt.

Code at `89fb4b4` (read by the Architect after the QA report):
- `main()` runs the §4 volume-side steps (`prepareFolder`) as root for every writer, then drops privilege.
- `volumeRestore()` (`infra/scripts/stack-data.mjs:684–742`): backup validation, target state, source kind, pair rule, then the removal of `.tmp` leftovers (`:734–736`), then `engine.run()`.
- `engine.run()` (`:472–533`): writes `prepared` (lti, then app), stages into `.restore-<opId>/`, then runs the content check on a scratch copy of the staged app database (`:502–504`). On `content_missing`, `cancel()` (`:343–347`) writes `rolled_back`, and the command logs `storage_restore_cancelled` and exits 1.
- Unit test `services/lti-service/src/cli/stack-data.test.ts:344–362` asserts `['rolled_back', 'rolled_back']` after `content_missing` (`:356`). It encodes the conflict.
- [ADR-011 §14](../adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback) (rollback step 2) already lists the content check among the validations that run "before it changes anything". So the intended contract is a check before any change.

QA oracles (tests tree `4c7e067`, read-only):
- A refusal row uses `refusal()` → `assertRefuses` and `assertUnchanged` → `nothingChanged` (`tests/host/storage-rows.mjs:128–133`, `tests/host/storage-oracle.mjs:88–104`). The `e-old-schema` import half also asserts `freshVolume` (`storage-rows.mjs:1061–1066`).
- `e-import-recover` and `g-fresh-target` do not use `freshVolume`. They check their own condition: no identity, no database, no `.restore-*` or `.previous-*`, and (`e-import-recover`) journals `rolled_back` (`storage-rows.mjs:887–896`, `918–930`). So the recovery rows already use the §6 row 13 meaning.

## 2. Decision

Keep the strict refusal contract exactly. Change the product order: the content check moves into step 1, before the first write to a target volume (ADR-012 §8 "Content check", revision 3.5). Then `content_missing` is a normal step-1 refusal, like `pair_mismatch` or a damaged backup, and the existing oracles apply without change.

| Case | `89fb4b4` | Revision 3.5 |
| --- | --- | --- |
| Refusal into absent volumes | Compose makes the volumes; both get a `rolled_back` journal | Compose makes the volumes; the §4 steps prepare them; no journal (§11 item 5 empty `FRESH`) |
| Refusal into an empty `FRESH` target | a `rolled_back` journal is added | listing equal, byte for byte |
| Refusal into a recovered `FRESH` target (terminal `rolled_back` journals) | the journals are rewritten or added, with a new `opId` | listing equal, also the journal bytes |
| Refusal into an `OK` target with `committed` journals | the journals change to `rolled_back` | listing equal, also the journal bytes |
| Output | `storage_content_check`, then `storage_restore_cancelled`, exit 1 | `storage_content_check`, then `storage_refused` with `code: "content_missing"`, exit 1 |
| Folder present | exit 0, one `pass` line | the same |
| Failure or interruption after the first journal write | journaled; verified cancel or rollback; `rolled_back` journals stay | the same (unchanged) |

Two meanings of `FRESH` (ADR-012 §6 and §11 item 5):
- **Empty `FRESH`** (§11 item 5) is the refusal oracle: absent, or no entry other than the empty mountpoints, no journal. A refusal keeps it.
- **§6 state `FRESH`** (row 13) is the product state. It also holds after a verified cancel or rollback, with terminal `rolled_back` journals. The recovery rows `e-import-recover` and `g-fresh-target` check it with their own condition.

Not chosen:

| Option | Reason |
| --- | --- |
| Accept `rolled_back` journals after a refusal (change the oracle or the text) | It weakens the refusal. An `OK` target loses the bytes of its last terminal journal (case C), and an empty target is no longer empty. ADR-011 §14 promises no change. The task forbids it. |
| Remove the journals after the cancel | A crash between the cancel and the removal makes new states. The earlier journal bytes of an `OK` target cannot come back exactly. It changes the recovery table. |
| Stage outside the volumes before the first journal write | A rename across mounts fails (ADR-012 fact M4). It needs a second full copy. |
| A new drill point before the first journal write | Not needed to prove the boundary (§5 U4, §6 H4). It adds interface. |
| The check reads the backup files directly | The backup is a read-only bind, and the rule "never open an original" applies. |

## 3. Assessment: can every validation run before the first target write?

Yes, for every check of the input. Staging stays journaled: a staged copy must be in its own volume (fact M4), and a `.restore-*` folder without a journal is `state_unclassified` after a crash.

| Property | Result with the step-1 check |
| --- | --- |
| Lock | unchanged: `stack-data.sh` holds it for the whole command |
| Read-only backup validation | unchanged; the check only reads the read-only backup bind |
| Scratch copy | kept: in the maintenance container's own writable layer; the check never opens an original. Added: each copy is verified against the manifest, and the scratch folder is removed before the line and before any target write. |
| Same bytes as the swap | yes: the check copy and the staged copy are both verified against the manifest SHA-256; only listed files are copied |
| One `storage_content_check` line | one for each command whose check finishes, written after the cleanup; none after an earlier refusal or a check failure |
| Fail-closed | a check that cannot finish (also a failed cleanup) refuses `content_check_failed` before any target write (exit 1). It never gives a `pass` or a `content_missing` record. Failures after the first journal write keep their paths (cancel, R3, exit 2). |
| Permissions | the check runs after the privilege drop, as today; no root write |
| Crash boundaries | before the first journal write: no journal, `--recover` finds nothing (R0). After it: R1–R6 unchanged. |
| Recovery and idempotence | unchanged; a second `--recover` gives R0 |
| Drills | the same points; a command that step 1 refuses reaches no point |
| `.tmp` leftovers | removed only after the check passed; a refusal keeps them, as the other step-1 refusals do |
| Import and restore success | the same path after the check; one `pass` line |
| Concurrent changes | the verified scratch bytes equal the manifest. The host package folders are checked once, at one point in time, and are not held; there is no atomic snapshot of the backup and the content folders. The check now runs before staging, not after it. A package folder that goes away later is not found (as before). A backup file that changes later fails the staged-copy verification (manifest size and SHA-256): a verified cancel, exit 1, never an accepted restore. |
| Volume preparation | unchanged: the §4 volume-side steps run before step 1 for every writer; on a prepared volume they change nothing (§9) |

## 4. Implementation (backend Author)

| File (only these) | Change |
| --- | --- |
| `infra/scripts/stack-data.mjs` | the content check in step 1 (properties below); `engine.run()` no longer runs it |
| `services/lti-service/src/cli/stack-data.test.ts` | the §5 cases. Replace only the assertion at `:356` (`journalStates(data)` equals `['rolled_back', 'rolled_back']`) with the stricter one: the target tree is equal before and after (names, types, modes, bytes; also journals and identities), and no journal exists. Prepare that target first (as the existing precedence case does), so the tree covers every write. This is the **only** assertion exception. Keep every other assertion. No QA oracle or QA assertion changes. |
| `infra/README.md` | one sentence (line 141): the content check runs before the first journal write; `content_missing` exits 1, writes no journal and changes nothing |

Do not change `sqlite-lock-probe.mjs` (its hash is in `infra/compat/storage-compat.sha256`), `stack-data.sh`, `lib.sh`, `compose.yaml` or `tests/**`.

Required properties (behavior; the Author chooses the code):
1. **Order.** Step 1 is: the backup validation, the target state, the source kind, the pair rule, the content check. Then the removal of `.tmp` leftovers, then the first journal write.
2. **Bytes.** Copy only the app files that the manifest lists (`cogniate-app/cogniate.db` and its listed `-wal`, `-shm`) from the backup into a new scratch folder in the process temp folder (Node `os.tmpdir()`, as today; in the container, its own layer). Verify each copy (size and SHA-256) against the manifest before the database opens. Open the copy read-only.
3. **Cleanup, then one line.** Remove the scratch folder after the query, also after a failure, and before the line and before any target write. Then log exactly one `storage_content_check` line with the existing fields. `opId` is this run's operation id. The engine runs no second check and logs no second line.
4. **Refusal.** `content_missing` → exit 1, the existing `storage_refused` line with `code: "content_missing"` and `command` (`restore` or `import`), human text with "Nothing was changed.". No `storage_restore_cancelled`, `storage_restore_rollback` or `storage_drill_*` line. No write in either volume.
5. **Check failure.** A failure inside the check (copy, verification, open, query, or the cleanup) → exit 1, `storage_refused` with `code: "content_check_failed"`, no `storage_content_check` line, no target write. Never exit 2, never `content_missing`, never a pass. The design does not promise that the cleanup succeeds; a scratch folder that a failed cleanup leaves stays only in the process temp folder (§9).
6. **Unchanged after the boundary.** `prepared`, staging, `staged`, swap, commit, the cancel of a staging failure (`rolled_back`, `storage_restore_cancelled`), R1–R6, the drill points, `--pause-after`, the exit codes and the journal format.
7. No new sleep, retry, Docker call, mount, drill point, journal state, §6 row or exit code. The only new code is `content_check_failed`.

## 5. Unit cases and mutation controls (Author, no Docker)

Fixtures: the existing helpers of `stack-data.test.ts` (scratch volume roots, legacy and volume backups, `cli`, `tree`, `journalStates`). An app database with `package` row `packages/p1`. Every target is prepared first (`0700` roots, empty `packages` and `uploads`), so the §4 steps change nothing and `tree` covers every write.

| Case | Setup | Expected |
| --- | --- | --- |
| U1 empty `FRESH` import | legacy backup; no `p1` | exit 1; exactly one `storage_content_check` (`content_missing`, `checked: 1`, `missing: ["packages/p1"]`); a `storage_refused` line with `content_missing`; no `storage_restore_cancelled`; `tree` equal; no journal |
| U2 recovered `FRESH` import | (a) `--stop-after prepared-lti` with `p1`, then `recover` (lti `rolled_back`, no app journal); (b) `--stop-after staged`, then `recover` (both `rolled_back`); then remove `p1` | exit 1 `content_missing`; `tree` equal, also both journal files byte for byte |
| U3 `OK` restore (the case at `:344` with its stricter assertion, and this variant) | a committed restore with `p1` (journals `committed`); then remove `p1` | exit 1; `tree` equal (journals, identities, databases); then add `p1` → exit 0 with one `pass` line |
| U4 boundary | (a) no `p1`, `STORAGE_DRILL=1 --stop-after prepared-lti`; (b) `p1` present, the same drill | (a) exit 1 `content_missing`, no `storage_drill_stop`, `tree` equal. (b) exit 3; one `pass` line before the `storage_drill_stop` line; lti `prepared`, no app journal; `recover` → 1; `recover` again → 0 |
| U5 check failure (all three sub-cases are required) | through the library API: (a) a scratch copy that does not match the manifest (for example a partial copy); (b) a check that cannot finish (for example an app database that does not open, or a failed copy); (c) a failed removal of the scratch folder | each: exit 1 `content_check_failed`; no `storage_content_check` line; no `pass` or `content_missing` record; `tree` equal |
| U6 `.tmp` leftovers | plant `.storage-journal.json.tmp` and `.storage-identity.json.tmp` in both volumes; no `p1` | exit 1; both files present and byte-equal; the existing case at `:574` still passes |
| U7 precedence | no `p1`, plus (a) a damaged backup file, (b) `pair_mismatch`, (c) an import into `OK` | the earlier code; no `storage_content_check` line; `tree` equal |
| U8 control | `p1` present: an import into `FRESH` and a restore into `OK` | exit 0; journals `committed`; exactly one `pass` line each |

Each mutation must make at least one case fail. The Author reports the failing case for each mutation.

| Mutation | Caught by |
| --- | --- |
| the check after the first `prepared` write (the old order) | U1, U2, U3, U4 (a) |
| the check before the pair rule or the target state | U7 |
| the `.tmp` removal before the check | U6 |
| a second check or a second line in the engine | U8 (one line) |
| a check failure mapped to exit 2, to `content_missing` or to a pass | U5 (b) |
| no verification of the scratch copy | U5 (a) |
| the line written before the cleanup, or a failed cleanup ignored | U5 (c) |
| a `storage_restore_cancelled` line for a refusal | U1 |

Not a unit case (reviewers check it by reading): an unlisted file in the backup's `cogniate-app/` folder is not copied into the check scratch folder.

## 6. Independent QA host checks (no Docker)

QA writes its criteria from this brief and ADR-012 §8 **before** it reads the Author's diff or notes, and records the criteria file hash in its report. The oracles are QA's own: a recursive listing of both scratch volume roots (path, type, uid, gid, mode, size, SHA-256, link target), its own JSON-line parsing, its own SQLite fixtures. QA runs the candidate `infra/scripts/stack-data.mjs` from a clone at the candidate SHA, as the host user, with `HOST_UID`/`HOST_GID` set to its own ids, on scratch folders inside its `0700` run root, with a `docker` stub first on `PATH` (0 calls expected). The roots are prepared first, as in §5. Product commands are setup steps, never the oracle.

| Check | Expected |
| --- | --- |
| H1 import refusal into empty `FRESH` | exit 1; one `storage_content_check` line `content_missing` with `checked` = QA's count and the missing folder; a JSON line that names `content_missing`; listing equal; no `.storage-journal.json`, no `.restore-*`; no `storage_restore_cancelled` or `storage_drill_*` line |
| H2 import refusal into recovered `FRESH` (R1 state and R2 state, made by drills and `recover`) | the same; both journal files keep their bytes |
| H3 restore refusal into `OK` (a) with `committed` journals, (b) with `rolled_back` journals after a recovered drill | the same; journals, identities and databases keep their bytes |
| H4 boundary | as U4 (a) and (b), with QA's own parsing of the journals |
| H5 success controls | import into `FRESH` and restore into `OK` with the folder present → exit 0, journals `committed`, one `pass` line each, `checked` = QA's count |
| H6 `.tmp` leftovers | kept byte-equal by a content refusal; removed by a later successful restore |
| H7 precedence | as U7 |
| Every check | the backup folder and the content folder listings are unchanged; no file outside the scratch roots changes; no root-owned entry. QA sets `TMPDIR` to an empty QA folder; after each command that folder is empty (no scratch copy stays) |

A mismatch is a finding. QA does not change, relax or waive an assertion.

## 7. Targeted runtime checks (needs a Lead Docker grant)

Required, on the new candidate SHA, in one window, with W1–W4, the ADR-012 §15 lane rules, a lane that passes the §15 fresh-lane check, no added waits, one attempt:
- **Q1 and Q2** of [storage-reset-parent-repair](storage-reset-parent-repair.md) §7, with the same text and assertions and the same prepared tools (QA verifies their recorded hashes first). Q2 must now run to its end: the refusal (also `Q2d` target `FRESH` and `Q2e`), `X1`, the import pass and `stack:up`.

Not granted now (Lead `msg_1b6e45be76e9`). Listed only for a later Lead decision; each would need a host-only tool preparation with a dry run, accepted by the Lead, and gives no acceptance credit:
- **Q3** restore half: after Q2's `stack:up`, stop both services, make a volume backup `V`, move the folder to a QA hold, `stack:data-restore -- --from V` → refuses `content_missing`; nothing changes, also both `committed` journal hashes; put the folder back; restore `V` → exit 0.
- **Q4** recovered `FRESH` and the boundary: quarantine the lane; `STORAGE_DRILL=1 stack:data-import -- --from X1 --stop-after prepared-lti` with the folder present → exit 3; `--recover` → exit 1; move the folder away; the import refuses `content_missing` and the lti journal keeps its bytes; put the folder back; the import → exit 0; `stack:up` → exit 0.

H2 and H3 cover the same code path without Docker, and the full rounds run `e-content-missing` (both halves) in each round.

## 8. Acceptance order and gates

No gate is changed or waived. No step gives credit to another.
1. The Lead freezes this design (ADR-012 revision 3.5, this brief, the M1 clarification) by a commit.
2. Author: the §4 change, the §5 cases and the mutation record; `npm run check` green; a done report.
3. The Lead commits the candidate. Its SHA is immutable for steps 4–6.
4. In parallel on that SHA:
   - QA: the §6 host checks (criteria first). Suggested report: `docs/reviews/M1/content-refusal-qa.md`.
   - Two blind review gates: Reviewer-A (lens A: the boundary has no write before the check, also `.tmp`; the same bytes; the refusal output; the check failure; the engine and recovery unchanged) and Reviewer-B (lens B: simplicity, naming, do the tests prove "nothing changes", the mutation record, the README sentence). Each reviews this brief, ADR-012 revision 3.5 and the implementation diff together, and does not read the other's file before it submits. Gate: no open BLOCKER or MAJOR. The design stays proposed (provisional) until both approve.
5. The §7 required Q1 and Q2 on the same SHA.
6. The existing gates on the same SHA, unchanged: two full rounds of 488 rows with the same result per row (also the exact `content_missing` assertions of `e-content-missing` and `e-old-schema`), the legacy suites, the fresh M2 browser rows, three T7 runs and the G-1 identity binding. These also give the runtime acceptance of revision 3.4 ([storage-reset-parent-repair](storage-reset-parent-repair.md) §8 items 4 and 5).

## 9. Limits and items not in this repair

| Item | Status |
| --- | --- |
| §4 steps before step 1 | unchanged. On a prepared volume they change nothing. An existing volume that is not prepared (for example, one that Compose made for a read-only `stack:data-backup` of an absent lane, which then refuses `backup_source_not_ok:FRESH`) gets its root owner and mode and the empty mountpoints before any writer refusal. This is the existing §4 rule for every writer refusal; the volume stays empty `FRESH`. No M1 row uses such a target. |
| Cancel after a failure or an interruption | keeps `rolled_back` journals by design (§6 row 13, §8 R1–R3) |
| Concurrent changes | no atomic snapshot of the backup and the content folders (§3 "Concurrent changes"). A package folder that goes away after the check is not found by this check. A backup file that changes after the check gives a verified cancel, never an accepted restore. |
| Scratch after a failed cleanup | the command refuses `content_check_failed`, but the scratch folder (a copy of the app database, with secrets) can stay. In the product it is only in the maintenance container's writable layer, which goes with the container (`--rm`, or ADR-012 §7 A6). In a unit or host check it is in the process temp folder; the test reports it. |
| A kill inside step 1 | not drilled; no drill point is added. U4, U5, H4 show the boundary. ADR-012 §8 states the result: no journal, R0. |
| QA-RP-01 evidence | the old report and its limits stay unchanged (runtime journal bytes not read; one host, one attempt) |
| ADR-011 §14 | already lists the content check before any change; no edit |
| Index citations | `docs/architecture/README.md`, `tasks/README.md` and the M1 AC-M1-41 head cite revision 3.3. After acceptance, the Lead can authorize their update. No row text changes. |
| Real LMS | all 32 real-LMS rows stay UNVERIFIED. This brief gives no runtime credit. |
