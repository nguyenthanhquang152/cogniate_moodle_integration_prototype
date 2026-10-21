# M1 R1-A: storage lock command, independent host QA

Verdict: FAIL
Round: 1

Scope: the R1-A host contract only (the product lock-command repair). Role: independent QA, Claude Code Opus 5.5, xhigh. Task `task_7f8548e14769`, dispatch `ctx_f8c483b094d3`, run `run_ebe671ad72a9`. Date: 2026-10-21.

## 1. Result

The verdict is FAIL because one frozen REQUIRED assertion fails on the target. I froze the verdict rule before I read any source: "PASS only when every REQUIRED assertion passes on the target". The Lead decided to keep that rule and not reclassify the assertion after the result (`msg_fbf94dea3979`, 13:28:20Z).

| Part | Result |
| --- | --- |
| R1-A command field (the repaired behavior) | **Passes.** Every lock event carries the command that the emitting process gave to its own acquire. This is true for normal release, failure exit, TERM, INT, the sourced entry point, the real candidate `stack:data-backup`, and the copied helper and wrapper on both old builds. On `storage_lock_lost`, the emitter command, `runId`, `pid`, `pidStart` and `pgid` are the own values. `owner` is the foreign record, and that record stays byte-identical. |
| Frozen assertion `C6.exit1` (ADR-012 §7 release step 1: "log `storage_lock_lost` and exit 1") | **Fails on the target and on the parent alike.** `storage-oplock.sh run` exits with the child's code (0) after a lost release. R1-A did not cause this. Separate finding Q-R1A-01 (§7), MINOR proposal. |

Key numbers:
- Target driver: 45 cases; 972 of 973 REQUIRED checks pass. The only failure is `N5-lost` `C6.main.exit1` (expected 1, actual 0).
- Target route (ADR-012 §12 old-build path, hash list, real backup command): 175 of 175 REQUIRED checks pass.
- Parent: release and lost events have `command: null` (94 driver checks in 39 cases, and 20 route checks). All other compared facts are equal to the target.
- Mutants: 8 of 8 are killed. Two hash mutants are refused on the old-build path.
- Real Docker calls: **0**. Stub calls: 521 (492 simulated, 29 fail-closed).
- Unchanged status: all 32 live LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. The full `aaa823b` result stays 438 PASS / 50 FAIL. This check gives no acceptance credit for the full runtime gates.

## 2. Identity and normative inputs

