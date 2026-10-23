# M1 storage harness: c-selftest folder and preflight summary selection (QA repair, held)

Common QA, 2026-10-21. **Result: the storage harness repair is held for the Lead. Host-side controls PASS. No runtime acceptance ran.** This is a bounded QA repair after the full runner at `9cdd768` failed round 1 in phase `storage`. It is not an acceptance retry. The failed attempt and its raw evidence stay **FAIL**. No M1 criterion gets credit from this report. No product defect is shown or changed.

## Identity

| Item | Value |
| --- | --- |
| Role and session | Independent common QA repair owner. It is independent of the product authors and reviewers. Requested and effective model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. Orca session `orca_session_id:071cdbf7-5636-41ab-ae1c-f724e076ed52`. |
| Task | Run `run_ebe671ad72a9`, task `task_d0bbcedfb6d3`, dispatch `ctx_499b214ba557`. |
| Base tested candidate | `9cdd7687b91169a262648018ec6945efa31217dc` (tests tree `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`) |
| Worktree | Branch `nguyenthanhquang152/lti-multi-lms`, HEAD `38d07a9`. `git diff 9cdd768 HEAD` outside `docs/` is empty: the later commits change only `docs/`. |
| Owned files | `tests/host/storage-rows.mjs`, `tests/host/storage-rows.selftest.mjs`, `tests/host/storage-oracle.mjs`, `tests/host/storage-oracle.selftest.mjs` and this report. No other repository file changed. No commit, no push, no Docker command, no stack, no live LMS call. |

## Failures (run `qa-multi-r1-st-9cdd7687-2026-10-21T07-39-36-550Z`)

Storage had 70 mandatory rows: 1 PASS (`c-host-negative`) and 69 FAIL. QA read the common diagnosis (`public/diagnosis-storage-round1.md`), the latest `docs/reviews/M1/qa.md` section, the step records `002` and `004`, the command logs `09`, `11` and `12`, `storage/qa-image.json`, and `lane-ownership.json` (container names and `created` times).

| Row | Failure | Cause | Owner |
| --- | --- | --- | --- |
| `c-selftest` | Probe exit 2, stderr `selftest needs an existing empty folder`. | The harness passed `--folder self=/tmp/qa-selftest-<16 hex>` but did not make the folder. The probe (`sqlite-lock-probe.mjs:521`) needs an existing empty folder (ADR-012 §5). | QA harness (this repair) |
| `a-fresh` | "Preflight pass is logged before the first service container is created". | `preflightOf()` returned `summary.at(-1)`, the last summary. On a first start that is `mark-started` at 07:40:39.035Z, after the healthy start. | QA harness (this repair) |
| 66 rows that did not run | "not run: prerequisite … did not pass" | Cascade, mostly from `a-fresh` and `@seed`. `e-content-missing` is one of them: it needs `e-old-schema`. | No own cause |
| `e-old-schema` | `stack:data-import` exit 1: Docker bind-source error for the new `packages` folder. | **Not established.** The backend Author investigates it (`ctx_798816f87982`). | Not part of this repair |

Times in the `a-fresh` `stack:up` log and in `lane-ownership.json` (Docker clock):

| Time (UTC) | Event |
| --- | --- |
| 07:40:08.947Z | `report` summary `pass` (legacy scan), runId `7be9a2f4930d022f` |
| 07:40:09.248Z | **`check` summary `pass`**, runId `f57afda16ad9f494` |
| 07:40:09.390164667Z | first service container created (`proxy`), 142 ms after the check |
| 07:40:09.427389583Z, .430672583Z | `lti-service`, `cogniate-app` created |
| 07:40:39.035Z | `mark-started` summary `pass`, runId `8834c47d7bfd5dc3` |

So the product did the right thing: the check pass came before every service container. The oracle compared the wrong line. Both QA workers found this independently.

## Change

### `tests/host/storage-oracle.mjs` (+12 −2): `preflightOf()`

