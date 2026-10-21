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
