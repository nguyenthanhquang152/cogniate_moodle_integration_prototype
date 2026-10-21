# Storage full-round triage (`aaa823b`, round 1)

Owner: Architect (bounded triage only). Run `run_ebe671ad72a9`. Model: Claude Code Opus 5.5, xhigh. Date: 2026-10-21. Revision 3: task `task_70d0b31626dd`, dispatch `ctx_6c7e0616e09b`. Revisions 1 and 2: task `task_269579cb01c1`, dispatch `ctx_a6965f1fbc80`.

Status: **unaccepted revision for bounded independent confirmation**. This file is not an approval and gives no acceptance credit. It does not claim that a review finding is closed or that the design is approved. It authorizes no implementation and no runtime. Before QA edits a test, the exact criterion and verification text of this revision needs a bounded independent confirmation (Reviewer-A, Reviewer-B), a QA testability check, and Lead acceptance.

Revision history:
- Revision 2 is at `2b0081d` (SHA-256 `d0f013ce3b44705f5460c196b834d7c3ea760ae8f68ebc6760bd8a82a10b2597`). It answered the Lead's `changes-requested` disposition of revision 1 (held report `a711e0df…`).
- Revision 3 (this file) answers the two blind design reviews of revision 2 and the Lead decisions of dispatch `ctx_6c7e0616e09b`. Reviewer-A: `docs/reviews/M1/storage-full-triage-reviewer-a.md` at `a58b477` (SHA-256 `01b72886d41a4d034b362892d95f21f111e8c806568ba248b2074d40b4ebf3d2`, CHANGES_REQUESTED). Reviewer-B: `docs/reviews/M1/storage-full-triage-reviewer-b.md` at `badde65` (SHA-256 `3bdc6d231688bc98e403f56983435fca40a8e21c4102019b223663ec75415161`, CHANGES_REQUESTED). §14 maps every finding.
- The facts of revision 2 that both reviews confirmed stay unchanged. One stale citation is corrected: the B-SI-07 disposition is at `docs/team/multi-lms-plan.md` lines 2523–2527 at `2b0081d` (revision 2 gave other line numbers). Changed text: §0 (new), §2 (one wording), §3 (R1-A wording, R1-B rejected, oracle), §4 (repair, phase stop), §5 (product negatives), §6 (P-1, `@seed`), §7 (P-3), §8 (new: log windows), §9 (plan), §10 (new: scopes), §11 (O-1), §12 (new: controls), §14 (new: disposition map).
- Two criterion texts of this revision are in other files: `docs/architecture/tasks/M1.md` (`a-fresh`, `d-content-folder`; P-1a, proposed) and ADR-012 §4 (O-1; proposed revision 3.6).

## 0. Lead decisions applied

| Item | Lead decision (dispatch `ctx_6c7e0616e09b`) | Where |
| --- | --- | --- |
| R1-A product conformance | Required | §3, §10.1 |
| R1-B / P-2a (`command` nullable) | Rejected | §3 |
| P-1a | Selected, with the conditions of both reviewers | §6 N-2, `M1.md` |
| P-1b and D-1 | Rejected as a gate. No diagnostic of the rename case is requested. | §6 N-2 |
| P-3 | Mandatory before the next runtime window | §7 |
| A-SFT-08 (product copy, then `chmod`) | Accepted MINOR, deferred to M4. Outside the product scope of this repair. | §7.6 |
| Diagnostic | `migration` (12 rows), then `storage` (70 rows), one candidate, one window, one fresh handoff | §9 |
| Global post-step lane check | Not required where an intended intermediate state would make it false. Scoped restore guarantees stay. | §4.3 |
| Private-file correction after a scan hit | Permitted, bounded (§7.5) | §7.5 |

## 1. Scope, method and inputs

- Candidate: product `aaa823b25306c5e560f7c4050238b374dec4d4e3`, tests tree `4c7e067feedc644f955afee37806f06e7273dd04`. The frozen source has no tracked change (`git status`, `git rev-parse`).
- Method: host-only reads of existing evidence and source. No Docker or Compose command, no product or test run, no reproduction, no mode change, no deletion, no live call. Revision 3 read only source sections again, for the P-3 inventory (§7.2). It read no new evidence file.
- Private logs: only event names, codes, counts, modes and timestamps were read. This file has no secret value.
- `F` = frozen source `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source`. Every `tests/**`, `infra/**` and `services/**` line reference is in `F`.
- `A` = `F/tests/host/artifacts/qa-multi-r1-st-aaa823b2-2026-10-21T11-24-56-069Z` (storage phase). `E` = `/Users/quangnguyen/cogniate-qa-runs/m1-full-aaa823b-20261021T1054Z`. `P8` = `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-st-aaa823b2-2026-10-21T11-24-56-069Z-storage-private`.

| Input | SHA-256 |
| --- | --- |
| `A/summary.json` | `81214d354b9b69e5b9aaf4e3be624fcf070110d9b9db3ff3cc0f46c9128ec0da` |
| `A/m1-case-results.json` | `e3a4f38186d4a6a607f6c92b3acbd566d8ba233db9afc4df8afae13cee05e81a` |
| `A/lane-ownership.json` | `2e940a84eb62ddcbfe91c7e3f23b4b53eea8a7384aa91fe279634c938733eb8a` |
| `A/cmd/59-a-serialize-up.log` | `1c498b3c06d88e0acebc7748e5d2ad79c24e8a01de0821cf7a863a34241aaf43` |
| `A/cmd/130-fixture-plant.log` | `162075791f10d3adb5a4f8de4658932bfe220e4918c768ceae6531761a473a4d` |
| `A/cmd/131-fixture-list.log` | `fae55fd78a3b2b8196ca13d78f5696d6f1a2c97740cdbae69f3a655c43e5b251` |
| `A/cmd/133-fixture-list.log` | `1942a95db88ada700cdd94b26b7912ed597bea3a11b37bdb2f23f26964c319d5` |
| `A/cmd/185-a-first-start-partial.log` | `ad4e68cc2e1415bf3b9151635c3d5e5d37e28334b5cbac08a89cbe5a53e709b1` |
| `A/cmd/186-seed.log` | `7cbf4a4eee554395f4dd9da20b2e46d4e5aadf29b1ed42eba9e07824d81879b4` |
| `A/cmd/208-content-import.log` | `069cdaaf90aebe8c3271b75467e9c02d748b23c86af1d6e8545f00699c5b8d0a` |
| `A/cmd/212-old-schema-import.log` | `ddd471d4cfd9532c6605c9a97e6c0ed21144d9930d65d8a593e9c2fd464e57d4` |
| `A/cmd/213-old-schema-up.log` | `b6f1c305d1f1b3042b6e322212d545eab8421fe47f8b73ac0fad22e151511255` |
| `A/service-logs/cogniate-app.jsonl` | `389ff6611e78ba7af2abe3fcd0574da2f8b5f6113ea1a52f0cbe5f9552334160` |
| `A/service-logs/storage-lock.jsonl` | `613a250e1c01b9dbe68999150b2fe03ff02d4faeba45bfa81b7fa7fe8e93aa91` |
| `E/public/w4-compare.json` | `8e79dea16292806b9bf9fa906371c0e57cf010460a96a2f7c698fe0e5a078465` |
| `E/public/secret-scan.json` | `c07a29f0ccb80825241d620bcada6f85ff0784272ae78678c323f210bb928ba8` |
| `E/public/sampler.out` | `b4c8764f03626c217e4416070a930ca4f4677546bac721f901140e7d56395bda` |
| `E/public/permission-correction-hold-db.json` | `f99bdcf000bd789df6f001e1b3264368fd1aa15a6a96444113bdc2df83ca0fd3` |
| `tests/host/storage-rows.mjs` | `c94b0ad6d96b35ab88bf7c92b1a3197bd031ecdab2e90a8583e3d3636c03b6a9` |
| `tests/host/storage-lane.mjs` | `b37daf431b8045a9e97b6f16986e9699c924edae1f9f2a435c1a0348e1d178ea` |
| `tests/host/storage-fixture-script.mjs` | `77e842f5e591fc19b1349480f295c3b7053bf5c29480741c0d6f08d6d1dfb68f` |
| `tests/host/storage-oracle.mjs` | `653211384484b18eddd90904057ebda239118eb0ca7765dcc68c52e70dac7c4a` |
| `tests/host/storage-docker.mjs` | `6862cc7b480b6cb4c0828550b32fa8558dee9b0e4ed3c8d2188657fe9a2fec6e` |
| `tests/host/storage-compat-route.mjs` (revision 3) | `1075773466c2ed2d30ef89f241a0f1506219a973e46309cad0bce3ed9e9ed692` |
| `tests/host/m1-migration.mjs` (revision 3) | `1be7c1c9d4028daffa2f5fbc9eb54b99804f2922eab0a1d7351bbe7e26a6cc75` |
| `tests/host/run-m1.mjs` (revision 3) | `bb8d0c2e5fa321d2693b0177ca1be3b7c3a30aff7073bd55b2a3770a90c52542` |
| `tests/acceptance/lib/app.ts` | `fffaf0809a6c8500c11f0efe966d26e02b6157fcadf7a6704b03186563e7a19d` |
| `tests/acceptance/T4a/security.test.ts` (revision 3) | `9c43ba6afcf6012494628b41aa93bb8ee13f4ae7456f7851a4c2d84a46c741b1` |
| `infra/scripts/storage-oplock.sh` | `1d2be154e754b9f2c07451384b3c24e8ea483073d16d24f49b276f15d8956753` |
| `infra/scripts/stack-data.mjs` | `5c3fde5cab845e27bbb942c69cc4a4578964a2c66171ba068b625f15b4a7c258` |
| `infra/scripts/sqlite-lock-probe.mjs` | `cb665e4e21b58844ce97985f4dc15ef4b2a41cb6532e6cf2b1a0e604e61c8b38` |
| `infra/scripts/lib.sh` | `64b686acfa439ece3e575567fdc8fc4a5e7e0a6e58685b9552c84c0541fb442a` |
| `infra/compose.yaml` | `4eb6d469aa7584cf76b84581ad2c58eda849ca76da60fa54a325dc2059d8cba6` |
| `services/cogniate-app/src/app/server.ts` | `c30867a72638ca71aba9271370ed91dc4d7f6a59a8b3d6fb39348580bfb6bc75` |
| `services/cogniate-app/src/app/app.test.ts` (revision 3) | `1a44d90b5a7f499256bb97923054b6de9b0995c0ae8750b6c3db483dc6922711` |