- `summary` is now the **`check`-mode** summary, selected by mode and never by position. `stack:up` prints `report`, then `check`, then (on a first start) `mark-started`. `stack:restart` prints only `check`. Only the check gates the start (ADR-012 §5).
- No check summary → `summary: null`. So the callers' existing `Preflight summary pass` assertion fails. A `report` or `mark-started` line never replaces a missing check.
- More than one check summary in one command → `StorageFail` ("2 check-mode preflight summaries in one command; expected one"). No guarded command prints two checks.
- New field `checkLines`: the folder lines of the selected check only (same mode and runId).
- `lines` (every `storage_preflight` line) and `runIds` are unchanged.

### `tests/host/storage-rows.mjs` (+7 −4)

- **`c-selftest`.** The container command is now `sh -c 'umask 077 && mkdir -m 0700 "$1" && shift && exec "$@"' c-selftest <folder> node /probe/sqlite-lock-probe.mjs selftest --run-id <16 hex> --folder self=<folder>`. The probe argument list is the same as before. The folder is made in the container's own writable layer, as `HOST_UID:HOST_GID`, mode 0700 from creation. `mkdir` has no `-p`, so an existing path fails and the probe does not run. `exec` keeps the probe's exit code. The container spec is unchanged: the probe file is the only mount; no bind, no volume and no tmpfs for the folder (ADR-012 §11).
- **`a-fresh`.** `fsType` is read from `checkLines` (before: every line, so a `report` or `mark-started` line could satisfy it). The ordering assertion now also needs at least one service container; before, an empty list gave `Math.min() = Infinity` and a vacuous pass. The assertion text and the `<=` bound are unchanged.
- `state.runIds` now starts with the check runId (before: the `mark-started` runId, when the oracle got that far).

Unchanged: every row id, phase, label, the SEQUENCE, NEEDS, refusal assertions, `assertRefuses`, every other row procedure, and all product files.

### Caller audit (`preflightOf` and `state.runIds`, owned files only)

| Caller (held line) | Command output | Selection before | Selection after |
| --- | --- | --- | --- |
| `preflightRunId` (`:144`) | used below | last summary | check summary |
| `a-fresh` (`:290-305`) | `report`, `check`, `mark-started` | **`mark-started`: wrong** (ordering FAIL; wrong `state.runIds`) | check; fsType from check lines; `state.runIds = {check runId}` |
| `a-second-start` second `stack:up` (`:316`) | `report`, `check` (pair `completed`, no `mark-started`) | check (last, by chance) | check (by mode); "A new runId" against earlier check runIds |
| `a-second-start` after stop (`:321-322`) | `report`, `check` | `every` line `OK` (report and check); last = check | unchanged `every` over all lines; check runId added |
| `a-restart` (`:332`) | `check` only | check | check; "A new runId" |
| `b-oracle-*` preflight afterwards (`:1110`) | `report`, `check` | check (last) | check |
| `identityCase` `f-*` (`:1132`) | `report`, `check` | `every` line `OK` | unchanged |

Read-only observation, not changed (not an owned file): `storage-compat-route.mjs:230` takes the first summary of an old-build wrapper start. That is the wrapper's `check --prepare` before the old command (`storage-compat.sh:87`); old builds print no storage lines. The migration and snapshot-upgrade phases passed at `9cdd768`.

## Controls (actually run, no Docker)

Private root `/Users/quangnguyen/cogniate-qa-runs/storage-oracle-repair-qa-20261021T0758Z` (mode 0700, made with umask 077; child test processes use umask 022). Trees come from `git archive`: `base` = `9cdd768` `tests/`; `held` = `base` plus the four held files. `clones/base` = all of `9cdd768`; `clones/held` = all of HEAD plus the four held files. `diff -rq clones/base clones/held` outside `docs/` shows only the four held files. Both clones use symbolic links to the worktree's `node_modules` and `tests/node_modules`. All data are synthetic or copied QA lane values (run ids, times, paths). No secret was read.

### C1. New and old self-tests against new and old code

Command: `node --test --test-reporter=tap --test-timeout=60000 tests/host/storage-oracle.selftest.mjs tests/host/storage-rows.selftest.mjs`, in each tree (`harness/cross.sh`).

