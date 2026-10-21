# Storage full-round triage (`aaa823b`, round 1)

Owner: Architect (bounded triage only). Task `task_269579cb01c1`, dispatch `ctx_a6965f1fbc80`, run `run_ebe671ad72a9`. Model: Claude Code Opus 5.5, xhigh. Date: 2026-10-21.

Status: **unaccepted proposal for independent design review**. This file is not an approval and gives no acceptance credit. It changes no ADR, acceptance criterion, test, product file, tool or evidence. It authorizes no implementation and no runtime. Items marked **PROPOSAL** need independent review before any text, test or product change.

Revision: 2. The Lead's `changes-requested` disposition (answer to the held report `a711e0df…`) asked for five corrections: the RC-1 classification (§3), the P-1 status (§6 N-2), a storage-only diagnostic before the full rounds (§8), the private copy permission item (§7), and unambiguous V1 controls (§3).

## 1. Scope, method and inputs

- Candidate: product `aaa823b25306c5e560f7c4050238b374dec4d4e3`, tests tree `4c7e067feedc644f955afee37806f06e7273dd04`. The frozen source has no tracked change (`git status`, `git rev-parse`).
- Method: host-only reads of existing evidence and source. No Docker or Compose command, no product or test run, no reproduction, no mode change, no deletion, no live call.
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
| `tests/acceptance/lib/app.ts` | `fffaf0809a6c8500c11f0efe966d26e02b6157fcadf7a6704b03186563e7a19d` |
| `infra/scripts/storage-oplock.sh` | `1d2be154e754b9f2c07451384b3c24e8ea483073d16d24f49b276f15d8956753` |
| `infra/scripts/stack-data.mjs` | `5c3fde5cab845e27bbb942c69cc4a4578964a2c66171ba068b625f15b4a7c258` |
| `infra/scripts/sqlite-lock-probe.mjs` | `cb665e4e21b58844ce97985f4dc15ef4b2a41cb6532e6cf2b1a0e604e61c8b38` |
| `infra/scripts/lib.sh` | `64b686acfa439ece3e575567fdc8fc4a5e7e0a6e58685b9552c84c0541fb442a` |
| `infra/compose.yaml` | `4eb6d469aa7584cf76b84581ad2c58eda849ca76da60fa54a325dc2059d8cba6` |
| `services/cogniate-app/src/app/server.ts` | `c30867a72638ca71aba9271370ed91dc4d7f6a59a8b3d6fb39348580bfb6bc75` |

## 2. Result

The storage phase has 70 rows: 20 PASS, 50 FAIL. There are three independent first failures.

| Id | First failure | Class | FAIL rows |
| --- | --- | --- | --- |
| RC-1 | No backup `storage_lock_released` event matched the `a-serialize` oracle. Every release event has `command: null`. | **Contract mismatch** (log contract): the product release events do not carry a `command` value, and the approved field list does not mark `command` as nullable. Not a lock release defect. The QA selector exposed the mismatch. | 1 |
| RC-2 | `d-mountpoint` makes both in-volume mountpoints `root:root 0700`, then lists them as `HOST_UID`. It has no restore step. | Harness | 47 |
| RC-3 | `storage-lane.mjs` `portal()` and `app()` send no `Origin` header. The product CSRF rule refuses the sign-in. | Harness | 2 |

- No lock, storage, recovery or data defect is proven. RC-1 is a product-versus-contract mismatch in log output. It needs either a product conformance repair or a reviewed contract change (§3). It has no waiver.
- The runner stops at the first non-PASS row (`tests/acceptance/M1/common/coverage.mjs:78`, called from `tests/host/run-m1.mjs:108`). So round 2 and the legacy suites did not run. The repair must make all 70 rows PASS (`c-host-negative` PASS or `NOT_APPLICABLE` in both rounds).
- The repairs of RC-2 and RC-3 must ship together. RC-2 alone moves the first failure to `@backup-B` (§6 N-1).
- One further hazard is possible in a row that has not run yet (§6 N-2). It is not measured.