## 2. Result

The storage phase has 70 rows: 20 PASS, 50 FAIL. There are three independent first failures. The full round-1 result at `aaa823b` stays FAIL (438 PASS, 50 FAIL).

| Id | First failure | Class | FAIL rows |
| --- | --- | --- | --- |
| RC-1 | No backup `storage_lock_released` event matched the `a-serialize` oracle. Every release event has `command: null`. | **Product nonconformance with the log contract.** The approved field list makes `command` required. Separately, the QA selector has an attribution weakness. Not a lock release defect. | 1 |
| RC-2 | `d-mountpoint` makes both in-volume mountpoints `root:root 0700`, then lists them as `HOST_UID`. It has no restore step. | Harness | 47 |
| RC-3 | `storage-lane.mjs` `portal()` and `app()` send no `Origin` header. The product CSRF rule refuses the sign-in. | Harness | 2 |

- No lock, storage, recovery or data defect is proven. RC-1 has no waiver.
- The storage phase runs every row (`tests/host/storage-rows.mjs:79–110`). The round check fails at the first non-PASS row (`tests/acceptance/M1/common/coverage.mjs:78`, called from `tests/host/run-m1.mjs:108`). So the run stopped before round 2 and the legacy suites. The repair must make all 70 rows PASS (`c-host-negative` PASS or `NOT_APPLICABLE` in both rounds).
- R1-A, the RC-1 oracle, RC-2, RC-3, P-1a and P-3 ship in one frozen candidate (§9). RC-2 alone moves the first failure to `@backup-B` (§6 N-1).

Independent comparison: Common QA classifies RC-1 as a contract mismatch and RC-2 and RC-3 as harness defects (`docs/reviews/M1/qa.md` at `ef787d1`; diagnosis `E/public/diagnosis-storage-round1.md`, `dc167072facccba619442e03c0906d6894c2285a253774cd8024233c58c8eba3`). Both design reviews verified RC-1, RC-2 and RC-3 in source and evidence. Canvas QA (`docs/reviews/M1/qa-canvas.md` §19.3) keeps the cause open and names the host content folder as a candidate. §4.1 shows that the host content folder is not involved.

## 3. RC-1: `a-serialize` — log contract nonconformance

| Item | Finding |
| --- | --- |
| Rows | `M1-41.common.a-serialize` (FAIL). No cascade. |
| Contract | `docs/architecture/tasks/M1.md:234`: the backup exits 0 with a manifest and no `INCOMPLETE`; no service container starts before the backup's `storage_lock_released` time (`State.StartedAt`); then `stack:up` exits 0. ADR-012 §7 release step 3 (line 288): log `storage_lock_released`. ADR-012 §7 "Lock events" (line 311), approved field list: `{event, ts, project, command, runId, pid, pidStart, pgid, owner … \| null, reason \| null, waitedMs, container … \| null}`. Only `owner`, `reason` and `container` are marked nullable. |
| Actual | The two earlier checks passed (`tests/host/storage-rows.mjs:405` exit 0, `:406` manifest and no `INCOMPLETE`). The oracle (`:407`) filters release events with `/backup/.test(e.command ?? '')` and found none (`:408`). Counts in `A/cmd/*.log` and the final lane log: 87 of 87 `storage_lock_released` events have `"command": null`. All 86 `storage_lock_acquired`, 3 `storage_lock_wait`, 3 `storage_lock_refused`, 3 `storage_lock_reclaimed` and 2 `storage_lock_cleanup` events name a command. |
| Product source | `infra/scripts/storage-oplock.sh:369`: acquire passes `--command`. `:386` (`storage_lock_release`): release passes no `--command`. `:194` (`ctxOf`): `command: o.command ?? null`. `:170–181` (`release`): renames and deletes only the own lock, then logs the event. The unit test checks the event keys only, not the `command` value (`infra/scripts/storage-oplock.test.mjs:72–85`). |
| Serialization behavior | Supported, not proven compliant. `A/cmd/59-a-serialize-up.log`: `stack:up` logged `storage_lock_wait` at 11:32:14.041Z with owner `stack:data-backup`, runId `79dc99c4…`, acquired 11:32:13.770Z. It acquired the lock at 11:32:15.044Z (`waitedMs` 1005). Acquisition step A2 succeeds only when no lock folder exists. So the backup released before 11:32:15.044Z, and the services started after the 11:32:16.117Z `check` preflight. This order supports correct serialization. It does **not** prove that the release event meets the approved schema. No runtime credit. |
| Log race? | No. The row reads the log after `await backup.done` (`:404`). The release line is appended synchronously before the backup process exits (`storage-oplock.sh` `eventLine`, `:63–72`). |
| Evidence limit | The backup's own release line is lost. The background backup (`:397`, `spawnGroup`) kept its output in memory only, and a later `stack:reset` removed `infra/.logs`. |
| Classification | **Product nonconformance** with ADR-012 §7 line 311. Not a lock release defect. The QA selector exposed it; it did not cause it. The selector also has its own attribution weakness (§3.1). |

Resolution (no waiver of a required field):

| Path | Owner and files | Status |
| --- | --- | --- |
| **R1-A product conformance** (keeps the approved contract) | Backend Author. Exact scope: §10.1. Every lock event carries the command that the emitting process gave to its own acquire. On `storage_lock_lost` this is also the own command; `owner` keeps the other record. | **Required (Lead)** |
| R1-B contract change (P-2a): `command: null` allowed on `storage_lock_released` and `storage_lock_lost` | — | **Rejected (Lead).** The field list states nullability per field, and `command` is required. The holder knows its command at release; the `null` is an omission at `storage-oplock.sh:386`. A release line without its command cannot name the command without the acquire line, which `stack:reset` can delete. No ADR-012 §7 change. |

### 3.1 `a-serialize` oracle (both reviewers' conditions)

Owner: independent common QA. File: `tests/host/storage-rows.mjs` (`a-serialize`, `:394–413`). The decision is one pure function. Input: the lock events after the offset, the spawned `pgid`, the `storage_lock_wait` lines of `stack:up`, the service `StartedAt` values, and the clock samples. Output: `{ verdict, selectedRunId, cause }`. The controls read `selectedRunId` (§12, V1).

1. **Offset.** Before the spawn, QA records the byte length of `infra/.logs/storage-lock.jsonl` (`0` when absent). No `stack:reset` runs inside the row. A log that is shorter than the offset at evaluation → FAIL "lock log truncated".
2. **Spawn.** `spawnGroup` starts the backup as its own process group (`detached: true`; `pgid` = child pid; `tests/host/storage-oracle.mjs:279–285`).
3. **Wait.** The wait ends only on a sign of this run: a `storage_lock_acquired` event after the offset whose `pgid` equals the spawned `pgid`, or a lock record (`owner.json`) whose `pgid` equals it. An event or a record of another run never ends the wait. Deadline 60 s → FAIL "backup run not identified".
4. **Identity.** After `await backup.done`: exactly one `storage_lock_acquired` event after the offset has the spawned `pgid`. It gives the run `X` (`runId`) and its command `C`. None, or more than one → FAIL "backup run not identified". There is no fallback to a command match.
5. **Wait owner.** When `stack:up` logs `storage_lock_wait`, its `owner.runId` equals `X` and its `owner.pgid` equals the spawned `pgid`. Else → FAIL "stack:up waited on another run". A missing wait line is allowed (`M1.md:234`: a fast backup can end first); the result records "no wait observed".
6. **Release selection.** The `storage_lock_released` events after the offset with `runId` = `X`. None → FAIL "no release for the backup run". More than one → FAIL "more than one release for the backup run". Exactly one → the event `R`.
7. **Schema.** `R.command` is exactly equal to `C` (string equality). `null`, an empty value or another string → FAIL "release event without the backup command (ADR-012 §7)". On `aaa823b` this step fails until R1-A is in the candidate.
8. **Timing (fail closed).** QA takes one clock sample before the spawn and one after both services start. A sample is: host time `h1`, the Docker engine time `E` (`docker system info --format '{{.SystemTime}}'`), host time `h2`. Offset `o = E − (h1 + h2) / 2`; uncertainty `u = (h2 − h1) / 2`. Over both samples, `lo = min(o − u)` and `hi = max(o + u)`. For each of `lti-service` and `cogniate-app`: `StartedAt ≥ R.ts + hi` → this check passes. `StartedAt < R.ts + lo` → FAIL "service started before the backup released the lock". Any other value → FAIL "clock uncertainty". A failed sample → FAIL "clock not measured". The result records `o`, `u`, `lo`, `hi` and each margin. It never passes on uncertainty.
9. **Saved output.** QA saves the background backup's stdout and stderr as a run artifact (`storage/a-serialize-backup.log`) through the same redaction as other command logs (`saveText`). The runner's final redaction and secret scan cover it (`run-m1.mjs:369–373`).