| Item | Value |
| --- | --- |
| Target source (T) | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b` |
| Normative baseline and parent (P) | `4410e85f2054a82c00466b4e19a474416140afea` |
| Changed files (only the names were seen before the freeze) | `infra/compat/storage-compat.sha256`, `infra/scripts/storage-oplock.sh`, `infra/scripts/storage-oplock.test.mjs` |
| `storage-oplock.sh` SHA-256 | T `90d246792c41d63268411bdfec4e9e04764f89d57d51343a0f60c1b88969ca96`; P `1d2be154e754b9f2c07451384b3c24e8ea483073d16d24f49b276f15d8956753` (the same as the `aaa823b` helper in the triage input table) |
| T `infra/compat/storage-compat.sha256` SHA-256 | `3337c5858f3d055e910d8002e139f3e7496ab17f2efc33cc39b46171f31d2747` |
| Product diff (read after the freeze) | Bash only. `storage_lock_acquire` keeps the command in `STORAGE_LOCK_COMMAND` (not exported), and its acquire call uses that variable (same value). `storage_lock_release` adds `--command "$STORAGE_LOCK_COMMAND"` to its `release` call. One comment line. No change to the JavaScript part, the event shape, the folder names or the lock algorithm. In the hash list, only the `storage-oplock.sh` line changes. |

Normative inputs at `4410e85` (SHA-256 of the content):

| File | SHA-256 | Parts used |
| --- | --- | --- |
| `docs/team/charter.md` | `5289f7f72471d15d8fbff41dde898514cee0270d28ea62bcfd006f259cd23054` | §1, §4–§7 |
| `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` | `165a78ee975c14b766c53dfd1e5705a46d1fe5d31a0f571532462c19894343aa` | §7 (lines 217–341), §12 (lines 565–650) |
| `docs/architecture/tasks/storage-full-round-triage.md` | `d0f013ce3b44705f5460c196b834d7c3ea760ae8f68ebc6760bd8a82a10b2597` | RC-1, R1-A row (line 84), V1-5 (line 104) |
| `docs/team/multi-lms-plan.md` | `a3b275496dd29db50ab5c69a794d0f773431be00f30a2c20a092089dcd764bee` | 12:29 UTC checkpoint (R1-A selected, null command rejected) |
| `docs/team/board.md` | `a431e8b4e38bd887d1d65c9b5484ec9c82c16cabd25a1de065d51020f6faaa08` | M1 row (status only) |

## 3. Independence and the freeze boundary

- Start: 2026-10-21T13:02:53Z. **Freeze: 2026-10-21T13:07:36Z.**
- Frozen files (private root, mode 0400 after the freeze):

| File | SHA-256 |
| --- | --- |
| `frozen/criteria.md` (criteria C1–C24, probe plan, verdict rule) | `16bcb18709f02a73e25109421e4f248e359fb5a1e634b6c5bf8220bd8c247ac4` |
| `frozen/checks.mjs` (all assertion functions) | `3d0e63acad60ca936ca3b4b747283f8309f42aba7e131254576b0dd126e041c6` |
| `frozen/normative-inputs.sha256` | `15f0ef7f54dee3963f65f0ec2d73d49d08e9638277894de0222d1df535bf6b3e` |
| `stub/docker` (fail-closed stub) | `88a12e2c559f340a1ccdff56bb1aecfa9d0625df058b1be6bf1a0ed6e49705f7` |
| `frozen/BOUNDARY.sha256` (the four hashes above) | `89388fff1b60c1a9a37ee7e65ae4d0556be821d13815b76b0c5a5dc3b9c716a8` |
| `frozen/BOUNDARY.txt` (time and statement) | `8f36e3c8f650b31d13021eeb9f32758ccfe763b8da311696a978215ab6f245c8` |

- At the end, I hashed the frozen files again. They are identical.
- Before the freeze, I read only the normative inputs, the names of the changed files, and the T and P hash lists.
- After the freeze, I read the T and P `storage-oplock.sh`, `storage-compat.sh`, the `package.json` script names, the old `lib.sh` (`b0b83a8`), and parts of the candidate `stack-data.sh` and `lib.sh`.
- I did not read `storage-oplock.test.mjs`, an Author note or self-check, an R1-A source review, or a commit after `01ce5bc`. I did not run the Author unit suite.
- **Exposure (I told the Lead at once, `msg_3a873bbe2a0b`; Lead acknowledgment `msg_23aad933030e`).** At about 13:08:50Z, after the freeze, I ran `git grep STORAGE_LOCK_COMMAND 4410e85` to confirm that the parent has no such variable. It printed one line from each of `docs/reviews/M1/storage-full-triage-reviewer-a.md:193` and `storage-full-triage-reviewer-b.md:219`. These are the earlier triage design reviews (`a58b477`, `badde65`), not the R1-A source reviews. Both suggest a non-exported variable that is passed to release. I saw no verdict on R1-A. I added no assertion from them. After that, my searches stayed on source and normative architecture paths.

Changes after the freeze (none weakens a REQUIRED check):

| Id | Change | Reason |
| --- | --- | --- |
| A1 | The foreign record `runId` has 16 lowercase hex characters, not 32 as the frozen text said. | A valid record needs 16 hex characters (`readRecord`, `HEX16`). A 32-hex record is invalid and tests a different path. I kept it as the extra INFO case `N5i`. |
| A2 | "Lock events" means the ADR-012 §7 names. Other `storage_*` lines (`storage_refused`) are removed before the frozen checks run. | The ADR-012 §7 event list. |
| A3 | Probe fixes after smoke runs: capture checks run only where the child captures `owner.json`; marker files are written atomically (§11 O-4). | Defects in the probe, not in the product. |
| A4 | Extra INFO cases: D1–D3 (Docker paths), N4b, N5i, U1 (child umask 022), E1 (SIGINT control). | More coverage. They run on T, P and every mutant. |

## 4. Method

- Private root (mode 0700), outer umask 077. All probe code and evidence are in it (§12).
- `PATH` of every probe: the stub folder, then `<root>/bin` (only a `node` symlink), then `/usr/bin:/bin:/usr/sbin:/sbin`. No folder on it has a real `docker` (the real one is in `~/.docker/bin` and `Docker.app`). `npm` is not on it.
- No line in `storage-oplock.sh`, `storage-compat.sh`, `stack-data.sh` or `lib.sh` at T, P, `b0b83a8` or `9f96f7b` names an absolute Docker path (grep).
- Stubs:
  - `stub/docker` (frozen) logs each call without argument values and exits 97.
  - `stub-sim/docker` (after the freeze, labelled) answers only the lock helper's storage-container listing: empty, one inactive or one active container. It also accepts `docker rm` of the simulated inactive id. Any other call fails closed (exit 97). The helper calls `docker ps` in A5 and A6, so `run` needs a listing answer; V1-5 also uses a stub.
- Case folders: each case has a new private checkout folder that has only `infra/scripts/storage-oplock.sh` (a T, P or mutant copy). Project `qa-r1a`. There is no `REPO_ROOT` in the environment. Each process starts detached (its own session and group), so TERM and INT reach only that group.
- Assertions come only from `frozen/checks.mjs`. Drivers: `probes/driver.mjs` (45 cases), `probes/route.mjs` (§12 route and C22), `probes/compare.mjs` (T against P, mutants).
- Signal support: the E1 control shows that a detached bash traps SIGINT on this host (exit 7, "int-trapped"). TERM and INT both apply.
- Host: macOS 27.0.1 (26A434) arm64, GNU bash 3.2.57, node v24.21.0, git 2.54.0 (Apple Git-157).

## 5. Results by criterion

| Criterion | What it checks | T (REQUIRED checks) | P |
| --- | --- | --- | --- |
| C1 | Acquire command is a non-empty string, equals the held `owner.json`; T acquire equals P acquire | 154/154 | acquire values equal to T (0 differences) |
| R1A, C2–C5 | Every lock event of a process has the process's own acquire command, one `runId` and one `pid`. The release emitter equals the own identity (normal, exit 7, TERM to group, TERM to pid, INT). Lock and `rel-` folders are gone. | R1A 224/224, C2 269/269 | `command: null` on every release |
| C6, C7 | Lost (normal, TERM, INT, exit 7, sourced): own command, `runId`, `pid`, `pidStart`, `pgid`; not the foreign values; `owner` equals the foreign record; record kept byte-identical; no release; no `stale-` or `rel-` folder; exit 1 (N5 only) | 78/79 (`C6.exit1` fails) | `command: null` on lost; exit codes equal to T |
| C8 | Lost when the lock is absent | 8/8 | `command: null` |
| C9 | Wait: B's wait events have B's command and `runId`; `owner` is A | 9/9 | wait events as T; release `null` |
| C10 | Reentry: the nested run is refused with its own command; `owner` is A; the lock stays A's | 9/9 | refusal as T; release `null` |
| C11 | Reclaim: B's command; `owner` is the stale record; `stale-<id>` byte-identical | 8/8 | reclaim as T; release `null` |
| C12 | Cleanup: two events with B's command | 11/11 | cleanup as T; release `null` |
| C13 | Invalid lock folder: refused with B's command; the folder is kept | 7/7 | refusal as T; release `null` (REF run) |
| C14 | In progress (120 s): refused with B's command; `owner` is A | 7/7 | refusal as T; release `null` |
| C15 | Empty and odd argv: release equals acquire; acquire T equals P | 10/10; 0 T/P differences | `command: null` on release |
| C16 | Ordered top-level and `owner` keys | 109/109 | key lists equal to T |
| C17 | File-lock behavior | 0 T/P differences in exit codes, event names, `owner.json` keys and normalized `.tmp` listings (45 cases) | — |
| C18 | Each stdout event is also in `infra/.logs/storage-lock.jsonl` | 46/46 | pass |
| C19 | `selftest`: exit 0, five scenarios `ok` | 2/2 | pass, same scenarios |
| C20 | Hash list | 4 of 4 entries equal the recomputed SHA-256; 2 hash mutants refused | P list matches the P helper |
| C21 | Old-build wrapper route (§9) | all pass on `b0b83a8` and `9f96f7b` | `command: null` on every release |
| C22 | Real candidate `stack:data-backup` | reaches the lock; acquire and release `"stack:data-backup"` | release `command: null` (reproduces RC-1 on the host) |
| C23 | Docker | 0 real calls (§10) | 0 |
| C24 | Mutants | 8 of 8 killed (§8) | — |
| PRE, X | QA plant preconditions; identity checks of the INFO cases | 6/6, 15/15 | — |

## 6. Cases

Each case runs on T and on P. Exit codes are equal on T and P in every case. The listed exit code is T's.

| Case | Input | Expected (frozen) | T actual | P actual |
| --- | --- | --- | --- | --- |
| N1-normal | `run -- bash child.sh capture 0` | acquire and release with one command and identity; exit 0 | pass; exit 0 | release `null` |
| N2-fail7 | child exits 7 | as N1 | pass; exit 7 | release `null` |
| N3-term-group | TERM to the group while the child sleeps | release with own identity; lock gone | pass; exit 143 | release `null` |
| N3b-term-pid | TERM to the helper pid only; the child runs 2 s more | release after the child ends | pass; release 13:18:21.738Z, child end 13:18:21.706Z; exit 143 | release `null`; same order |
| N4-int-group | INT to the group | as N3 | pass; exit 130 | release `null` |
| N4b-int-pid (INFO) | INT to the helper pid only | as N3b | pass; exit 130 | release `null` |
| N5-lost | child puts foreign record F in place of its lock; exits 0 | lost with own values; `owner` = F; F kept; no release; exit 1 | all pass except exit: **0** | lost `null`; exit 0 |
| N6-lost-term | plant F, then TERM to the group | C6 without the exit check | pass; exit 143 | lost `null` |
| N7-lost-int | plant F, then INT to the group | as N6 | pass; exit 130 | lost `null` |
| N8-lost-fail7 | plant F; child exits 7 | as N6 | pass; exit 7 | lost `null` |
| N9-lost-absent | child moves its lock away | lost with own values; release creates no lock | pass; `owner` null; exit 0 | lost `null` |
| N5i (INFO) | invalid foreign record (32-hex `runId`) | lost with own values; record kept | pass; `owner` null | lost `null` |
| N10-wait | A holds; B starts, waits 2.5 s | B's wait has B's values; `owner` is A | pass | release `null` |
| N11-reentry | nested `run -- true nested-tag` inside A | refused `operation_lock_reentry`, nested own command; lock stays A's | pass; nested exit 1 | release `null` |
| N12-reclaim | planted stale record S (dead pid, empty group) | reclaimed with B's command; `owner` = S; `stale-<id>` kept | pass | release `null` |
| N13-cleanup | planted dead `cand-` and `rel-` folders | two cleanup events with B's command | pass | release `null` |
| N14-invalid | lock folder with `not-json` | refused `operation_lock_invalid` with B's command; folder kept | pass; B exit 1 | release `null` (REF run) |
| N15-in-progress | A holds; B waits 120 s | refused `operation_in_progress` with B's command; `owner` is A | pass; B exit 1 | release `null` |
| O1–O11 (C15) | quotes, backslash, `$`, backticks, unicode, newline, tab, 4,096-character argument, leading and trailing spaces, option-like words, no `--`, non-UTF-8 bytes, empty arguments | acquire T = P; release = acquire | pass; O2 and O2b (no argv): usage, exit 2, no event, as P; O3 (`''`): exit 127 | release `null` |
| S1–S9 | sourced entry point, label `stack:data-backup` (S8 `""`, S9 odd label with newline and tab): ok, exit 7, `set -e` error, TERM, INT, lost, lost + TERM | acquire = supplied label; release or lost = acquire | pass; S8 acquire `"unknown"` (as P); exits 0, 7, 1, 143, 130, 0, 143, 0, 0 | release or lost `null` |
| D1 (INFO) | fail-closed Docker | — | `storage_lock_acquired` only; exit 1; lock gone | same |
| D2 (INFO) | simulated inactive storage container | `storage_container_removed` with own command | pass | release `null` |
| D3 (INFO) | simulated active storage container | refused `storage_writer_active` with own command | pass; no release event | same |
| C19-selftest | `storage-oplock.sh selftest` | exit 0; five scenarios `ok` | pass | pass |
| U1 (INFO) | as N1 with child umask 022 | as N1 | pass | release `null` |
| E1 (control) | detached bash with an INT trap | exit 7 | pass | pass |

Representative lines (`$R` = the probe root):

```text
T N5-lost acquired {"command":"storage-oplock run -- bash $R/probes/child.sh plant-foreign 0","runId":"da3e16b3f2a814dc","pid":70436}
T N5-lost lost     {"command":"storage-oplock run -- bash $R/probes/child.sh plant-foreign 0","runId":"da3e16b3f2a814dc","pid":70436,
                    "owner":{"runId":"126999268028f0aa","command":"qa-foreign:ef2d8f0604f20501 'odd' \"q\" \\ ü✓","pid":70414}}
