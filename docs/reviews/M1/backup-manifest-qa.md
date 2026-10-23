# M1 backup oracle: per-database migration names (QA repair, held)

Common QA, 2026-10-21. **Result: the oracle repair is held for the Lead. Host-side controls PASS. No runtime acceptance ran.** This is a bounded QA repair after the full runner at `82e2dab` exited 1 (Lead message `msg_50cf6f48d777`). It is not an acceptance retry. The failed attempt and its raw evidence stay **FAIL**. No M1 criterion gets credit from this report. No product defect is shown.

## Identity

| Item | Value |
| --- | --- |
| Role and session | Common QA, independent of the product authors and reviewers. Requested and effective model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. Orca session `orca_session_id:25078458-7ea5-4ec4-9dbb-0938c5bafd83`. |
| Task | Run `run_ebe671ad72a9`, task `task_c535a6bc68c8`, dispatch `ctx_f082183d3eb8`. |
| Base tested candidate | `82e2dab6d26915c90070a4aae8ac0c4472706c2d` |
| Worktree | branch `nguyenthanhquang152/lti-multi-lms`, HEAD `894c019193296ba8c612b464faa8ab7d5f2f5932`. `git diff 82e2dab HEAD -- tests infra services package.json` is empty: the commits after `82e2dab` change only `docs/`. |
| Owned files | `tests/host/m1-migration.mjs`, `tests/host/m1-migration.selftest.mjs` and this report. No other repository file changed. No commit, no push, no Docker. |

## Failure

The full runner at `82e2dab` stopped in phase `snapshot-upgrade`. `M1-38.common.h1` passed. Then `inspectBackup` failed (run `qa-multi-r1-82e2dab6-2026-10-21T04-54-03-177Z`, `summary.json`, row `ERROR`):

```
AssertionError: Manifest contains only the old migration names
+ actual - expected
+ []
- [ '001_init.sql', ... '011_lms_types.sql' ]   (14 names)
at inspectBackup (m1-migration.mjs:84:10)
at snapshotMigrationRun (m1-migration.mjs:295:3)
```

All earlier assertions of `inspectBackup` passed: the manifest file, the project and backup id, each file size and SHA-256, and "Old migration named" for each of the 14 names.

## Cause (sources)

- **The product writes `migrations` per database.** Volume backup: `infra/scripts/stack-data.mjs:660` `const migrations = {}` and `:673` `migrations[\`${folder}/${db}\`] = …`. Legacy backup: `:145` `Object.fromEntries(DATABASES.map((db) => [db, migrationNames(data, db)]))`. The keys are `lti-service/lti.db` and `cogniate-app/cogniate.db`. Each value is the `schema_migration` names of that database, `ORDER BY name` (`:62`).
- **The same form at the pinned old build.** `9f96f7b:infra/scripts/stack-data.mjs:53` and `:65` (legacy backup only, the same `Object.fromEntries` form). `b0b83a8` has no `stack-data.mjs`.
- **Which emitter runs.** Both callers check out the candidate before the backup (`m1-migration.mjs:197`, `:292`). `npm run stack:data-backup` (`package.json:25`) runs `stack-data.sh` with the default `source_kind="volume"` (`stack-data.sh:17`, `:63`). So the backup is the candidate's `volumeBackup`.
- **The old collector.** `m1-migration.mjs:80-83` (at `82e2dab`) took only arrays directly under a key that matches `/migration/i`. The product value under `migrations` is an object, and its keys do not match `/migration/i`. So the collector found no name: `actual []`.
- **The old self-test did not see this.** Its fixture used one flat list (`migrations: Object.values(ledger).flat()`), which no emitter writes.

## Contract

- AC-M1-23 step 4 (`docs/architecture/tasks/M1.md:211`): "The manifest lists both databases (and present sidecars) with size and SHA-256, and the `schema_migration` names in it are those of `b0b83a8` only."
- ADR-011 §14 step 3 (`ADR-011-multi-lms.md:401`): the backup "reads each database's `schema_migration` names from a scratch copy". ADR-012 §8 item 3 (`ADR-012-sqlite-volume-storage.md:344`): "The migration names are read from a scratch copy."
- AC-M1-38 (h1) (`M1.md:184`): back up from the volumes before the upgrade to `012`.
- No text requires one flat list. The per-database form is the product form at `9f96f7b` and at the candidate.

