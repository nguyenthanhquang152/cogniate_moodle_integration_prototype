Verdict: APPROVE
Round: 3 (bounded G1 disposition check of revision 3.2 at d0bdda0; see the last section)

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


## Round 2 — recheck of revision 2

Verdict: **CHANGES_REQUESTED**
Round: 2

Reviewer: the same dedicated Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_5f05dfacb229`, dispatch `ctx_b55641e6fd09`. Date: 2026-10-21. The Round 1 text above is unchanged.

This round gives no implementation approval and does not open the implementation gate.

### Scope and method

- Frozen design: `7a6374460dd02c3544b6dbf043086b0facefceb2`. Product and test files equal `8138097889f87359d5055bb1d79766b5ed842f92`: no path outside `docs/**` changed.
- Read at the frozen commit:
  - ADR-012 revision 2 (all of §1–§18);
  - `docs/architecture/review-response-storage.md`;
  - the amendments to ADR-006, ADR-011 §14 (lines 389–418), `local-stack.md` (line 60), M1 (AC-M1-23, the AC-M1-41 rows), M3 (AC-M3-02 line 92, AC-M3-06 line 96) and both indexes;
  - the Lead correction scope in the phase plan;
  - my Round 1 report (SHA-256 `4f95cf7d2b3cebaf583f72edc6a6b30abad14bb5f69521049eaf283c18fecad2`, committed in `2bb918f`).
- Source checks with `git show`:
  - old `seed.sh` and `lti-bootstrap.sh` at `b0b83a8` and `9f96f7b` use only `dc exec`;
  - both old `lib.sh` set `KNOBS_FILE` to an absolute path (line 9).
- I did not read `storage-reviewer-a.md`, `storage-qa.md`, any Round 2 review or draft of another worker, or the optional Author feasibility report itself. I used its summary in ADR-012 §17.
- No Docker, stack, product run, edit, commit or push.

Private model probe for revision 2. It encodes recovery rows R0–R6 and the relevant §6 rows. It enumerates every crash point that the stated write order can leave, for an `OK` or `FRESH` target, with or without an earlier terminal journal, including a rollback in progress.

```sh
node /tmp/cogniate-reviewer-b-claude-7a63744-bGC6Vd/probe/journal-table-probe-r2.mjs \
  /tmp/cogniate-reviewer-b-claude-7a63744-bGC6Vd/probe/journal-table-probe-r2.results.json
```

- Script SHA-256: `d845ec67914b5e6815f6aedea8fadb959c20b8a151168b2ef29d7a95a1ef856d`.
- Results SHA-256: `20b5afd2c2dbcc740157c08b2a948b7bf59cd0602bafa4b9f95c395f7066cff6`.
- Result: 44 crash points and 0 failures. Each point goes to R1–R4 (never R5 or R6) and ends in `FRESH` or `OK`, and a second `--recover` gives R0.
- This is a model of the text, not of an implementation.

### Recheck of Round 1 findings

| Id | Round 2 disposition | Basis |
| --- | --- | --- |
| B-S-01 | **Closed** | §3 allowed-children table; §4 volume-side steps (no recursion, no symbolic links, an empty root-owned mountpoint is fixed once); maintenance writers drop to `HOST_UID:HOST_GID` (§4 line 91). Author facts M1–M3 support it. Rows `a-second-start`, `a-restart`, `d-mountpoint`. |
| B-S-02 | **Closed** (required part) | ADR-011 §14 lines 413–416: rollback mode is temporary, the forbidden old commands are listed, the supported restart is given, and `status` checks the knobs hash and mounts. ADR-012 §12 command rule. The sentinel tripwire was optional; I accept that it is not adopted, given the Lead scope. |
| B-S-03 | **Closed** | §6 row 13 (`FRESH` accepts terminal `rolled_back` journals), §8 line 269 and R3 (an empty `before` removes the new identities and the empty `.previous-X/`). Probe: every FRESH-target point ends in `FRESH`. Rows `e-import-recover`, `g-fresh-target`. |
| B-S-04 | **Closed** | R1 (§8 line 283), drill point `prepared-lti`. Probe: both first-write cases end in `FRESH`/`OK`. |
| B-S-05 | **Closed** | §4 host side (line 77): create the three content folders as the host user, mode 0700, before any compose start; `content_path_unsafe`; no host `chown`. `enable` also creates them (§12 line 385). Row `d-content-folder`. |
| B-S-06 | **Closed** | §6 is total and ordered; rows 1–3 come first; row 18 catches everything else. |
| B-S-07 | **Closed** | Upgrade order (§12 line 434, ADR-011 line 400); the copied `bash .tmp/storage-compat/storage-compat.sh` runs after the old checkout; the candidate guard covers every start and data command (§12 line 430). |
| B-S-08 | **Closed**, apart from B-S-15 below | The `rollback_failed` exit is quarantine (§9); R5 changes nothing, which I accept; the scratch cap is dropped (§5 step 3). |
| B-S-09 | **Closed** | `legacySources` survive a same-pair restore (§8 line 248, §10 line 354). Row `e-provenance-restore`. |
| B-S-10 | **Closed** | C0/C1 through the old `dc()` with `--profile storage` and the step profiles, compared by `target` (§12 lines 401–410); the preflight is before each harness-invoked old start command, with `status` after it (§12 lines 425–428). |
| B-S-11 | **Closed**, with my correction below | §15, `local-stack.md:60`, AC-M3-06. |
| B-S-12 | **Closed** | AC-M3-02 approved-change list (`tasks/M3.md:92`). |
| B-S-13 | **Closed** | §7 "Running services" (lines 217–220). |
| B-S-14 | **Closed** | Marker key `x-cogniate-storage-compat` (§12 line 382); C1 item (e). |
| O-1 | Not adopted; accepted | A hot journal and unknown legacy entries now refuse. A data-quality check stays operator guidance. |
| O-2 | Done | `STORAGE_DRILL=1` gate and the `storage_drill_stop` log (§8 line 302). |
| O-3 | Done | §13 line 471 puts the cause claim on the lock-level rows. |
| O-4 | Done, changed; accepted | QA runs the probe in its own fixture container (§11, §14). No new option. |
| O-5 | Done | M1 AC-M1-41 defines `SIM` for these rows. |

**Correction to Round 1 B-S-11.** In Round 1, I wrote that `docker system prune --volumes` deletes every Cogniate database. That was wrong. The installed `docker system prune --help` and Docker's command reference say that `--volumes` prunes anonymous volumes only. `docker volume prune --all` removes unused named volumes, so it does delete these databases. Revision 2 states this correctly (§15 lines 496–499, `local-stack.md:60`). The rest of B-S-11 stands and is closed.

### New findings in revision 2

#### B-S-15 — MAJOR — Quarantine cannot remove volumes that stopped containers still use

- Location: ADR-012 §9 lines 327–331 ("Remove only the two volumes"); ADR-011 §14 rollback step 1 (line 408); §12 line 422 (the harness's `stop`); `tasks/M1.md:271` (`g-quarantine`, from the `g-tamper` state).
- Problem:
  - Every maintenance precondition accepts "positively stopped" services. Stopped containers count (`infra/scripts/stack-data.sh` accepts `exited`, `created`, `dead` or absent).
  - The documented stop (`docker compose stop`, the harness's `stop`) keeps the `cogniate-app` and `lti-service` containers, and those containers keep their references to `<project>_ltidb` and `<project>_appdb`.
  - Docker refuses to remove a volume that any container references, running or stopped ("volume is in use").
  - §9 removes only the two volumes. It does not remove those containers or name this condition.
- Schedule:
  1. Run `docker compose stop cogniate-app lti-service`.
  2. Run `stack:data-restore`, then `--stop-after swapped`, then tamper one byte in `.previous-X/`, then `--recover` → `rollback_failed`, exit 2. This is `g-tamper`.
  3. `stack:data-quarantine -- --out Q`: the copy is verified, then `docker volume rm <lane>_ltidb` fails.
  4. Quarantine exits 1 and removes nothing. The lane stays `rollback_failed`.
  5. The documented commands then offer no exit. `stack:reset` is forbidden as a recovery step, and removing the containers by hand is not documented.
- Consequence:
  - The only exit from `rollback_failed` and `journal_inconsistent` fails in its own main scenario, and `g-quarantine` fails as specified.
  - The failure is safe (nothing is removed, and the copy is verified), but the operator is left without a documented next step.
- Narrow fix:
  - After the verified copy, with both services positively stopped, quarantine removes the project's `cogniate-app` and `lti-service` containers. They hold no data, and the next guarded `stack:up` recreates them.
  - It refuses `volume_in_use`, naming the container, when any other container still references a lane volume. Only then does it remove the two volumes.
  - `g-quarantine` starts from services stopped with `docker compose stop`. Its oracle also records that both containers were removed and no other container changed.
  - An alternative is to require old or candidate `stack:down` before quarantine, and say so in §9, ADR-011 §14 and the refusal message.

#### B-S-16 — MINOR — The operation lock has no documented exit for a false-live owner, and the old checkout lacks the lock helper

- Location: ADR-012 §7 lines 199–203; §12 lines 386 and 389.
- Problems:
  - A stale lock is detected only by "pid no longer runs". After a host reboot, or with pid reuse, an unrelated process can have the recorded pid. Every guarded command then waits 120 s and refuses `operation_in_progress`, and the remedy (removing `.tmp/storage-op.<project>.lock/`) is not documented.
  - The lock lives in the checkout's `.tmp/`, so it is per checkout and project, not "per project" as written.
  - `enable` copies only the probe and `storage-compat.sh`, so `infra/scripts/storage-oplock.sh run -- <command>` (line 203) does not exist after the old checkout for operator-invoked old steps.
- Fix:
  - Record a boot id or the process start time with the pid, and treat a mismatch as stale.
  - Name the manual removal in the refusal message and the M4 guide.
  - Say that two checkouts sharing one project name are unsupported.
  - Copy and hash the lock helper with the other compatibility files, or add `storage-compat.sh run -- <command>`.

#### NITs

- **B-S-17:** §17 assumption 2 is already settled by source. Both old `lib.sh` set `KNOBS_FILE="$REPO_ROOT/.tmp/compose.knobs.yaml"` (line 9), an absolute path. So the relative `-f` behaviour of M6 does not apply to the old `dc()`.
- **B-S-18:** AC-M1-23 step 1 and AC-M1-38 (h1) start a fresh lane on the old SHA. State that QA runs `npm run stack:storage-compat -- enable` in the candidate checkout of the same clone before the old checkout, as the rollback order does (§12 line 440).
- **B-S-19:** state that the preflight writes every output and log line after the privilege drop. A failure during the root-only prepare step must not create a root-owned `infra/.logs/storage-preflight.jsonl` on a host that keeps real owners.

### Remaining gate

The required fix before a design APPROVE from this reviewer is B-S-15 (MAJOR). B-S-16 is a required MINOR that may be closed in the same correction or recorded for the build step. The NITs need no new round. Revision 2 closes every Round 1 BLOCKER and MAJOR of this report. Implementation, its independent source reviews, the 63 AC-M1-41 rows and every stack-level rerun at the new candidate remain separate gates. All 32 live LMS rows stay UNVERIFIED, and historical evidence keeps its labels and SHAs.


## Round 3 — recheck of revision 3

Verdict: **APPROVE** (design only)
Round: 3

Reviewer: the same dedicated Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_31dd99af646c`, dispatch `ctx_9ba10725b220`. Date: 2026-10-21. Rounds 1 and 2 above are unchanged.

The approval covers the storage **design** only. It is not an implementation approval or acceptance, and it does not open the implementation gate by itself. One required MINOR precision fix (B-S-20) and one NIT stay open.

### Scope and method

- Frozen design: `b3bd22e2ada43f45499db5e50cfb4cafc8295fb9` (ADR-012 revision 3). Product and test files equal `8138097889f87359d5055bb1d79766b5ed842f92`: no path outside `docs/**` changed.
- Read at the frozen commit:
  - ADR-012 §4–§18;
  - the Round 3 section of `review-response-storage.md`;
  - ADR-011 §14 (lines 397–420);
  - the M1 AC-M1-23 step 1 and AC-M1-41 rows (lock, orphan and quarantine rows, the self-check list);
  - my committed Round 2 report (SHA-256 `16b857b032d430fa67fc1db4375cc25a8d8dea109616be1b6e06059f5d84a338`).
- Source check with `git show`: `infra/scripts/stack-down.sh:7` in `b0b83a8`, `9f96f7b` and the candidate.
- The §6 rows and the R0–R6 conditions are identical to revision 2; only the R3 and R4 action texts changed. So the Round 2 model result still applies: 44/44 crash points recover to `FRESH` or `OK`, and a second `--recover` gives R0.
- I did not read `storage-reviewer-a.md`, `storage-qa.md`, or any other worker's Round 3 report or draft.
- No Docker, stack, product run, edit, commit or push.

### Recheck of Round 2 findings

| Id | Round 3 disposition | Basis |
| --- | --- | --- |
| B-S-15 | **Closed** | §9 steps 1–5 (lines 431–445). After the verified copy, quarantine lists every container that uses a lane volume. It removes by id, without `-f` or `-v`, only the project's `lti-service`/`cogniate-app` containers that are not `run` containers and are `exited`, `created` or `dead` on a second read. Any other user → `volume_in_use`, with nothing removed. It then removes the volumes and writes `quarantine.json`. The exact Round 2 schedule is now a row: `g-quarantine` starts from the harness's `docker compose stop` and checks the container list (`M1.md:281`). `g-quarantine-in-use` (`M1.md:280`) proves the refusal with a QA container that is created but never started. |
| B-S-16 | **Closed**, apart from B-S-20 | Process identity (`pid`, `pidStart`), so a reused pid or a pid after a reboot is not live (§7 lines 228–231). `operation_lock_invalid` has a manual exit. "One checkout per project" (§7 line 274, §15 line 629). The lock helper is copied and hashed (§12 lines 507–520). Rows `a-lock-wait` and `a-lock-stale` (including a live pid with another `pidStart`). |
| B-S-17 | **Closed** | §12 line 515 and §17 S1. |
| B-S-18 | **Closed** | §12 line 578; `M1.md:208` (AC-M1-23 step 1: `enable` in the candidate checkout before `git checkout b0b83a8`). |
| B-S-19 | **Closed** | §4 privilege rule (line 95) and §5 output (line 153): no file or log line as root, also after a root-step failure. |

**Earlier closures, rechecked:**
- B-S-01 to B-S-14 remain sound in revision 3.
- The new §5 order — read, journal gate, preparation that only records an unsafe mountpoint, privilege drop, cleanup, table — removes my Round 1 concern about root writes.
- The legacy table is now first-match and total (L1–L7). Journal refusals still come first.
- Old start commands now run only through the copied `storage-compat.sh run --`. It is old-only (`git rev-parse HEAD` must be one of the two SHAs) and runs: lock, hashes, preflight, command, `status`, release. The rollback-mode restart is old `stack:down`, then `run -- npm run stack:up` (ADR-011 line 415).
- The effective-config allow list (a)–(e) is unchanged and precise.

### Old procedures traced as an operator would run them

| Procedure | Result |
| --- | --- |
| Fresh old-route lane | Candidate checkout → `enable` (host folders, copies, four hashes) → `git checkout <old>` → `storage-compat.sh run -- npm run stack:up`. Runnable. |
| Rollback | Stop → `stack:data-restore` (lock) → `enable` → `git checkout <old>`, install, build → `run -- npm run stack:up` → `status` inside. Runnable. |
| Restart in rollback mode | Old `stack:down` → `run -- npm run stack:up`. Runnable; forbidden commands listed (ADR-011 line 414). |
| Upgrade from rollback mode | Old `stack:down` → `git checkout <candidate>` → `disable` (lock) → `stack:data-backup` → `stack:up`. Runnable; the candidate guard refuses a skipped `disable`. |
| `rollback_failed` | Quarantine from services stopped by `docker compose stop`, or after `stack:down` (no containers) → `FRESH` → restore a known backup. Runnable. |
| Killed client with a running storage container | `storage_writer_active` names the container → wait, or `docker stop <name>` → `--recover`. Runnable (`g-orphan-*`). |

### New findings in revision 3

#### B-S-20 — MINOR (required precision fix) — The lock's mutual exclusion depends on two primitives the contract does not pin

- Location: ADR-012 §7 lines 230–232 (`pidStart`, liveness), 240 (A2), 243 (A5), 252 ("the only primitives are `mkdir`, `rename` and `ps`"); §17 assumption 4.
- Problem 1, `rename` versus `mv`:
  - A2 and A5 rely on `rename(2)` semantics. A directory rename onto a non-empty directory fails, and a second takeover to the same `stale-<id>` name fails.
  - Shell `mv src dst` (BSD and GNU, without GNU's `-T`) moves `src` **into** an existing directory `dst`, and succeeds.
  - With `mv`, A2 succeeds while a lock is held, and a second takeover nests inside `stale-<id>`, so the takeover proof (lines 246–250) does not hold.
- Problem 2, locale-dependent `pidStart`:
  - `ps -o lstart=` prints a locale-formatted date (`%c` style).
  - Schedule: a holder writes `pidStart` from a shell with one `LANG`/`LC_ALL`, for example a Vietnamese-locale operator terminal. A contender compares from another locale, for example a harness or `cron` environment in the C locale. The strings differ, so a live owner looks stale.
  - If the owner has no active storage container at that moment (for example `stack:up` inside `up --wait`), A5 takes over a live lock.
  - Other checks limit the damage: data commands still require stopped services. But the guarantee "a takeover never removes a current owner" (line 246) is broken.
- Detection: a wrong `rename` would make `a-lock-wait` or the "two contenders" unit case fail, so problem 1 is detectable. No row or unit case covers problem 2.
- Fix:
  - State that every §7 `rename` is the `rename(2)` system call on the folder, for example through `node:fs.renameSync`, never `mv`. Node is already a host requirement.
  - Run `ps` with `LC_ALL=C` both when `pidStart` is written and when it is compared, or record an epoch value.
  - Add a unit case with a non-C locale on one side.
- This fits in the design text or the implementation brief. It is not a design change.

#### B-S-21 — NIT — `stack:down` removes containers

- Location: ADR-012 §7 line 299 ("It only stops services") and §9 line 443 ("`stack:down`, which keeps the stopped containers").
- Fact: in all three trees `stack-down.sh:7` is `docker compose … down --remove-orphans`. That removes the service containers and the project network, and keeps volumes and the knobs file.
- The quarantine outcome is unchanged (no users remain), but the two sentences should state the fact.

#### Observations (no finding)

- **Maintainability of the lock.** The lock now has four record folder kinds and six acquisition steps. That is a real maintenance cost, but it is the bounded answer to an orphaned writer after `SIGKILL`. The unit list (`M1.md:307`) and the four `a-lock-*` rows cover it. I accept it.
- **Leftover `stale-<runId>/` folders.** They are never deleted by storage commands (§7 line 225), so an operator checkout keeps one per killed command. The M4 guide may say that they can be removed when no storage command runs.

### Remaining gate

- Design: no open BLOCKER or MAJOR from this reviewer. B-S-20 must be applied before or with the implementation brief. B-S-21 is optional wording.
- Implementation of ADR-012, its independent source reviews, the 72 AC-M1-41 rows (488 rows per full round), and every stack-level rerun at the new candidate (both full M1 rounds, both old routes, the legacy suites, M2 and three T7 runs) remain separate gates.
- §17 assumptions 1–9 remain unmeasured until the build step. All 32 live LMS rows stay UNVERIFIED. Historical evidence keeps its labels and SHAs.


## Round 3 bounded-disposition addendum — revision 3.1

Verdict for the bounded correction: **APPROVE** (design only)

Reviewer: the same dedicated Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_95e51fff8e37`, dispatch `ctx_60080f82e427`. Date: 2026-10-21.

This is a bounded check of my Round 3 findings and of regressions caused by the corrections. It is not a fourth general review.

**Changes to earlier bytes:**
- Lines 1–2 of this file are the current top verdict header. They were "Verdict: CHANGES_REQUESTED / Round: 1" (the Round 1 header, never updated). They now state the current verdict.
- Every other earlier byte is unchanged: lines 3–420 equal the committed Round 3 report at `a65a4ee` (SHA-256 of the whole committed file `42dd201aa7fdbe28f3b83681438cc3310a36106fd7daf026565d71eae6205b60`).

### Scope and method

- Frozen correction: `a65a4eec669c4a98aac80ff6b3dc3d1f55813dd0` (ADR-012 revision 3.1), compared with `b3bd22e2ada43f45499db5e50cfb4cafc8295fb9`. Product and test files equal `8138097889f87359d5055bb1d79766b5ed842f92`: no path outside `docs/**` changed.
- Read:
  - the full ADR-012 diff;
  - the "Round 3 bounded corrections" section of `review-response-storage.md`;
  - the M1/M3/ADR-006/ADR-011/index diffs;
  - the Lead's Round 3 escalation in the phase plan;
  - G1 in `docs/human_review/decisions-needed.md` (UNRESOLVED, committed at `9124cfd`).
- Source check with `git show`: `stack-down.sh` and `lib.sh` (`start_build_runner`, `stop_build_runner`) at `b0b83a8` and `9f96f7b`.
- `git diff --check b3bd22e a65a4ee -- docs/architecture`: clean.
- I did not read any other worker's addendum or Round 3 report. No Docker, stack, product run, edit, commit or push.

### Dispositions

| Id | Disposition | Evidence |
| --- | --- | --- |
| B-S-20 (required MINOR) | **Closed** | ADR-012 §7 "Primitives": every lock folder move and record write goes through `node:fs.renameSync`/`fsync`, never shell `mv`, with the reason (`mv` moves into an existing folder). §7 lock records: every `ps` call, for writing and comparing, runs with `LC_ALL=C`. Self-check scenarios `rename-held` and `locale` (§7 table), run once per round before the `storage` phase; a failure makes the phase `BLOCKED` (§13, M1 harness self-checks). Unit case with a non-C locale (M1 self-check list). Architect probes P1–P3 (§17) match my Round 3 schedule: `mv` nests, and `fr_FR` changes the `lstart` text. |
| B-S-21 (NIT) | **Closed** | §7 `stack:down` row and §9 line "So both documented stops…": `down --remove-orphans` removes the service containers and the project network, and keeps the volumes and the knobs file (source fact S8, confirmed: `stack-down.sh:7` in all three trees). The row adds "Do not run it while a storage command runs" and states the unmeasured effect on a running storage container (§17 assumption 11) as a crash handled by §8. |
| B-S-15 | **Not reopened**; strengthened | §9 step 1 now removes the command's own ended copy container (by its run label) before step 2. So the volume-user list never contains the quarantine's own container. Steps 2–5 are unchanged. |
| B-S-16 | **Not reopened** | Owner identity (`pid`, `pidStart`) is unchanged apart from `LC_ALL=C`. The new group rule (below) only adds liveness, so it can make a command wait, never take over a live owner. `operation_lock_invalid`, "one checkout per project", and the copied and hashed helper are unchanged. |
| B-S-17, B-S-18, B-S-19 | **Not reopened** | The §12 source fact, the fresh old-lane order and the privilege rule are unchanged by this diff. |

### Operability of the changed ownership mechanism (A-S-12 group rule)

The new rule keeps a record live while any process of its `pgid` remains. I traced it as an operator and a harness would meet it:

- **Interactive terminal** (the normal operator path): each command line is its own job group. After a normal end, release removes the record. After a kill of the whole job (`Ctrl-C` with the trap, or `SIGHUP` on a closed terminal), the group empties. If a storage container still runs, `storage_writer_active` names it, with the documented exit. Operable.
- **Candidate Build Runner:** `stack:up` starts it in its own group (§7 "Long-lived helpers", probe P5), so it never keeps a `stack:up` record live. Operable.
- **Old-build wrapper** (rollback mode and the old routes):
  - Old `lib.sh` still starts the Build Runner with a plain `nohup … &` (b0b83a8 `lib.sh:280`, 9f96f7b `:293`). So it shares the `storage-compat.sh run --` wrapper's group.
  - After a normal end, the wrapper releases, so nothing changes.
  - Only after a kill of the wrapper alone does the Build Runner keep that record live. The result is fail-closed (`operation_in_progress`, and the message names the group's processes). Old `npm run stack:down`, which rollback mode allows, stops the Build Runner (`stack-down.sh:6` in both old SHAs), and the record then becomes stale. So an exit exists.
- **Harness callers that share one group:** fail-closed by design (§7 "Shared group"). The rows that kill a command start it as its own group (M1 `g-orphan-refusal`, `g-orphan-stopped`, `a-lock-stale` (4)), and §16 assigns that to QA. Operable, with a stated limit.

I found no new BLOCKER or MAJOR in this mechanism. Its worst outcome is a wait or refusal that names its cause, never a takeover of a live owner.

### New finding

**B-S-22 — NIT — The group read uses a non-portable `ps` form.**

- Location: ADR-012 §7 lock records, "A record is live" (`LC_ALL=C ps -ax -o pid=,pgid=`); §17 assumption 4.
- Problem 1: `-ax` mixes the BSD `ax` selector into option syntax. The POSIX "all processes" option is `-A` (or `-e`), and both macOS and procps accept it.
- Problem 2: for empty headers, both BSD and procps document one `-o` per column (`-o pid= -o pgid=`). The comma form `pid=,pgid=` relies on implementation-specific parsing of the header text after `=`.
- Fix: use `LC_ALL=C ps -A -o pid= -o pgid=`, and name that exact command in §17 assumption 4 and in the `locale` or `orphan-client` self-check output, so the build step measures the same form on macOS and Linux.
- This is a precision NIT; it is not a design change.

### Observation (no finding)

The M4 operator guide should name the two group-related exits that the design already gives:
- end the named group processes, or wait;
- in rollback mode, old `npm run stack:down`, which also stops the old Build Runner.

The Round 3 observation that `stale-<runId>/` folders are kept also still applies.

### Remaining limits

- **Open findings:** no BLOCKER or MAJOR is open from this reviewer; B-S-22 is a NIT. G1 closure depends on all three owners' checks, as the escalation record states. This addendum does not close G1 by itself.
- **Not covered by this check:** QA R3-01, QA R3-02, A-S-12 and QA R3-03 to R3-07 belong to their owners. I checked them only for regressions against my findings.
- **Implementation and runtime gates remain separate:**
  - the implementation and its independent source reviews;
  - the build-step assumptions of §17 (now 1–11), including Linux behaviour and the Docker client process group;
  - the 488 rows per full round (416 existing and 72 AC-M1-41), plus the separate lock self-check;
  - every stack-level rerun (both full M1 rounds, both old routes, legacy, M2 and three T7 runs).
- **Labels:** no implementation, runtime or acceptance approval follows from this check. All 32 live LMS rows stay UNVERIFIED, and historical evidence keeps its labels and SHAs.


## G1 bounded-disposition addendum — revision 3.2

Verdict for the bounded correction: **APPROVE** (design only)

Reviewer: the same dedicated Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_278ec21bfdec`, dispatch `ctx_db35f10495b2`. Date: 2026-10-21.

This is a bounded check inside escalation G1. It covers B-S-22, and the new `FIRST_START` fixture and exact-volume-name ownership changes only where they bear on my earlier closures. It is not a new general review.

**Changes to earlier bytes:**
- Line 2 (the current top header) changed from "Round: 3 (bounded disposition check of revision 3.1 at a65a4ee; see the last section)" to the line now shown. Line 1 still says `APPROVE`.
- Every other earlier byte is unchanged: lines 3–499 equal the committed report at `0928c888543a1171944870125ac2fe2ab5e0067a` (whole-file SHA-256 `c18278e6db0fa287efbe80bc0bc8ad41d8de41114a80aeebc59b18dc8f10394b`).

### Scope and method

- Frozen correction: `d0bdda06cbb7176fcb7d2b66797d81edd95de6fe` (ADR-012 revision 3.2), compared with `a65a4eec669c4a98aac80ff6b3dc3d1f55813dd0`.
- Hashes match the Lead handoff:
  - ADR-012 SHA-256 `d1d95e5c5432f21afadd895bba9dd8a22e4fd8426d8ad13bd4d1d21dabb494b7`;
  - `review-response-storage.md` SHA-256 `f78179767075debd396cf01b3d30993821ab112feb4a5ae99791b677db7e5079`.
- Product, test, build and infrastructure files equal `8138097889f87359d5055bb1d79766b5ed842f92`: no path outside `docs/**` changed.
- Read:
  - the ADR-012 diff;
  - the "G1 bounded correction" section of the response;
  - the M1, M3 and `local-stack.md` diffs;
  - the Lead handoff.
- `git diff --check a65a4ee d0bdda0 -- docs/architecture`: clean.
- I did not read any other worker's new addendum. No Docker, product command, edit outside my report, commit or push.

### Dispositions

| Id | Disposition | Evidence |
| --- | --- | --- |
| B-S-22 (NIT) | **Closed** | The group read is exactly `LC_ALL=C ps -A -o pid= -o pgid=` in ADR-012 §7 (line 235), in the self-check output field `psCommand` (line 277), in §17 assumption 4 (line 744) and in the M1 unit list (`M1.md:309`). The G-1 diagnostic uses the same one-`-o`-per-column form (line 731). A repository search finds no remaining `ps -ax` or `pid=,pgid=` form under `docs/architecture`. |
| B-S-20, B-S-21 | **Not reopened** | `rename(2)` via `node`, `LC_ALL=C`, and the `stack:down` wording are unchanged by this diff. |
| B-S-15 | **Not reopened**; strengthened | `g-quarantine` now also checks that neither exact volume name exists afterwards (`M1.md`, `g-quarantine`). Quarantine steps 1–5 are unchanged. |
| B-S-16 | **Not reopened** | The lock mechanism is unchanged. §7 line 235 now limits the group guarantee to hosts where gate G-1 passed, and §17 (line 730) makes G-1 a precondition of implementation acceptance. This narrows a claim; it opens no new path. |
| B-S-01, B-S-05, B-S-11 | **Not reopened**; B-S-11 strengthened | The product-made setup (§11 item 2, line 522) runs the real `check --prepare`, so the roots and mountpoints get `HOST_UID:HOST_GID 0700` the same way as on the guarded path. QA checks this independently (item 3, line 525). §15 (lines 668–671) and AC-M3-06 now use exact volume names as well as labels, plus an ownership record and a preserve-on-doubt teardown. This closes the "mount of a missing name creates an unlabeled root-owned volume" gap without any new product surface. |

### Operability of the new fixture and ownership rules

- **No QA-made lane volume** (§11 items 1–2): every lane volume is created by Compose for a product storage container, with Compose labels, and the product's own §4 step prepares it. Existing closures still apply to every volume QA then mounts.
- **Fixture command:** `storage-oplock.sh run -- bash -c 'source infra/scripts/lib.sh && dc --profile storage run --rm --name … --label … storage-preflight check --prepare …'` (line 522).
  - It holds QA's lock.
  - Its inner command is not a guarded `npm` command, so it cannot trigger `operation_lock_reentry`.
  - It creates a named, labeled storage container, so A5 and A6 see it.
  - It is consistent with §5 and §7.
- **Teardown preserve rule** (line 670): it never removes an unrecorded, unlabeled or other-project resource with a lane name. With the fresh-lane check (line 668), a leftover from an earlier run blocks the next run (`BLOCKED`) instead of being silently reused or removed. That is the safe behaviour for shared Docker hosts.
- **Gate G-1** (line 730): implementation acceptance is held until a real-Docker measurement shows every client process of a run in the command's group, and that a whole-group kill leaves no client and no container within 30 s.
  - The Lead's diagnostic context (front and plugin processes in the group in 4/4 trials; no container during about 2.7 s after a whole-group kill) does **not** yet meet the 30 s condition.
  - I give no G-1, runtime or acceptance credit, and I keep that timing limit.

### New finding

**B-S-23 — NIT (precision) — The product-made `FIRST_START` setup can produce a state that the guarded path never reaches.**

- Location: ADR-012 §11 item 2 (line 522); `M1.md:238` (`a-first-start-resume`: "a new lane, or one after `stack:data-quarantine`"); §10 rows L5–L7 (lines 493–495).
- Problem:
  - The setup runs `storage-preflight check --prepare` directly, so it skips `stack:up`'s §10 legacy scan.
  - `stack:data-quarantine` does not touch the legacy bind files (§9).
  - So on a lane that still holds legacy files (for example after the `e-*` rows keep them for reference), the setup can make `FIRST_START` with legacy files present and an empty `legacySources`.
  - The guarded path never reaches that state: `stack:up` refuses `legacy_present` (L5) before the preflight.
- Schedule: legacy files present → quarantine → product setup (`FIRST_START`) → `stack:up` → L7 `legacy_conflict`. So `a-first-start-resume` would FAIL for a fixture reason, not a product one. `h-target-state` (2) is not affected, because it does not run `stack:up` after the setup.
- Fix: state in §11 item 2, and in the two rows, that the setup runs only when both legacy sets of §10 are empty (QA checks this; otherwise the setup is `BLOCKED`). The fixture is then a state that a cut `stack:up` can reach.
- This is a text precision note for QA's sequencing. It is not a design change and does not affect product safety.

### Remaining limits

- **Open findings:** no BLOCKER or MAJOR is open from this reviewer; B-S-23 is a NIT.
- **G1 closure:** G1 also depends on QA's independent decision on R3B-01 and on Reviewer-A's assessment of the G-1 diagnostic results. This addendum does not close G1 by itself.
- **Held:** implementation acceptance, gate G-1 (unmeasured to its 30 s condition), §17 assumptions 1–9 and 11, the 488 rows per full round (416 original rows with unchanged assertions and 72 AC-M1-41 rows), the lock self-check, and every stack-level rerun (both full M1 rounds, both old routes, legacy, M2 and three T7 runs).
- **Labels:** no runtime or acceptance credit follows from this check. All 32 live LMS rows stay UNVERIFIED, and historical evidence keeps its labels and SHAs.
