Verdict: APPROVE
Round: 1

# M1 backup oracle: per-database migration names — Reviewer-B

Reviewer: new dedicated independent Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, Orca session `orca_session_id:5a49a171-4941-40ee-afc5-061f7bb10129`. Task `task_fce2f9194bbb`, dispatch `ctx_43be3bb4ba35`, run `run_ebe671ad72a9`. Date: 2026-10-21.

This is a bounded source and host-control review of one test-oracle repair. It is not a product review. **It gives no runtime acceptance credit.** The full attempt at `82e2dab` stays **FAIL**. This review does not claim the work of an earlier Reviewer-B session.

## 1. Scope and exact sources

| Item | Value |
| --- | --- |
| Reviewed commit | `51a80b51de2c7491466a21a678418ff8178d247d` (tree `e0949d55d6586aa272e705b50c16dfba8deb6be9`, `tests` tree `a47b34cd56bb3d85e4c3ef1cafef0a2b0c3210c0`) |
| Base | `82e2dab6d26915c90070a4aae8ac0c4472706c2d` |
| `tests/host/m1-migration.mjs` | SHA-256 `1be7c1c9d4028daffa2f5fbc9eb54b99804f2922eab0a1d7351bbe7e26a6cc75` (equal to the held value; base `9a96656d…39561f6`) |
| `tests/host/m1-migration.selftest.mjs` | SHA-256 `20745f2ae60818f260e2907893c76156133db8f2e50e78228f5886cce434fe5a` (equal to the held value; base `80f2fd4b…cf0994f`) |
| QA report (evidence only) | `docs/reviews/M1/backup-manifest-qa.md`, SHA-256 `3c739ccdf5b42985b0edeacaf99f67e396bc5b031538cd9f7453f6060381bc02` |

- `git diff --stat 82e2dab 51a80b5 -- tests infra services apps packages package.json package-lock.json` shows only the two test files (+86 −20). Product files, case ids, phases, the old pins (`OLD_REVISION = 'b0b83a8'`, `SNAPSHOT_OLD_SHA = 9f96f7b…`) and all other assertions are unchanged.
- In `m1-migration.mjs` the change is only inside `inspectBackup` (`:80`–`:87` new, `:92` changed). Both callers and the return value `{ manifestFile, manifest, listed, projectField, idField }` (`:94`) are unchanged.
- **Independence:** I did not read any other reviewer's report on this repair. When I listed the folder before my controls, only the QA report existed. The Lead later committed Reviewer-A's report in `a259398` (that file only; no test or product change). I did not open it. I used the QA report only as a list of claims to test.

## 2. Manifest shape: what the emitters write (source facts)

- **Current emitter.** `volumeBackup` builds `migrations = {}` and sets `migrations[\`${folder}/${db}\`]` for each volume (`infra/scripts/stack-data.mjs:660`, `:673`, `:676`). The legacy `backup` uses `Object.fromEntries(DATABASES.map(…))` (`:145`, `:158`). The keys are `lti-service/lti.db` and `cogniate-app/cogniate.db`. Each value is `SELECT name FROM schema_migration ORDER BY name` (`:62`).
- **Old pinned 011 build.** `9f96f7b:infra/scripts/stack-data.mjs:53` and `:65` use the same per-database form (legacy backup only). `b0b83a8` has no `stack-data.mjs`.
- **Which emitter the callers run.** Both callers check out the candidate first (`m1-migration.mjs:197`, `:292`). Then they run `npm run stack:data-backup` (`:207`, `:302`). The default source is `volume` (`stack-data.sh:17`), so the command is `storage_run maintenance backup --source volume …` (`stack-data.sh:63`). This is the candidate `volumeBackup`.
- **Ledger argument.** `volumeLedger` returns the same two keys (`m1-migration.mjs:42`–`:45`). Its values are `ORDER BY name` reads of stopped copies (`storage-fixture-script.mjs:133`–`:134`). Names are migration file names in a primary-key column (`packages/shared/src/migrations.ts:38`, `:63`), so a ledger has no duplicates.
- **Contract.** AC-M1-23 step 4: "the `schema_migration` names in it are those of `b0b83a8` only" (`docs/architecture/tasks/M1.md:211`). ADR-011 §14 step 3: the backup "reads each database's `schema_migration` names from a scratch copy" (`ADR-011-multi-lms.md:401`). No text requires one flat list.
- **Base defect.** The base collector (`82e2dab` `m1-migration.mjs:80`–`:84`) took only arrays directly under a key that matches `/migration/i`. The product value under `migrations` is an object, and its keys do not match. So the collector found `[]`. The base self-test used a flat array, which no emitter writes, so it could not see the defect.