P N5-lost lost     {"command":null,"runId":"8d07536ecf7dbfdb","pid":77946,"owner":{"runId":"a010a39878675fb0",...}}
T C22 backup       acquired {"command":"stack:data-backup","runId":"e6ad1207dabeaa04","pid":9030}; released {"command":"stack:data-backup","runId":"e6ad1207dabeaa04","pid":9030}
P C22 backup       acquired {"command":"stack:data-backup",...}; released {"command":null,"runId":"930c8d8d5963e5f6","pid":10667}
```

## 7. Finding Q-R1A-01: exit status after `storage_lock_lost` (the frozen `C6.exit1` assertion)

| Item | Detail |
| --- | --- |
| Severity | **MINOR (proposal).** It existed before R1-A. It is not a command-field regression. The Lead's disposition is pending. |
| Contract | ADR-012 §7 release step 1 (`4410e85`, line 286): "Read the record; continue only when it has its own `runId`. Else log `storage_lock_lost` and exit 1; another owner's lock is never removed." |
| Observed | N5-lost: `storage-oplock.sh run` logs `storage_lock_lost` correctly and keeps the foreign record, but exits **0** (the child's code). N8 (child exit 7) exits 7. The sourced path S6-lost exits 0 (S6 has no frozen exit check). The parent gives identical results. |
| Cause (source, unchanged context) | The JavaScript `release` logs the event and returns false, so the `release` subcommand exits 1 (`storage-oplock.sh:170–176`, `:315`). The bash `storage_lock_release` ends in `\|\| true` (`:388`). R1-A edits this line, but `\|\| true` is unchanged. `run` then exits with the command's code (`:412–413`). The sourced path releases in the `EXIT` trap, so the script keeps its exit status. |
| Impact | A caller sees a lost lock only in the event (stdout and `storage-lock.jsonl`), not in the exit status. A lost lock needs a manual change or a defect, because a takeover moves only stale records (ADR-012 §7 A5). No data changes; the other record stays. |
| Possible repair (not authorized; needs a Lead or Architect decision) | Let `storage_lock_release` return the release status, and make `run` exit 1 after a lost release. Or clarify the ADR-012 §7 text for `run` and the trap path. |

## 8. Mutation and parent comparison

| Variant | Change (copy of the T helper unless noted) | Killed by |
| --- | --- | --- |
| P (parent) | release without `--command` | 94 driver checks in 39 cases, 20 route checks (`command: null`) |
| M-const | release passes a fixed `"storage-oplock release"` | 88 checks in 37 cases |
| M-env | release passes an inherited environment value | 88 checks in 37 cases |
| M-foreign-cmd | lost event uses the foreign record's command | 18 checks in the 6 lost cases |
| M-foreign-id | lost event uses the foreign `runId` and `pid` | 36 checks in the 6 lost cases |
| M-remove | lost release also deletes the foreign lock | 6 "record kept" checks and 7 listing differences |
| M-trim | release passes a word-split command (spaces and newline changed) | 17 checks in O3, O4, O6, O9, O11, S9 |
| M-trap | a trap release leaves out the command; an explicit release keeps it | 30 checks in 15 TERM, INT and sourced cases |
| M-acq | acquire composition changes (`run $*` without `--`) | no in-run check; 33 T-against-mutant differences in the C15 and C17 comparison (32 acquire commands, 1 nested refusal command) |
| M-hash (route) | the other tree's hash list, or the other tree's helper copy | the wrapper refuses before the lock: exit 1, `hash_mismatch` on `storage-oplock.sh`, no lock event |

T against P in all 45 cases: **0 differences** in exit codes, lock-event names, acquire commands, ordered key lists, `owner.json` key lists, normalized `.tmp` listings and `selftest` scenarios. So the lock algorithm, the event keys and the file-lock behavior do not change. Only the `command` value on `storage_lock_released` and `storage_lock_lost` changes.

## 9. Old-build route (ADR-012 §12) and hash list

Private clones of the exact SHAs (`git rev-parse` checked: `01ce5bc…`, `4410e85…`, `b0b83a8…`, `9f96f7b…`). Docker: simulated listing for the lock; everything else fails closed.

| Step | T | P |
| --- | --- | --- |
| Clone at the candidate; each hash list entry equals the recomputed SHA-256 of its file | 4/4 | 4/4 (P list matches the P helper) |
| Candidate `bash infra/scripts/storage-compat.sh enable` (the command of the npm script) | exit 0; acquire and release `"stack:storage-compat enable"`; the copies and the knobs file are byte-identical to their sources; copied helper `90d24679…` | release `null` |
| C22: real `infra/scripts/stack-data.sh backup --out <private folder>` (second clone, no override) | acquire and release `"stack:data-backup"`; exit 1 at `docker info` (fail-closed) after the lock; output folder not created | release `null` |
| `b0b83a8`: copied `.tmp/storage-compat/storage-oplock.sh run -- bash child.sh capture 0` | acquire = release = held `owner.json` command; exit 0 | release `null` |
| `b0b83a8`: `.tmp/storage-compat/storage-compat.sh run -- npm run stack:up` | acquire and release `"storage-compat run -- npm run stack:up"`; exit 1 at the preflight (`docker compose` fails closed); `npm` never ran | release `null` |
| `b0b83a8`: wrapper `status` and `preflight` | own command on acquire and release; exit 1 and 97 (the stub's code) | release `null` |
| `9f96f7b`: the same four steps | same as `b0b83a8` | same |
| Hash mutants: the other tree's list, then the other tree's helper copy | refused before the lock; copies restored byte-identical | refused |

## 10. Docker calls

- Real Docker calls: **0**. No probe `PATH` has a real `docker`, and no executed script names an absolute Docker path (§4).
- Stub log: 521 lines in total, for all variants and both smoke runs.
  - Simulated: 492 (`sim-list-empty` 459, `sim-list-inactive` 11, `sim-list-active` 11, `sim-rm-ok` 11).
  - Fail-closed: 29 (D1 once in each of 11 variant runs; on the route, 16 `compose` and 2 `info`).
- No stub call went to the unrouted log.

## 11. Observations (INFO, not graded, T = P)

- **O-1: silent A6 error release.** After acquire, a failed Docker listing (D1) or an active storage container (D3) makes the JavaScript release the lock with `quiet: true`. No `storage_lock_released` is logged. D3 logs `storage_lock_refused` with the own command. The lock folder is gone. This is outside R1-A and unchanged. ADR-012 §7 release step 3 says "Log `storage_lock_released`". The Lead may want to add this to the same conformance disposition as Q-R1A-01.
- **O-2:** The emitter `pid` equals the spawned process pid in every case.
- **O-3:** With child umask 022 (U1), `storage-lock.jsonl` is 0644 and `.tmp` is 0755, on T and P. The parents were 0700.
- **O-4: probe defect, fixed before the graded runs.** In a smoke run, TERM arrived while a shell function in the probe had stdout redirected. Bash ran the `EXIT` trap with that redirection, so the release line went into the marker file. The jsonl sink had the correct line with the own command. Markers are now written atomically. The two smoke runs (`smoke-T`, `smoke-T2`) are kept as evidence but are not used for the verdict.

## 12. Limits

- Host only. No Docker or Compose call, no service, no LMS, no network. The Docker answers are simulated. So this check does not measure gate G-1 again, and it measures no container behavior.
- I did not run the Author unit suite or the infrastructure suite.
- I did not test SIGKILL (the contract says: no release).
- `npm` was not on `PATH`. `enable` ran as the bash script that the npm script names.
- One host and one shell (bash 3.2.57).
- I did not check the `j-migration` and `j-snapshot` evidence that changes with the hash.
- All 32 live LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. The full `aaa823b` result stays 438 PASS / 50 FAIL. No acceptance credit for the full runtime gates.

## 13. Evidence

- Root: `/Users/quangnguyen/cogniate-qa-runs/r1a-storage-command-qa-20261021T1305Z` (mode 0700).
- Manifest: `MANIFEST.sha256`, SHA-256 `57039ac7e02a9880cf9d28ab2293cc189c57994415dfb3ff0bb2a84ae0692d4b`, mode 0400. It has 3,368 entries (3,367 files and 1 symlink), with the SHA-256, mode, size and path of each file.
- File counts: `frozen` 5, `probes` 5, `stub` 1, `stub-sim` 1, `helpers` 12 (T, P, 8 mutants, 2 smoke copies), `src` 8, `src-parent` 7, `bin` 1 (symlink to `node`), `evidence` 1,578, `work` 1,750.
- Current modes:
  - 3,347 files are 0600.
  - The 5 frozen files and the manifest are 0400 (made read-only after creation).
  - 4 scripts are 0700.
  - 11 files are 0644 and 11 folders are 0755. They are all in the U1 (child umask 022) case folders, inside 0700 parents.
  - Every other folder is 0700.
- Removed scratch (in the root only): the four private clones `route-T`, `route-P`, `c22-T` and `c22-P` (about 410 MB). Their outputs are in `evidence/route/`.

| Key file | SHA-256 |
| --- | --- |
| `evidence/results/T.json` | `20e75321b38f5d5afb9e08c7cc3897ea52f42a5de0b890673c6db9932c27cb09` |
| `evidence/results/P.json` | `400752e8e1f8ebb1ac0a891a8ff0b2d628ec66655cdaaebae9db1a88a370158b` |
| `evidence/route/T/result.json` | `c5e92a20a668d6b03c035f4c50753dc4d8d33044dd7a9878e892f4c0a2dbcc7d` |
| `evidence/route/P/result.json` | `2ecdce1f7fd3f283fcdc927e40fac948338b322791374690a8ad411048e5e72a` |
| `evidence/compare.json` | `3766b6f225a6b0e9cb32e671a5e31b392ecd6c96cd5795f3950612519893edb2` |
| `evidence/docker-calls.log` | `07422a77ee4d34c5d631d72c32870e799fb4ddecb08e44a7b8304b15e369f1b5` |
| `evidence/independence-disclosure.txt` | listed in the manifest |
| `probes/driver.mjs` | `4fbac1bf7045d6a837a3ccc8b2d4543f6f8ca0129b3ee09afb7b04f09cdbd70c` |
| `probes/route.mjs` | `d807e79bfc88a2a2bb1ac9311357844f200f8a49a8630f4c520c85b936b097c9` |
| `probes/compare.mjs` | `b544c729fd961e26c3b21a3a35b99563651cb3f3777bac0ac7e041baf099b321` |
| `probes/child.sh` | `a69e9af561d6f5b0767e8338bb74a4fd94fdd3ecad71f35df7aa1a19aa70c8aa` |
| `probes/sourced.sh` | `8f429c3e53377715ca0a78dc5c4392179f9da0aa27b283ae7cc8a4d4d45493e3` |
| `stub-sim/docker` | `0478f5550d3012a51600c20e47955b095b9f1d28d9bf3c62a8166780076bb3a4` |
| Mutant results `evidence/results/M-*.json` | listed in the manifest |

## 14. Repository state

- I wrote only this file. No commit, push or merge.
- `pnpm-workspace.yaml` is unchanged (SHA-256 `dfc07aac2ca34834eb425dac912bf6cfe1075b3e265b10c22368a7b99a82c064`).
- During the run, Lead commits moved the worktree HEAD from `7fbf7c8` to `2d763fe`. I did not read them. The probes used private copies of the exact SHAs, not the worktree.