## Change

`tests/host/m1-migration.mjs` (+9 −1). The new lines are 80–87 and 92:

```diff
   for (const names of Object.values(ledger)) for (const name of names) assert.ok(serialized.includes(name), `Old migration named: ${name}`);
+  // stack-data.mjs (9f96f7b and later) writes `migrations` per database: { '<service>/<db>': [schema_migration names] }.
+  const perDatabase = manifest.migrations;
+  assert.ok(perDatabase && typeof perDatabase === 'object' && !Array.isArray(perDatabase), 'Manifest gives the migration names per database');
+  assert.deepEqual(Object.keys(perDatabase).sort(), Object.keys(ledger).sort(), 'Manifest gives the migration names of exactly the stopped databases');
+  for (const [db, names] of Object.entries(ledger)) {
+    assert.ok(Array.isArray(perDatabase[db]) && perDatabase[db].every((name) => typeof name === 'string'), `Manifest lists the migration names of ${db}`);
+    assert.deepEqual([...perDatabase[db]].sort(), [...names].sort(), `Manifest contains only the old migration names of ${db}`);
+  }
   const migrations = nodes.flatMap(…unchanged…);
-  assert.deepEqual([...new Set(migrations)].sort(), [...new Set(Object.values(ledger).flat())].sort(),
+  assert.deepEqual([...new Set([...migrations, ...Object.values(perDatabase).flat()])].sort(), [...new Set(Object.values(ledger).flat())].sort(),
     'Manifest contains only the old migration names');
```

What the oracle checks now, in this order:

1. Unchanged: the manifest file, the project and backup id, each listed file with exact size and SHA-256, and each old name in the manifest text.
2. New: `migrations` is an object (not a list).
3. New: its keys are exactly the keys of the stopped-volume ledger (`volumeLedger`, `m1-migration.mjs:42-45`).
4. New: for each database, the value is a list of strings, and the list equals that database's ledger (sorted; a duplicate or a missing name fails).
5. Kept: the union of all names (the per-database names plus any other list under a `/migration/i` key anywhere) equals the union of the ledgers. A future `012` anywhere fails.

The per-database check is stronger than the union. `001_init.sql` is in both ledgers. So a name that moves between databases, a swap of the two lists, or a duplicate keeps the union the same. Only step 4 finds these.

**Decision: one flat list now fails.** No emitter writes it, and it cannot show which database has which name. To accept it would need a second, weaker path. The old fixture's behaviours (wrong bytes, missing sidecar, new name) stay; the fixture now has the product form.

Unchanged: both callers and their arguments (`:208`, `:219`, `:303`), the damage loop, every other assertion, the runner, phases, inventory, the old pins, and all product files.

`tests/host/m1-migration.selftest.mjs` (+77 −19):

- A `productBackup` fixture in the form of `volumeBackup`: `<service>/<file>` copies and the manifest fields `formatVersion`, `backupId`, `createdAt`, `composeProject`, `sourceRevision`, `files` (`name`, `size`, `sha256`), `migrations` per database, `source: volume`, `pairId`, `generation`, `legacySources`.
- The ledgers of the two old builds, from the migration files of each SHA (`git ls-tree`): `b0b83a8` (lti 3, app 10, union 12) for phase `migration`, and `9f96f7b` (lti 4, app 11, union 14) for phase `snapshot-upgrade`.
- Test 1 (kept, now on the product form): valid PASS; future `012` in the app list, wrong bytes, and a missing sidecar fail.
- Test 2 (new), for both ledgers. Each case changes one thing in the manifest and must fail with its own message:

| Case | Fails at |
| --- | --- |
| one flat list | step 2 |
| one database with the names of both; an extra database; a key without its service folder | step 3 |
| names in one string; names in an object; names as `{name}` objects | step 4, "lists" |
| `001_init.sql` missing from the app list; an old name twice; an app name in the lti list; the two lists swapped (union unchanged in all four) | step 4, "only the old migration names of `<db>`" |
| future `012` in the app list | step 4 |
| future `012` in another list (`pendingMigrations`) | step 5 |
| manifest size differs; manifest SHA-256 differs | unchanged file check |
| `migrationRun` damage through the returned fields: `idField` is `backupId` (set to `""`), `projectField` is `composeProject` (set to another project) | unchanged identity check |