## 3. Controls actually run

Private scratch: `~/cogniate-qa-runs/backup-manifest-rb-20261021-qligam` (mode 0700). Trees come from `git archive`: `base` = `82e2dab` `tests/host` + `infra/scripts`; `fix` = `51a80b5` (the same `infra/scripts` bytes; `diff -r` is empty); `pin011` = `9f96f7b` `infra/scripts`. A private clone at `51a80b5` runs the harness. No Docker. All data is synthetic. No private backup of the failed run was opened. The controls call the exported `inspectBackup` of each tree. They do not copy the oracle logic. Each expectation is a manifest fact: "valid" or "must be rejected for reason X".

**R1. Real emitters, base oracle versus fixed oracle.** My script makes two stopped "volumes" with real SQLite databases. Each database has a `schema_migration` ledger, and `lti.db` has a live `-wal` sidecar. Each volume also has an identity file; the product's own state check accepted the pair as `OK`. The ledgers are the migration file names of each pin, read with `git ls-tree` (b0b83a8: lti 3, app 10, union 12; 9f96f7b: lti 4, app 11, union 14). The script then runs the product CLI `node stack-data.mjs backup --source volume --data <root> --out <dir> …`, which is the maintenance-container command line. It also runs both legacy emitters. The ledger and the snapshot come from my own reads of the stopped files, in the form of `volumeLedger` and `volumeSnapshot`.

| Emitter | Ledger | `migrations` | Base oracle | Fixed oracle |
| --- | --- | --- | --- | --- |
| candidate volume CLI | 9f96f7b | object, 4 + 11 | FAIL "Manifest contains only the old migration names", diff `+ []` | PASS, 3 files, `backupId`, `composeProject` |
| candidate volume CLI | b0b83a8 | object, 3 + 10 | FAIL, same message, `+ []` | PASS, same fields |
| candidate legacy, `9f96f7b` legacy | both | object, same counts | FAIL, same message, `+ []` (4 of 4) | PASS (4 of 4) |

The first row reproduces the runtime failure: the same message and an empty actual list.

**R2. 40 controls per ledger (80 total) on the real candidate volume backup.** Each case changes one copy of the backup. The results are 0 unexpected in 80. The fixed oracle's first failing message is shown, with the product `validate()` result where useful.

| Class | Cases (each on both ledgers) | Fixed oracle |
| --- | --- | --- |
| Missing or extra name | last app name dropped; `001_init.sql` dropped from lti only (union unchanged); unknown `099_…` in lti | rejected: "Old migration named" or "…only the old migration names of `<db>`" |
| Future `012` | in the app list; in the lti list; replacing the last app name (same count); in a sibling `appliedMigrations[]`; nested `files[0].migrations[]`; as `{name}` in `pending.migrationList[]` | rejected: per-database message, "Old migration named", or the union message for other lists |
| Wrong database, union unchanged | lists swapped; lti `002_service_keys.sql` moved to app; **equal-count exchange** `002_service_keys.sql` ↔ `002_connections.sql`; duplicate `001_init.sql` in app; the other pin's ledger | rejected: "…only the old migration names of `<db>`" (or "Old migration named") |
| Malformed `migrations` | `null`; absent; flat array; string; `{}` | rejected: "per database" or "Old migration named" |
| Malformed value | `null`; string; nested array; a number in the list; `{name}` objects | rejected: "lists the migration names of `<db>`" or "Old migration named" |
| Keys | lti key missing; extra empty key; key `lti.db`; key with changed case | rejected: "exactly the stopped databases" |
| Unchanged checks | manifest size; manifest SHA-256; other `composeProject`; empty `backupId`; backup bytes damaged; `-wal` removed | rejected by the unchanged size/hash, file and identity assertions |
| Arguments | stopped ledger with `012` but manifest without; snapshot hash changed; other project | rejected ("Old migration named: 012…", strict equality, identity) |
| Positives | per-database key order reversed; unsorted lists; ledger key order app, lti | PASS |

