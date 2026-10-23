Verdict: CHANGES_REQUESTED
Round: 1

# Storage implementation review — Reviewer-B (ADR-012 revision 3.3)

Reviewer: dedicated independent Reviewer-B, Claude Code `claude-opus-5-5`, xhigh, retained session `c75b96cd-c1da-42ea-9b53-c5207e508e49`. Task `task_94536ec30f9a`, dispatch `ctx_127f2d72d1b0`. Date: 2026-10-21.

This is a source review of the storage implementation. It gives no runtime acceptance credit, and it does not open any runtime gate by itself.

## 1. Scope and method

**Exact sources:**
- Candidate (implementation and frozen tests): `f8a869bc6990d966b669352bedd8ec528adb4c08`.
- Contract: ADR-012 revision 3.3 at `89be93cc9e24f74c2b32ce72180ad4c706d000f7`. No path under `docs/architecture` changes between the contract and the candidate.
- QA preparation: `049da68a8958039fc3b4c22e8fa42d8e410269d2`, with the journal follow-up `8a66a337b0486028cc5af1e265a1d12255cfd2f6`.
- Product and test base: `8138097889f87359d5055bb1d79766b5ed842f92`.

**What changed since the base:**
- The Author changed 20 files: `infra/**`, `package.json`, and `services/lti-service/src/cli/stack-data.test.ts`. All 20 match `held-files.sha256` (SHA-256 `53f4c79d1bb9a79dad184cdc54b1cad3aaf473350ab5c70b62f95bc07f55c9b3`).
- The Author evidence matches `evidence.sha256` (SHA-256 `c988b541ed2faf5718c669acf1722cd896b5523550708a3e12e19a18d8c22df3`). I checked both lists myself.
- No product code under `services/`, `apps/` or `packages/` changes, apart from that one test file.
- QA changed `tests/host/**` and two additive acceptance probes.

**What I read:**
- the charter;
- ADR-012 revision 3.3, and the referenced ADR-006, ADR-011 §14, `local-stack.md`, M1 and M3;
- the team records `9ac8d5e` (unit fixtures, Option C) and `ed0fac8` (output and refusal interpretation);
- the Author's report, controls and assertion map;
- the QA preparation addendum in `docs/reviews/M1/qa.md`;
- every Author source file;
- the QA harness parts that call the product: `storage-rows.mjs`, `storage-oracle.mjs`, `storage-lane.mjs`, `storage-compat-route.mjs`, `storage-docker.mjs`, and the `m1-migration.mjs` follow-up.

**Independence:** I did not read the other reviewer's report or draft.

**Commands** (clean detached clone `/tmp/cogniate-reviewer-b-claude-impl-f8a869b-w6gIvO/src`, with links to the installed `node_modules`; both lockfiles unchanged since `8138097`; no Docker; every test puts a fake `docker` first on `PATH`):