Independent comparison: Common QA classifies RC-1 as a contract mismatch and RC-2 and RC-3 as harness defects (`docs/reviews/M1/qa.md` at `ef787d1`; diagnosis `E/public/diagnosis-storage-round1.md`, `dc167072facccba619442e03c0906d6894c2285a253774cd8024233c58c8eba3`). This triage found the RC-1 and RC-2 facts before it saw QA's summary (`msg_cd6b203f3b09`). It then checked RC-3 and each QA statement against source and evidence, and read the full QA report last. Canvas QA (`docs/reviews/M1/qa-canvas.md` §19.3) keeps the cause open and names the host content folder as a candidate. §4.1 shows that the host content folder is not involved.

## 3. RC-1: `a-serialize` — log contract mismatch

| Item | Finding |
| --- | --- |
| Rows | `M1-41.common.a-serialize` (FAIL). No cascade. |
| Contract | `docs/architecture/tasks/M1.md:234`: the backup exits 0 with a manifest and no `INCOMPLETE`; no service container starts before the backup's `storage_lock_released` time (`State.StartedAt`); then `stack:up` exits 0. ADR-012 §7 release step 3 (line 288): log `storage_lock_released`. ADR-012 §7 "Lock events" (line 311), approved field list: `{event, ts, project, command, runId, pid, pidStart, pgid, owner … \| null, reason \| null, waitedMs, container … \| null}`. Only `owner`, `reason` and `container` are marked nullable. |
| Actual | The two earlier checks passed (`tests/host/storage-rows.mjs:405` exit 0, `:406` manifest and no `INCOMPLETE`). The oracle (`:407`) filters release events with `/backup/.test(e.command ?? '')` and found none (`:408`). Counts in `A/cmd/*.log` and the final lane log: 87 of 87 `storage_lock_released` events have `"command": null`. All 86 `storage_lock_acquired`, 3 `storage_lock_wait`, 3 `storage_lock_refused` and 3 `storage_lock_reclaimed` events name a command. |
| Product source | `infra/scripts/storage-oplock.sh:369`: acquire passes `--command`. `:386` (`storage_lock_release`): release passes no `--command`. `:194` (`ctxOf`): `command: o.command ?? null`. `:170–181` (`release`): renames and deletes only the own lock, then logs the event. The unit test checks the event keys only, not the `command` value (`infra/scripts/storage-oplock.test.mjs:72–85`). |
| Serialization behavior | Supported, not proven compliant. `A/cmd/59-a-serialize-up.log`: `stack:up` logged `storage_lock_wait` at 11:32:14.041Z with owner `stack:data-backup`, runId `79dc99c4…`, acquired 11:32:13.770Z. It acquired the lock at 11:32:15.044Z (`waitedMs` 1005). Acquisition step A2 succeeds only when no lock folder exists. So the backup released before 11:32:15.044Z, and the services started after the 11:32:16.117Z `check` preflight. This order supports correct serialization. It does **not** prove that the release event meets the approved schema. |
| Log race? | No. The row reads the log after `await backup.done` (`:404`). The release line is appended synchronously before the backup process exits (`storage-oplock.sh` `eventLine`, `:63–72`). |
| Evidence limit | The backup's own release line is lost. The background backup (`:397`, `spawnGroup`) kept its output in memory only, and a later `stack:reset` removed `infra/.logs`. |
| Classification | **Contract mismatch** between product log output and the approved event field list. Not a lock release defect. The QA selector exposed the mismatch; it did not cause it. |

Resolution paths (Lead decision; no waiver of a required field):