The product `validate()` accepted every change to migration content, and refused only identity, form and file damage. So this oracle is the only check of the migration names, and its strictness has value.

**R3. `migrationRun` damage loop on the real volume backup (both ledgers).** For each damage, the script copies the backup and calls the fixed oracle on the copy. Then it damages the copy through the returned `listed`, `idField` and `projectField`, as `m1-migration.mjs:217`–`:226` does.

| Damage | Returned field | Points into the copy | Per-database `migrations` kept | Product `validate()` | Fixed oracle on the damaged copy |
| --- | --- | --- | --- | --- | --- |
| `bytes` | `listed` lti | yes | yes | refuses `backup_damaged` | rejected (size) |
| `missing` | `listed` app | yes | yes | refuses `backup_damaged` | rejected ("Backup file exists") |
| `backup-id` | `backupId` | yes | yes | refuses `manifest_invalid` | rejected (identity) |
| `project` | `composeProject` | yes | yes | refuses `project_mismatch` | rejected (identity) |

The original backup still passed after all controls. `snapshotMigrationRun` (`:303`) ignores the return value. So the snapshot-upgrade caller depends only on the pass/fail result, which R1 and R2 cover for the `9f96f7b` ledger.

**R4. Self-test cross-matrix (`node --test m1-migration.selftest.mjs`).**

| Tests | Oracle | Result |
| --- | --- | --- |
| base | base | 2 of 2 PASS |
| held | held | **3 of 3 PASS** |
| held | base | 2 FAIL with "Manifest contains only the old migration names" (the runtime defect) |
| base | held | 1 FAIL: "Manifest gives the migration names per database" (the flat fixture; see §5) |