Then the restored manifest passes again. Test 3 (restore journals) is unchanged.

## Controls (actually run, no Docker)

Private root `/Users/quangnguyen/cogniate-qa-runs/backup-manifest-qa-20261021T0505Z` (mode 0700; logs 0600; child processes with umask 022). Source trees came from `git archive`: `base` = `82e2dab` `tests/host` and `infra/scripts`; `fix` = `base` plus the two held files; `pin011` = `9f96f7b` `infra/scripts`. All databases are synthetic. No private backup of the failed run was opened.

**C1. Real product emitters, old oracle versus fixed oracle.** For each emitter and each ledger, `harness/control.mjs` makes real SQLite databases with a `schema_migration` table and an `lti.db-wal` sidecar. It runs the emitter, reads the ledger itself (a copy, `ORDER BY name`, as `volumeLedger`), and lists the files itself (as `volumeSnapshot`). Then it calls the exported `inspectBackup` of each tree.

| Emitter | Ledger | Manifest `migrations` | Old oracle (`82e2dab`) | Fixed oracle | Fixed, `012` added to app |
| --- | --- | --- | --- | --- | --- |
| `82e2dab` `volumeBackup` (the default) | `9f96f7b` | object, lti 4, app 11 | **FAIL** line 84, actual 0 vs 14 names | PASS (3 files; `backupId`, `composeProject`) | FAIL line 86, app |
| `82e2dab` `volumeBackup` | `b0b83a8` | object, lti 3, app 10 | **FAIL** line 84, actual 0 vs 12 | PASS | FAIL line 86, app |
| `82e2dab` legacy `backup` | `9f96f7b` / `b0b83a8` | object, 4+11 / 3+10 | **FAIL** line 84 (0 vs 14 / 0 vs 12) | PASS / PASS | FAIL line 86 / FAIL line 86 |
| `9f96f7b` legacy `backup` | `9f96f7b` / `b0b83a8` | object, 4+11 / 3+10 | **FAIL** line 84 (0 vs 14 / 0 vs 12) | PASS / PASS | FAIL line 86 / FAIL line 86 |

The first row is the original failure: same line, same message, same 14 names.

**C2. The `migrationRun` damage loop on a real `volumeBackup` (ledger `b0b83a8`).** The script copies the backup, calls the fixed `inspectBackup` on the copy, and damages it through the returned `listed`, `idField` and `projectField`, as `m1-migration.mjs:217-226` does. Then the product's own `validate()` (its restore pre-check) and the fixed oracle read the damaged copy.

| Damage | Field used | Product `validate()` | Fixed oracle |
| --- | --- | --- | --- |
| `bytes` | `listed` lti | refused `backup_damaged` | FAIL line 72 (size) |
| `missing` | `listed` app | refused `backup_damaged` | FAIL line 71 (file exists) |
| `backup-id` | `backupId` | refused `manifest_invalid` | FAIL line 67 (identity) |
| `project` | `composeProject` | refused `project_mismatch` | FAIL line 67 (identity) |

**C3. Self-test against each oracle (`node --test tests/host/m1-migration.selftest.mjs`).**

| Tree | Result |
| --- | --- |
| old tests, old oracle (`82e2dab`) | 2 of 2 PASS |
| held tests, held oracle | **3 of 3 PASS** |
| held tests, old oracle | 2 FAIL: "Manifest contains only the old migration names" (the original failure) |
| old tests, held oracle | 1 FAIL: "Manifest gives the migration names per database" (the flat fixture; see the decision above) |

**C4. Mutants of the held oracle, with the held tests.** Each mutant removes one new check. Each one fails the self-test.

| Mutant | First failing case |
| --- | --- |
| no per-database loop (step 4) | "names in one string" (and test 1: the `012` message) |
| no key check (step 3) | "one database with the names of both" |
| no union check (step 5) | "future 012 in another migration list" (missing exception) |
| no form check (step 2) | "one flat list" |

