# M1 backup oracle: per-database migration names — Reviewer-A

Verdict: **APPROVE** (test source only)

Round: 1

| Item | Value |
|---|---|
| Reviewer | Reviewer-A (Claude Code, Opus 5.5 `claude-opus-5-5`, xhigh), new dedicated session `orca_session_id:67e26a3d-fdbb-4900-bcff-103a924f5e0f` |
| Date | 2026-10-21 |
| Run / task / dispatch | `run_ebe671ad72a9` / `task_307ba1c5faaa` / `ctx_216a0403c03b` |
| Reviewed SHA | `51a80b51de2c7491466a21a678418ff8178d247d` |
| Base | `82e2dab6d26915c90070a4aae8ac0c4472706c2d` |
| Held test files (commit blob = worktree) | `tests/host/m1-migration.mjs` SHA-256 `1be7c1c9d4028daffa2f5fbc9eb54b99804f2922eab0a1d7351bbe7e26a6cc75` (base `9a96656d5027285a1b3769c0da3a4aa5d3feb53911673f55c030af68f39561f6`); `tests/host/m1-migration.selftest.mjs` SHA-256 `20745f2ae60818f260e2907893c76156133db8f2e50e78228f5886cce434fe5a` |
| QA evidence assessed | `docs/reviews/M1/backup-manifest-qa.md`, SHA-256 `3c739ccdf5b42985b0edeacaf99f67e396bc5b031538cd9f7453f6060381bc02` |
| Lens | Correctness and integrity |
| Runtime credit | **None.** No Docker, stack, runner phase or product command ran. The failed `82e2dab` full attempt stays **FAIL**. |

## 1. Summary

The repair makes `inspectBackup` read the manifest in the form that the product writes: `migrations` is one object, with one list of `schema_migration` names for each database. The base oracle looked only for arrays directly under a `/migration/i` key, so it found no name and failed every real backup.

I reproduced the original failure with the real product emitter and the base oracle: the same line (`m1-migration.mjs:84:10`), the same message, `actual []` and the same 14 names as the runtime `ERROR` row. The held oracle accepts the same real backups. It rejects all 88 of my wrong-manifest and damaged-file cases, including 6 cases where the union of names stays the same. The existing identity, size, SHA-256 and file checks keep their force. Harness checks, typecheck and the 488 / Canvas 233 inventory are unchanged, except that the self-test count goes from 70 to 71.

I found no BLOCKER, MAJOR or MINOR finding. One NIT is in §7.

## 2. Inputs and independence

- `git diff --stat 82e2dab 51a80b5 -- infra services packages apps package.json tests` shows only the two held test files (+86 −20). No product file changes. The diff in `m1-migration.mjs` is one hunk inside `inspectBackup` (lines 80–87 and 92). The three call sites and their arguments are unchanged.
- I read the charter, `docs/research/inputs.md`, AC-M1-23/30 and AC-M1-38 (h1) in `docs/architecture/tasks/M1.md`, ADR-011 §14 and ADR-012 §8.
- I read the QA report as evidence to assess. I did not read another reviewer's report for this repair. None existed when I started.
- I ran my controls from fresh private scratch `/Users/quangnguyen/cogniate-review-runs/backup-manifest-reviewer-a-20261021T0513Z` (mode 0700). The trees came from `git archive` of `82e2dab` (base), `51a80b5` (fix) and `9f96f7b` (pinned 011). The data is synthetic. I did not open any private backup of the failed run. I read only the `ERROR` row of its `summary.json`.
- I changed only this report.

## 3. The manifest form (source facts)