Not acceptable: remove the release check; accept any release event, or the last one; select by a command match or by a whole-log or first-match acquire; accept a non-null command that is not `C`; accept a `null` command (R1-B is rejected); use the `stack:up` acquire time instead of the backup's own event; pass on clock uncertainty.

Runtime check V1-R (diagnostic and full rounds): the saved backup output has one acquire and one release line with run `X` and the spawned `pgid`. The selected event is the same event in `infra/.logs/storage-lock.jsonl` (archive, §8). `R.command` equals `C`. When a wait line exists, its owner is `X`. Every service `StartedAt` is not earlier than `R.ts + hi`. Both clocks, `o`, `u` and the margins are recorded.

## 4. RC-2: `d-mountpoint` root plant and `HOST_UID` listing

| Item | Finding |
| --- | --- |
| First failure | `M1-41.common.d-mountpoint` |
| Contract | `M1.md:252`: QA changes the owner of the two empty mountpoints to `0:0` → `stack:up` exit 0, both `HOST_UID:HOST_GID 0700`, and nothing else changed. ADR-012 §11 (line 541) and `tests/host/storage-docker.mjs:113, :125–127`: a `storage-fixture` runs as `HOST_UID:HOST_GID`; root only for the owner changes of `d-owner` and `d-mountpoint`; write mode only while both services are positively stopped and QA holds the operation lock. |
| Actual | `tests/host/storage-rows.mjs:532`: root plant `chown 0:0` of `packages` and `uploads` (`A/cmd/130-fixture-plant.log`, exit 0, 11:33:44Z). The mode stays `0700` (made by the preflight, ADR-012 §4). `:533`: the "before" listing runs as `501:20` (`A/cmd/131-fixture-list.log`) and exits 1: `EACCES: permission denied, scandir '/v/appdb/packages'`. `listRoot` reads every folder (`tests/host/storage-fixture-script.mjs:61–74`, `readdirSync` at `:66`). No product command ran in this row. The row has no `finally` step, so both mountpoints stay `root:root 0700`. |
| Carry-over | `d-content-folder` and the five `f-*` rows fail at their first listing or snapshot with the same `EACCES` (`A/cmd/133-fixture-list.log` and later). No product command ran in them. Their `finally` steps restore their own files. `a-first-start-resume` then runs `stack:data-quarantine` on the same volumes (§4.2). |
| Classification | **Harness.** The QA root plant makes a state that QA's own `HOST_UID` listing cannot read. The product is not involved. |
| Cascade (47) | Same `EACCES` (7): `d-mountpoint`, `d-content-folder`, `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`. Prerequisite (1): `f-originals-back`. Product refusal on the carried state (1): `a-first-start-resume`; then fixture `@seed` fails because the services are stopped. Not run (38): `e-not-same-import`; `h-volume-manifest`, `g-damaged`, `h-nomanifest`; `g-prepared-lti`, `g-prepared`, `g-staged`, `g-swap-lti-mid`, `g-swapped-lti`, `g-swap-app-mid`, `g-swapped`, `g-identity-lti`, `g-identity-app`, `g-rollback-mid`, `g-committed-lti`; `h-open-journal`; `g-recover-idempotent`; `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`; `g-tamper`, `g-quarantine-in-use`, `g-quarantine`; `h-legacy-manifest`, `h-target-state`, `e-fresh-refusal`, `e-hot-journal`, `e-old-layout`, `g-fresh-target`; `h-pair-mismatch`; `e-import-recover`, `e-import`, `e-kept`, `e-provenance-restore`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest`. |

### 4.0 Repair procedure

Owner: independent common QA. Files: `tests/host/storage-rows.mjs` (`d-mountpoint`, `:530–553`; `storagePhase`, `:72–117`) and one metadata-only operation in `tests/host/storage-fixture-script.mjs`.

1. **Stop.** QA stops both services and confirms that no service container of the lane runs (as `stopped()` does today).
2. **Baseline.** Full `HOST_UID` read-mode listing of both volumes (`before`). It runs **before** the root plant.
3. **Root plant.** `chown 0:0` of `packages` and `uploads` in `appdb`, in write mode, as root, with `rootReason: 'd-mountpoint'`, under QA's lock, with both services positively stopped. This is the existing ADR-012 §11 permission. No new root reason and no other root operation.
4. **Planted-state check.** A new fixture operation `meta` returns `type`, `uid`, `gid` and `mode` of named entries through `lstat` only. It never reads a folder (`readdir`) and never follows a link. It runs as `HOST_UID` in read mode on `packages` and `uploads`. (The `appdb` root is `HOST_UID 0700`, so `lstat` of its children works.) Each entry must be a directory with `uid 0`, `gid 0`, mode `0700`. Else → FAIL "precondition not made" (the plant had no effect).
5. **Product.** The real `stack:up` → exit 0, both services healthy.
6. **After.** Stop as in step 1. Full `HOST_UID` listing (`after`). Both mountpoints are directories `HOST_UID:HOST_GID 0700`, empty, and equal to their `before` entries. "Nothing else changed" compares `after` with `before` of step 2. The existing exclusion of the database files and their sidecars (the service start changes them) stays. No new exclusion is added; the mountpoints are no longer excluded.
7. **Subcases.** The file case and the symlink case run as today, each with its own cleanup (§4.3).
8. **Root restore (`finally`).** It runs when step 3 ran and step 6 did not confirm both mountpoints as `HOST_UID:HOST_GID 0700`. Order: (a) stop as in step 1, and confirm the stop; (b) `meta` (step 4) finds the root-owned mountpoints; (c) under QA's lock, in write mode, as root, `rootReason: 'd-mountpoint'`, `chown HOST_UID:HOST_GID` of only those named entries, never recursive; (d) a full `HOST_UID` listing must succeed and show both mountpoints `HOST_UID:HOST_GID 0700` and empty. If (a), the lock, (c) or (d) fails or cannot run → the cleanup fails, and §4.3 applies.
9. **Result.** The row keeps the status and the first cause of its body. The restore result is a separate note. It never replaces the first cause. If the body passed and a cleanup failed, the row is FAIL with the cleanup cause.
10. **Strict listing.** `listRoot` stays strict: an unreadable folder stays an error. `stack:data-quarantine` stays fail-closed (§4.2).

Not acceptable: `listRoot` ignores `EACCES` (globally or for named entries); a listing as root (outside §11; needs a separately reviewed design change); a root `chmod`, or a planted mode `0755` (not allowed by §11; tests another state than the criterion); a new root reason; a restore without the stop check or the lock; a restore result that replaces the row's first cause; remove "nothing else changed"; move `d-mountpoint` to the end of the sequence (hides carry-over); a product change so that backup or quarantine read as root or prepare volumes (contradicts the B-SI-07 disposition, `docs/team/multi-lms-plan.md` at `2b0081d`, lines 2523–2527).

### 4.1 In-volume mountpoint versus host content bind

Both `EACCES` failures are on the **in-volume mountpoint** of `appdb`. The host content folder is not involved.

| Path in the error | Container and mount | What it is | Owner and mode at the failure |
| --- | --- | --- | --- |
| `/v/appdb/packages` | QA `storage-fixture`; it mounts only the two lane volumes (`tests/host/storage-docker.mjs:128–131`) | `packages` folder inside the `appdb` volume | `root:root 0700` (QA `chown`; mode from the preflight) |
| entry `cogniate-app/packages` | product maintenance container; `appdb` at `/check/cogniate-app`; the entry is relative to `/check` (`infra/scripts/stack-data.mjs:653`) | the same in-volume folder | the same |
| `infra/.data/cogniate-app/packages` on the host | bound only at `/data/packages` (service, `infra/compose.yaml:186–188`) and `/content/packages` (maintenance, `:396–399`) | host content folder | host user, `0700`; `a-fresh` checked it; QA never changes its owner |

So the expectation in `d-mountpoint` is about volume metadata. It does not test Docker Desktop bind behavior. The host bind hazard is a separate item (§6 N-2).

### 4.2 `a-first-start-resume` and the quarantine contract

- `A/cmd/185-a-first-start-partial.log`: `stack:data-quarantine` acquired the lock at 11:34:04.727Z. It refused `source_unreadable` with entry `cogniate-app/packages` at 11:34:05.192Z, released the lock and exited 1. Text: "Quarantine stopped: the copy failed. Nothing was removed."
- Contract: ADR-012 §9 step 1 (copy failure → exit 1, nothing removed) and the B-SI-07 disposition (`docs/team/multi-lms-plan.md` at `2b0081d`, lines 2523–2527). The quarantine copy drops privilege before it reads, does no §4 step, and fails closed on an entry that `HOST_UID` cannot read. Source: `stack-data.mjs:858–861` (read-only modes drop at once), `:642–649` (`readable`), `:774–787` (copy walk).
- Nothing was removed: `A/lane-ownership.json` records no new appearance of `qa-multi-r1-st_ltidb` or `_appdb` between `a-fresh` and `b-sequence-up-1`.
- `@seed` (`A/cmd/186-seed.log`): exit 1, "Service 'lti-service' is not healthy (status: missing)". `require_running` (`infra/scripts/lib.sh:146–155`) reads `dc ps -q`, which lists running containers only. The services were stopped before the quarantine, and the row failed before its `stack:up`. §6 N-5 corrects the prerequisite.
- **Assessment:** the product refusal matches its documented contract. The quarantined `FIRST_START` state of ADR-012 §11 items 2–3 was never made in this round. Its result is **unknown**. No product change is indicated.

### 4.3 Phase stop after a failed cleanup

Today a `StorageBlocked` marks only the row that throws (`storage-rows.mjs:94`). The `f-*` rows need only `a-fresh` and `@seed`, so they still run after a BLOCKED `d-mountpoint`. That repeats the misattributed cascade.

Rule (QA, `storagePhase`):
- The phase has one abort state. A row sets it when a cleanup of its own plant fails or cannot run safely, or when a private-file correction is refused (§7.5).
- The row first records its own result (§4.0 step 9).
- The loop then records every remaining `SEQUENCE` step without running it. Each row: `BLOCKED`, note "phase stopped after `<step>`: `<cleanup cause>`; first cause: `<row cause>`". Each fixture: the same status and note. Every one of the 70 row ids has exactly one result.
- The phase then returns. The runner's owned teardown runs (log collection, §8 archive, removal of QA's own lane resources under ADR-012 §15). The abort itself changes and removes nothing.
- Scope: every row-level `finally` restore of a QA plant uses this rule. At least: `d-mountpoint` (root restore, file case, symlink case), `d-content-folder` (both cleanups, `M1.md`), and the existing restores of `d-unknown`, `d-symlink`, `d-owner`, the five `identityCase` rows and the `e-content-missing` package hold. QA lists every restore site in its file inventory (§10.2). The dry run injects a failure into each (§12, V2-8).
- A global post-step lane check (after every step: both volumes list as `HOST_UID`, mountpoints `0700` and empty) is **not required** (Lead). Some steps leave an intended intermediate state for the next row (for example the `g-*` drill chain and `g-tamper` → `g-quarantine`). The scoped restore guarantees above stay.

Runtime check V2-R: `d-mountpoint` PASS. Its command logs show: `HOST_UID` listing → root plant → `HOST_UID` `meta` → `stack:up` → `HOST_UID` listing. No later fixture listing has `EACCES`. No `source_unreadable` line in the phase (`cmd/*.log`). Both `a-first-start-resume` quarantines log `storage_quarantine_copy` and exit 0. No phase stop. Controls: V2-1 to V2-9 (§12).

## 5. RC-3: `e-old-schema` portal sign-in `403`

| Item | Finding |
| --- | --- |
| Rows | `M1-41.common.e-old-schema` (FAIL), `M1-41.common.e-content-missing` (not run; it needs `e-old-schema`). |
| Contract | `M1.md:269`: after the import and `stack:up`, the portal sign-in of `thanh@cogniate.test` with the copied password lists the v10 connection. `docs/architecture/security.md:160`: portal API writes (`/app-api/*`) need the session cookie **and** `Origin` = `PUBLIC_APP_URL`, else `403 ORIGIN_NOT_ALLOWED`. `services/cogniate-app/src/app/server.ts:135–143`: an `onRequest` hook refuses every write without that `Origin`, "also the login", and logs `csrf_rejected`. |
| Actual | Content parts passed: `A/cmd/208-content-import.log` refused `content_missing` with `checked: 3`, and the target stayed `FRESH` (the import half of `e-content-missing`). `A/cmd/212-old-schema-import.log`: exit 0, `storage_content_check` `pass`, `checked: 3` = QA count 3. `A/cmd/213-old-schema-up.log`: exit 0. LTI log: `GET /api/platforms` 200 at 11:36:43.865Z. App log: `csrf_rejected` with `origin: null` at 11:36:43.868Z, then `POST /app-api/session` 403. |
| Harness source | `tests/host/storage-lane.mjs:168–178` (`portal`) and `:179–185` (`app`) send only `content-type` (and the cookie). The acceptance helper sends `Origin` = `PUBLIC_APP_URL` on every write (`tests/acceptance/lib/app.ts:2`, `:62`). |
| State, session or credentials? | None of these. The `Origin` hook runs at `onRequest` (`server.ts:137`), before the body is read and before the session hook (`:145`). So the 403 says nothing about the copied password, the imported database or a session. Whether the copied password signs in is **unknown** until a run. |
| Classification | **Harness** (request shape). The product behaves as specified. |
| Smallest repair | Owner: independent common QA. File: `tests/host/storage-lane.mjs`. `portal()` and `app()` send `Origin` exactly equal to `this.r.state.urls.app` (the lane's `PUBLIC_APP_URL`) on every non-GET request (`POST`, `PUT`, `PATCH`, `DELETE`). No other header, cookie or password change. |
| Not acceptable | Exempt `/app-api/session` or another `/app-api` write from the `Origin` rule. Remove the sign-in or the v10 connection oracle. Write the marker connection with a fixture database write instead of the public API (`M1.md:226`). |
| Latent effect | The same helpers make the "write after `B`" (`storage-lane.mjs:187–199` `writeMarkers`; used by `@backup-B` at `storage-rows.mjs:658` and by `postB` at `:184`). See §6 N-1. |

Product negatives that must stay unchanged and pass on the same candidate:
- Pre-authentication: `services/cogniate-app/src/app/app.test.ts:122–124` (`POST /app-api/session` without `Origin` → 403). It runs in the Author's root `npm run check` (§9 step 4).
- Authenticated: `tests/acceptance/T4a/security.test.ts:24–37` (wrong, `null` and missing `Origin` on an `/app-api` write → 403, no course made). It runs in the legacy T4a group of the full gate (`docs/architecture/tasks/M3.md:93`; §9 step 8), not in the diagnostic.

Runtime check V3-R: over the complete phase window (§8), the storage-phase app log has zero `csrf_rejected` lines. `e-old-schema`: sign-in 204 with `__Host-cog_session`, and the v10 connection id is listed. `@backup-B` and each `@post-B`: platform 201 and connection 201. Controls: V3-1, V3-2 (§12).

## 6. Order and carry-over: what the repairs expose next

### N-1. `writeMarkers` 403 (latent RC-3)

After RC-2 only, `a-first-start-resume` and `@seed` can pass. Then `@backup-B` calls `writeMarkers` → `portal()` → the same 403. 37 of the 38 "not run" rows depend on `@backup-B` or `@post-B` (all except `e-not-same-import`). So all repairs go into one frozen candidate (§9 step 6).

### N-2. `d-content-folder`, absent case: P-1a selected

- Row: `M1.md:253`, second case (old text): "With the three content folders absent → `stack:up` creates them with mode `0700` and starts."
- Harness: `storage-rows.mjs:571–575` renames `infra/.data/cogniate-app` (`P`) to a hold folder, then runs `stack:up`. Before this, service containers bound `P/packages` and `P/uploads` many times. `stack:up` then makes a new `P` and new children (`infra/scripts/lib.sh:351–364`) and starts containers with nested binds of them (`infra/compose.yaml:184–193`).
- Measured topologies ([storage-reset-parent-repair](storage-reset-parent-repair.md) §1): R1 (new parent, new child) 20/20 visible; R2 (delete and make the parent again) 20/20 `bind source path does not exist`, still after 5.1 s; R3 (keep the parent; delete and make only the child again) 20/20 visible. A rename of `P` or of a bound child is not measured. ADR-012 §15 Limit (line 734) puts "a deletion or a move of `P` by hand" outside the guarantee.
- What is **not** known: the result of the old row text. This triage does not claim that it fails.
- Architect gap (revision 2, kept): the revision 3.4 check of QA assertions ([storage-reset-parent-repair](storage-reset-parent-repair.md):66) did not list `d-content-folder`, which moves `P` by hand.

**P-1a (selected by the Lead; criterion text proposed in `M1.md`, pending bounded confirmation and acceptance).** Conditions of both reviewers (A-SFT-03, B-SFT-04):
1. `a-fresh` asserts before its `stack:up` that `lstat` of `P`, `P/packages` and `P/uploads` each gives `ENOENT`. Any other result → the row is `BLOCKED` (setup: the lane is not fresh), never PASS. So `a-fresh` keeps the coverage "`P` absent → created `0700` → start", in a fresh clone where no container has bound `P` (topology R1). `infra/.data/` is not tracked (`.gitignore:19`).
2. `d-content-folder` keeps `P`. QA records `P`'s device, inode, owner, group and mode. QA deletes the two children; it never renames them. Before the deletion, QA records a listing of each child (names, types, sizes, SHA-256) as evidence. QA makes no copy: no later row uses that content (the current harness also leaves both children new and empty after this row). `lstat` of each child gives `ENOENT`. `stack:up` exits 0, and both services are healthy. Both children are directories of the host user with mode `0700`. `P` has the same device, inode, owner, group and mode. This is topology R3, the product's own post-reset path after revision 3.4.
3. The first half (`uploads` replaced by a symbolic link → `content_path_unsafe` before any compose start command; the link and its target unchanged) stays. QA makes `uploads` absent by deletion, not by rename. Its cleanup removes the link as a link and makes `uploads` again as the host user, an empty directory with mode `0700` (topology R3). The old rename and rename-back put the bound inode back at the bound path, which is not measured.
4. Safety for every deletion in the row: both services positively stopped; QA works as the host user, without a container, only inside its own lane clone (§15 ownership record) and its own private folder. `lstat` shows that `P` and each child are real directories of the host user, and `P` has no legacy database entry (the existing `legacyEmpty` check). Any other result → `BLOCKED` (setup), and QA deletes nothing. A deletion removes a symbolic link as a link and never follows it. QA deletes nothing outside the two children.
5. The criterion states the limit: a deletion or a move of `P` by hand after a nested bind is outside the ADR-012 §15 guarantee. No row covers it, and no result claims PASS for it.
6. No row id or count changes. No ADR-012 change for P-1a.

**P-1b and D-1: rejected as a gate (Lead).** No diagnostic of the rename case is requested. A sample of an unknown Docker Desktop mechanism cannot narrow the §15 Limit, and D-1 as written cannot tell a correct bind from a stale bind (B-SFT-05).

Controls: V5-1 to V5-4 (§12). Runtime check V5-R: `a-fresh` records `ENOENT` for the three paths before its start. `d-content-folder` records `P`'s identity before and after (equal), `ENOENT` for both children before `stack:up`, and both children `0700` of the host user after it.

### N-3. `a-serialize` clock domains

The lock events use the host clock. `State.StartedAt` uses the Docker engine clock. The observed margin is about 1 s or more. The run sampler reports `maxSkewMs: 0` and `skewViolations: 0` (`E/public/sampler.out`). The oracle now compares fail-closed with a measured offset and its uncertainty (§3.1 step 8).

### N-4. Rows never run on any full round (unknown)

The 38 "not run" rows, `f-originals-back`, and the bodies of `d-content-folder`, the five `f-*` rows, `a-first-start-resume` and the restore half of `e-content-missing` have no full-round result on any candidate. The `9cdd768` storage phase stopped at `a-fresh` (`/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source/tests/host/artifacts/qa-multi-r1-st-9cdd7687-2026-10-21T07-39-36-550Z/summary.json`, `f50117ee5b3f7fce122175e1db3c96b5df57f6741433e2c61f8fbb55adc9af95`). Their runtime result is **unknown**. The host-only dry run (§12, V7) can find sequence and fixture-logic errors. Only a storage run can find runtime errors (§9 step 7).

### N-5. Repeated `@seed` prerequisite (A-SFT-05 h)

- `SEQUENCE` runs `@seed` twice: after `a-fresh`, and after `a-first-start-resume` (`storage-rows.mjs:28`, `:32`). `NEEDS` is keyed by name, so both runs need only `a-fresh` (`:47`). The status of the second run replaces the status of the first (`steps.set`, `:101`).
- Effect: after a failed `a-first-start-resume`, the second run starts on stopped services and records its own failure (`A/cmd/186-seed.log`). The later rows then name a seed failure as their cause.
- Repair (QA): the second run has its own needs: `a-fresh` and `a-first-start-resume`. The first run keeps only `a-fresh`. `e-not-same-import` and `@backup-B` read the status of the second run. One way: a second fixture name (for example `@seed-resume`) with the same procedure. A fixture is not a row (`coverage.mjs` counts row ids only), so no row id or count changes. No step needs a later step, and the first run does not depend on a later state (V2-9, V7-1).

## 7. Private copy permissions (P-3, mandatory before the next runtime)

### 7.1 Deviation (unchanged facts)

- Deviation during this failed run: the QA stash copy `P8/out/hold-f-half-f50d1dc235febf0e/cogniate.db` had mode `0644` under a `0700` parent. QA corrected it after the run to `0600` at 11:47:11.753Z, under Lead authorization `msg_6b7ada30298a`. The record `E/public/permission-correction-hold-db.json` (`f99bdcf0…`) shows the same inode, size and SHA-256 before and after. The correction does **not** make the run compliant: the deviation stands for this run.
- This is the second window with this deviation class (four copies in the targeted retry; one in this run). The Lead already requires `0600` from creation.
- Metadata of `P8` (Reviewer-B, `stat` only): `bin/storage-fixture-script.mjs` is `0555`; `out/content-target-3d51…/qa.txt` is `0644`; every other regular file is `0600`.
- The partial quarantine copy `P8/quarantine/a-first-start-partial-…/` (four files, mode `0600`, no manifest) is product output; ADR-012 §9 step 1 keeps it after a copy failure. QA owns the cleanup of `P8`.

### 7.2 Inventory of QA copy and write sites (storage and migration phases)

Protected classes: `*.db`, `*.db-wal`, `*.db-shm`, `*.db-journal`, `.storage-identity.json`, `.storage-journal.json`, a backup or quarantine `manifest.json` and `quarantine.json`, `.env` and every copy of its values, every file under `infra/.secrets/`, private keys (`*.key`, `*.pem`) and certificates (`*.crt`).

"Private helper" and "into-volume helper" are defined in §7.3. "Private scratch" is `privateScratch` (§7.3).

| # | Site (`F`) | What it copies or writes | Today | Required |
| --- | --- | --- | --- | --- |
| 1 | `storage-fixture-script.mjs:186–193`, `stash` (volume → `out/<hold>`) | database, sidecars, identity | `copyFileSync` keeps the source mode (`0644` seen, §7.1) | private helper; records the source mode |
| 2 | same lines, `unstash` (`out/<hold>` → volume) | the held files | keeps the hold-file mode | into-volume helper with the recorded original mode |
| 3 | `storage-fixture-script.mjs:221–234`, `copyOut` (volume → `out/<folder>`) | database, sidecars, identity (`identityCase`) | copy, then `chmod` to the source mode | private helper (`0600`); records the source mode for the return |
| 4 | `storage-fixture-script.mjs:107–116`, `logicalRead` | database and sidecars into scratch (fixture container; host through #10, #11) | keeps the source mode | private helper; on the host, `scratchBase` is a private scratch |
| 5 | `storage-fixture-script.mjs:174–178`, plant `copy` (volume → volume) | a planted copy | keeps the source mode | into-volume helper with the planted mode (`op.mode`, else the recorded source mode) |
| 6 | `storage-fixture-script.mjs:150–153` plant `write`; `:198–206` plant `editjson` (temporary, then rename) | planted files; edited identity or journal | mode through the umask | into-volume helper: planted mode for `write`, recorded original mode for `editjson` |
| 7 | `storage-fixture-script.mjs:285–290`, `oracle-B` negative control (self-test only) | a synthetic database copy | keeps the source mode | private helper; no exception |
| 8 | `storage-oracle.mjs:233–241`, `LegacyFixtures.place` (backup → `infra/.data/<service>/`) | legacy databases and sidecars | copy, then `chmod 0600` | private helper (`0600` at creation, at the legacy place) |
| 9 | `storage-rows.mjs:1330–1349`, `copyCredentials` | four secret files; the `.env` rewrite (`:1342`) | copy over an existing file, then `chmod 0600`; `.env` rewritten in place | private helper: an exclusive `0600` temporary in the same folder, `fsync`, then `rename` over the target |
| 10 | `storage-lane.mjs:220–229`, `backupLogical` | backup databases into host `os.tmpdir()` | keeps the source mode | private scratch + private helper |
| 11 | `storage-rows.mjs:1304–1325`, `storagePaths` | the app database into host `os.tmpdir()` | keeps the source mode | private scratch + private helper |
| 12 | `storage-rows.mjs:687` (`g-damaged`), `:707`, `:709` (`h-nomanifest`), `:992` (`h-old-manifest`) | recursive `cpSync` of a backup into `backups/` | keeps the source modes | private recursive copy: each folder `0700`, each file through the private helper; a symbolic link → FAIL, never followed |
| 13 | `m1-migration.mjs:218` (migration phase) | damage copies of the AC-M1-23 backup | keeps the source modes | as #12 |
| 14 | `storage-compat-route.mjs:202–218`, `configDiff` (migration phase, `j-migration`) | `env -0` and the `dc()` arguments, captured by shell redirection into host temp files | `lib.sh:20–22` exports every `.env` value (`set -a; source .env`), so the `env` file holds the `.env` secrets. Mode through the umask (`0644` under `022`); parent `0700` (`mkdtempSync`); removed after the compare. Source fact; not observed at runtime. New in revision 3. | private scratch; QA first makes both files with the private helper (empty, `0600`); the shell then writes into the existing files (`>` keeps the mode) |
| 15 | QA marker and scratch files in private areas: `d-content-folder` `qa.txt` (`storage-rows.mjs:558`, no mode); `d-symlink` target (`:502`, `0600` without `wx`) | QA text | `0644` under umask `022`; `0600` | `{ mode: 0o600, flag: 'wx' }`, then a mode check |
| 16 | `m1-migration.mjs:162–171`, `writeHandoff` | ids and paths only; no secret | `0600`, no exclusive create | `wx` and `0600`, so that an existing file fails (§9 step 7) |

Named exceptions (not a protected class). These are the only copy or temporary-folder calls outside the helpers that the source-inventory check (V4-9) accepts:
- X1 `storage-lane.mjs:46`, `boot()`: the fixture script into `bin/` (checked by the `bin/` rule, §7.4).
- X2 `storage-rows.mjs:1070`, `e-old-schema`: course package folders from the AC-M1-23 clone into the lane content folder (synthetic course content; `M1.md:269`).
- X3 `storage-compat-route.mjs:186`, `treeRule`: a git index of the public `tests/` tree in host temp.
- X4 `run-m1.mjs:141`: the accounting scratch (`0700`) with row result files and the handoff (#16).

`tests/host/core.mjs` is outside the source check. It copies the clone, the test tree and redacted evidence; it copies no protected class.

### 7.3 Helpers

Both copy helpers are in `tests/host/storage-fixture-script.mjs`. It is the only QA file in the fixture container (`bin/`, `storage-lane.mjs:18`, `:46`), and it imports Node built-ins only. Host modules import the helpers from it. No second file goes into `bin/`.

- **Private helper** (QA copies outside the product volumes). Open the target with exclusive create and no link follow (`O_CREAT | O_EXCL | O_NOFOLLOW | O_WRONLY`) and mode `0600`. Check `fstat` of the descriptor before the first byte: regular file, mode `0600`, size `0`. The helper reports this check to an optional hook. Then write the bytes, `fsync`, close. Then check the SHA-256 against the source. For a replace (#9): write such a temporary in the target folder, then `rename` over the target. The source mode is returned as a record, never applied to the copy.
- **Into-volume helper** (QA returns or plants a file in a volume). Exclusive create with mode `0600` as above; write; `fsync`; `fchmod` to the target mode (the recorded original mode, or the planted mode); `fsync`; close. Then `lstat`: mode equal to the target mode, SHA-256 equal. For `editjson`, the temporary is made this way and then renamed.
- **Private scratch** (`privateScratch(label)`). It makes `<private root>/scratch/<label>-<16 hex>` with mode `0700` and returns it with `remove()`. `remove()` first runs the §7.4 scan on that folder, then removes it. A hit FAILs the current step before the removal (§7.5).
- The mode is always explicit. No result depends on the process umask.

### 7.4 Scan scope

| Area | Rule |
| --- | --- |
| **Private data areas** (full scan, no name exemption): `out/`, `backups/`, `quarantine/` and `scratch/` of each lane private root (storage lane and migration lane); the migration roots `qa-m1-private-backup-*` and `qa-m1-snapshot-private-*` | Every regular file, whoever made it, has no group or other bit (`mode & 0o077 === 0`). A symbolic link is never followed. |
| `bin/` of each lane private root | Exactly one entry: the fixture script, a regular file with the SHA-256 that `boot()` records (`scriptSha`) and mode `0555`. Any other entry, another digest or another mode → FAIL. The mode stays `0555`; a change to `0500` needs evidence of how root and `HOST_UID` fixture containers read that bind, which this triage does not have. |
| **Outside these areas**: the two legacy placement folders `infra/.data/lti-service/` and `infra/.data/cogniate-app/` of the lane clone (direct entries only; not `packages/` or `uploads/`), and every protected-class path that a QA step wrote, copied, placed or replaced (a QA write ledger; for example the #9 targets) | Every protected-class file is a regular file of the host user with no group or other bit. |

Scan points:
- Storage phase: after every `SEQUENCE` step, rows and `@` fixtures, and in the abort path (§4.3). Also at each `privateScratch.remove()`.
- Migration phase: after the private backup, after each damage copy (#13), at each `configDiff` scratch removal (#14), after the snapshot backup, and at the phase end.
- The scan reads `lstat` only. It hashes only a hit.
- No scan exemption may be added during implementation. A needed exemption returns to the Architect for a reviewed text change.

### 7.5 Scan hit

1. The step (row or fixture) that the scan point belongs to is FAIL. A hit at the migration phase end makes the phase FAIL. No later correction changes this result.
2. QA records, without secret content: the path relative to the area root, the type, the mode, the size, the SHA-256, the device and the inode.
3. Then QA may make one bounded correction (Lead decision): open the same path with `O_RDONLY | O_NOFOLLOW`; `fstat`: a regular file of the host user, the same device and inode as the record; `fchmod 0600`; `fstat` again: mode `0600`, the same device, inode, size and SHA-256. QA records the correction. No deletion. No claim of earlier compliance.
4. If a check of step 3 fails (a link, another owner, another inode, a race), or the ownership is unknown → no correction. The file stays as it is. QA records "correction refused: `<reason>`", and the phase stops (storage phase: §4.3; migration phase: the phase ends FAIL).

### 7.6 Product copies (A-SFT-08)

`infra/scripts/stack-data.mjs:153–154`, `:694–695` and `:785` copy each database file, then set `0600`. So a copy exists at the source mode for a short time. Lead decision: accepted MINOR, deferred to M4 (Docs records it in `docs/human_review/deferred.md`). It is not in R1-A and not in this repair. The §7.4 scan of `backups/` and `quarantine/` still applies: a wider product file found there FAILs that step.

Controls: V4-1 to V4-9 (§12). Runtime check V4-R: zero scan hits in both phases. Each hit, if any, is recorded with §7.5 step 2 and stays a FAIL.

## 8. Evidence windows (logs)

- `stack:reset` deletes `infra/.logs` (ADR-012 §15). The storage phase runs it four times (`b-sequence` ×3, `storage-rows.mjs:1004`; `@old-schema-setup`, `:1027`). `collectLogs` copies the folder only at the end (`core.mjs:368–376`).
- Rule (QA): before each product `stack:reset`, and at the phase end (also after a phase stop), QA copies every `infra/.logs/*.jsonl` file into the phase artifacts as one segment (for example `storage/log-archive/<nn>-<label>/`). It records each file's byte length and line count. The copy goes through the same redaction as other evidence (`saveText`). The runner's final redaction and secret scan cover it.
- V1-R, V2-R and V3-R read the union of all segments and the final copy. Each result states its window (phase start to phase end) and its segment list.
- An absence claim (zero `csrf_rejected`, no `EACCES`, no `source_unreadable`) is PASS only when a segment exists before each reset and at the end. A missing or unreadable segment makes the claim `BLOCKED`, never PASS. `cmd/*.log` is not reset-truncated and stays a source for `EACCES` and `source_unreadable`.

Controls: V6-1, V6-2 (§12).

## 9. Verification plan

No step below gives acceptance credit. No step is granted by this file.

1. **Lead decisions.** Done (§0).
2. **Criterion confirmation.** Bounded independent confirmation of this revision and of the two criterion texts (`M1.md` P-1a; ADR-012 §4 O-1) by Reviewer-A and Reviewer-B, plus a QA testability check from the criteria (not from code). Lead acceptance. Only then QA edits tests.
3. **Host only, QA.** The repairs of §10.2. Every control of §12, each with its mutation. The mock-lane dry run (V7). The handoff feasibility (V8) before any runtime grant.
4. **Host only, Author (R1-A, required).** §10.1. `npm run test:infra` (it also runs the compatibility hash check, `infra/scripts/storage-compat.test.mjs:334`) and the root `npm run check` (it includes the pre-authentication `Origin` negative, §5). The compatibility hash is updated in the same commit.
5. **Reviews.** Two blind source reviews of the QA diff and two of the Author diff. Lens A: no weaker oracle, no privilege change, no `Origin` relaxation, `listRoot` strict, no required field waived, no scan exemption. Lens B: test quality, saved evidence, row attribution, permission controls, dry-run coverage.
6. **Freeze.** One product SHA and one tests tree: candidate `C`. Any later product or test change returns to step 3 for the affected checks and reviews, and needs a new step 7. No silent rerun.
7. **Diagnostic (separate Lead grant; zero acceptance credit).** On `C`, in one granted window:
   - QA makes one new private folder (`0700`). The handoff path in it does not exist before the migration child starts. No handoff or file of the `aaa823b` run is read, copied or reused.
   - `--phase migration` (12 rows, default lane) with `QA_M1_HANDOFF_FILE` = that path. The migration child creates the file exclusively (#16).
   - Then `--phase storage` (70 rows, lane `<base>-st`) with the same `QA_M1_HANDOFF_FILE`. Its `@old-schema-setup` accepts the handoff only when `m123Clone` and `m123Backup` are this window's migration clone and backup.
   - Both lanes: fresh G1, W1–W3 and strict W4; the ADR-012 §15 ownership record; cleanup; secret and permission scans (§7.4).
   - Reads V1-R, V2-R, V3-R, V4-R, V5-R. Keeps every failed, blocked and not-run row with its evidence.
   - A failure returns to triage. It is not waived and not rerun silently.
8. **Full gates on `C`, unchanged and mandatory after step 7.** Two complete 488-row rounds with the same result per row; all 12 legacy groups (the T4a group includes the authenticated `Origin` negative, §5); strict W4, cleanup and scans; then fresh M2 and T7. R1-A changes a file that every `stack:up` uses, so M2 and T7 use `C` too.
9. **O-1.** Closed (reviewed ADR text) before the Lead's full acceptance decision and before M4 conformance (§11).

## 10. Implementation scopes

### 10.1 Backend Author (R1-A; the scope that both design reviews give)

The Lead runs the R1-A Author in parallel on these three files only. The Lead records R1-A at `01ce5bc` with Author self-checks only (plan checkpoint 12:45 UTC). Its independent source reviews are pending. This file makes no claim about that diff.

| File | Change |
| --- | --- |
| `infra/scripts/storage-oplock.sh` | `storage_lock_acquire` keeps its own command in a shell variable (for example `STORAGE_LOCK_COMMAND`, next to `STORAGE_LOCK_RUN_ID`, not exported). `storage_lock_release` passes `--command "$STORAGE_LOCK_COMMAND"`. `command` is always the emitting process's own acquire command, also on `storage_lock_lost`; `owner` keeps the other record there. The JavaScript `release` needs no change, because `ctxOf` reads `--command` (`:194`). No change to the event shape, the lock algorithm, `release()` or another function. Optional (Reviewer-A): the same variable in `storage_lock_add_container`, which writes no event. |
| `infra/scripts/storage-oplock.test.mjs` | Assert values, not only keys (`:69`, `:85`). `run -- true`: acquired and released events have the same command, equal to the record's command. Lost (`:195`): `lost.command` is the own command, and `owner` is the other record. `TERM` trap (`:207`): `released.command` is the own command. Every event of every test has a non-empty string `command`. Mutation: without `--command` on release, the test FAILs. |
| `infra/compat/storage-compat.sha256` | The new SHA-256 of `storage-oplock.sh` (line 4), in the same commit (ADR-012 §12). |

Checks: `npm run test:infra` and the root `npm run check`. Not in this scope: `infra/scripts/storage-compat.test.mjs` (Reviewer-A's optional item), `stack-data.mjs` (A-SFT-08, §7.6), any ADR or criterion text, any other product file. `j-migration` and `j-snapshot` use the new lock-helper hash through the old-build route, so they need fresh runtime evidence (§9 steps 7–8). Control V1-5 (§12) is in this scope.

### 10.2 Independent common QA (`tests/**` only; file inventory recommendation)

QA owns the final list. It must name every file and every restore site before the source reviews.

| File | Change |
| --- | --- |
| `tests/host/storage-rows.mjs` | `a-serialize` (§3.1); `d-mountpoint` (§4.0); `d-content-folder` and `a-fresh` (P-1a, only after step 2 acceptance); the phase stop in `storagePhase` (§4.3); the occurrence-specific `@seed` need (§6 N-5); the per-step scan hook (§7.4); the log archive (§8); P-3 sites #9, #11, #12, #15. |
| `tests/host/storage-fixture-script.mjs` | The `meta` operation (§4.0 step 4); both copy helpers (§7.3); P-3 sites #1–#7. `listRoot` unchanged. |
| `tests/host/storage-lane.mjs` | `Origin` on non-GET in `portal()` and `app()` (§5); the `scratch/` folder in `boot()` and `privateScratch`; site #10; the `bin/` rule. |
| `tests/host/storage-oracle.mjs` | Site #8; optionally the pure `a-serialize` verdict function. |
| `tests/host/m1-migration.mjs` | Sites #13 and #16; the migration scan points (§7.4). |
| `tests/host/storage-compat-route.mjs` | Site #14. |
| `tests/host/run-m1.mjs` | Only if needed for the diagnostic call (two children, one handoff, a new handoff folder). No change of the `full` mode. |
| New host modules | Allowed (for example the scan in `tests/host/storage-private-scan.mjs`). The copy helpers stay in the fixture script (§7.3). |
| Self-tests | A new `tests/host/*.selftest.mjs` file is found by its suffix (`run-m1.mjs:57`); there is no list to edit. Recommended: `storage-private-copy.selftest.mjs` (V4), `storage-source-inventory.selftest.mjs` (V4-9), and additions to `storage-rows.selftest.mjs` (V1, V2, V5, V6, V7, V8) and `storage-fixture-script.selftest.mjs` (V2-1, V2-2, V4). |

Not in QA scope: the row inventory (`tests/host/storage-inventory.mjs`, the manifests). No row id or count changes. No product file.

### 10.3 Architect

- `M1.md`: `a-fresh` and `d-content-folder` text (P-1a), proposed.
- ADR-012 §4: the O-1 sentence, proposed revision 3.6.
- This revision. No speculative product change.

## 11. Observations: O-1 (ADR text precision)

- ADR-012 §4 (line 101) says that `report` and `mark-started` "drop privilege at once". Both read the volumes as root first, read only (the step-1 snapshot), then drop privilege before evaluation, output and writes (`sqlite-lock-probe.mjs:567`, `:573`). The first sentence of the same rule allows this ("As root, a program may only read …").
- `d-mountpoint` depends on it: the `stack:up` legacy scan runs `report` (ADR-012 §10 step 3) on root-owned `0700` mountpoints. Literal compliance with "at once" would break an accepted row.
- Proposed text: ADR-012 revision 3.6 (one §4 sentence). It adds no root write and no privilege. Do not change the product to drop first.
- Owner: Architect. Gate: bounded independent review; closed before the Lead's full acceptance decision and before M4 conformance (§9 step 9).

## 12. Consolidated QA controls and the dry run

Rules for every control:
- It asserts an observable result of the code under test: a verdict, a status, a cause text, `selectedRunId`, a file mode at creation, a device and inode, a row count. It does not assert a call sequence of a specific implementation.
- It names one mutation and shows that the mutation fails it.
- A control that cannot make its precondition is `BLOCKED`, never PASS.
- Host only. No Docker, except that V1-5 and V1-12 use a Docker stub first on `PATH`.

| Id | Input | Expected | Mutation it detects | Finding |
| --- | --- | --- | --- | --- |
| V1-1 | acquire `X` (spawned `pgid`); release `X` with `command: null` | schema FAIL, distinct message; `selectedRunId` = `X` | a command-only selector ("no release", not the schema message); a selector that skips the schema step (PASS) | revision 2 |
| V1-1b | release `X` with `command: "stack:up"` | schema FAIL | a non-null-only check | B-SFT-03 |
| V1-2 | acquire `X`; no release `X`; release `Y` with the backup command | FAIL "no release for the backup run" | a wrong-run selector that accepts a command match | revision 2 |
| V1-3 | release `X` before the service `StartedAt`; later release `Z` (other run, backup command) after it | PASS; `selectedRunId` = `X` | a "last release" selector (selects `Z`, FAILs on time) | A-SFT-04 |
| V1-4 | release `X` later than a service `StartedAt` | FAIL on time | a missing or reversed time compare | revision 2 |
| V1-5 | (Author) `storage-oplock.sh run -- true`, the lost case and the `TERM` case | every event has a non-empty `command`; release and lost equal the own acquire command | the current missing-command release | A-SFT-04, B-SFT-10 |
| V1-6 | an older backup pair `W` before the offset, released before `StartedAt`; then `X`, released after it | FAIL on time; `selectedRunId` = `X`, never `W` | a whole-log or first-match acquire selector | A-SFT-04, B-SFT-03 |
| V1-7 | `W`'s acquire event and a record of `W` exist before the spawn | the wait does not end until a sign of the spawned `pgid` | the `.some()` wait over the whole log | B-SFT-03 |
| V1-8 | zero, or two, acquire events after the offset with the spawned `pgid` | FAIL "backup run not identified" | an "any new acquire" selector | A-SFT-04 |
| V1-9 | a `storage_lock_wait` of `stack:up` with `owner.runId` ≠ `X` | FAIL "stack:up waited on another run" | a missing wait-owner cross-check | B-SFT-03 |
| V1-10 | margin smaller than the offset uncertainty; and an engine offset of +2 s that hides a start 1 s before the release | FAIL "clock uncertainty"; FAIL on time | a compare without offset or uncertainty | A-SFT-04, B-SFT-12 |
| V1-11 | no `storage_lock_released` event after the offset | FAIL "no release for the backup run" | a selector that falls back to an earlier release | revision 2 |
| V1-12 | `spawnGroup` starts `bash infra/scripts/storage-oplock.sh run -- true` (Docker stub) | the logged acquire `pgid` equals the spawned `pgid` | an identity rule whose `pgid` premise is false | B-SFT-03 |
| V2-1 | non-root; folders `packages`, `uploads` and one other name with mode `000` in an app-role root; precondition: a direct `readdirSync` of each throws `EACCES`, and the control refuses to run as root | `listRoot` fails with `EACCES` for each | a global or a name-targeted relaxation of `listRoot` | A-SFT-05 c, B-SFT-06 |
| V2-2 | the same `000` folders | `meta` succeeds and returns `type`, `uid`, `gid`, `mode`, and no entry list | a hidden `readdir` (it throws `EACCES`) | A-SFT-05 d, B-SFT-06 |
| V2-3 | mock lane; injected `stack:up` failure | order: listing → plant → `meta` → `stack:up` → listing; the restore runs; the next listing works; the row is FAIL with the `stack:up` cause and a separate restore note | a missing restore; a restore result that replaces the first cause | revision 2, A-SFT-05 b |
| V2-4 | injected failed root restore | `d-mountpoint` FAIL with its first cause and the restore note; every remaining step `BLOCKED` with "phase stopped after `d-mountpoint`: …; first cause: …"; 70 row ids, one result each; teardown runs | a row-only BLOCKED (the `f-*` rows still run); a missing row | A-SFT-05 f, B-SFT-06 |
| V2-5 | mock `stack:up` changes one unrelated volume entry | FAIL "nothing else changed" | a baseline that drops this check | **Reviewer-A V2-5** (A-SFT-05 e) |
| V2-6 | the root plant has no effect (`meta` shows `HOST_UID`) | FAIL "precondition not made" | a no-op plant that passes the row | **Reviewer-B V2-5** (B-SFT-06) |
| V2-7 | services not positively stopped, or QA's lock not held, at the root restore | the restore does not run; cleanup failure; phase stop as V2-4 | a restore without the stop or lock check | A-SFT-05 a, B-SFT-06 |
| V2-8 | dry run; one injected failure at each restore site of §4.3 | phase stop as V2-4 at each site | a site without the abort rule | B-SFT-06 |
| V2-9 | mock: `a-first-start-resume` FAIL | the second seed run does not run; `e-not-same-import` and `@backup-B` name `a-first-start-resume`; the first seed needs only `a-fresh` | a shared `@seed` need; a need on a later step | A-SFT-05 h |
| V3-1 | recording HTTPS function; `POST /app-api/session` and `POST /app-api/connections` | `Origin` exactly equal to `PUBLIC_APP_URL` | the current omission | revision 2 |
| V3-2 | the same with `Origin` = the LTI URL, `PUBLIC_APP_URL` + `/`, or another port | the test fails | a fixed, loose or wrong origin | revision 2 |
| V4-1 | for **each** site #1–#14: a source at `0644` made by the control, umask pinned to `022` and to `000` (asserted) | the hook reports `0600` and size `0` on the same device and inode as the final file; the final mode is `0600` (private) | a plain copy; copy, then `chmod`; a mode left to the umask | A-SFT-02, B-SFT-08, B-SFT-09 |
| V4-2 | `unstash` and the plant `copy`/`write`/`editjson` into a volume folder with a recorded mode `0644`, and with `0600`; umask `022` and `077` | each returned or planted entry has exactly the recorded or planted mode; `identityCase` and the `d-symlink` unstash compare modes with QA's listing before the row | a return that keeps `0600`; a byte-only (`fileset`) compare | B-SFT-09 |
| V4-3 | in each private data area: a `0644` database, sidecar, identity, secret file, and a `0644` course file | each FAILs the scan | a filename exemption in a private area | A-SFT-02, B-SFT-01 |
| V4-4 | outside: a `0644` protected file in a legacy placement folder; a `0644` non-protected file there | the first FAILs; the second does not | a scan without the outside classes | A-SFT-02 |
| V4-5 | `bin/`: the recorded script at `0555`; a second file; a changed digest; mode `0755` | the first passes; each other FAILs | an unchecked `bin/`; a blanket `bin/` exemption | B-SFT-01 |
| V4-6 | `qa.txt` and the `d-symlink` target made by the row code | both `0600`; a pre-existing target makes the write fail | a marker without mode or `wx` | B-SFT-01 |
| V4-7 | a planted `0644` file at a scan point; variants: the path replaced by a link, or by another inode, before the correction | the step FAILs; the record has §7.5 step 2; the correction keeps the inode and sets `0600`; the step stays FAIL. Variants: the correction is refused, the file is unchanged, and the phase stops | a correction that follows a link, changes another file or deletes; a FAIL that turns into PASS | B-SFT-01 |
| V4-8 | `privateScratch` with a `0644` protected file; site #14 capture files | the step FAILs before the removal; both capture files are `0600` at creation | a removal without a scan; a capture file with the umask mode | A-SFT-02 |
| V4-9 | source-inventory check of `tests/host/storage-*.mjs`, `m1-migration.mjs`, `run-m1.mjs` | no `copyFileSync`, `copyFile`, `cpSync`, `cp`, or `mkdtempSync` under `os.tmpdir()` outside the helpers and X1–X4. Mutation: one such call inserted at a #1–#16 site → the check FAILs | a bypass at any site | A-SFT-02, B-SFT-08 |
| V5-1 | mock: `P`, or one child, present before `a-fresh` | `a-fresh` `BLOCKED` "lane not fresh: `<path>`"; never PASS | a precondition that is only recorded | A-SFT-03, B-SFT-04 |
| V5-2 | mock file system: `d-content-folder` second case | `P` identity equal before and after; both old child inodes exist nowhere in the clone or the private root; `ENOENT` before `stack:up`; new children `0700` of the host user | a rename (the old inode stays alive); a new `P` | A-SFT-03, B-SFT-04 |
| V5-3 | mock: `d-content-folder` first half | refusal before any compose start; after the cleanup, `uploads` is a real empty directory of the host user, `0700`, with an inode different from the original; the original inode exists nowhere | a rename-back of the old folder; a link left in place | A-SFT-03 |
| V5-4 | a child that is a symbolic link, or a file, before a deletion | `BLOCKED` (setup); nothing deleted; the link target unchanged | a deletion that follows a link | A-SFT-03 |
| V6-1 | dry run | a log segment is saved before each `stack:reset` and at the phase end, also after a phase stop | an archive after the reset, or none | B-SFT-07 |
| V6-2 | an absence check with one segment missing | `BLOCKED`, not PASS | an absence claim from a reset-truncated log | B-SFT-07 |
| V7-1 | mock-lane dry run of the full `SEQUENCE` (no Docker; a fake product records commands) | every step has a procedure; every need names an earlier step (no cycle, no forward need); the scan hook runs after every step, also `@` fixtures and the abort path; each §4.3 restore runs; each row id has one result, 70 in total; a harness exception (for example a `TypeError`) FAILs the dry run | a missing hook, restore or row; a forward need | revision 2, A-SFT-05, B-SFT-06 |
| V8-1 | host only: a standalone migration child with `QA_M1_HANDOFF_FILE` set to an absent path; then a storage child with the same variable | the migration child creates the file exclusively (`0600`) with its own clone and backup; the storage child reads it; an existing file → `BLOCKED`; a clone or backup outside the window's folders → `BLOCKED` | a reused or stale handoff | A-SFT-01, B-SFT-02 |

## 13. Limits

- One host, one attempt, read-only diagnosis. No hypothesis was reproduced.
- The backup's own release line for `a-serialize` is not available (§3).
- The rename cases of N-2 are unmeasured. The R2 evidence is for a deletion. No diagnostic of them is requested.
- Site #14 is a source fact. Its runtime mode was not observed.
- The rows in N-4, the `FIRST_START` path of `a-first-start-resume` and the copied-password sign-in of `e-old-schema` have no runtime evidence. Their result stays unknown until a storage run.
- Accepted deferrals stay unchanged: B-BM-01, A-SOR-01/B-SOR-01, post-reset build-request coverage, A-T9-C01 (closed B-SI-07 stays closed). New: A-SFT-08 (§7.6).
- The 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. No push or main merge is implied.

## 14. Disposition map (Reviewer-A and Reviewer-B)

"Revised" means that this revision changes the text. It does not mean that the finding is closed. Each item needs the bounded confirmation of §9 step 2. The Lead's decisions are in §0.

| Finding | Severity | Disposition | Where |
| --- | --- | --- | --- |
| A-SFT-01 diagnostic cannot run all 70 rows | MAJOR | Revised: migration (12) then storage (70), one window, one fresh handoff; feasibility V8-1 before the grant | §9 step 7, §12 |
| A-SFT-02 P-3 sites and scan scope | MAJOR | Revised: P-3 mandatory; 16 sites + X1–X4; helpers; private areas, `bin/`, outside classes; source check | §7, §12 V4 |
| A-SFT-03 P-1a deletion; P-1b | MAJOR | Revised: P-1a with conditions 1–6; criterion text in `M1.md`; P-1b and D-1 rejected (Lead) | §6 N-2, `M1.md`, §12 V5 |
| A-SFT-04 run binding, controls, clocks, saved output | MINOR | Revised: offset + `pgid` + exactly one acquire; `selectedRunId`; fail-closed clocks; redacted saved output | §3.1, §12 V1 |
| A-SFT-05 RC-2 precision | MINOR | Revised (a)–(f), (h). (g) per-row isolation guard: not required (Lead), scoped restores stay | §4.0, §4.3, §6 N-5, §12 V2 |
| A-SFT-06 one candidate; criterion order; P-3; O-1 gate; Author checks | MINOR | Revised | §9 steps 2, 4, 6, 9; §11 |
| A-SFT-07 wording | NIT | Revised: runner wording, own acquire command, both `Origin` negatives cited, cleanup events counted | §2, §3, §5 |
| A-SFT-08 product copy, then `chmod` | MINOR | Deferred to M4 (Lead); outside this repair | §7.6 |
| B-SFT-01 scan conflicts with QA's own files | MAJOR | Revised: full scan of private areas; exact `bin/` rule at `0555`; markers `0600` `wx`; scan after every step; §7.5 hit rule (correction permitted by the Lead) | §7.4, §7.5, §12 V4 |
| B-SFT-02 storage-only diagnostic | MAJOR | Revised as A-SFT-01 | §9 step 7, §12 V8-1 |
| B-SFT-03 weaker `a-serialize` oracles | MAJOR | Revised: equality, `pgid` identity, wait rule, wait-owner check; V1-1b, V1-6, V1-7, V1-9, V1-12 | §3.1, §12 V1 |
| B-SFT-04 P-1a silent coverage loss | MAJOR | Revised: `a-fresh` asserts `ENOENT` (BLOCKED else); deletion, not rename; `P` identity kept; stated limit | §6 N-2, `M1.md`, §12 V5 |
| B-SFT-05 D-1 cannot tell a stale bind | MINOR | P-1b and D-1 rejected (Lead); no D-1 | §6 N-2 |
| B-SFT-06 phase stop; V2 controls | MINOR | Revised: abort with 70 results; stop and lock before the root restore; V2-6 (no-op plant); non-root preconditions. Optional post-step lane check: not required (Lead) | §4.3, §12 V2 |
| B-SFT-07 absence checks on deleted logs | MINOR | Revised: segment before each reset and at the end; BLOCKED on a missing segment | §8, §12 V6 |
| B-SFT-08 more copy sites | MINOR | Revised: inventory #1–#16, X1–X4; migration private roots in scope | §7.2, §7.4 |
| B-SFT-09 umask; V4-2 compare | MINOR | Revised: explicit modes; pinned umask; creation-time check; mode compare in `identityCase` and the `d-symlink` unstash | §7.3, §12 V4-1, V4-2 |
| B-SFT-10 R1-A wording for `lost` | MINOR | Revised: own acquire command; `owner` keeps the other record | §3, §10.1 |
| B-SFT-11 O-1 before acceptance | MINOR | Revised: proposed ADR-012 3.6; closed before the full acceptance decision and M4 | §11, ADR-012 §4 |
| B-SFT-12 plan precision | NIT | Revised: criterion step added; Author step required; one candidate; T4a negative in step 8; clock margin rule | §9, §5, §3.1 step 8 |

Unique control ids where the reviews used the same id: Reviewer-A's V2-5 (unrelated entry change) is **V2-5**. Reviewer-B's V2-5 (no-op plant) is **V2-6**. Reviewer-A's V1-6 (older pair `W`, selection) and Reviewer-B's V1-6 (older pair `W`, timing) are one control, **V1-6**, which checks both.