## Harness-only checks, typecheck and inventory

The checks ran in a private clone of HEAD `894c019` with the two held files (`npm --prefix tests ci --prefer-offline` exit 0).

| Check | Result |
| --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0. Self-checks **71 of 71** PASS (70 before; +1 is the new test 2). Typecheck PASS. "392 API cases, 96 host rows (72 AC-M1-41); **488** mandatory rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70". |
| `--harness-only --provider canvas` | exit 0. 71 of 71. 347 rows (common and Canvas). |
| Joined inventory by owner (the runner's `readManifests` and `joinInventory`) | common 114, Blackboard 141, **Canvas 233** (225 API `sim`, 7 browser `sim`, 1 API `snapshot-isolated`); total 488. Byte-identical to the same count on `82e2dab`. |
| `npm --prefix tests run typecheck` in the worktree | exit 0 |
| `git diff --check` on the two test files | exit 0 |

## Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/backup-manifest-qa-20261021T0505Z`. The files hold only shapes, counts, codes and first message lines of synthetic data.

| File | SHA-256 (first 12) |
| --- | --- |
| `harness/control.mjs` | `8507add333c3` |
| `harness/inventory.mjs` | `dfc08f00e3c7` |
| `evidence/c1-emitter-controls.json` (C1 and C2) | `09039a0ffb69` |
| `evidence/selftest-fix.tap` | `5c1d88d02226` |
| `evidence/selftest-cross-new-tests-old-oracle.tap` | `60c2407bf16c` |
| `evidence/selftest-cross-old-tests-new-oracle.tap` | `b3e6ef0429d4` |
| `evidence/selftest-m1-no-per-db-loop.tap` … `m4-no-shape-check.tap` | `bc896ebf2391`, `cfc09cf6626e`, `cb6adc107627`, `536104cda81b` |
| `evidence/harness-only-all.txt` | `ff98ecabae7d` |
| `evidence/harness-only-canvas.txt` | `c1f6c57d1fd1` |
| `evidence/inventory-fix.json` = `inventory-base.json` | `cd002b7f97fa` |

## Held files

| File | SHA-256 before (`82e2dab` = HEAD) | SHA-256 after |
| --- | --- | --- |
| `tests/host/m1-migration.mjs` | `9a96656d5027285a1b3769c0da3a4aa5d3feb53911673f55c030af68f39561f6` | `1be7c1c9d4028daffa2f5fbc9eb54b99804f2922eab0a1d7351bbe7e26a6cc75` |
| `tests/host/m1-migration.selftest.mjs` | `80f2fd4b5e0763775edf7e12fa9d2ad0d2f39e3bf96416e21e9bfded4cf0994f` | `20745f2ae60818f260e2907893c76156133db8f2e50e78228f5886cce434fe5a` |
| `docs/reviews/M1/backup-manifest-qa.md` | new file | given in the completion message (a file cannot contain its own hash) |

## Limitations

- **Not run:** Docker, the runner phases, the real callers `migrationRun` and `snapshotMigrationRun`, the maintenance container, `volumeLedger` and `volumeSnapshot` through the fixture container. C1 and C2 call the real emitters and the real exported oracle in a host process, with QA's own ledger and file reads in their place.
- C1 used the product's legacy-source `9f96f7b` emitter. That build has no volume backup, and the runs never use it for the backup; it shows only that the form is old.
- The self-test databases are text files, not SQLite. The oracle never opens them. C1 used real SQLite files.
- The phase `migration` (AC-M1-23/30) did not run in the failed attempt. It uses the same oracle with the `b0b83a8` ledger. C1, C2 and test 2 cover that ledger on the host only.
- Other assertions after line 84 in the failed snapshot route never ran. This repair gives them no evidence.

## Next

1. The Lead commits the three held files by exact path.
2. Reviewer-A and Reviewer-B review the repair independently.
3. The Lead freezes a new candidate SHA.
4. A new Docker window runs the full acceptance again from a fresh clone.

Until then, all M1 rows keep their current status.