| Source | `migrations` form |
|---|---|
| Current volume backup, `infra/scripts/stack-data.mjs:660-676` | `migrations[\`${folder}/${db}\`] = migrationNames(...)`: keys `lti-service/lti.db` and `cogniate-app/cogniate.db` |
| Current legacy backup, `stack-data.mjs:145` | `Object.fromEntries(DATABASES.map((db) => [db, migrationNames(data, db)]))`, the same keys |
| Pinned `9f96f7b`, `stack-data.mjs:53` and `:65` | The same `Object.fromEntries` form (legacy backup only) |
| `b0b83a8` | No `stack-data.mjs`. It never writes a backup. |
| Product reader `migrationNames`, `stack-data.mjs:62` | `SELECT name FROM schema_migration ORDER BY name` on a scratch copy with its sidecars |
| QA ledger `volumeLedger` → `logicalRead`, `tests/host/storage-fixture-script.mjs:112-134` | The same query on a copy with the same sidecars; keys `lti-service/lti.db` and `cogniate-app/cogniate.db` (`m1-migration.mjs:44`) |

Both callers check out the candidate before `npm run stack:data-backup` (`m1-migration.mjs:197` and `:292`). So every backup that the oracle reads comes from the candidate emitter. No emitter or caller writes one flat list. Only the base self-test fixture did.

The contract: AC-M1-23 step 4 says that the `schema_migration` names in the manifest "are those of `b0b83a8` only". ADR-011 §14 step 3 says that the tool "reads each database's `schema_migration` names". AC-M1-38 (h1) backs up from the volumes before the upgrade to `012`.

## 4. Controls that I ran

### C1. Original failure and repaired positive, real emitters

My script `harness/control.mjs` makes real SQLite databases with the product's `schema_migration` table. The lti database keeps an un-checkpointed WAL, so `lti.db-wal` and `lti.db-shm` exist. For the volume emitter it also writes two valid identities (state `OK`). I took the ledgers from `git ls-tree` of each SHA: `b0b83a8` lti 3 + app 10 (union 12); `9f96f7b` lti 4 + app 11 (union 14). My script reads the snapshot and the ledger itself, in the `volumeSnapshot` and `volumeLedger` forms. Then it calls the exported `inspectBackup` of each tree.

| Emitter | Ledger | Manifest form | Base oracle | Held oracle | Held, `012` added to app |
|---|---|---|---|---|---|
| current `volumeBackup` (the default route) | `9f96f7b` | object, lti 4 / app 11 | FAIL "Manifest contains only the old migration names", `actual []`, 14 expected | PASS, 4 files, `backupId`, `composeProject` | FAIL "... of cogniate-app/cogniate.db" |
| current `volumeBackup` | `b0b83a8` | object, 3 / 10 | FAIL, `actual []`, 12 expected | PASS | FAIL (app) |
| current legacy `backup` | both | object | FAIL, `actual []` | PASS | FAIL (app) |
| `9f96f7b` legacy `backup` | both | object | FAIL, `actual []` | PASS | FAIL (app) |

The runtime `ERROR` row (`.../qa-multi-r1-82e2dab6-2026-10-21T04-54-03-177Z/summary.json`) shows the same message, `+ []` and the same 14 names. The base self-test cross run gives the same frame: `inspectBackup (m1-migration.mjs:84:10)`.

### C2. Negatives and positives on a real current volume backup

For each ledger, each case changes one thing on a fresh copy of the real backup. I also ran the product's own `validate()` on each copy, to see which guard catches what. 96 records; all 94 judged cases give the expected result (`WRONG` = 0).