| Command | Result |
| --- | --- |
| `node --test 'infra/scripts/*.test.mjs'` | exit 0: 62 pass, 0 fail, 0 skipped |
| `npx vitest run services/lti-service/src/cli/stack-data.test.ts` | exit 0: 63 of 63 |
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0: 70 of 70 self-tests, typecheck; 392 API + 96 host rows (72 AC-M1-41) = 488 per round; phases `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; only `c-host-negative` conditional |
| mutation (scratch copy `/tmp/cogniate-rb-mut-Fg5jyW`): `sqlite-lock-probe.mjs:380`, the `busy.errcode !== 5` check removed | `node --test sqlite-lock-probe.test.mjs`: 34 pass, 0 fail (the mutant survives) |
| `git diff --check 8138097 f8a869b -- infra package.json services tests` | clean |

These are host-only unit and harness results. They do not prove any Docker, Compose, privilege or real-volume behaviour.

## 2. Findings that need a fix

### B-SI-01 — BLOCKER — Nine refusal paths print their code only as text, so nine mandatory AC-M1-41 rows cannot pass

- **Rule:** the accepted M1 text defines a refusal row: "'Refuses `<code>`' means: exit 1, the code in the `storage_preflight` (or the command's) JSON output, and nothing changes" (`docs/architecture/tasks/M1.md:224`). QA implements exactly this: `assertRefuses` needs exit 1 and the code in a JSON line of stdout or stderr (`tests/host/storage-oracle.mjs:37`–`:40`). `lane.product` builds `lines` only from JSON lines (`tests/host/storage-lane.mjs:61`).
- **Where the implementation prints text only:**

  | Refusal | Product location | Mandatory row that expects the code in JSON |
  | --- | --- | --- |
  | `restore_target_state`, `import_target_not_fresh`, `pair_mismatch`, `backup_source_not_ok:<state>`, `manifest_incomplete` | `stack-data.mjs:817` (also `:757` for the legacy backup): `console.error(err.message)`. `Refused` already carries `err.code` (`:39`–`:41`), but no JSON line holds it. | `h-target-state` (`storage-rows.mjs:846`, `:848`, `:1145`), `e-import-nonfresh` (`:984`), `h-old-manifest` (`:992`), `h-pair-mismatch` (`:902`), `h-open-journal` (`:1142`), `g-damaged` `manifest_incomplete` case (`:681`–`:697`) |
  | `volume_in_use` | `stack-data.sh:112` (`echo … >&2`) | `g-quarantine-in-use` (`storage-rows.mjs:790`) |
  | `old_layout_container` | `lib.sh:398` (`echo … >&2`) | `e-old-layout` (`storage-rows.mjs:878`) |
  | `content_path_unsafe` | `lib.sh:343` (`echo … >&2`) | `d-content-folder` (`storage-rows.mjs:562`) |

- **Paths that already comply:** the preflight codes (summary `reasons`), the legacy codes (`storage_legacy_scan`), `content_missing` (`storage_content_check`), and the lock codes (`storage_lock_refused`).
- **Consequence:** these nine rows fail deterministically in both full rounds, although the product refuses correctly. AC-M1-41 cannot pass, so this is a BLOCKER by charter §5 ("an acceptance criterion fails"). QA's own self-tests do not catch it, because they test QA logic against recorded answers.
- **Narrow fix (no behaviour change):** at each refusal, also print one JSON line that names the code, for example `{"event":"storage_refused","ts","command","code","message"}`, to stdout, and append it to the matching log:
  - in the `Refused` branches of `stack-data.mjs` `main()`, with `err.code`;
  - for `volume_in_use` in `stack-data.sh`;
  - for `old_layout_container` and `content_path_unsafe` in `lib.sh`.

  Add one unit case per path that parses the JSON line. Every existing exit code and message stays.

### B-SI-02 — MINOR (required before implementation acceptance) — The required probe unit cases are missing, and a safety mutant survives

- **Rule:** the M1 supplemental list (`M1.md:309`) requires "probe logic with injected drivers (lock always granted, holder exits, extended codes `5`, `261`, `517` and `6`, other errors, each timeout, cleanup failure, many stale files, a near-match name, …)".
- **What the tests cover:** `infra/scripts/sqlite-lock-probe.test.mjs` runs only real `node:sqlite`. It covers normal, `no-hold` and `holder-dies` (`:145`–`:159`), and one leftover file (`:199`–`:211`).
- **What is missing:** a seam for an injected driver, and the cases for codes 261, 517 and 6, other errors, each wait timeout, cleanup failure, many stale files and a near-match name.
- **Evidence:** I removed the check `if (busy.errcode !== 5) return … 'probe_error'` (`sqlite-lock-probe.mjs:380`). All 34 probe tests still pass (table in §1).
- **Consequence:** the rule "a non-lock error is never a pass" (§5) has no test. A regression that read `SQLITE_LOCKED`, `SQLITE_BUSY_RECOVERY` or an I/O error as an enforced lock would pass `npm run check`. The Author's 24 killed mutations do not include this one.
- **Fix:** let `probeSteps` take an injectable database factory and holder (the defaults stay the real ones), and add the listed cases. Include a mutation note for the `errcode` check.

### B-SI-03 — MINOR — A wait timeout is reported as `probe_error`, not as the contract's `timeout`

- **Rule:** ADR-012 §5, line 152: "each wait ≤ 10 s (`timeout`); the whole run ≤ 60 s".
- **What the code does:** every bounded wait returns `probe_error`: `HELD` (`sqlite-lock-probe.mjs:364`), `PONG` (`:382`), `COMMITTED` and exit (`:386`), and the 60 s deadline (`:527`–`:531`). So an operator or QA cannot tell a hung holder from a crashed one.
- **Fix:** return `timeout` when a wait expires (keep `probe_error` when the holder ends or answers wrongly), and use `timeout` in the deadline summary. Add tests with B-SI-02.

## 3. Minor deferrals and NITs (no new round needed)

- **B-SI-04 (NIT):** the 60 s deadline handler emits only a summary line (`sqlite-lock-probe.mjs:527`–`:531`). §5 says one `storage_preflight` line per folder, then the summary. Emit both folder lines with `state: null` before the summary.
- **B-SI-05 (NIT):** in quarantine step 3, a failing `docker rm "$id"` (`stack-data.sh:118`–`:121`) exits through `set -e` with only Docker's text. No message says which service containers were already removed, and no record is written. The copy and the volumes are safe. Print "Quarantine stopped at the container removal; removed: …; the copy and the volumes stay", and exit 1.
- **B-SI-06 (NIT, may move to the M4 guide):** the old-build part of `infra/README.md` does not list the old commands that rollback mode forbids (old `stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo*`; ADR-011 §14). Its cleanup line (`README.md:92`) omits `docker volume prune --all` (ADR-012 §15). An operator who reads only the README can still reach the empty-bind case of my design finding B-S-02 by typing old `npm run stack:restart`.
- **B-SI-07 (NIT):** read-only maintenance modes (`backup`, `quarantine-copy`; volumes `:ro` through `${STORAGE_MAINT_VOLUME_MODE:-ro}`) still run the §4 root step (`stack-data.mjs:773`–`:792`). On a volume that needs a change, for example a root-owned empty mountpoint, `chown` fails with `EROFS`, and the command refuses `prepare_failed`. Guarded starts normally prepare every volume first, so I found no supported path to this state. But quarantine is the last-resort exit, so it should not depend on it: skip the root step, or report it as information, for the read-only modes.

## 4. Verified in source (no finding)

**Mount layout (`infra/compose.yaml`):**
- `ltidb:/data` and `appdb:/data`, plus the two nested long-syntax binds with `create_host_path: false`.
- The profiled one-shot services `storage-preflight` and `maintenance` with `user: "0:0"`, `network_mode: none`, `restart: "no"`, labels and no anchor.
- Maintenance volumes are read-only unless a command sets `rw`.

**Host content folders:** `prepare_content_folders` (`lib.sh:333`–`:350`) refuses a link, a non-directory or a foreign owner, and never runs `chown`. `stack-up.sh` no longer makes the legacy bind folders.

**Privilege (`sqlite-lock-probe.mjs`):**
- `dropPrivilege` order is `setgroups`, `setgid`, `setuid` (`:238`–`:243`).
- `prepareFolder` is not recursive, never follows a link, and changes only an empty root-owned mountpoint (`:249`–`:278`).
- The `check` order is: read as root, the journal gate, prepare, drop, leftovers, state, probe, initialization (`:534`–`:608`).
- A root-step failure is reported after the drop, with the fixed state code first (`:574`–`:578`).
- Report identity lines hold metadata only, come after the drop and before the summary, and reduce `legacySources` to name, size and SHA-256 (`:545`–`:553`).

**Operation lock (`storage-oplock.sh`):**
- Steps A1–A6 with `fs.renameSync`, never `mv`; `LC_ALL=C` on every `ps`; the group read exactly `ps -A -o pid= -o pgid=` (`:27`–`:39`).
- Bounds: 120 s for A4, 10 s for an invalid record (A3), 30 s for Docker calls.
- An active storage container refuses; an inactive one is removed by id.
- Release moves only the command's own record (`:159`–`:170`).
- Traps: `EXIT` releases; `INT` and `TERM` exit (`:353`–`:355`).
- Re-sourcing `lib.sh` in `stack-up.sh` resets no lock state, and no guarded script sets a competing `EXIT` trap.
- The candidate Build Runner starts in its own process group (`lib.sh:293`–`:296`).
- The self-check covers `rename-held`, `locale`, `orphan-client`, `dead-owner` and `own-group`.

**Guards and scope:**
- `stack:up`, `stack:restart`, `stack:reset` and `stack:data-*` take the guard, then the lock, before their first Docker command.
- `qa-suite.sh`, `e2e-reset.sh`, `demo*` and `test:compat` take the guard only.
- `stack:restart` runs the preflight before it writes the knobs file (`stack-restart.sh:31`–`:37`).

**Restore and import (`stack-data.mjs`):**
- Precedence: validation, then target state, then source kind, then pair rule, with fixed codes for either source (`:630`–`:677`).
- Every step-1 refusal comes before the first journal write.
- `content_missing` cancels through the R2 path and prints `storage_content_check` (`:484`–`:499`).
- Exit codes: 0, 1 only after a verification, 2 unresolved, 3 drill. "No target changed" is never printed after a change.
- Drill options need `STORAGE_DRILL=1`, and the pause is bounded to 300 s (`:283`–`:305`).

**Quarantine (`stack-data.sh:89`–`:133`):**
- The copy is verified before anything is removed.
- The command's own copy container is removed first.
- Every volume user is read again: only the stopped, non-one-off `lti-service` and `cogniate-app` containers of the project are allowed, removed by id without `-f` or `-v`.
- Then the volumes go, and `quarantine.json` is written at mode 0600.

**Old-build override:**
- `infra/compat/storage-compat.knobs.json` holds the marker key and only the allowed items (a)–(e).
- All four copies equal `infra/compat/storage-compat.sha256`.
- `storage-compat.sh` is old-only (HEAD must be one of the two SHAs) and allows only the two commands. It checks the hashes before it sources the copied lock helper, then: lock, hashes, preflight, the command, the mount check.
- This matches QA's §12 route (`storage-compat-route.mjs:12`–`:17`, `:116`).

**Option C, `stack-data.test.ts`:**
- A mechanical compare with `89be93c` shows 30 original `expect` lines: 27 are verbatim, and 3 differ only by `'--source', 'legacy'` (now `:125`, `:130`, `:131`).
- The fake `node` logs only the database program (`:766`–`:771`). The fake `docker compose run maintenance` runs the real `stack-data.mjs` on a volume stand-in.
- So the refusal cases still prove "the database program never ran", and the positive restore proves file sets, generation, provenance and the retained sidecar.
- This is unit evidence only. It does not prove the real container path.

**QA interfaces besides B-SI-01:**
- preflight lines, lock events, `storage_drill_stop`/`pause`, `storage_content_check`, `quarantine.json` fields and the manifest `backupId` match;
- journal fields match QA's AC-M1-30 step 3 check (`m1-migration.mjs`, `8a66a33`);
- the `FIRST_START` setup command works with `storage-oplock.sh run --`;
- the guard rows read text and exit code only.

**Precision items, in the harness:**
- A-S-14: the bound identities are checked at the run boundary (`storage-docker.mjs:171`–`:189`, `core.mjs:154`–`:159`).
- B-S-23: the legacy precondition applies only when `stack:up` follows (`storage-rows.mjs:145`–`:149`, `:845`).
- G1-QA-01 and G1-QA-02: the ownership record, and the Docker-clock creation second rounded down (`storage-docker.mjs:37`–`:43`, `:208`–`:245`).

**Unchanged assertions:** the 416 original rows, ids and phases are unchanged (harness inventory). Product code is unchanged, so the Moodle, Blackboard and Canvas behaviour of the shared engine is not touched.

## 5. Unmeasured assumptions (not claimed)

- **Docker and Compose behaviour:**
  - `run --rm -T --name --label -v <abs>:/backup[:ro]`;
  - the interpolated volume mode;
  - nested binds with `create_host_path: false` under a named volume;
  - a new volume's root owner and mode;
  - `docker ps -a --filter volume=`;
  - `{{index .Config.Labels …}}` on a container without labels;
  - `docker volume rm` after the stopped service containers are removed.
- **Privilege:** root, then `setgroups`/`setgid`/`setuid`, inside `node:24.22.0-alpine3.24`.
- **Locks:** WAL lock enforcement and extended `errcode` 5 on a real volume. Measured only on host APFS temp folders in the unit tests.
- **G-1 scope:** the storage services set no `pull_policy` (the §5 field table has none). The G-1 measurement used `pull_policy: never`, so a first run that pulls the image is outside the measured scope. QA requires the image to be present; operator documentation should say the same, or state the limit.
- **Timing:**
  - the added preflight and lock time on every `stack:restart` (one storage container per restart) inside the existing 60 s lease windows (§17 assumption 8);
  - `stack:up` now runs up to three storage containers (report, check, mark-started), which matters for the `demo:prepare` 3 min budget (AC-T7-15);
  - QA must record these durations.
- **Linux hosts and other client identities:** not measured (A-S-14 binding).

## 6. Remaining gate

**Required before a source APPROVE from this reviewer:**
- B-SI-01 (BLOCKER);
- B-SI-02 and B-SI-03 (MINOR; required because the M1 test list and §5 name them);
- each with unit evidence.

B-SI-04 to B-SI-07 are NITs, and B-SI-06 may be deferred to the M4 guide.

**Runtime gates that remain separate:**
- the two full M1 rounds, both old routes, the legacy suites, a fresh M2 run and three T7 runs on the exact candidate;
- the 488 rows (416 + 72), with only `c-host-negative` as the conditional row;
- the lock self-check, and the A-S-14 identity check at each run.

All 32 live LMS rows stay UNVERIFIED.

## Round 2 — bounded recheck of the repaired candidate

Verdict: **APPROVE** (source review only; no runtime credit)
Round: 2

The two header lines at the top of this file stay as Round 1 wrote them, because this dispatch asks me to keep all previous bytes. **This Round 2 verdict replaces the Round 1 verdict.**

Reviewer: the same retained Reviewer-B session `c75b96cd-c1da-42ea-9b53-c5207e508e49` (Claude Code `claude-opus-5-5`, xhigh). Task `task_f8cfe85a1d3a`, dispatch `ctx_9a557d8d1cfc`. Date: 2026-10-21.

### R2.1 Scope and method

**Exact sources:**
- Candidate: `a784522a3cdd9bb67453b03093092cac24e87402`. Diff base: `f8a869bc6990d966b669352bedd8ec528adb4c08`.
- Contract: ADR-012 revision 3.3 at `89be93cc9e24f74c2b32ce72180ad4c706d000f7`. No path under `docs/architecture` changes between `89be93c` and `a784522`.
- B-SI-07 reading: the Architect disposition recorded at `8c4d565` (`docs/team/multi-lms-plan.md`; Architect `msg_4286bb7f2bc0`, Lead `msg_eefd866c15b1`).
- The workspace HEAD `c0c9443` has no change under `infra`, `services`, `apps`, `packages`, `tests` or `docs/architecture` since `a784522`.

**What changed since `f8a869b`:** the Author changed 12 files: `infra/README.md`, `infra/compat/storage-compat.sha256`, `lib.sh`, `sqlite-lock-probe.mjs` and its test, `stack-data.mjs`, `stack-data.sh`, `storage-compat.sh` and its test, `storage-oplock.sh` and its test, and `services/lti-service/src/cli/stack-data.test.ts`. The other changes are team records and the two Round 1 reports.

**What I read:** the full diff of each changed file, the Architect disposition, the published Round 1 findings of Reviewer-A (`storage-reviewer-a.md` as it is in `a784522`), and the Author hand-off (`.tmp/author-handoff/task_81a4c5dab4dc/`).

**Independence:** I did not read the Round 2 text of the other reviewer (commits from `a9fe7ed` on).

**Evidence checks that I did:**
- `evidence.sha256` (SHA-256 `e547a151f34fab04ca0d00acf2aae06f9af5693dc1242fb54bced458ecf4098d`): 8 of 8 files OK.
- `held-files.sha256` (SHA-256 `73a39c77b1f1370635ac3a0fc41c1a1eb0ae3afc06a30be727487dfb67661240`): 12 of 12 OK against my clean detached clone of `a784522`.
- `shasum -a 256 -c infra/compat/storage-compat.sha256` in that clone: 4 of 4 OK.
- `git diff`, `grep` and line-by-line reading only. I did not run the unchanged broad checks again.
- I asked to run the errcode mutant again in a scratch copy. That run was not permitted in this session. For that mutant I use the Author control N1 (hash-verified) and my own trace of the test (B-SI-02 below).

### R2.2 Dispositions of the Round 1 findings

Line numbers are at `a784522`. "mjs" is `infra/scripts/stack-data.mjs`, "probe" is `infra/scripts/sqlite-lock-probe.mjs`, and "ts" is `services/lti-service/src/cli/stack-data.test.ts`.

| Finding | Round 1 severity | Disposition |
| --- | --- | --- |
| B-SI-01 (with A-SI-01) | BLOCKER (A: MAJOR) | **Closed** |
| B-SI-02 | MINOR, required | **Closed** |
| B-SI-03 | MINOR, required | **Closed** |
| B-SI-04 | NIT | **Closed** |
| B-SI-05 | NIT | **Closed** (steps 1 and 3); see the new NIT B-SI-08 for step 4 |
| B-SI-06 | NIT | **Closed** |
| B-SI-07 | NIT | **Closed** against the Architect disposition |
| A-SI-02 (Reviewer-A) | MINOR | **Verified closed** |
| A-SI-03 (Reviewer-A) | NIT | **Verified closed** |

**B-SI-01 and A-SI-01 — closed.** Every refusal path in the union now writes one `storage_refused` JSON line that holds the code.
- **Node paths:**
  - `Refused` keeps the code and safe details (mjs `:43`–`:45`). `refusalLine` builds the line without the message text (mjs `:47`–`:48`).
  - The main catch writes it (mjs `:879`–`:882`). The legacy backup catch writes it (mjs `:811`), and `stack-data.sh:55` gives that host command `STORAGE_LOG_DIR`. The drill-option catch writes it for every code except `usage` (mjs `:837`–`:841`). `prepare_failed` writes it with the fixed §6 code first (mjs `:844`–`:851`).
- **Shell paths:**
  - `storage_refusal_json` (`lib.sh:333`–`:342`) builds the line in node with escaped JSON, the command name and the run id.
  - It is used for `content_path_unsafe` with a path relative to the checkout (`lib.sh:356`), `old_layout_container` (`lib.sh:413`), `volume_in_use` (`stack-data.sh:117`), `backup_folder_missing` (`:84`), and the two folder refusals (`:41`–`:42`, on stderr, because `new_folder` runs inside `$(…)`).
  - The old-build wrapper uses `refusal_json` (`storage-compat.sh:24`–`:29`) for `content_path_unsafe` (`:64`), `wrapper_old_only` (`:72`, `:75`) and `wrapper_command_not_allowed` (`:156`).
- **Union check against QA:** I listed every code that `tests/host/storage-rows.mjs` gives to `assertRefuses` or to its `refusal` helper. Each one now has a JSON line:
  - the nine Round 1 codes;
  - `legacy_hot_journal` and `old_layout_container` on the legacy backup path;
  - `manifest_incomplete`.

  The other codes already complied at Round 1: the preflight summary `reasons`, `storage_legacy_scan`, `storage_content_check`, and `storage_lock_refused` (`operation_in_progress`, `storage_writer_active`).
- **Tests:**
  - `refusalOf` (ts `:994`) requires exactly one `storage_refused` line with the code. It also uses QA's `namesCode` rule, allows only fixed keys, and rejects an absolute temp path or message text.
  - Cases: ts `:1008` (volume commands), `:1060` (legacy backup), `:1086` (root-step failure), `:1097` (shell paths), `:1121` (folder refusals); `storage-compat.test.mjs:283`, `:298`; `storage-oplock.test.mjs:264`.
  - The Author's `qa-compat` log (hash-verified) shows that QA's own oracle accepts 6 of 6 real outputs.
- **What stays:** the diff adds each JSON line next to the existing text. It removes no text line and changes no exit code or order. The shell lines go to the command output only, not to a log file. That is enough for the rule at `M1.md:224`.

**B-SI-02 — closed (required check met).**
- **Seam:**
  - `REAL_DRIVER` (probe `:349`–`:354`) and `PROBE_BOUNDS` (`:355`; 10 s per wait, 60 s per run).
  - `probeFolder` takes a `driver` (`:361`), and `main` reads `deps.driver` (`:548`).
  - No CLI flag or environment variable selects the driver. The CLI calls `main` without `deps` (`:661`).
- **Cases** (`sqlite-lock-probe.test.mjs`):
  - real bounds and the default driver (`:316`);
  - code 5 passes, and these give `probe_error` (`:320`–`:330`): codes 261, 517, 6, 1, 10, 13 and 773, no code, the string `'5'`, a non-SQLite error, and a primary `SQLITE_BUSY` without an extended code;
  - a lock that is always granted gives `lock_not_enforced` (`:331`);
  - a holder that ends or answers wrongly (`:337`);
  - each wait timeout (`:345`);
  - the release-positive control (`:353`);
  - cleanup failure (`:357`);
  - many stale files, near-match names and a failed delete (`:363`);
  - the whole-run bound (`:385`).
- **The Round 1 mutant:** with the check `busy.errcode !== 5` removed (now probe `:406`), the 261 case continues. The fake holder answers PONG and COMMITTED, and the second `BEGIN` succeeds, so the result is `pass`. The assertion at `:328` then fails. The Author's control N1 is this exact mutant and is KILLED (`controls.md` row N1; 21 controls KILLED; hash-verified).

**B-SI-03 — closed (required check met).**
- `answer` (probe `:342`) maps an elapsed wait to `timeout`, and an ended holder or a wrong answer to `probe_error`. The probe uses it at HELD (`:388`), PONG (`:408`) and COMMITTED (`:413`).
- The exit wait gives `timeout` (`:416`), and a non-zero exit gives `probe_error` (`:417`).
- The run deadline uses `timeout` in the folder lines and in the summary (`:643`–`:649`).
- Tests:
  - `:337`: `probe_error` is decided by the answer, not by a wait.
  - `:345`: four waits give `timeout`, each after the bound.
  - `:385`: the run bound.
- `infra/README.md:112` documents `timeout`.

**B-SI-04 — closed.**
- At the deadline, the probe writes one `storage_preflight` line per folder with reason `timeout`, then the summary last (probe `:642`–`:649`).
- `settled` stops a second report (`:550`–`:554`). `expired` stops all writes after the summary (`:624`).
- Test `:385` checks the three lines and their order. It also checks that no second report comes after 1.2 s, that no identity or scratch file stays, and that a late pass writes nothing.

**B-SI-05 — closed for the copy container and step 3.**
- Copy container: `stack-data.sh:103` says that Docker did not remove it, that nothing was removed, and where the verified copy is.
- Step 3: `:126`–`:129` names the container that failed and the containers removed before it, and says that the copy and both volumes stay.
- Step 4: `:135`–`:137` now also names the removed service containers.
- Tests: ts `:1141` and `:1152`. They check exit 1, no raw Docker text, the exact `docker rm` and `docker volume rm` calls, the manifest present, and no `quarantine.json`.
- Step 4 has a remaining wording point; see B-SI-08.

**B-SI-06 — closed.**
- `infra/README.md:92`–`:98` lists the §15 cleanup cases, including `docker volume prune --all`.
- `:169`–`:175` gives the allowed and forbidden old commands: old `stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e` and `demo*`.

**B-SI-07 — closed against the Architect disposition.** I checked each item:
- *Skip preparation, and drop privilege before any volume read:* mjs `:827`–`:832`. Only `restore`, `import` and `recover` do the §4 step. The read-only modes call `dropPrivilege` at once. The later calls are harmless, because `dropPrivilege` does nothing for a non-root user (probe `:238`–`:243`).
- *Keep the read-only mounts:* no change to `infra/compose.yaml` or to the mount mode.
- *Unprepared readable metadata is information only:* `unpreparedItems` (mjs `:632`–`:646`) lists items with the issues `owner`, `mode`, `absent`, `root_owned` and `owner_or_mode`. The `storage_backup` line (`:857`) and the `storage_quarantine_copy` line (`:863`) carry them.
- *An unreadable entry fails closed:*
  - `readable` (mjs `:615`–`:623`) changes `EACCES` and `EPERM` into `source_unreadable`, with the entry relative to the volume root (`entryIn`, `:626`).
  - It wraps the state read (`:655`), the database files, copies and migrations (`:665`–`:673`), and the quarantine copy walk (`:750`–`:756`).
  - A backup writes no manifest. A quarantine stops before any removal (`stack-data.sh:98`).
- *No root copy of unreadable data:* no read path as root stays for the read-only modes.
- *Writers keep their preparation:* ts `:1241`.
- *Positive and unreadable controls:* ts `:1228`, `:1241`, `:1253`.

**A-SI-02 (Reviewer-A) — verified closed.**
- `readJournal` (mjs `:257`–`:268`) reads the file with `lstat`. Only `ENOENT` means "absent". Each of these is `{ invalid: true }`, which is row R6:
  - any other `lstat` error;
  - a folder or a symbolic link;
  - text that does not parse;
  - `null`, `false`, `0`, `""`, an array or another value that does not validate.
- `recover` classifies the journals directly (`:540`).
- Tests ts `:1166`–`:1217`: nine invalid texts on both journal roles, a folder and a symbolic link. Each gives exit 2 with the tree unchanged. A valid R1 then R0 still works.

**A-SI-03 (Reviewer-A) — verified closed.**
- `tagged` (`storage-oplock.sh:76`–`:77`) marks the step of a failed child process. `ctx.reclaimed` and `ctx.removed` record what A5 and A6 did (`:89`–`:90`, `:133`, `:146`–`:147`).
- The message names the step and the exit status, lists the earlier actions, and never repeats child output (`:331`–`:343`). A failure in the A6 cleanup releases the lock.
- Tests: `storage-oplock.test.mjs:138` and `:149`.
- The message ending changes from "Nothing was changed." to "No data was changed." This change is intentional: after a reclaim, "nothing" is not true. No contract text and no QA row reads these strings (I searched `tests/host`, ADR-012 and `M1.md`). The three changed assertions are as strong or stronger: they add the exit status and a negative check for `secret.sock`.

### R2.3 Required checks

- **Original assertions:**
  - ts: all 214 `expect` lines of `f8a869b` are present byte for byte. The 5 removed lines are the import list and lines of the fake `docker`, each replaced by a superset.
  - `sqlite-lock-probe.test.mjs`: one import line is replaced.
  - `storage-compat.test.mjs`: no line is removed.
  - `storage-oplock.test.mjs`: three assertion lines change for A-SI-03 (see above).
  - Option C still holds: the fake `node` logs only the database program.
- **Refusal text, exit codes, order and "nothing changed":** these are unchanged, except the requested A-SI-03 lock ending and the B-SI-05 quarantine messages.
- **Compatibility copies:** 4 of 4 hashes match the updated list. New hashes: probe `cb665e4e…`, `storage-compat.sh` `65be43f2…`, `storage-oplock.sh` `1d2be154…`. The knobs file `54f76f4a…` is unchanged.
- **No provider or shared LTI engine change:** no path under `services/`, `apps/` or `packages/` changes, apart from the one test file. `docs/architecture` does not change.
- **Rows:** `tests/host/**` is byte-identical between `f8a869b` and `a784522`. So the inventory stays 488 (416 + 72), with only `c-host-negative` as conditional N/A (my Round 1 harness run). The 32 live rows stay UNVERIFIED.

### R2.4 New findings (none blocks)

**B-SI-08 — NIT — After a partial volume removal, quarantine step 4 can give a false message.**
- `stack-data.sh:135`–`:137` runs one `docker volume rm <project>_ltidb <project>_appdb`. On any failure it says "The copy and the volumes stay."
- The Docker CLI removes each named volume on its own and reports the errors at the end (I did not measure this). So `ltidb` can be gone while `appdb` fails, and the message is then false.
- The verified copy stays, so no data is lost. But the operator can then run quarantine again on a half pair.
- **Fix:** remove the two volumes one at a time, or check each with `docker volume inspect` after the failure. Name the volumes that stay. Add a fake that fails only on the second name.

**B-SI-09 — NIT — The README line about the JSON refusal line is not exact.**
- `infra/README.md:146` says that the `storage_refused` line is on stdout and names the container field `name`.
- But the two folder refusals (`stack-data.sh:41`–`:42`) write the line to stderr, and the field is `container`.
- QA reads both streams, so no row changes. An operator who reads only stdout misses those two lines.
- **Fix:** correct the sentence.

**Observations (no action needed now):**
- **O-1:** Some probe tests use wall-clock bounds: under 4 s with a 5 s wait (`:342`); at least 290 ms with a 300 ms wait (`:350`); under 650 ms with a 300 ms run bound and 700 ms waits (`:392`). A slow host can only make them fail, not pass falsely. If CI shows flakes, make the gap between the two bounds larger.
- **O-2:** Some refusals still have text only, because the contract gives them no code and no QA row reads a code from them:
  - `require_services_stopped` (`stack-data.sh:33`);
  - the candidate guard;
  - the old-build `stop now:` lines (`storage-compat.sh:161`–`:178`).
- **O-3:** The `prepare_failed` control (ts `:1086`) and the unreadable-entry control (ts `:1253`) are skipped when the suite runs as root. They ran on the Author's non-root host. A root CI does not run them.

### R2.5 Source facts, host evidence and unmeasured assumptions

**Source facts:** R2.2 and R2.3. I checked each one by reading the source at `a784522`.

**Host evidence:** this is the Author's evidence. I verified its hashes, but I did not run it again.
- root check: 70 test files and 1111 unit tests pass;
- infra node tests: 76 of 76;
- mutation controls N1–N21 KILLED;
- `qa-compat`: 6 of 6.

This is unit evidence on a macOS host only.

**Not measured** (Round 1 §5 still applies, plus):
- Docker CLI behaviour: `docker rm`, `docker volume rm` with two names (partial removal), their exit codes and their text;
- the `{{index .Config.Labels …}}` result for a container without labels;
- the root to `HOST_UID` drop inside `node:24.22.0-alpine3.24`, together with the `:ro` mounts and the immediate drop;
- a root-owned empty mountpoint on a real new volume as `HOST_UID` reads it (`root_owned`). A non-root unit test cannot make a root-owned entry.
- extended code 5 on a real volume; Linux `ps`;
- real timing; an image pull (the storage services have no `pull_policy`).

### R2.6 Verdict and remaining gates

**APPROVE**, for the source review only.
- No BLOCKER or MAJOR stays open.
- The required checks B-SI-02 and B-SI-03 are met, with injected unit controls and a killed errcode mutant.
- B-SI-08 and B-SI-09 are NITs. They can go into a later bounded change or the M4 guide.

**This verdict gives no runtime credit.** These runtime gates stay:
- the Lead's clean-clone root check on the exact candidate;
- the two full M1 rounds: 488 rows, with only `c-host-negative` conditional;
- both old routes, the legacy suites, a fresh M2 run and three T7 runs;
- the lock self-check, and the A-S-14 identity check at each run.

All 32 live LMS rows stay UNVERIFIED.