| Path | Owner and files | Effect | Status |
| --- | --- | --- | --- |
| **R1-A product conformance** (keeps the approved contract) | Backend Author: `infra/scripts/storage-oplock.sh` (release and lost events carry the holder's command, for example kept from acquire); `infra/compat/storage-compat.sha256` (the lock helper hash, ADR-012 §12); `infra/scripts/storage-oplock.test.mjs` (assert the `command` value on every event). | New product candidate. It needs the normal host QA and two source reviews. The compatibility hash and the `j-migration` and `j-snapshot` evidence change with it. This cost is not a reason to defer the item as MINOR. | Proposed for review |
| R1-B contract change (P-2a) | Architect: one ADR-012 §7 sentence that allows `command: null` on `storage_lock_released` and `storage_lock_lost`. | No product change. | **Unaccepted contract change**; needs independent review; not recommended by this triage |

Independent oracle improvement (both paths; owner: independent common QA; file `tests/host/storage-rows.mjs`, `a-serialize` `:394–413`):
1. Identify the backup by its `runId`, from its `storage_lock_acquired` event or the lock record that the wait loop reads (`:398–402`). QA's own `lockPairs` already pairs events by `runId` (`tests/host/storage-oracle.mjs:304–313`).
2. Select the `storage_lock_released` event with that `runId`. Absent → FAIL "no release for the backup run".
3. Check the selected event against the approved fields: `command` equals the backup's acquire command. A `null` or other value → FAIL "release event without the backup command (ADR-012 §7)", a distinct message. On `aaa823b` this check fails until R1-A or an accepted R1-B.
4. Save the background backup's stdout and stderr as a run artifact.
5. Record host time and Docker engine time with each `StartedAt` compare.

Not acceptable: remove the release check; accept any release event, or the last one; accept a `null` command without an accepted contract change; use the `stack:up` acquire time instead of the backup's own event.

Verification (each control has one intended discriminator):

| Control (host only) | Input | Expected | Mutation it detects |
| --- | --- | --- | --- |
| V1-1 | acquire `X` (`stack:data-backup`) and release `X` with `command: null` | identity step finds `X`; schema step FAILs with the distinct message | a command-only selector (it reports "no release", not the schema message); a selector that skips the schema step (it PASSes) |
| V1-2 | acquire `X`; no release `X`; release `Y` (another runId) with `command: "stack:data-backup"` | FAIL "no release for the backup run" | a selector that accepts a wrong runId when the command matches |
| V1-3 | acquire `X`, release `X` and later release `Z`, both with `command: "stack:data-backup"` | selects `X`, not `Z` | a "last release" selector |
| V1-4 | release `X` later than a service `StartedAt` | FAIL on time | a missing or reversed time compare |
| V1-5 (product, R1-A) | `storage-oplock.sh run -- true` on the host, with a Docker stub first on `PATH` | every event of the run has a non-empty `command`; release equals acquire | the current missing-command release event |

Runtime check V1-R: the saved backup output has acquire and release lines with one `runId`. That `runId` equals the owner `runId` in `stack:up`'s `storage_lock_wait` (when present) and the selected event. The selected event names the backup command. Every service `StartedAt` is not earlier than the release time. Both clocks are recorded.

## 4. RC-2: `d-mountpoint` root plant and `HOST_UID` listing

| Item | Finding |
| --- | --- |
| First failure | `M1-41.common.d-mountpoint` |
| Contract | `M1.md:252`: QA changes the owner of the two empty mountpoints to `0:0` → `stack:up` exit 0, both `HOST_UID:HOST_GID 0700`, nothing else changed. ADR-012 §11 (line 541) and `tests/host/storage-docker.mjs:113, :125–127`: a `storage-fixture` runs as `HOST_UID:HOST_GID`; root only for the owner changes of `d-owner` and `d-mountpoint`. |
| Actual | `tests/host/storage-rows.mjs:532`: root plant `chown 0:0` of `packages` and `uploads` (`A/cmd/130-fixture-plant.log`, exit 0, 11:33:44Z). The mode stays `0700` (made by the preflight, ADR-012 §4). `:533`: the "before" listing runs as `501:20` (`A/cmd/131-fixture-list.log`) and exits 1: `EACCES: permission denied, scandir '/v/appdb/packages'`. `listRoot` reads every folder (`tests/host/storage-fixture-script.mjs:61–74`, `readdirSync` at `:66`). No product command ran in this row. The row has no `finally` step, so both mountpoints stay `root:root 0700`. |
| Carry-over | `d-content-folder` and the five `f-*` rows fail at their first listing or snapshot with the same `EACCES` (`A/cmd/133-fixture-list.log` and later). No product command ran in them. Their `finally` steps restore their own files. `a-first-start-resume` then runs `stack:data-quarantine` on the same volumes (§4.2). |
| Classification | **Harness.** The QA root plant makes a state that QA's own `HOST_UID` listing cannot read. The product is not involved. |
| Cascade (47) | Same `EACCES` (7): `d-mountpoint`, `d-content-folder`, `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`. Prerequisite (1): `f-originals-back`. Product refusal on the carried state (1): `a-first-start-resume`; then fixture `@seed` fails because the services are stopped. Not run (38): `e-not-same-import`; `h-volume-manifest`, `g-damaged`, `h-nomanifest`; `g-prepared-lti`, `g-prepared`, `g-staged`, `g-swap-lti-mid`, `g-swapped-lti`, `g-swap-app-mid`, `g-swapped`, `g-identity-lti`, `g-identity-app`, `g-rollback-mid`, `g-committed-lti`; `h-open-journal`; `g-recover-idempotent`; `g-orphan-refusal`, `g-orphan-complete`, `g-orphan-stopped`; `g-tamper`, `g-quarantine-in-use`, `g-quarantine`; `h-legacy-manifest`, `h-target-state`, `e-fresh-refusal`, `e-hot-journal`, `e-old-layout`, `g-fresh-target`; `h-pair-mismatch`; `e-import-recover`, `e-import`, `e-kept`, `e-provenance-restore`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest`. |
| Smallest repair | Owner: independent common QA. File: `tests/host/storage-rows.mjs` (`d-mountpoint`, `:530–553`); if needed, one metadata-only operation in `tests/host/storage-fixture-script.mjs`. (1) Take the full "before" listing before the root `chown`. (2) After the `chown`, confirm the planted owner with `lstat` of the two named entries only, as `HOST_UID`, with no `readdir`. The `appdb` root is `HOST_UID 0700`, so `lstat` works. (3) Run `stack:up`. The full listing after it must be readable and must show both mountpoints `HOST_UID:HOST_GID 0700` and empty. "Nothing else changed" compares with the listing from step 1. (4) Add a `finally` step: if a mountpoint is still root-owned (for example `stack:up` failed), restore the owner with the same §11 root `chown` (`rootReason: 'd-mountpoint'`), then list as `HOST_UID`. A failed restore or listing stops the phase as `BLOCKED` with that cause, so later rows do not report a wrong cause. (5) Keep `listRoot` strict: an unreadable folder stays an error. |
| Not acceptable | `listRoot` ignores `EACCES` (weakens every "nothing changes" oracle). A listing as root (outside §11; needs a separately reviewed design change). A root `chmod`, or a planted mode `0755` (not allowed by §11; tests another state than the criterion). Remove "nothing else changed". Move `d-mountpoint` to the end of the sequence (hides carry-over). A product change so that backup or quarantine read as root or prepare volumes (contradicts the B-SI-07 disposition, `docs/team/multi-lms-plan.md:2491–2496`). |

Verification (host only, each with a mutation):
- **V2-1.** Fixture selftest: a folder with mode `000` inside a listing root → `listRoot` still fails with `EACCES`. Detects a global relaxation.
- **V2-2.** The metadata operation returns owner and mode of named entries and never lists their content. Detects a hidden `readdir`.
- **V2-3.** Row test with a mock lane: the order is `chown` → `lstat` → `stack:up` → listing. With an injected `stack:up` failure, the `finally` step restores the owner and the next listing works. Without the `finally` step, the next row's listing fails. Detects a missing cleanup.
- **V2-4.** With an injected failed restore, the phase stops as `BLOCKED` with the restore cause. Detects a cascade with a wrong cause.

Runtime check V2-R: `d-mountpoint` PASS. Its command logs show root plant → `HOST_UID` metadata read → `stack:up` → `HOST_UID` listing. No later fixture listing has `EACCES`. No `source_unreadable` line in the phase. Both `a-first-start-resume` quarantines log `storage_quarantine_copy` and exit 0.

### 4.1 In-volume mountpoint versus host content bind

Both `EACCES` failures are on the **in-volume mountpoint** of `appdb`. The host content folder is not involved.

| Path in the error | Container and mount | What it is | Owner and mode at the failure |
| --- | --- | --- | --- |
| `/v/appdb/packages` | QA `storage-fixture`; it mounts only the two lane volumes (`tests/host/storage-docker.mjs:128–131`) | `packages` folder inside the `appdb` volume | `root:root 0700` (QA `chown`; mode from the preflight) |
| entry `cogniate-app/packages` | product maintenance container; `appdb` at `/check/cogniate-app`; the entry is relative to `/check` (`infra/scripts/stack-data.mjs:653`) | the same in-volume folder | the same |
| `infra/.data/cogniate-app/packages` on the host | bound only at `/data/packages` (service, `infra/compose.yaml:186–188`) and `/content/packages` (maintenance, `:396–399`) | host content folder | host user, `0700`; `a-fresh` checked it; QA never changes its owner |

So the expectation in `d-mountpoint` is about volume metadata (§4 volume side). It does not test Docker Desktop bind behavior. The host bind hazard is a separate item (§6 N-2).

### 4.2 `a-first-start-resume` and the quarantine contract

- `A/cmd/185-a-first-start-partial.log`: `stack:data-quarantine` acquired the lock at 11:34:04.727Z. It refused `source_unreadable` with entry `cogniate-app/packages` at 11:34:05.192Z, released the lock and exited 1. Text: "Quarantine stopped: the copy failed. Nothing was removed."
- Contract: ADR-012 §9 step 1 (copy failure → exit 1, nothing removed) and the B-SI-07 disposition (`docs/team/multi-lms-plan.md:2493–2496`). The quarantine copy drops privilege before it reads, does no §4 step, and fails closed on an entry that `HOST_UID` cannot read. Source: `stack-data.mjs:858–861` (read-only modes drop at once), `:642–649` (`readable`), `:774–787` (copy walk).
- Nothing was removed: `A/lane-ownership.json` records no new appearance of `qa-multi-r1-st_ltidb` or `_appdb` between `a-fresh` and `b-sequence-up-1`.
- `@seed` (`A/cmd/186-seed.log`): exit 1, "Service 'lti-service' is not healthy (status: missing)". `require_running` (`infra/scripts/lib.sh:146–155`) reads `dc ps -q`, which lists running containers only. The services were stopped before the quarantine, and the row failed before its `stack:up`.
- **Assessment:** the product refusal matches its documented contract. The quarantined `FIRST_START` state of ADR-012 §11 items 2–3 was never made in this round. Its result is **unknown**. No product change is indicated.

## 5. RC-3: `e-old-schema` portal sign-in `403`

| Item | Finding |
| --- | --- |
| Rows | `M1-41.common.e-old-schema` (FAIL), `M1-41.common.e-content-missing` (not run; it needs `e-old-schema`). |
| Contract | `M1.md:269`: after the import and `stack:up`, the portal sign-in of `thanh@cogniate.test` with the copied password lists the v10 connection. `docs/architecture/security.md:160`: portal API writes (`/app-api/*`) need the session cookie **and** `Origin` = `PUBLIC_APP_URL`, else `403 ORIGIN_NOT_ALLOWED`. `services/cogniate-app/src/app/server.ts:135–143`: an `onRequest` hook refuses every write without that `Origin`, "also the login", and logs `csrf_rejected`. |
| Actual | Content parts passed: `A/cmd/208-content-import.log` refused `content_missing` with `checked: 3`, and the target stayed `FRESH` (the import half of `e-content-missing`). `A/cmd/212-old-schema-import.log`: exit 0, `storage_content_check` `pass`, `checked: 3` = QA count 3. `A/cmd/213-old-schema-up.log`: exit 0. LTI log: `GET /api/platforms` 200 at 11:36:43.865Z. App log: `csrf_rejected` with `origin: null` at 11:36:43.868Z, then `POST /app-api/session` 403. |
| Harness source | `tests/host/storage-lane.mjs:168–178` (`portal`) and `:179–185` (`app`) send only `content-type` (and the cookie). The acceptance helper sends `Origin` = `PUBLIC_APP_URL` on every write (`tests/acceptance/lib/app.ts:2`, `:62`). |
| State, session or credentials? | None of these. The `Origin` hook runs at `onRequest` (`server.ts:137`), before the body is read and before the session hook (`:145`). So the 403 says nothing about the copied password, the imported database or a session. Whether the copied password signs in is **unknown** until a rerun. |
| Classification | **Harness** (request shape). The product behaves as specified. |
| Smallest repair | Owner: independent common QA. File: `tests/host/storage-lane.mjs`. `portal()` and `app()` send `Origin` = `this.r.state.urls.app` (the lane's `PUBLIC_APP_URL`) on every non-GET request. No other header, cookie or password change. |
| Not acceptable | Exempt `/app-api/session` or another `/app-api` write from the `Origin` rule. Remove the sign-in or the v10 connection oracle. Write the marker connection with a fixture database write instead of the public API (`M1.md:226`). |
| Latent effect | The same helpers make the "write after `B`" (`storage-lane.mjs:187–199` `writeMarkers`; used by `@backup-B` at `storage-rows.mjs:658` and by `postB` at `:184`). See §6 N-1. |

Verification (host only, each with a mutation):
- **V3-1.** Helper test with a recording HTTPS function: `POST /app-api/session` and `POST /app-api/connections` carry `Origin` equal to `PUBLIC_APP_URL`. Without the header, the test fails. Detects the current omission.
- **V3-2.** The same test with a wrong value (for example the LTI URL) fails. Detects a fixed or wrong origin.

Runtime check V3-R: the storage-phase app log has zero `csrf_rejected` lines. `e-old-schema`: sign-in 204 with `__Host-cog_session`, and the v10 connection id is listed. `@backup-B` and each `@post-B`: platform 201 and connection 201. Product control unchanged: `tests/acceptance/T4a/security.test.ts:30–34` (wrong or missing `Origin` on an `/app-api` write → 403) stays in the suite and passes on the same product SHA.

## 6. Order and carry-over: what the repairs expose next

### N-1. `writeMarkers` 403 (latent RC-3)

After RC-2 only, `a-first-start-resume` and `@seed` can pass. Then `@backup-B` calls `writeMarkers` → `portal()` → the same 403. 37 of the 38 "not run" rows depend on `@backup-B` or `@post-B` (all except `e-not-same-import`). So RC-2 and RC-3 must be in one harness freeze.

### N-2. `d-content-folder`, absent case: a by-hand move of the content parent (possible; unmeasured)

- Row: `M1.md:253`, second case: "With the three content folders absent → `stack:up` creates them with mode `0700` and starts."
- Harness: `storage-rows.mjs:571–575` renames `infra/.data/cogniate-app` (`P`) to a hold folder, then runs `stack:up`. Before this, service containers bound `P/packages` and `P/uploads` many times. `stack:up` then makes a new `P` and new children (`infra/scripts/lib.sh:351–364`) and starts containers with nested binds of them (`infra/compose.yaml:184–193`).
- Related measured fact: [storage-reset-parent-repair](storage-reset-parent-repair.md) §1, series R2: "delete and make the parent again; new child 1.2 s later" → 20/20 `bind source path does not exist`, still after 5.1 s. ADR-012 §15 Limit (line 734) names "a deletion or a move of `P` by hand" as outside the guarantee: "Docker can then refuse the next start …".
- What is **not** known: R2 measured a deletion. The exact case here (a rename of `P` away, then a new `P` from `stack:up`) is not measured. So this triage does not claim that the row fails. It claims only that the accepted row asks for a start in a case that the accepted ADR text excludes from its guarantee. If the Docker error occurs, the window and what ends it are unknown, so later starts (`f-*` restores) can also fail.
- Architect gap: the revision 3.4 check of QA assertions ([storage-reset-parent-repair](storage-reset-parent-repair.md):66) listed rows that need `P` absent after a reset. It did not list `d-content-folder`, which moves `P` by hand.
- `a-fresh` already covers "`P` absent → created `0700` → start" in a fresh clone (`infra/.data` is git-ignored and not tracked), where no container has bound `P` (topology R1, 20/20 visible).

**PROPOSAL P-1 (proposed, pending independent review; not applied; it changes coverage):**
- P-1a: the `d-content-folder` second case keeps `P` and makes only `packages` and `uploads` absent (topology R3, measured 20/20 visible). Expected: `stack:up` creates both with mode `0700`, owned by the host user, and starts. Coverage of "`P` absent" moves to `a-fresh`, which adds one precondition record: `P` is absent (`lstat` `ENOENT`) before its `stack:up`. No row id or count changes. This redistributes coverage, so it needs Architect revision, QA, Reviewer-A, Reviewer-B and Lead acceptance.
- P-1b: keep the row text. Measure the exact case first with diagnostic D-1 (§8 step 5). If D-1 shows no Docker error, ADR-012 §15 Limit can be narrowed with that evidence, after its own review. If D-1 shows the error, P-1a or another reviewed change is needed.
- Without P-1a or P-1b, the full run may fail at `d-content-folder` with a Docker bind error. That result must not be waived.

### N-3. `a-serialize` clock domains (low risk)

The lock events use the host clock. `State.StartedAt` uses the Docker engine clock. The observed margin is about 1 s or more. `stack:up` acquired the lock at 11:32:15.044Z (host clock). The `check` preflight passed at 11:32:16.117Z (container clock), before the services started. The run sampler reports `maxSkewMs: 0` and `skewViolations: 0` (`E/public/sampler.out`). The RC-1 oracle improvement records both clocks (§3).

### N-4. Rows never run on any full round (unknown)

The 38 "not run" rows, `f-originals-back`, and the bodies of `d-content-folder`, the five `f-*` rows, `a-first-start-resume` and the restore half of `e-content-missing` have no full-round result on any candidate. The `9cdd768` storage phase stopped at `a-fresh` (`/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source/tests/host/artifacts/qa-multi-r1-st-9cdd7687-2026-10-21T07-39-36-550Z/summary.json`, `f50117ee5b3f7fce122175e1db3c96b5df57f6741433e2c61f8fbb55adc9af95`). Their runtime result is **unknown**. A host-only dry run (§8 step 2) can find sequence and fixture-logic errors. Only a storage run can find runtime errors (§8 step 6).

## 7. Private copy permissions (harness hardening; disclosed deviation)

- Deviation during this failed run: the QA stash copy `P8/out/hold-f-half-f50d1dc235febf0e/cogniate.db` had mode `0644` under a `0700` parent. QA corrected it after the run to `0600` at 11:47:11.753Z, under Lead authorization `msg_6b7ada30298a`. The record `E/public/permission-correction-hold-db.json` (`f99bdcf0…`) shows the same inode, size and SHA-256 before and after. This triage read the file mode only after that correction. The correction does **not** make the run compliant: the deviation stands for this run.
- Cause in QA source: the `stash` operation copies with `fs.copyFileSync` (`tests/host/storage-fixture-script.mjs:190`), which keeps the source mode. `copyOut` sets the copy to the source mode (`:229–231`). The volume database was `0644`, so both paths can make a `0644` private copy. `LegacyFixtures.place` copies, then sets `0600` (`tests/host/storage-oracle.mjs:238`), so a short window at the source mode exists there too. `identityCase` restores from its own copy and never returns the stash of the row body (`storage-rows.mjs:1112–1134`, `:608`), so the stash copy also stays in a passing run.
- The partial quarantine copy `P8/quarantine/a-first-start-partial-…/` (four files, mode `0600`, no manifest) is product output; ADR-012 §9 step 1 keeps it after a copy failure. QA owns the cleanup of `P8`.

**PROPOSAL P-3 (QA harness; pending independent review):**
- Every QA copy of a database, sidecar, identity, journal or secret file is created `0600` from the start: exclusive create with mode `0600`, then the bytes. No copy exists at a wider mode at any time.
- A return into a volume (for example `unstash` of originals) sets the recorded original mode of that file explicitly, so the "original bytes back" step does not change the volume listing.
- After each row, QA scans its private root for a regular file with any group or other bit. A hit FAILs that row at once and is kept as evidence. No later correction changes that result.

Verification (host only, each with a mutation):
- **V4-1.** Source database at `0644`; `stash`, `copyOut` and `place` each make a copy that is `0600` when it first exists (checked by a creation hook, not only at the end). A mutation back to plain `copyFileSync` or copy-then-`chmod` fails.
- **V4-2.** `unstash` into a volume folder restores the recorded original mode (`0644`). A mutation that keeps `0600` there fails the listing compare.
- **V4-3.** A planted `0644` file in a private folder FAILs the per-row scan.

## 8. Verification plan

No step below gives acceptance credit. No step is granted by this file.

1. **Lead decisions.** RC-1 path (R1-A product conformance, or R1-B for independent review); P-1 (P-1a or P-1b); P-3; the scope of the design review of this file.
2. **Host only, QA.** QA writes its repair criteria from this file and the criteria text, then the code. Controls V1-1 to V1-4, V2-1 to V2-4, V3-1, V3-2 and V4-1 to V4-3, each with its mutation. A mock-lane dry run of the full storage `SEQUENCE` checks the order, the `NEEDS` table and every `finally` restore.
3. **Host only, Author (R1-A only).** Control V1-5 and the existing unit and infrastructure suites. The compatibility hash file is updated in the same commit.
4. **Reviews.** Two blind reviews of the harness diff, and of the product diff for R1-A. Lens A: no weaker oracle, no privilege change, no `Origin` relaxation, `listRoot` stays strict, no required field waived. Lens B: test quality, saved evidence, row attribution, permission controls.
5. **Only for P-1b: diagnostic D-1**, in its own Lead-granted Docker window, before any storage run. Scratch project, plain `docker run`, no product code: bind a child of a scratch parent; stop the holder; rename the parent away; make the parent and child again; start a container that binds the child about 1–2 s later. 20 trials, with and without the earlier container present. Diagnostic only.
6. **Storage-only diagnostic (separately granted; zero acceptance credit).** One complete 70-row storage phase on the frozen, reviewed repair candidate, before the two full rounds. Rules: the unchanged storage inventory and oracles; a fresh lane; fresh G1 and W1–W3; the §15 ownership record; strict W4, cleanup and scans. It keeps every failed and not-run row with its evidence. It reads V1-R, V2-R and V3-R and the per-row permission scan. A failure here goes back to triage; it is not waived and not rerun silently.
7. **Full gates, unchanged.** Two complete 488-row rounds with the same result per row; all 12 legacy groups; strict W4, cleanup and scans; then fresh M2 and T7. These stay mandatory after step 6.

## 9. Observations (not root causes)

- **O-1 (ADR text precision).** ADR-012 §4 (line 101) says that `report` and `mark-started` "drop privilege at once". The probe reads the volumes as root first, then drops (`sqlite-lock-probe.mjs:567`, `:573`). The first sentence of the same rule allows this ("As root, a program may only read …"). `d-mountpoint` depends on it: the `stack:up` legacy scan runs `report` (ADR-012 §10 step 3) on root-owned `0700` mountpoints. Do not change the product to drop first. Clarify the ADR text in a later reviewed precision pass.

## 10. Limits

- One host, one attempt, read-only diagnosis. No hypothesis was reproduced.
- The backup's own release line for `a-serialize` is not available (§3).
- N-2 is unmeasured. The R2 evidence is for a deletion, not for a rename.
- The rows in N-4 have no runtime evidence. Their result stays unknown until a storage run.
- The 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. No push or main merge is implied.