| Group (each for both ledgers) | Cases | Held oracle | Product `validate()` |
|---|---|---|---|
| Valid: unchanged; keys in reverse order with unsorted names; pretty JSON | 3 | PASS | accepted |
| Union unchanged: app loses `001_init.sql`; an app-only name added to lti; an old name twice; an lti-only name moved to app; the two lists swapped; both lists merged into each | 6 | FAIL "Manifest contains only the old migration names of `<db>`" | accepted |
| Missing names: app loses its newest name; lti loses an lti-only name | 2 | FAIL "Old migration named" | accepted |
| Future names: `012` in app; `012` in lti; `012` replaces the newest app name; an unknown `005_*` in lti | 4 | FAIL (per-database check or "Old migration named") | accepted |
| Future names outside `migrations`: top-level `pendingMigrations: [012]`; nested `meta.appliedMigrations: [{name: 012}]` | 2 | FAIL "Manifest contains only the old migration names" (union) | accepted |
| Keys: extra database with `[]`; extra database with old names; app key missing; `lti.db` without its folder; `./` prefix; empty object | 6 | FAIL ("exactly the stopped databases" or "Old migration named") | accepted |
| Form: `migrations` absent; null; one flat list; a string | 4 | FAIL | refused 3 (`manifest_invalid`); **accepted** the flat list |
| Values: null; joined string; number; nested `[[names]]`; `{name}` objects; `{names: [...]}`; a number entry; an empty string; a trailing space; an empty list | 10 | FAIL | accepted |
| Identity: `backupId` empty; `backupId` absent; other `composeProject` | 3 | FAIL "identifies the compose project and backup" | refused |
| Manifest files: size +1; SHA-256 zeroed; the `-wal` entry removed | 3 | FAIL "Manifest gives size and SHA-256" | refused 2; accepted the removed `-wal` entry |
| Bytes and files: one byte flipped (same size); one byte appended; `-shm` removed; `cogniate.db` removed | 4 | FAIL (size/SHA-256 or "Backup file exists") | refused `backup_damaged` |

The product validator accepts 31 of the 34 migration-metadata changes for each ledger. So this oracle is the only guard of AC-M1-23 step 4, and its strictness matters.

### C3. The two callers' sequence (host simulation)

- `migrationRun` (ledger `b0b83a8`): `inspectBackup` on the original passes. Then, as `m1-migration.mjs:217-226` does, each damage copy passes `inspectBackup` first. Then the script damages it through the returned `listed`, `idField` and `projectField`. The fields are `listed`, `backupId` and `composeProject`. The product refuses each copy (`backup_damaged`, `backup_damaged`, `manifest_invalid`, `project_mismatch`). The held oracle also fails on each damaged copy. `verified.manifest.backupId` is a string, as `assertRestoreJournalsCommitted` needs.
- `snapshotMigrationRun` (ledger `9f96f7b`): `inspectBackup` on the original passes (4 files).

### C4. Self-test cross runs and my own mutants

| Tests / oracle | Result |
|---|---|
| held / held | 3 of 3 PASS |
| base / base | 2 of 2 PASS |
| held / base | 2 FAIL: "Manifest contains only the old migration names", `+ []`, at `:84:10` (the original failure) |
| base / held | 1 FAIL: "Manifest gives the migration names per database" (the flat fixture; see §6) |

My mutants (`harness/mutants.mjs`) differ from QA's four. Each one weakens one check. The held self-test kills all six:

| Mutant | Killed by |
|---|---|
| R1 per-database compare ignores duplicates (`Set`) | "an old name twice" |
| R2 per-database compare checks only that the old names are present | "an old name twice"; test 1 `012` message |
| R3 per-database names are checked only against the union of both ledgers | "an old name is missing" (union unchanged) |
| R4 key check allows extra databases | "an extra database" |
| R5 union leaves out the per-database names (base union) | valid backup fails |
| R6 union check removed | "future 012 in another migration list" |

### C5. Harness-only checks, typecheck and inventory

In a private `git clone --no-hardlinks`, detached at each SHA, after `npm --prefix tests ci --prefer-offline` (exit 0):