| Tree | Result |
| --- | --- |
| base (old tests, old code) | 14 of 14 PASS |
| held (new tests, new code) | **18 of 18 PASS** |
| old tests, new code | 14 of 14 PASS: no existing case changed its result |
| new tests, old code (`9cdd768`) | **4 FAIL**, 14 PASS. Each new test fails with the runtime failure of the run (below). |

New tests with the old code:

| New test | Failure on `9cdd768` code |
| --- | --- |
| `preflightOf takes the check pass by mode …` (oracle self-test) | `summary.mode` expected `check`, actual `mark-started` |
| `a-fresh judges the check pass …` | `Preflight pass is logged before the first service container is created` (the run's `a-fresh` message) |
| `a-restart needs a new check runId …` | the same `a-fresh` message (its setup runs `a-fresh` first) |
| `c-selftest makes its new 0700 folder …` | the exact command on the host: `selftest needs an existing empty folder`, exit 2 (the run's `c-selftest` failure) |

### C2. Focused mutants of the held code (`harness/mutants.mjs`)

Each mutant is one exact replacement, applied exactly once, in a copy of the held tree. **All 12 fail** the new self-tests.

| Mutant | First failing case |
| --- | --- |
| m01 `summary = summaries.at(-1)` (the old selection) | oracle test: `mark-started` ≠ `check`; also the `a-fresh` and `a-restart` tests |
| m02 `summary = summaries[0]` (the `report`) | oracle test; `a-fresh`: `state.runIds` holds the report runId |
| m03 no check for two summaries | "Missing expected exception: Two checks are ambiguous" |
| m04 `checkLines` of any check runId | "Only the folder lines of the selected check" |
| m05 `fsType` from all lines | `a-fresh`: check lines without `fsType` are accepted ("Missing expected rejection") |
| m06 no `services.length > 0` | `a-fresh`: no service container is accepted |
| m07 `state.runIds` = every runId of the command | `a-fresh`: "The check runId; not the report or mark-started runId" |
| m08 the `9cdd768` command (no folder) | `selftest needs an existing empty folder` |
| m09 `mkdir -p` | "An existing path is never reused: mkdir fails and the probe does not run" |
| m10 plain `mkdir` (no umask, no `-m`) | folder mode `755`, expected `700` |
| m11 `mkdir` of another path | `selftest needs an existing empty folder` |
| m12 a bind mount added for the folder | mount list has `type=bind,…,target=/check/host-negative` |

### C3. The real probe, on the host (`harness/real-probe.mjs`)

The script takes the `c-selftest` command from the real row procedure of one tree (fake lane, no Docker). It runs that command on the host. It changes only `/probe/sqlite-lock-probe.mjs` to the `9cdd768` probe (SHA-256 `cb665e4e21b5…`, equal to the worktree file). `STORAGE_LOG_DIR` points into the private root.

| Tree | Exit | Result |
| --- | --- | --- |
| base (`9cdd768` command) | **2** | stderr `selftest needs an existing empty folder`; no selftest line; the folder never existed |
| held, macOS `/bin/sh` | **0** | `normal` → `pass`, `no-hold` → `lock_not_enforced`, `holder-dies` → `probe_error`, each `ok: true`; the folder was 0700 and empty afterwards; QA removed it |
| held, `/bin/dash` in place of `sh` | **0** | the same three `ok` lines; 0700, empty, removed |

### C4. How the new self-tests work

- `a-fresh` and `a-restart` run the **real row procedures** (`defineRows`) on a fake lane. The fake `stack:up` output has the shapes, times and run ids of the `9cdd768` `a-fresh` log: `report`, `check`, then `mark-started`, with lock and text lines. The fake service list has the five `created` values of that run, in nanoseconds.
- Preserved failures in the `a-fresh` test (each must give the exact message): the first container 148 ms before the check; 1 ms before the check; no service container; a check summary without `ts`; no check lines (only `report` and `mark-started`); a failed check with a passing `mark-started`; check lines without `fsType`; two check summaries. A first container 1 ms after the check passes.
- `a-restart`: two restarts with new check runIds pass, and `state.runIds` becomes the three check runIds. A restart that prints the `a-fresh` check runId again fails with "A new runId".
- `c-selftest`: the real row builds the command. The test runs it on the host with `sh`; only the probe path changes, to a stub that has the probe's prerequisite (an existing, empty folder; else exit 2 with the probe's message). The stub must see a 0700 directory of the current user, and the exact probe arguments. A second run on the same path must fail before the probe runs. Then the real `fixtureArgs()` builds the Docker arguments: the probe file is the only `--mount`, read-only; there is no `-v`, `--volume` or `--tmpfs`; the user is `HOST_UID:HOST_GID`; the arguments after the image id equal the command. The host run makes `/tmp/qa-selftest-<16 hex>`; the test removes it afterwards. After every held, cross and C3 run, no `/tmp/qa-selftest-*` remained. Mutant m11 made a different path (`/tmp/qa-selftest-<16 hex>.x`) that the test does not know. QA checked that this one folder was empty and removed it.

## Harness-only checks, typecheck and inventory

| Check | Result |
| --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all`, worktree, umask 022 | exit 0. Self-tests **77 of 77** PASS (73 before; +4 new). Typecheck (`tsc --noEmit -p tsconfig.json`) PASS. "392 API cases, 96 host rows (72 AC-M1-41); **488** mandatory rows per round; phases sim 394, migration 12, snapshot-upgrade 6, snapshot-isolated 6, storage 70; conditional `M1-41.common.c-host-negative` only". |
| `--harness-only --provider canvas`, worktree | exit 0. 77 of 77. 347 rows. |
| The same two commands, `clones/held` | exit 0; 77 of 77; 488 and 347 rows; the same phase counts. |
| The same two commands, `clones/base` (`9cdd768`) | exit 0; 73 of 73; 488 and 347 rows; the same phase counts. |
| Joined inventory (`harness/inventory.mjs`, the same script as the earlier repair report) | Base and held: common 114, Blackboard 141, **Canvas 233** (225 API `sim`, 7 browser `sim`, 1 API `snapshot-isolated`); total 488; Canvas run 347. `rowsSha256` (all ids, phases, labels, kinds and files) is equal. The base file has SHA-256 `9aa87f054dc0…`, as in the earlier report. Only `caseFilesSha256` differs: it hashes the content of each row's source file, and `host/storage-rows.mjs` is one of them. |
| `diff -rq clones/base clones/held` outside `docs/` | only the four held files: no case, manifest, product or infra file changed |
| `git diff --check -- tests/host/` | exit 0 |
| `git status --short` | the four held test files and this report, plus the Lead's `docs/team/multi-lms-plan.md` edit. `pnpm-workspace.yaml` (untracked, not QA's) is untouched. |

Root product checks did not run again: the product is unchanged.

## Evidence (private, mode 0700)

Root: `/Users/quangnguyen/cogniate-qa-runs/storage-oracle-repair-qa-20261021T0758Z`. The files hold only synthetic values, QA lane run ids and times, counts and test names.

| File | SHA-256 (first 12) |
| --- | --- |
| `harness/trees.sh`, `cross.sh`, `mutants.mjs` | `a2fe4ff3357c`, `3dc4a3efdec4`, `f39066d45fce` |
| `harness/real-probe.mjs` (the optional shell argument was added after the two `/bin/sh` runs; their path is unchanged) | `2017796f0957` |
| `harness/harness-only.sh`, `inventory.mjs` | `95b0b2d48073`, `c8030bdce45e` |
| `evidence/selftest-base.tap`, `-held.tap` | `9947aaafacb5`, `d6cecf5664ae` |
| `evidence/selftest-newtests-oldcode.tap`, `-oldtests-newcode.tap` | `bfcf8a51804b`, `6317e54ad14e` |
| `evidence/selftest-mutant-m01…m12.tap` | `ac6c3396a5d6`, `036d0ed47463`, `ec9725f46e7e`, `7ac58a6c2238`, `a6d151ab8f2f`, `c13a2f772211`, `1b466a450442`, `4c5ec3522d07`, `e055ec963c60`, `099eab1459c2`, `94c76841bec3`, `3b16ff14b1a0` |
| `evidence/mutants.json` | `56e0c8255cf0` |
| `evidence/real-probe-base.json`, `-held.json`, `-held-dash.json` | `7173a9af2073`, `3188556242ab`, `9c30703c3f97` |
| `evidence/probe-logs/storage-preflight.jsonl` (the probe's own log copy) | `f171f0b837e3` |
| `evidence/harness-only-worktree-all.txt`, `-canvas.txt` | `7fde8d685d03`, `a7144eeed228` |
| `evidence/harness-only-held-all.txt`, `-canvas.txt` | `646ca22faac6`, `3fe89d813c8f` |
| `evidence/harness-only-base-all.txt`, `-canvas.txt` | `c9738580f0a9`, `2bdfecbcace0` |
| `evidence/inventory-base.json`, `inventory-held.json` | `9aa87f054dc0`, `71639cfee4dc` |

## Held files

| File | SHA-256 before (`9cdd768` = HEAD) | SHA-256 after |
| --- | --- | --- |
| `tests/host/storage-rows.mjs` | `f5dbe2363c094ff48170ddfbced14720be87aa2a46ba3667191e314ccc8582e1` | `c94b0ad6d96b35ab88bf7c92b1a3197bd031ecdab2e90a8583e3d3636c03b6a9` |
| `tests/host/storage-rows.selftest.mjs` | `7c617aafbdc04189e2875fc4c396b0018c922c72bc0cc587af6dc17f8a49eb8b` | `c8f4a01463f592579689add04325ad459a8b160acc1461e32afc182c38bed5fa` |
| `tests/host/storage-oracle.mjs` | `03520081b7cdd2f9613414e78b1f7256c103e626085fef887f216f7a1cbe90b5` | `653211384484b18eddd90904057ebda239118eb0ca7765dcc68c52e70dac7c4a` |
| `tests/host/storage-oracle.selftest.mjs` | `5b123aae4812b527b2b381860c4fb7784082dcd8a0a825fd630ec31e41f94338` | `be61f27448148a0774731479bbde3cc7215ac62c6f5ad6619727e3b58943d64f` |
| `docs/reviews/M1/storage-oracle-repair-qa.md` | new file | given in the completion message (a file cannot contain its own hash) |

## Limitations

- **Host-only evidence is not a runtime PASS.** No container ran. The pinned image `node:24.22.0-alpine3.24` (`sha256:44fce696…`) runs the new command with busybox `sh` and `mkdir`. QA checked the script with macOS `/bin/sh` and `/bin/dash` only; busybox is not on this host. The script uses only POSIX `umask`, `mkdir -m`, `shift` and `exec "$@"`. The image entrypoint and the container writable layer are not verified here.
- The host runs of the probe use APFS. The container uses its overlay layer. The run evidence of the lock behaviour in the container is still missing.
- `a-fresh` and `a-restart` run on a fake lane. The fake shows the harness logic only. It does not show the product order; that comes from the `9cdd768` logs above.
- The equality bound is unchanged: a check summary in the same millisecond as the first container creation passes (`<=`). The product log has milliseconds; Docker has nanoseconds.
- `a-second-start` (after stop) and `identityCase` keep `lines.every(state OK)` over every line of the command. An output with no preflight line at all would pass that one assertion. A `stack:up` exit 0 always prints a check (`stack-up.sh:61`), and `a-second-start` also needs a check pass (`:322`). QA did not change this; it is outside the two confirmed defects.
- **Not addressed:** the `e-old-schema` and `e-content-missing` bind-source failure. Its cause is not established. QA did not accept it as `content_missing` and added no delay. The backend Author owns that diagnosis.
- **Not run:** Docker, the stack, the runner phases, `storagePhase` with a real lane, the 68 other storage rows, round 2, legacy, M2 and T7.

## Next

1. The Lead commits the five held files by exact path.
2. Two reviewers review the repair independently.
3. The backend diagnosis of the import bind-source failure ends, with its own repair if one is needed.
4. The Lead freezes a new candidate SHA.
5. A new Docker window runs the full acceptance again from a fresh clone.

Until then, all M1 rows keep their current status.