**R5. My own mutants of the held oracle (different from QA's four deletions), run against the held self-test.**

| Mutant | Result | First failing case |
| --- | --- | --- |
| per-database compare with a Set (ignores duplicates) | killed | "an old name twice" |
| per-database superset only | killed | test 1 (`012` in the app list) and test 2 |
| per-database subset only | killed | "an old name is missing" |
| key check: ledger keys present only | killed | "an extra database" |
| key check: same key count only | killed | "a key without its service folder" |
| no value-shape check | killed | "names in one string" |
| flat-list compatibility fallback | killed | "one flat list" |
| union over per-database lists only | killed | "future 012 in another migration list" |
| union in the base form (the original defect) | killed | both backup tests |
| **per-database compare by count only** | **survived** | — (see B-BM-01) |

**R6. Harness-only checks and inventory (private clone, `npm --prefix tests ci --prefer-offline` exit 0, umask 022).**

| Check | `51a80b5` | `82e2dab` |
| --- | --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0; **71 of 71** PASS; typecheck PASS; 488 rows, phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70 | exit 0; 70 of 70; the same 488 and phases |
| `--harness-only --provider canvas` | exit 0; 71 of 71; 347 rows | not run |
| Inventory through the runner's `readManifests` + `joinInventory` | all 488 = common 114, Blackboard 141, **Canvas 233**; Canvas run 347 | identical counts; identical SHA-256 of the sorted id list (`8c03594e…`, `7cab7ae3…`) |
| `git diff --check 82e2dab 51a80b5 --` both test files | exit 0 | — |

The +1 self-check is the new regression test. The clone stayed clean after the harness runs.

**R7. Scope check.** A future name under a key without "migration" (for example `notes: ['012_…']`) passes the fixed oracle. It also passes the base oracle with its old flat form. So this behaviour is unchanged. No emitter writes such a key: the real volume manifest has exactly the 11 keys `formatVersion, backupId, createdAt, composeProject, sourceRevision, files, migrations, source, pairId, generation, legacySources`.

## 4. Source reasoning only (not run)

- Docker, the runner phases, the real callers `migrationRun` and `snapshotMigrationRun`, `stack-data.sh` with its `INCOMPLETE` marker, and the maintenance container. R1 ran the same CLI command in a host process as a non-root user, where `dropPrivilege` does nothing.
- `volumeLedger` and `volumeSnapshot` through the fixture container. I read the same files with the same SQL and the same output form.
- The Node 22 assertion-message format (no Node 22 binary is installed; see B-BM-02).

## 5. The design choice: a flat `migrations` array now fails

I agree with this choice.
- No emitter writes a flat list. `b0b83a8` has no emitter. `9f96f7b`, `a784522`, `82e2dab` and `51a80b5` all write the per-database form. R1 ran the candidate volume and legacy emitters and the `9f96f7b` emitter.
- Both callers always use the candidate emitter (§2).
- The contract asks for the names of each database. A flat list cannot show which database holds which name. R2 shows that the per-database check alone finds five union-preserving defects.
- A compatibility path would be a second, weaker oracle path with no real input to test it. My "flat-list fallback" mutant shows that the self-test pins this choice.
- If a future product changes the shape, the oracle fails closed with its own clear message ("Manifest gives the migration names per database"). That is easy to diagnose.

The product `validate()` accepts a flat array (`typeof object`). So the oracle is stricter than the product here. For the AC-M1-23 step 4 evidence, this is correct.

## 6. Findings

| ID | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| B-BM-01 | MINOR | `tests/host/m1-migration.selftest.mjs:75`–`:80` | The self-test does not prove that the per-database check compares names when the counts agree. | A mutant of `m1-migration.mjs:86` that compares only `perDatabase[db].length` with `names.length` passes all 3 held self-tests (R5). On the real candidate volume backup, the same mutant gives a false PASS for an equal-count exchange (lti `002_connections.sql`, app `002_service_keys.sql`) with the union unchanged, on both ledgers (`evidence/rb-controls-length-mutant.json`). The held oracle rejects this case with "…only the old migration names of lti-service/lti.db" (R2). "the ledgers swapped" fails the count mutant only because the counts differ (4/11, 3/10). | Add one `rejects` case: exchange one name between the two lists so both counts and the union stay the same. |
| B-BM-02 | NIT | `tests/host/m1-migration.selftest.mjs:81` | `/only the old migration names\n/` depends on Node's message format: the custom message followed by the diff. | It passes on Node v24.21.0, where the full message continues with `+ actual - expected` on a new line. `tests/package.json` declares `node >=22.12`. I did not verify Node 22. If the format differs, the case fails closed (a false failure, not a false pass). | Match the union message without the newline, for example `/only the old migration names(?! of)/`. |

No BLOCKER or MAJOR finding. Both findings are about regression strength of the self-test. The held oracle is correct for every control in R1–R3.

## 7. Maintainability and evidence quality

- **Fixture fidelity.** `productBackup` (`selftest.mjs:22`–`:35`) has the 11 keys of the real volume manifest (R7) and the `<service>/<file>` layout (R1). Its two ledgers equal the `git ls-tree` file names of `b0b83a8` and `9f96f7b`. The fixture files are text, not SQLite. This is acceptable because the oracle never opens a database, and R1 covers real SQLite files. The fixture copies the emitter shape by hand; it cannot import product code. So a future change to the product manifest is found at runtime, not by this self-test.
- **Negative cases fail for the intended reason.** Each test-2 case asserts its own message. With the held oracle, each failure comes from the intended step (R2, R5). Some malformed values (`null`, `{}`, absent) fail first at the unchanged "Old migration named" check. This is fail-closed, with a less specific message.
- **Size of change.** The oracle change is 9 lines, with one comment that names the emitter form. The messages are distinct per failure class. The union check stays for migration lists under other keys. Its line (`:92`) is long, but a refactor is optional and is not requested.
- **Return fields.** The callers use `listed`, `idField`, `projectField`, `manifestFile` and `manifest`. These keep their meaning (R3). `assertRestoreJournalsCommitted` still reads `backupId` from `verified.manifest`.

## 8. QA report assessment

- **Reproduced independently:** the base failure on real emitters, the fixed PASS, the per-database rejections, the damage loop with product refusal codes, the 4-way self-test matrix, 71/71 harness checks, typecheck, and the inventory (488, Canvas 233, 347).
- QA ran four deletion mutants. They do not test a weakened comparison; B-BM-01 is the gap that they leave.
- QA's claim that only the per-database check finds a moved, swapped or duplicate name with an unchanged union is confirmed by R2.
- QA's limitations are accurate. In particular, the `migration` phase (AC-M1-23/30) has never run with this oracle. Its evidence is still host-only.

## 9. Limitations

- Host controls only. No runtime, Docker, maintenance container or real lane volumes.
- The assertions of the snapshot-upgrade route after the backup check never ran at `82e2dab`. The `migration` and `storage` phases, round 2 and legacy did not run. This review cannot exclude a later oracle defect in those phases. A bounded search found no other host reader of `manifest.migrations`.
- Round 1 at `82e2dab` stays FAIL. All M1 rows keep their current status until a new frozen candidate passes the full runtime.

## 10. Private evidence (SHA-256)

Root `~/cogniate-qa-runs/backup-manifest-rb-20261021-qligam` (0700). The files hold only shapes, counts, codes and the first lines of messages for synthetic data.

| File | SHA-256 |
| --- | --- |
| `controls/rb-controls.mjs` | `1ce3cb490a9a0b0ffd2307fdd310db4a2eff625f956ad76fb0f94b86631f00ca` |
| `controls/rb-mutants.mjs` | `b1ab375114c5c4aeeb32f3eda388e8f89bafb51839a31bd3e16e383ec9a7ab74` |
| `controls/rb-inventory.mjs` | `699270b2f051108f3c02ffdda832eac4522783cc662897ee4d55c9b9766a0de0` |
| `controls/rb-unchanged-scope.mjs` | `11a00aa613b6a666ad653730cdefb8fd2edc9faf1b19e060bae2cdcb909c1d53` |
| `evidence/rb-controls.json` (R1–R3) | `2838ff8e37f4a3ecc05449a6d3eaecd3487fc5b033298f201532475052239652` |
| `evidence/rb-controls-length-mutant.json` (B-BM-01) | `a0fc95e2f1e69619eda024bdecee9d827e88abf48eb107cabb920162c98b2558` |
| `evidence/rb-mutants.json` (R5) | `1facce6d20f0fe3388595b3b3ead4d421c2b8028c4bda91cc11f61b7e7ea6a2f` |
| `evidence/selftest-held-held.tap` | `be681199e08caf851908c6b0d96e74a5e978258a49cb2f9fd6afc264f42f46f9` |
| `evidence/selftest-heldtests-baseoracle.tap` | `8c6544c384d64421c6e6170bcf491ab8ef5554542b35c5dc488d13e9f4f29267` |
| `evidence/selftest-basetests-heldoracle.tap` | `883a4e60aa133642a10e807593bf740ec7830e69a0c0570a91a5e5d0846a9d94` |
| `evidence/selftest-base-base.tap` | `fc7df789d618ecd2a74d82fbad880675e572867c543d1853b1fde7cc8ccf41b8` |
| `evidence/harness-only-all.txt` | `23c2bbe60af78b47701af0b08e866ab5036c60360910f5019e00d94ce388fed8` |
| `evidence/harness-only-canvas.txt` | `64500f092a46831a144baac935f1bc2572390e441b695cd901919accdce84e9f` |
| `evidence/harness-only-all-base.txt` | `fa8c7c46c418a1ed246ed5f4804438868fe8c2f485ed514ebc5fec8221e0bbdc` |
| `evidence/rb-unchanged-scope.txt` (R7) | `3a5c1bba5cffe6e371114c85ee3ba840b821da183bf9ddd8bc0afc208ff94a0c` |

## 11. Held file

Only this report, `docs/reviews/M1/backup-manifest-reviewer-b.md`, is held for the Lead's exact-path commit. Its SHA-256 is given in the completion message, because a file cannot contain its own hash. No other repository file changed. No commit and no push.
