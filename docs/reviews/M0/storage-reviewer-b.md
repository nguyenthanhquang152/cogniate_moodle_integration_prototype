Verdict: CHANGES_REQUESTED
Round: 1

# Storage design review — Reviewer-B (operability, minimality, test claims)

Reviewer: dedicated independent Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_fe7b1645e3a0`, dispatch `ctx_2646adf72f56`. Date: 2026-10-21.

This review covers the design only. It gives no implementation approval and does not open the implementation gate. One BLOCKER and four MAJOR findings are open, so the verdict is CHANGES_REQUESTED.

## 1. Scope and method

- Frozen candidate: `6a5eb6a89b3ee6bb377f93244b00e6488e9e2314`. Product and test files equal `8138097889f87359d5055bb1d79766b5ed842f92`: no path outside `docs/**` changed.
- Reviewed files:
  - `docs/architecture/adr/ADR-012-sqlite-volume-storage.md`, the new contract;
  - amendments to ADR-006, ADR-011 §14, `local-stack.md`, `tasks/M1.md` (AC-M1-23, AC-M1-30, AC-M1-38 (h1), the new AC-M1-41 and the supplemental tests) and `tasks/M3.md` (AC-M3-01, owners, independence rule);
  - the index and role amendments in `docs/architecture/README.md` and `tasks/README.md`.
- Context read: charter, phase plan up to `6a5eb6a` (diagnosis and Lead scope `msg_9cf2186e296b`), and the current `infra/**` scripts.
- Feasibility checks against unchanged source at the candidate:
  - `infra/compose.yaml`;
  - `infra/scripts/{lib,stack-up,stack-restart,stack-reset,stack-down,e2e-reset,qa-suite,stack-data,build-runner}.sh`;
  - the app store and upload code;
  - `tests/host/{m1-migration,p5-fixture,run-t1}.mjs`.
- The old builds' `lib.sh`, `stack-up.sh`, `stack-restart.sh` and `compose.yaml`, read with `git show` at `b0b83a8289e1bf9cf349068aca184f0879e9aaf0` and `9f96f7b24cd0aed702e4dc40373bdda4307aad31`.
- No Docker, stack, product run, edit, commit or data import. No `docker compose` command was run, so I did not observe Compose merge or `config` behaviour.
- Blind review: I did not read `storage-reviewer-a.md`, `storage-qa.md`, any other new storage review or any worker draft.
- Clean detached clone: `/tmp/cogniate-reviewer-b-claude-6a5eb6a-du37d9/src`.

Private model probe. It encodes the ADR-012 §5 start-state table and the §7 recovery table as written, then enumerates every journal pair that the stated "lti journal first, then app journal" write order can leave after a crash:

```sh
node /tmp/cogniate-reviewer-b-claude-6a5eb6a-du37d9/probe/journal-table-probe.mjs \
  /tmp/cogniate-reviewer-b-claude-6a5eb6a-du37d9/probe/journal-table-probe.results.json
```

- Script SHA-256: `38441cf9b27b46bca040e4189887877c25ad88735c8d448e9b089b59b1a0919a`.
- Results SHA-256: `0303974f53cb6cc07654af0fc727f1d8be22fa9772b70f9c4ffe26029a334823`.
- Result: 3 recovery gaps, 2 start-state gaps and 2 multiple-reason refusals. This is a model of the text, not of an implementation. B-S-03, B-S-04 and B-S-06 use these results.

## 2. What the design does well

- **Honest diagnosis.** §1 makes no claim about Docker-version cause, universal bind failure or other hosts. AC-M1-41 (c) records `NOT APPLICABLE`, never a PASS, where QA's own oracle shows enforcement. No assertion assumes that the host fault always exists.
- **No product code change.**
  - The app writes only `cogniate.db` and its sidecars, `packages/` and `uploads/` under `/data` (`package-store.ts:13`–`:19`). The LTI service writes only `lti.db`.
  - The upload rename stays inside `uploads` (`upload.ts:109`). Extraction writes files into `packages/` and never renames across the two nested mounts. The Build Runner reads the host `uploads` folder (`build-runner.sh:31`).
  - So the content and Build Runner paths stay valid.
- **The old-build hook exists.** Both old builds' `dc()` adds `.tmp/compose.knobs.yaml` and exports `HOST_UID`/`HOST_GID` (b0b83a8 `lib.sh:39`–`:40`, `:92`–`:96`; 9f96f7b `:39`–`:40`, `:105`–`:109`). They use the same `node:24.22.0-alpine3.24` image.
- **Same SQLite driver.** The product uses `node:sqlite` (`packages/shared/src/migrations.ts:7`), the driver available to the probe in that image.
- **Sound restore design.**
  - The backup manifest is written last.
  - Restore keeps the old generation until both volumes are verified.
  - There are bounded exit codes, and no output says "no target changed" after a change.
- **Clear scope.** The old-build evidence qualifier and the "never unchanged old infrastructure" wording keep labels honest. AC-M3-01 requires every stack-level rerun on the new candidate.

## 3. Required fixes

### B-S-01 — BLOCKER — The owner rule refuses every start after the first

- Location: ADR-012 §4 step 1 (line 78), with §3 line 59 and §10 assumption 1 (line 256).
- Problem: step 1 fails `owner_mismatch` when "any existing file or folder inside has another owner". But Docker creates the nested-bind mountpoints `/data/packages` and `/data/uploads` inside the `appdb` volume as root (runc makes a missing mount target as root, mode 0755, before it starts the process as `HOST_UID`). The preflight container mounts `appdb` without the nested binds, so it sees two root-owned folders.
- Schedule:
  1. Fresh lane: `stack:up` → `FRESH`, and the preflight passes on empty volumes.
  2. `dc up` → cogniate-app starts, and Docker creates `appdb/packages` and `appdb/uploads` as `root:root`.
  3. Any next guarded start (`stack:down` then `stack:up`; `stack:restart -- <svc>`; the second `stack:up` inside `test:acceptance`, `qa-suite.sh:45`/`:56`) → step 1 → `owner_mismatch` → nothing starts.
- The same problem applies to any file that a root maintenance container writes. §7 does not state the user of the maintenance, restore and import container.
- Consequence: the stack cannot restart. AC-M1-41 (e), (f) and (g) ("then `stack:up` starts"), AC-M1-23 step 5 and every M1 `stack:restart` case fail. The old routes fail the same way, because the override adds the same nested binds.
- Narrow fix:
  - State that the preflight, on `appdb`, creates `packages` and `uploads` as `HOST_UID:HOST_GID` mode `0700` before the first service start. Alternatively, exempt exactly these two folders from the owner rule when they are empty folders.
  - State that every maintenance, restore and import writer runs as `HOST_UID:HOST_GID` after its own root-folder step, so no root-owned entry appears.
  - Add AC-M1-41 (a2): the second `stack:up` after the app has run passes, and a `stack:restart -- cogniate-app` passes.

### B-S-02 — MAJOR — Rollback mode: routine old commands silently move a service back to an empty bind database

- Location: ADR-012 §8 lines 230, 235 and 238; ADR-011 §14 rollback step 3 (line 408); old `stack-restart.sh` (b0b83a8 `:45`, `:52`; 9f96f7b `:49`, `:56`); `stack-reset.sh:31`.
- Problem: the documented operator rollback leaves the old build running with the override, and nothing limits it afterwards. In that state, routine old commands rewrite or remove the override:
  - old `npm run stack:restart -- lti-service`, with or without `--env`, replaces or deletes `services.lti-service` in `.tmp/compose.knobs.yaml`;
  - when the last service section goes, old `stack-restart.sh` removes the whole file;
  - old `stack:reset`, `e2e:reset` and `test:e2e` delete the file.
- Schedule:
  1. Roll back to `b0b83a8` with the override.
  2. An operator runs `npm run stack:restart -- lti-service` to restart one service.
  3. The old script deletes `services.lti-service`, and the service is recreated with the base bind `./.data/lti-service:/data`.
  4. The old `stack-up.sh:25` already made that folder, so it is empty and present. The LTI service opens a new empty `lti.db`, runs its migrations and reports healthy.
  5. Platforms and keys disappear from the running service, launches fail, and new writes go to the failing bind mount.
  6. The real data stays in `ltidb`, disconnected. The next candidate `stack:up` then refuses (§6, legacy and volume databases both exist). The bind-side writes cannot be imported, because volumes are not `FRESH`.
- §8 forbids old `stack:restart` and `stack:reset` only for QA routes "before the route ends". The QA mount check (line 236) would detect this in a QA run, but no technical guard exists, and the operator procedure states no such limit.
- Consequence: line 238's claim "No route and no documented procedure returns live data to a bind folder" holds only if the operator never uses ordinary commands, and the result is split-brain data.
- Narrow fix:
  1. In ADR-011 §14 rollback and the M4 operator guide, list the old commands that are forbidden while the override is enabled: `stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo:prepare`. Give the supported restart (`stack:down`, the preflight, `stack:up`).
  2. State that rollback mode is temporary, until the next upgrade.
  3. Give a check that operators can run (for example `npm run stack:storage-compat -- status` from the candidate tree): the running containers mount the two volumes.
- Optional fail-closed tripwire: `enable` places a non-SQLite sentinel at `infra/.data/lti-service/lti.db` and `infra/.data/cogniate-app/cogniate.db`, and the §6 scan recognizes it. A service that lands on the bind then fails to open its database instead of creating an empty one.

### B-S-03 — MAJOR — An interrupted import, or a restore into an empty lane, leaves a state that no start row matches; the import cannot be retried

- Location: ADR-012 §5 lines 124–129; §7 lines 188, 191 and 214; §6 import step 2 (line 151).
- Problem: the probe's start-state gaps.
  - A `rolled_back` operation whose target was `FRESH` leaves no database and no identity, but both journals remain, and `.previous-<opId>/` remains after a swap (line 188 removes only `.restore-<opId>/`).
  - `FRESH` requires "no journal, no `.previous-*`". `OK` requires identities. No refusal row matches either.
- Schedule:
  1. Two FRESH volumes and legacy files.
  2. Run `stack:data-import`. Kill it at `staged`, or at `swapped`.
  3. `--recover` gives a verified `rolled_back`.
  4. `stack:data-import` again → refused (not `FRESH`). `stack:up` → refused (§6, last row).
  5. The only exits are `stack:reset`, which also deletes the Moodle volumes, or an undocumented manual delete.
- Consequence: line 214's claim "there is no permanent refusal" is false for every interrupted import and every restore into an empty lane.
- Narrow fix:
  - Define `FRESH` to also accept both journals `rolled_back` with the same `opId`, with no database or identity.
  - Have a rollback of an operation with an empty `before` list remove its now-empty `.previous-<opId>/`.
  - Add drills to AC-M1-41: an interrupted import, then `--recover`, then a successful second import; and the same for a restore into an empty lane.

### B-S-04 — MAJOR — The first journal write is outside every recovery row

- Location: ADR-012 §7 line 177 (write order), lines 199–207 (recovery table) and line 216 (drill list).
- Problem: each state change goes to the lti journal first. The first change, from no journal to `prepared`, can therefore leave:
  - lti `prepared` with opId X, and app without a journal (first operation); or
  - lti `prepared` with opId X, and app holding the earlier terminal journal of opId Y (any later operation).
- §5 refuses the start (`JOURNAL_OPEN`: not terminal, or the opIds differ) and names `--recover`. But recovery rows 1–4 all need both journals in the same operation, so recovery has no defined action. The probe finds these 3 reachable combinations and no other uncovered pair.
- Schedule: kill the restore process after the rename of the lti journal `prepared` and before the app journal write.
- Consequence: the operator is told to run `--recover`, and `--recover` cannot decide. The drill list starts at `prepared` (both written), so QA never exercises this boundary.
- Narrow fix:
  - Add a recovery row: "one journal open with opId X; the other has no journal, or has a terminal journal of another opId". No target file can have changed, because staging starts only after both are `prepared`. So remove `.restore-X/` if present, verify the lti targets equal `before`, and write lti `rolled_back`, leaving the other journal unchanged. Make `OK` accept this pair, or rewrite both journals as `rolled_back` X.
  - Add the drill `--stop-after prepared-lti`.

### B-S-05 — MAJOR — Nobody creates the nested-bind host folders

- Location: ADR-012 §3 line 48 ("unchanged host folders", owner "host user, 0700"); candidate `stack-up.sh:25`–`:28`; old `stack-up.sh:25` (both SHAs); `package-store.ts:19`.
- Problem: today the app makes `packages/`, `uploads/` and `uploads/.tmp` inside the `/data` bind. With nested binds, `infra/.data/cogniate-app/packages` and `…/uploads` must exist on the host before Compose mounts them. Neither the candidate contract nor the old builds' `stack-up.sh` creates them.
- The repo records the risk: `stack-up.sh:27` pre-creates the build-queue folders "else Docker makes them as root".
- Schedule (AC-M1-23 step 1 and AC-M1-38 (h1)): a fresh QA lane runs old `stack:up` with the override, and Compose creates the two missing sources. Where they are root-owned, the app's `prepareStore` cannot create `uploads/.tmp` (`package-store.ts:19`), and cogniate-app does not become healthy.
- Consequence: the old routes run in every full run, so they would be `BLOCKED`. A Linux operator's first candidate start fails the same way unless the Author adds a step the contract does not state.
- Narrow fix: state that the candidate's `stack-up.sh` creates both host folders as the host user with mode `0700` before any compose start. State that `stack:storage-compat -- enable`, or the harness and operator step before every old `stack:up`, creates them for the old builds.

### B-S-06 — MINOR — The refusal reason during a swap is not determined

- Location: ADR-012 §5 lines 126–128; AC-M1-41 (g) ("`stack:up` refuses (`JOURNAL_OPEN`)").
- Problem: at `swapped-lti` and `identity-lti`, both `JOURNAL_OPEN` and `IDENTITY_*` match; at some points `HALF_PAIR` also matches. The table has no order. An implementation that checks identity first prints "no automatic repair" instead of naming `--recover`, and AC-M1-41 (g) then fails on the reason text.
- Fix: state the order — `rollback_failed`, then `JOURNAL_OPEN`, then `UNKNOWN_ENTRY`, then `IDENTITY_*` and `HALF_PAIR`, then `FRESH`/`OK`.

### B-S-07 — MINOR — The human procedures cannot be run as written

- Locations: ADR-011 §14 upgrade step 2 (line 398); rollback step 3 (line 408); AC-M1-23 step 3 (`tasks/M1.md:203`).
- Problems:
  - On a single checkout of the old revision, `npm run stack:storage-compat -- disable` "from the candidate tree" does not exist before the switch. The order must be: switch to the candidate, then `disable`, then backup.
  - `dc --profile storage run --rm storage-preflight` is a shell function from the old `lib.sh`, not a command an operator can type.
  - The candidate guard (§8 line 239) covers only `stack-up.sh`. Candidate `stack:restart`, `seed` and the maintenance commands then run with the stale override merged.
- Fix:
  - Reorder the steps.
  - Give a runnable preflight command, for example `bash -c 'source infra/scripts/lib.sh && dc --profile storage run --rm storage-preflight'`, or a script that `enable` copies into `.tmp/storage-compat/`.
  - Extend the marker refusal to every candidate command that starts or recreates a container.

### B-S-08 — MINOR — Two refusals have no documented exit

- Locations: ADR-012 §7 line 207 (`rollback_failed`, exit 2) and §4 step 3 (line 80, `scratch_overflow`).
- `rollback_failed`: every start and every restore are refused (`JOURNAL_OPEN`), and the only automatic exit is `stack:reset`, which also deletes Moodle. Even a transient I/O failure has no retry path.
- `scratch_overflow`: each interrupted probe leaves up to three entries (`.db`, `-wal`, `-shm`). So four interrupted preflights, for example Ctrl-C or a Docker VM stop, exceed the cap of 9 and block every start, with no stated way out.
- Fix:
  - Document the supported exit from `rollback_failed`: preserve the evidence, remove only the two SQLite volumes, then restore from a backup into the empty lane. Optionally allow `--recover` to retry from `rollback_failed` when the cause was not a hash mismatch.
  - Drop the scratch cap: deleting only names that match `^\.lock-probe-[0-9a-f]{16}\.db(-wal|-shm)?$` is already safe. Otherwise document the cleanup command.

### B-S-09 — MINOR — The "legacy files are kept for reference" allowance ends at the first restore

- Location: ADR-012 §6 lines 145–146, with §7 line 186.
- Problem: after an import, `stack:up` continues only while `provenance.kind` is `import`. Any later restore writes `kind: restore`, and the identity carries no `legacySources`. The next candidate `stack:up` then refuses "legacy databases and volume databases both exist", in the middle of an upgrade or rollback window, for an operator who followed the earlier warning.
- Fix: carry `legacySources` forward when a restore keeps the `pairId`. Or have a committed import rename the legacy set aside (for example `<db>.imported-<opId>`) so that it no longer matches the scan.

### B-S-10 — MINOR — Two old-route checks cannot be satisfied exactly as written

- Location: ADR-012 §8 lines 234, 235 and 237; AC-M1-41 (i) and (j).
- Problems:
  - `docker compose config` leaves out services of inactive profiles. So item (d), the new `storage-preflight` service, is visible only when `--profile storage` is passed to both C0 and C1.
  - Old `test:acceptance` runs `stack:up` twice internally (`qa-suite.sh:45`, `:56`). The harness cannot run a preflight before each of these calls, yet line 237 requires one "before each old `stack:up`".
- Fix:
  - Specify the exact config commands, each step's stack profile plus `--profile storage`, for both C0 and C1.
  - Restate the rule: one preflight before each harness-invoked old command that starts services, with the mount check after that command covering its internal starts.

### B-S-11 — MINOR — SQLite state now belongs to the project name, not the checkout

- Locations: ADR-012 §3 line 61, §5 line 110; `local-stack.md:58`; charter §3a line 158; AC-M3-06.
- Problem: before, a new clone had new databases. Now a new clone with an existing project name silently inherits that project's `ltidb` and `appdb`. The identity check `composeProject` passes, while `gen-env` gives the new clone new master keys.
- Also, common cleanup commands now delete every Cogniate database: `docker system prune --volumes`, `docker volume prune -a`, and Docker Desktop "Clean / Purge data". §11 does not say so.
- Fix:
  - Document both facts in §11, `local-stack.md` and the M4 guide.
  - Make QA's boundary check show no `<lane>_ltidb`/`<lane>_appdb` before a fresh-lane run, and none after cleanup.
  - Optionally add a checkout id (in `.tmp/`) to the identity and refuse a mismatch.

### B-S-12 — MINOR — The legacy-suite change for P5 is not on the approved-change list

- Location: `tasks/M3.md:88` (AC-M3-02: "Tests may change only for these approved reasons … Any other change needs a new Lead approval"); ADR-012 §9 line 250.
- Problem: the storage move requires the T5b P5 fixture (`tests/host/p5-fixture.mjs:11`, which opens the host `cogniate.db`) to run in a one-shot container. That reason is not on AC-M3-02's list.
- Fix: add "ADR-012 storage access (database read or written through a container), assertions unchanged", with the test ids, to the AC-M3-02 list.

## 4. NITs

- **B-S-13 — §4 line 89.** "It runs before any service opens a database … no startup race" is not true for `stack:restart` or for `stack:up` on a running stack. Both run the preflight while services hold their databases. The probe never opens those files, so this is safe, but the sentence should say so.
- **B-S-14 — §8 lines 230 and 239.** Define the "storage-compat marker" as a named top-level `x-` key of the JSON override. Old `warn_knobs` then shows it, and the candidate scripts can test for it exactly.

## 5. Optional design preferences (not required)

- **O-1:** before an import, record `PRAGMA integrity_check` of a scratch copy (with its WAL applied) in the manifest. The legacy files come from the storage that lost writes. Warn, or refuse unless the operator confirms.
- **O-2:** treat `--stop-after` as a drill: require an explicit drill flag or variable, and log it. A crash-injection option then does not look like a normal operator choice.
- **O-3:** AC-M1-41 (b) shows that the volumes work: three times HTTP 200. To show that the layout caused the change, either add an information-only control of the same sequence on a scratch bind layout on the same host, or state that causality rests on the lock-level negative of (c).
- **O-4:** state that the AC-M1-41 (c) "QA-only test mount" uses the existing `.tmp/compose.knobs.yaml` hook, so no new product or infra option appears.
- **O-5:** AC-M1-41 rows are host-infrastructure checks, not simulations. The label `SIM` is acceptable inside the current label set; one sentence could say what it means here.

## 6. Procedure traces (summary)

| Procedure | Result against this contract |
| --- | --- |
| Fresh start | First start passes. The second start fails (B-S-01). Host nested-bind sources are not created (B-S-05). |
| Partial install, legacy at rest | Refusal and the `FRESH` volumes are correct (§6). An interrupted import cannot be retried (B-S-03). The kept-legacy allowance ends at the first restore (B-S-09). |
| Normal backup and restore | Manifest-last backup and verified paired restore are sound. |
| Crashed restore | The first-write boundary is not covered (B-S-04). The refusal reason is ambiguous during the swap (B-S-06). `rollback_failed` has no exit (B-S-08). |
| Old-build upgrade (AC-M1-23) | Feasible through the existing knobs hook in both old builds. Step order (B-S-07) and the config check (B-S-10) need precision. |
| Rollback to an old build | QA routes are covered by mount checks. Operators can silently reach an empty bind database (B-S-02). |
| Reset and cleanup | `stack:reset` removes both volumes (`down -v`) and the override file. Lane reuse and prune semantics are not documented (B-S-11). |

## 7. Remaining gate

Before a design APPROVE from this reviewer, the Architect must close B-S-01 to B-S-05 and answer B-S-06 to B-S-12. The NITs and optional items need no new round. Implementation, its independent source reviews, AC-M1-41 and all stack-level reruns at the new candidate remain separate gates. All 32 live LMS rows stay UNVERIFIED. Historical evidence keeps its labels and SHAs.