| Check | `51a80b5` | `82e2dab` |
|---|---|---|
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0; **71 / 71**; typecheck (`tsc --noEmit`) PASS; 392 API cases, 96 host rows (72 AC-M1-41), **488** rows; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70 | exit 0; 70 / 70; the same 488 and phases |
| `--harness-only --provider canvas` | exit 0; 71 / 71; 347 rows | not run |
| Joined inventory by owner (runner's `readManifests` + `joinInventory`) | common 114, Blackboard 141, **Canvas 233** (225 API sim, 7 browser sim, 1 API snapshot-isolated); id-list SHA-256 `7513f03f1c73…` | byte-identical output |
| `git diff --check 82e2dab 51a80b5` on the two files | exit 0 | – |

## 5. Source review: the kept assertions and the callers

- Lines 55–79 are unchanged: the manifest file search, the project and backup-id fields, and for each snapshot file its presence, exact size, SHA-256 and a manifest node with that size and SHA-256. The new checks come after them. So they cannot hide an earlier failure. C2 shows each kept check still fails its own damage.
- The stopped-ledger rule stays in the callers: `assert.deepEqual(await volumeLedger(candidateLane), oldLedger, ...)` before the backup (`:203`, `:298`). `inspectBackup` compares against `oldLedger`, QA's own read of the stopped old lane.
- New line 82: `migrations` must be a non-array object. Line 83: its keys must equal the ledger keys exactly. Lines 84–87: each value must be a list of strings that equals that database's ledger (sorted; duplicates fail). Line 92: the union of every `/migration/i` array anywhere plus the per-database names must equal the union of the ledgers. So a future name anywhere in a migration list fails.
- The per-database check is the only check that finds a wrong database ledger when the union is unchanged. `001_init.sql` is in both ledgers, so a move, swap or duplicate keeps the union. C2 and R3 show this.
- The callers (`:208`, `:219`, `:303`) pass the same arguments. The returned object (`manifestFile`, `manifest`, `listed`, `projectField`, `idField`) is unchanged. No other test reads the backup manifest's `migrations` (`grep` over `tests/host` and `tests/acceptance/M1`).
- A valid backup cannot fail the new checks because of the form: the emitter and the QA ledger read the same table with the same query, on copies with the same sidecars, under the same keys.

## 6. Design choice: one flat list now fails

I agree with this choice. It is consistent with the contract and the code:

- No emitter at `9f96f7b`, `82e2dab` or `51a80b5` writes a flat list, and `b0b83a8` writes no backup. Both callers always read the candidate's backup.
- ADR-011 §14 requires "each database's" names. A flat list cannot show which database has which name. So it cannot prove AC-M1-23 step 4 per database.
- The product's `validate()` accepts a flat list (`typeof m.migrations === 'object'`, C2). So the oracle is stricter than the product here. That is correct for an oracle of the emitter's output. If a later product change wrote a flat list, the oracle fails closed with a clear message ("per database"). It does not give a false pass.
- A second path for flat lists would add weaker code for a form that nothing writes.

## 7. Findings

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
|---|---|---|---|---|---|
| A-BKP-01 | NIT | `tests/host/m1-migration.selftest.mjs:81` | The case "future 012 in another migration list" matches `/only the old migration names\n/`. The `\n` depends on Node's assertion format, which adds the diff after a custom message. | On Node 24.21, `assert.deepEqual([1], [2], 'msg')` gives `"msg\n+ actual - expected..."`. I could not test Node 22 (`tests/package.json` allows `>=22.12`; the root requires `>=24.11`). If the format differs, the self-test fails closed. It cannot pass falsely. | Optional: anchor on the message end in a format-free way, for example `/only the old migration names$/m`. No action is needed for this repair. |

Observation, not a finding of this repair (pre-existing, outside scope, no action requested): the kept check at `m1-migration.mjs:74-75` binds a size and SHA-256 to *some* manifest node, not to the node with that file's name. A manifest with the names of the `lti.db` and `cogniate.db` entries swapped passes the oracle (C2 "observe" case). The product's `validate()` refuses it (`backup_damaged`), and the product emitter cannot write it. This line is unchanged by the repair.

## 8. Assessment of the QA report

- **Confirmed by my own controls:** the cause (object form, collector found `[]`); the emitter forms at `9f96f7b` and the candidate; that both callers back up after the candidate checkout; the original failure through the real emitter and the base oracle; PASS of the held oracle on real backups of both ledgers and both emitter kinds; the four `migrationRun` damage fields; the self-test cross results (3/3, 2 FAIL, 1 FAIL); 71 / 71 harness checks; typecheck; 488 rows, its phases, and Canvas 233, identical to `82e2dab`.
- **Not re-run by me:** QA's four mutants (I ran six other mutants), and QA's private evidence files. I did not read them.
- I found no claim in the QA report that my controls contradict.

## 9. Limitations

- No runtime credit. I ran no Docker command, no runner phase, no real `migrationRun` or `snapshotMigrationRun`, no maintenance container, and no `volumeLedger` or `volumeSnapshot` through the fixture container. C1–C3 call the real emitters and the real exported oracle in a host process, with my own ledger and snapshot reads in their place.
- My volume fixture is a host folder pair with valid identities, not Docker volumes. The `9f96f7b` emitter is its legacy backup only; the runs never use it.
- The other assertions of the snapshot route after `inspectBackup` never ran in the failed attempt. This review gives them no evidence. The phase `migration` (AC-M1-23/30) has never run on this oracle at runtime.
- A new frozen candidate and a new full run are still necessary. Until then, all M1 rows keep their current status.

## 10. Evidence (private, mode 0700, synthetic data only)

Root: `/Users/quangnguyen/cogniate-review-runs/backup-manifest-reviewer-a-20261021T0513Z`

| File | SHA-256 |
|---|---|
| `harness/control.mjs` (C1–C3) | `92d7b7a90df916b0fe4b287a8e43952d39a09c64b4efe3de2635f274afae31ec` |
| `harness/mutants.mjs` (C4) | `20e0a680f303850cf50ce7329961f540e945ebdb8fd73d1a27e65ddb44d71525` |
| `harness/inventory.mjs` (C5) | `d9ac3547e7b37f9479c1d05e477e8dca2ead7ec4c59d51379bee8083f8d20616` |
| `evidence/controls.json` | `9a551f49be113bfd6b352ee82d5ae7c78dddc558e2d705895ea8ba4280fd0bc5` |
| `evidence/controls.log` | `69a0c23d1315d0227a0577bfb931a5dbcb54985182807fda18f4af7c7158be19` |
| `evidence/mutants.json` | `648a659796224e7a37941ba89f652548f6e566739316f049bc50a44971d32403` |
| `evidence/selftest-fixfix.tap` | `6cc128cf334158f609fcf4f45064e34305dc8f58c4e126e8fc4f18cb0c90b12a` |
| `evidence/selftest-heldtests-baseoracle.tap` | `f6c4d4c58c723fe4ba5583fa2a0cc9e269191bbc343cde1f94042f0c47956876` |
| `evidence/selftest-basetests-heldoracle.tap` | `9adf98961e2718b0b4ed2d94a4f92647d3196274b660038cd85aa57971a318f9` |
| `evidence/selftest-basebase.tap` | `af5fd37b222b50cdf2008412ec57e53396c21da17cbaadd8e974bbfcf9906b75` |
| `evidence/harness-fix-all.txt` | `352a53438332bb7d3f655caa6f831a81e6c17266b5426117457cb201aa8d20cb` |
| `evidence/harness-fix-canvas.txt` | `c908ea87b756c11d15cbc09410b4cd78ca365c234e2b9fa5d55a50dae18e9027` |
| `evidence/harness-base-all.txt` | `b73ba95b0ba9fdc55c3881adfb2eb981f382df07e47bf022503e8c3802fa6a54` |
| `evidence/inventory-fix.json` = `inventory-base.json` | `8a70ce27318f4b7b64716c26436f63d74e721d5254e4e54d980f8ec6dc9737e5` |

## Held file

Only this report: `docs/reviews/M1/backup-manifest-reviewer-a.md`. Its SHA-256 is in the completion message (a file cannot contain its own hash). The Lead commits by exact path.
