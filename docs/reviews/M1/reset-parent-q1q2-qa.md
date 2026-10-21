Verdict: FAIL
Round: 1

# Reset-parent repair: targeted QA checks Q1 and Q2 (runtime)

Independent QA, 2026-10-21. Brief: `docs/architecture/tasks/storage-reset-parent-repair.md` §7. ADR-012 revision 3.4 §15 (proposed).

**Result.**
- **Preparation: PASS.** This is the earlier host-only task. It was accepted, and its result is kept apart from the runtime result.
- **Runtime: FAIL.** **Q1: PASS**, all 3 reset → up cycles. **Q2: FAIL** at `Q2-IMPORT-REFUSAL`.
- The import refusal was correct: exit 1, `content_missing`, one `storage_content_check` line that names the missing folder, `checked` = QA count, and no bind error. But after the refusal, each target volume kept a `.storage-journal.json` file (state `rolled_back`). So the target is not `FRESH` by ADR-012 §11 item 5, and the brief cites that item.
- Cause: a conflict inside the contract. The product follows the ADR-012 §6/§8 journal design. The QA oracle follows the "nothing changes" rule of §8 and §11 item 5. The reset repair did not cause it.
- The approved full-round rows `e-old-schema` (import half of `e-content-missing`) and `e-content-missing` (restore half) make the same assertions. So they will fail in the same way on this candidate (see §5).

These checks are not AC rows. They give no acceptance credit and do not replace the full gates (brief §8 step 5). All 32 real-LMS rows stay **UNVERIFIED**.

## 1. Identity

| Item | Value |
| --- | --- |
| Role | Independent QA runtime worker. Model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. Orca session `orca_session_id:7cbed7f9-9932-473d-b18d-ed300f443a8a`. |
| Task | Run `run_ebe671ad72a9`, task `task_9a5781ae31f0`, dispatch `ctx_0ecac0d6ef69` |
| Candidate | `89fb4b48ee388faff3060fe1a161a9f9d064de93`. Tests tree `4c7e067feedc644f955afee37806f06e7273dd04`. Product diff since design `35d093d`: only `infra/README.md`, `infra/scripts/stack-reset.sh` and `infra/scripts/stack-reset.test.mjs`. `89fb4b4..9168fed` changes only `docs/`. |
| Worktree | Branch `nguyenthanhquang152/lti-multi-lms`, HEAD `51505bc` when this report was written. `git diff 89fb4b4 51505bc` outside `docs/` is empty. The `51505bc` change to ADR-012 touches only the history and §15; the §6, §8 and §11 text that §5.3 cites is the same as at `89fb4b4`. Only change by QA: this report. The untracked `pnpm-workspace.yaml` stays (SHA-256 `dfc07aac…c064`). No commit, no push. |
| Grant | Lead `msg_13268913e81d` (09:18:47Z): one conditional Docker window for Q1 and Q2 on lane `qa-reset-parent-r1`, port 8743, subnet `172.28.0.0/16`. Reviews A (`9168fed`) and B (`9f0d9ec`) APPROVE. Author RA 20/20 fresh and RC 5/5 refused were accepted. |
| Prepared tools | `/Users/quangnguyen/cogniate-qa-runs/claude-reset-parent-q1q2-prep-20261021T0838Z`: handoff `103d9d9e…2a08f`, `manifest-all.sha256` `dc09550b…6ef3` (21/21 files OK), `tools.sha256` `3bcf3d3a…5a4e` (5/5 OK), 5/5 reused W1–W4 tools OK, baseline `219da30b…6582` OK. QA used them read-only and did not change them. |

## 2. Host-only preflight (before the grant)

- QA ran the handoff DRY_RUN at the candidate with fresh paths: `…/qa-reset-parent-r1-89fb4b48-20261021T0916Z-dry`, mode 0700, umask 077. It exited 0 at 09:16:14Z.
- Precheck PASS: HEAD = SHA; `status --porcelain --ignored` is empty; no `.env`; no `node_modules`; tests tree `4c7e067`; the approved helpers import. The helper hashes are equal to the hashes of the preparation DRY_RUN. `precheck.json` SHA-256 is `834eb552…15ba`.
- Ancestor check PASS: home is 0750 `quangnguyen:staff`; the group members are `quangnguyen root`; the root is 0700.
- A `docker` stub was first on `PATH` (separate folder `…-dry-stub`). It recorded 0 calls.

## 3. Runtime run

Root: `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-89fb4b48-20261021T0919Z`. The launcher made it under umask 077 with mode 0700. One attempt. No retry, no added sleep, no waiver.

| Stage (UTC) | Result |
| --- | --- |
| 09:19:02 tool integrity, `--no-hardlinks` clone at the SHA, precheck, ancestor check | PASS |
| 09:19:04 **W1** wake | PASS. Cached pinned image `sha256:44fce696…937f`, `--pull never --rm --network none`, label `org.cogniate.qa=wake`. No wake container is left. Before the wake, the idle VM showed a cached bridge Id `3de24ec9…` and a clock 6.6 min behind the host. This is why the wake comes first; these values are not boundary evidence. |
| 09:19:06 **W2** live clock | PASS. Two reads, skew 77 ms and 94 ms; the Docker clock advanced with the host clock. |
| 09:19:11 **W3** formal start | PASS. G-1 identity match: macOS 27.0.1 arm64; CLI 29.9.1 `67827118…af5fb`; Compose 5.6.0 `1ec06408…f605`; engine 29.9.1; image `44fce696…937f`. Lane fresh (no exact name, no label). Port 8743 free. No subnet clash. 7 protected FULL records identical to the baseline. Built-in networks bridge `74288f53…`, host `b9266a37…`, none `d2863b51…`. 9 volumes, including 2 anonymous. 0 containers. Settings readable. `runStartSecond` 1792574356 (09:19:16Z). `w3-formal-start.json` `8ce64c22…a83a3a`. |
| 09:19:19 READY | The launcher sent the post-W3 status (`gate-message.txt`: `msg_31ab1c6268d7`). Then the sampler and the runner (umask 022 child only) started. |
| 09:19:19–09:21:55 runner | exit 1. Stop at `Q2-IMPORT-REFUSAL` (§4). Teardown ran. |
| 09:21:55 clone host processes | none (`clone-processes-after.txt` is empty) |
| 09:22:02 **W4** end, 09:22:07 strict compare | PASS. `problems: []`. The end is live. Identity unchanged. Built-in network Ids are equal at start and end. Settings hash equal. All 9 volume FULL records equal (the 7 protected and the 2 anonymous). No non-lane container changed. No lane leftover. Sampler: 12 samples, 0 failed, 1 bridge Id, 0 skew violations, at most 1 compose project, no other project seen. So there was no VM restart or sleep during the run. |
| 09:22:07 secret scan | exit 1 with the expected single problem `no captured values: the scan proves nothing`. stackValues 9; raw hit files 0; public hit files 0 (55 files); JWT-shaped files 0. |

### 3.1 The 22 detailed checks

| Check | Result | QA-observed values |
| --- | --- | --- |
| `PRE` | PASS | node 24.21.0, docker 29.9.1, compose 5.6.0; port and subnet free; 0 other containers |
| `CLONE` | PASS | HEAD `89fb4b4` |
| `Q1-UP0` | PASS | `stack:up` exit 0 at the first run; no bind error |
| `H1` | PASS | project `qa-reset-parent-r1`; services cogniate-app, lti-service, moodle, postgres, proxy |
| `Q1-P0` | PASS | `P` dev/ino `16777233/8056492`, directory, uid 501, mode 0700 |
| `Q1-C0-UP` | PASS | all healthy; exact nested binds; fresh in-container view |
| `Q1-C1-RESET` | PASS | see §3.2 |
| `Q1-C1-UP` | PASS | see §3.2 |
| `Q1-C2-RESET` | PASS | see §3.2 |
| `Q1-C2-UP` | PASS | see §3.2 |
| `Q1-C3-RESET` | PASS | see §3.2 |
| `Q1-C3-UP` | PASS | see §3.2 |
| `Q1` | PASS | 3 of 3 cycles |
| `Q2-FIXTURE` | PASS | F = `pkg_qaq2feaf5f7535339ab9`; QA count `C_qa` = 1; F never existed |
| `Q2-RESET` | PASS | exit 0; `P` is the same inode, empty, 0700; both exact volume names absent; no lane container |
| `Q2-BACKUP-X0` | PASS | exit 0; manifest `source: legacy`; exactly QA's 2 files with QA's sizes and hashes |
| `Q2-IMPORT-REFUSAL` | **FAIL** | see §4 |
| `Q2-BACKUP-X1` | **NOT RUN** | stopped by the first failure |
| `Q2-IMPORT-PASS` | **NOT RUN** | stopped by the first failure |
| `Q2-UP` | **NOT RUN** | stopped by the first failure |
| `Q2` | **NOT RUN** | stopped by the first failure |
| `TEARDOWN` | PASS | `stack:down` exit 0; 0 containers, 0 volumes (also by exact lane names) and 0 networks left |

Counts: 17 PASS, 1 FAIL, 4 NOT RUN. The runner also wrote a record `ERROR` FAIL. It is the stop exception, not a check.

### 3.2 Q1 cycles (all QA reads)

Each cycle planted these items in `P`: `.qa-marker`, `.qa-dotdir/x`, a link `qa-link` to a file outside the clone, and `packages/qa-q1-c<i>/index.html`. It also planted the lti-service and log markers and set `chmod 0755 P`. QA made the kept-file listing (10 files: `.env`, `infra/.certs/*` and `infra/.data/fixtures/*`) before each reset.

| Cycle | Reset ms | Reset call → up call ms | Up ms | Result |
| --- | --- | --- | --- | --- |
| 1 | 5035 | 5233 | 31985 | PASS |
| 2 | 3763 | 3947 | 31846 | PASS |
| 3 | 3809 | 3987 | 31860 | PASS |

In every cycle:
- R1, R2: `P` kept dev/ino `16777233/8056492`, uid 501, mode 0700 (it was 0755 before), and had no entries. This includes the dot names and the link.
- R3: the target of the outside link was unchanged (name, inode, mode, SHA-256).
- R4: these paths were present before and absent after: `lti-service` and its marker, the log marker, `backups`, `build-queue` and `.secrets/app`. `seed.json` was not exercised, as expected.
- R5: both exact volume names were absent (exact-name inspect and `volume ls`).
- R6: no lane container. R7: the kept listing was equal. R8: no bind error text.
- U1, U2: the same inode; `packages` and `uploads` were 0700 directories of uid 501.
- U3: all 5 services were running and `healthy` at the first inspect.
- U4: `cogniate-app` had exactly `/data` = volume `qa-reset-parent-r1_appdb`, and `/data/packages` and `/data/uploads` were binds with the exact source `<clone>/infra/.data/cogniate-app/<name>`. `lti-service` had `/data` = `qa-reset-parent-r1_ltidb`.
- U5: the new host marker had the same SHA-256 inside the container. The erased `qa-q1-c<i>` folder was absent inside, and the in-container listing showed only the new marker folder.
- U6: no bind error text.

## 4. Q2 failure: the facts

Import `stack:data-import -- --from X0` (09:21:53.776Z to 09:21:54.242Z, exit 1). Docker-clock start second 1792574513 (09:21:53Z).

| Sub-check | Result | Evidence |
| --- | --- | --- |
| Q2a exit 1 and `content_missing` | PASS | exit 1; `storage_restore_cancelled` `reason: content_missing` |
| Q2b one `storage_content_check` line | PASS | `result: "content_missing"`, `checked: 1` (= `C_qa`), `missing: ["packages/pkg_qaq2feaf5f7535339ab9"]`. The maintenance container ran (`qa-reset-parent-r1-storage-3911f89e548a01ce`). |
| Q2c no bind error | PASS | no `bind source path does not exist` text |
| Q2d target FRESH | **FAIL** | see below |
| Q2e nothing else changed | PASS for every item other than Q2d | no service container change; legacy bytes unchanged; no storage container left |

After the import, both volumes existed. Compose made them: labels `com.docker.compose.project=qa-reset-parent-r1` and `com.docker.compose.volume=ltidb|appdb`, `CreatedAt` 09:21:54Z (not before the start second). The QA listing, made by a read-mode fixture container, showed:

| Volume | Entries |
| --- | --- |
| `ltidb` | `.` 0700; `.storage-journal.json` 0600, 560 bytes, `ee26d26b…48c4aa` |
| `appdb` | `.` 0700; `.storage-journal.json` 0600, 565 bytes, `8ad4d7aa…3ddb08`; empty `packages` and `uploads` 0700 |

The approved oracles `nothingChanged` and `freshVolume` (`tests/host/storage-oracle.mjs`, tests tree `4c7e067`) gave: `lti: appeared but is not FRESH`, `app: appeared but is not FRESH`, `lti volume is not FRESH` and `app volume is not FRESH`. The product printed "import: cancelled or rolled back; the targets equal the state before (verified)".

## 5. Classification

### 5.1 What the product does (code at `89fb4b4`, read after the run)

`infra/scripts/stack-data.mjs` `run()`:
1. It writes the journal `prepared` in both volumes (lti, then app).
2. It stages the files in `.restore-<opId>/` and runs the content check.
3. On `content_missing`, `cancel()` removes `.restore-<opId>/`, verifies that the in-place files equal `before`, and writes the journal `rolled_back`. The journal file stays.

`stack-data.mjs`, `sqlite-lock-probe.mjs`, `stack-data.sh` and `lib.sh` have no change between `a784522` and `89fb4b4`. So the reset repair did not cause this result.

### 5.2 Host-only reproduction (no Docker; allowed by Lead `msg_791ec4d226b9`)

The folder `review/host-repro/` in the run root holds the scripts, the results and the hashes. They call the candidate's own `volumeRestore` on scratch folders. Case A uses a byte-equal copy of X0. A `docker` stub was first on `PATH` and recorded 0 calls. The existing evidence did not change: `review/evidence-manifest.sha256` (69 files, `06644b10…b402`) still checks 69/69 OK.

| Case | Result |
| --- | --- |
| A: import of X0 into empty prepared folders, F absent | exit 1; one line `content_missing`, `checked 1`, the same F. Both journals `rolled_back`, `before: []`, `identityBefore: null`, **560 and 565 bytes**. These are the exact sizes of the runtime journals. Product §6 state before and after: `FRESH`. Approved `freshVolume` after: false, false. |
| B: control, F present | exit 0, `result: "pass"`, state `OK`, journals `committed` (558 and 563 bytes) |
| C: restore half of `e-content-missing`, from B's `OK` pair: a volume backup, then F moved away, then a restore | exit 1 `content_missing`. Both journals change from `committed` to `rolled_back` with a new `opId`. Product state stays `OK`. Approved `listingDiff`: `.storage-journal.json` changed in both volumes. |

The runtime journal bytes were not read; teardown removed the volumes. The state `rolled_back` is an inference from three facts: the code path, the product message, and the exact size match. The journal size changes with the length of the state name: `committed` gives 2 bytes less.

### 5.3 The contract conflict

| Text | Says | Matches |
| --- | --- | --- |
| ADR-012 §6 row 13 | `FRESH`: no database, no identity, no `.restore-*` or `.previous-*`; "each journal is absent or `rolled_back`" | product |
| ADR-012 §8 state table | the `prepared` journal comes before staging; the content check is part of `staged`; a cancel writes `rolled_back` | product |
| ADR-012 §8 content check | "else `content_missing`, and nothing changes" | QA oracle |
| ADR-012 §11 item 5 | "`FRESH` holds for an absent volume and for an existing labeled volume that holds no entry other than the empty mountpoints" | QA oracle |
| Brief §7 Q2 | "The target stays `FRESH` (ADR-012 §11 item 5)" | QA oracle |
| M1 AC-M1-41 | `e-content-missing`: "the target stays `FRESH`". M1 also says that `FRESH` and "nothing changes" use §11 item 5. But `e-import-recover` and `g-fresh-target` call the state after `rolled_back` journals "`FRESH`". | both readings |

**Classification: a contract conflict. It is not a reset-repair regression and not a Q-tool fault.**
- The product follows ADR-012 §6 and the §8 journal design.
- The QA oracle implements the text that the brief cites, word for word. The approved full-round oracle uses the same functions.
- QA did not change, relax or waive any assertion.

### 5.4 Effect on the full rounds (inference from the approved code and the host reproduction)

- `e-old-schema` (import half of `e-content-missing`) calls `refusal(… 'content_missing')`. This runs `lane.assertUnchanged` → `nothingChanged`, then `freshVolume`. After the `@old-schema-setup` reset, the volumes are absent, as in Q2. So the row will report "appeared but is not FRESH".
- The restore half of `e-content-missing` uses the same `assertUnchanged` on an `OK` pair. Case C shows that the journal changes there. So "nothing changes" will fail.
- Both rows are mandatory in each full round (brief §8 step 5 keeps their exact assertions). The records that I read show no earlier runtime that reached this content check: at `9cdd768` the bind error stopped the import before its container started.

### 5.5 Finding

| Id | Severity | Where | Problem | Evidence | Next step (not decided by QA) |
| --- | --- | --- | --- | --- | --- |
| QA-RP-01 | BLOCKER (for AC-M1-41 `e-content-missing` and `e-old-schema`; not for the reset repair itself) | `infra/scripts/stack-data.mjs` `run()`/`cancel()` against ADR-012 §8 "nothing changes" and §11 item 5 | A `content_missing` refusal leaves a `rolled_back` journal in each target volume. The brief, M1 and the approved oracles require a target with no entry other than the empty mountpoints, and an unchanged listing. | §4, §5.2 cases A and C | The Architect resolves the conflict. Then the product, or the contract text, changes through the normal gates. QA must not weaken the assertions. |

## 6. Cleanup, modes and scan coverage

- Teardown (ADR-012 §15): `lane-ownership.json` has 42 records and 0 ledger errors. It removed 2 resources: `qa-reset-parent-r1_ltidb` and `qa-reset-parent-r1_appdb`, made by the import. It kept 0 and failed 0. The earlier lane containers, network and volumes were already gone after the Q2 `stack:reset`. QA did no manual removal. QA ran no prune, pull, settings change or restart.
- W4: no lane leftover; the 7 protected and 2 anonymous volumes have identical FULL records; built-in network Ids are unchanged. **Window RETURNED** at 09:22:07Z. The host-only reproduction ran after the window and used no Docker.
- Modes (actual):
  - 0700: run root, `public`, `private`, `tmp`, `source`, `review`, `infra/.data/cogniate-app`, `infra/.secrets` and the backup folders.
  - 0600: `.env` and the backup files. No secret file is readable by group or other.
  - 0755: the clone and its normal folders (the runner child ran under umask 022), and the artifact folder in `source/tests/host/artifacts` (0755/0644). Both are inside the 0700 root.
  - QA did not chmod any shared ancestor (`cogniate-qa-runs` stays 0755).
- Secret scan coverage: 1 clone, 2 raw files, 55 public files (`public/` and the artifact folder), 0 private browser files. `private/` (backups with lane secrets) is private by design and not scanned as public.

## 7. Limits

- Q2 steps 5–7 (`X1` backup, import pass with QA's identity and byte reads, `stack:up` with F visible) did **not** run. The import-pass path has no runtime evidence on this candidate.
- Q1 shows the operator path reset → up 3 times, including the build-queue binds of `stack:up`. It does not measure the `d-content-folder` move or a manual deletion of `P` (ADR-012 §15 limit).
- The runtime journal content was not read (see §5.2).
- One host, one attempt. The Docker Desktop mechanism of the earlier bind error stays unknown. The default-subnet caveat stays: `172.28.0.0/16` is the product default, and W3 checked only the start (no other project appeared in the sampler).
- The full 488-row rounds, the legacy suites, M2 and T7 were not run. All 32 real-LMS rows stay UNVERIFIED.

## 8. Evidence (private, kept)

Run root `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-89fb4b48-20261021T0919Z` (0700).

| File | SHA-256 |
| --- | --- |
| `review/evidence-manifest.sha256` (69 files of `public/`, `private/` and artifacts, made right after the run) | `06644b10e932d129df5e0645ffee571fa97ad869f49c37ad0724d26fd222b402` |
| `public/launcher.log` | `db48fc629ae9411e7e11dbc7252b77f1f0ec7da7c0fb3b4a23a82d0e00640480` |
| `public/run-exit.json` | `67447e08b89a003ec47f47ca48a5d6f3723bee14e60b7af8cb7f047e316993a0` |
| `public/w3-formal-start.json` | `8ce64c22bbdc3dcb46330393b7425b6e2c41977dd1872cb9e5fcb6df9ba83a3a` |
| `public/w4-end.json` | `e437fa20e48cd2fd3b1f896921b8b1e75f02c9e82b3adf80bb4f9ba4b4af00d2` |
| `public/w4-compare.json` | `bd4163a3aca51e58e6cea9dce0682cb5b6daa85ffa783ffd6fcc096cb30593a8` |
| `public/sampler/lane-containers.json` | `2ea5d2553f6a0fb358ad6e8172cc628e93f3f231bef8c958cce08852d435b692` |
| `public/secret-scan.json` | `d6dd36112130e475120ff888f53186761518b2e346e5147b0fb0db72125d2b33` |
| `…/artifacts/qa-reset-parent-r1-89fb4b48-2026-10-21T09-19-19-429Z/summary.json` | `4dc8c596ba5ba3bb2f2df09fe1e87e412b2c6018e3fd9026607a29ce66391f00` |
| `…/q1-q2-evidence.json` | `4347cb760db93440b723e8f631a285319891571b2fe1b49f15677156b14167bd` |
| `…/lane-ownership.json` | `5a031a0ca5445b539bb41201988d8ada2fe3cac3dd6f45f086c2bbe8ce3c1c3b` |
| `…/cmd/22-q2-import-X0.log` | `f5c72bd8ea8bd1de64594fb96cb993444dd931b40ddd65f67be4dd6a3d00568e` |
| `…/cmd/23-fixture-list.log` | `b4bc4ca244475870f16d0d0c72ad6a430153709414578aec88e062dce845c7cf` |
| `private/runner.stdout.log` | `86693ad2bf51320b67adb19806a85da4bc3b573905fccf450e13ee3e79410ff3` |
| `review/host-repro/repro.mjs`, `repro-restore.mjs`, `listing.mjs` | `11614bb2…f5f0`, `bb2397eb…efee`, `06a86165…04dc` |
| `review/host-repro/repro-result.json`, `repro-restore-result.json` | `4be9b08f66389c442ac16bfc232f810ff877a2729ae1404b70d4acd4f8472914`, `b92030ffada873782fb9566621a55109ad9b947d4189aeaab15dd4df45cecb75` |

Dry-run root: `…/qa-reset-parent-r1-89fb4b48-20261021T0916Z-dry` (`precheck.json` `834eb552…15ba`), and its stub folder `…-dry-stub`.

## Round 2

Verdict: PASS
Round: 2

Independent QA, 2026-10-21. The same §7 Q1 and Q2 of `storage-reset-parent-repair.md`, now on the candidate of [storage-content-refusal-repair](../../architecture/tasks/storage-content-refusal-repair.md) (design `2323361`, ADR-012 revision 3.5, proposed). The Round 1 text above stays unchanged. Its evidence applies only to `89fb4b4`.

**Result.**
- **Preparation addendum: PASS** (host only, accepted by the Lead before the grant). It is kept apart from the runtime result. The earlier preparation PASS (Round 1) stays as it is.
- **Runtime: PASS.** **Q1: PASS**, all 3 reset → up cycles. **Q2: PASS**, to its end: the refusal, `X1`, the import pass and `stack:up`.
- `Q2-IMPORT-REFUSAL` passed with the same assertions that failed in Round 1. The import exited 1 with `content_missing` and one `storage_content_check` line. After the refusal, each target volume held only its empty root (and, in `appdb`, the empty `packages` and `uploads` mountpoints). No journal and no identity were present. So the target was empty `FRESH` (ADR-012 §11 item 5), and the approved `nothingChanged` and `freshVolume` oracles passed.
- So QA-RP-01 does not occur on this targeted path at `aaa823b`. The full-round rows `e-old-schema` and `e-content-missing` (both halves) have not run yet.
- Strict W4: PASS (`problems: []`). Cleanup removed only recorded lane resources. The secret scan gave only its expected coverage problem, with 0 hits.
- Permission deviation: during the run, four private database copies had mode 0644 (inside 0700 folders), not the required 0600. QA corrected them to 0600 after the run, on Lead instruction (R2.4). The functional result does not change.

These checks are not AC rows. They give no acceptance credit and do not replace the full gates (`storage-content-refusal-repair.md` §8 step 6: two full rounds of 488 rows, the legacy suites, the fresh M2 rows, three T7 runs and G-1). All 32 real-LMS rows stay **UNVERIFIED**.

### R2.1 Identity

| Item | Value |
| --- | --- |
| Role | Independent QA runtime worker. Model: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. Orca session `orca_session_id:e0768072-460a-445b-b777-ed3364ce6734`. Not the Author, a reviewer or the Round 1 worker session. |
| Task | Run `run_ebe671ad72a9`, task `task_9a5781ae31f0`, dispatch `ctx_7bc9d3467a5d` |
| Candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3`. Tests tree `4c7e067feedc644f955afee37806f06e7273dd04` (unchanged). Product scope since design `35d093d`: `infra/README.md`, `infra/scripts/stack-data.mjs`, `infra/scripts/stack-reset.sh`, `infra/scripts/stack-reset.test.mjs`, `services/lti-service/src/cli/stack-data.test.ts`. |
| Worktree | Branch `nguyenthanhquang152/lti-multi-lms`, HEAD `09ab726` when this round was written. `git diff aaa823b 09ab726` outside `docs/` is empty. Only change by QA: this section. The Round 1 text is byte-equal to `faa77a2` (SHA-256 `6158c9ea…70b5` before the append). The untracked `pnpm-workspace.yaml` stays (SHA-256 `dfc07aac…c064`). No commit, no push. |
| Lead messages | `msg_7d2b84463f57` (10:26:14Z): candidate, host-only preparation and the one allowed tool change. Reply to the preparation report: preparation accepted, runtime on HOLD for the reviews. `msg_14b51cbbe615` (10:37:18Z): the sole conditional Docker window, after Reviewer-A (`a4488ac`) and Reviewer-B (`a32fb10`) APPROVE with 0 BLOCKER or MAJOR and host QA H1–H7 PASS (`18aa600`). |
| Prepared tools | `/Users/quangnguyen/cogniate-qa-runs/claude-reset-parent-q1q2-prep-aaa823b2-20261021T1028Z`: `ADDENDUM.md` `4009596d31827bc025e3e80d6753bdb61ee36e1d57596a55d18cddf707e87a56`, `ledger/tools.sha256` `c30c4606bb93f6a32c2dc9ec94778c173162c4cd77a3761a6201b413c33a7d1e`, `ledger/manifest-all.sha256` `c0c58aac93fa13a23b43d060ec5edebb91743860d376fb77e8e73b95d125707a` (52/52 OK). The earlier root `…-prep-20261021T0838Z` is unchanged (21/21 OK after the copy). |

### R2.2 Preparation addendum (host only, before the grant)

- The earlier precheck allowed only the three files of the reset repair. It blocked `aaa823b` with exactly `infra/scripts/stack-data.mjs` and `services/lti-service/src/cli/stack-data.test.ts` (exit 2).
- The Lead authorized one change. QA verified the original hashes, made a byte copy (`historical/prep-20261021T0838Z/`, 21/21 OK; historical only), and changed only line 318 of the copy's `tools/q-oracles.mjs`: `ALLOWED_PRODUCT_FILES` adds those two exact paths.
- `q-oracles.mjs` SHA-256 changed from `adb81db2…a860` to `b53a0418…1b1e`. Only line 318 differs. The launcher (`fad8a42f…`), runner (`64ce64e8…`), controls (`589b23ba…`), spec (`2243ce99…`) and reused-tools ledger (`4c834f98…`) are byte-identical. `DESIGN_SHA`, `EXPECTED_TESTS_TREE`, lane constants, problem texts, judges and counts did not change.
- Provenance controls (new file `addendum-controls/provenance-aaa823b.mjs`, real git in a private clone, a `docker` stub first on `PATH`): **20/20** required verdicts. Accepted: the exact candidate with the five files, and the clean state again. Rejected, each with its own reason: a wrong HEAD; a synthetic commit that changes `infra/scripts/lib.sh`; a synthetic commit that changes `tests/host/lib.mjs`; a modified tracked file; an untracked file; `.env`; `node_modules`; seven near or neighbour paths. 0 Docker calls. The 93 earlier controls were not run again (no concrete concern; only the list that `sourceProblems` reads changed).
- DRY_RUN: `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-aaa823b2-20261021T1029Z-dry` (0700), exit 0 at 10:29:51Z, stub 0 calls. Tool integrity 5/5 and 5/5. Precheck PASS (`e63bd49e…2fdf`); the helper hashes equal those of the accepted preparation DRY_RUN. Ancestor check PASS.

### R2.3 Runtime run

Root: `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-aaa823b2-20261021T1037Z`. The launcher made it under umask 077 with mode 0700. One attempt. No retry, no added sleep, no waiver.

| Stage (UTC) | Result |
| --- | --- |
| 10:37:32 tool integrity, `--no-hardlinks` clone at the SHA, precheck; 10:37:34 ancestor check | PASS. Precheck: HEAD = SHA; status empty; no `.env`; no `node_modules`; tests tree `4c7e067`; scope = the five files; helpers import. Ancestor: home 0750 `quangnguyen:staff`, group members `quangnguyen root`, root 0700. |
| 10:37:34 **W1** wake | PASS. Cached pinned image `sha256:44fce696…937f`, `--pull never --rm --network none`, label `org.cogniate.qa=wake`. No wake container is left. Before the wake, the idle VM showed the cached Round 1 bridge Id `74288f53…` and a Docker clock of 09:27:16Z against host 10:37:35Z. These pre-wake values are not boundary evidence. |
| 10:37:37 **W2** live clock | PASS. Two reads, worst skew 40 ms and 74 ms; the Docker clock advanced with the host clock. |
| 10:37:42 **W3** formal start | PASS. G-1 identity match, no difference: macOS 27.0.1 arm64; CLI 29.9.1 `678271184175…af5fb`; Compose 5.6.0 `1ec06408b809…f605`; engine 29.9.1; image `44fce696f38b…937f`. Lane fresh: no exact lane name, no lane label, no lane prefix (all containers, networks and volumes). Port 8743 free. No subnet clash. 7 protected FULL records identical to the baseline `219da30b…6582`. Built-in networks bridge `cf6b8ae1…`, host `b9266a37…`, none `d2863b51…`. 9 volumes, including the 2 anonymous `a17056b8…` and `d5df35bd…`. 0 containers. Settings readable (normalized `8d959def…`). 0 vanished resources. `runStartSecond` 1792579068 (10:37:48Z). `w3-formal-start.json` `f6433ad9…178f`. |
| 10:37:50 READY | The launcher sent the post-W3 status `msg_1d76a6a43f8c` with the W3 summary and hash. Then the sampler and the runner (umask 022 child only) started. |
| 10:37:50–10:41:10 runner | exit 0. 22/22 PASS, no abort. Teardown ran. |
| 10:41:10 clone host processes | none (`clone-processes-after.txt` is empty) |
| 10:41:18 **W4** end, 10:41:24 strict compare | PASS. `problems: []`. The end is live (Docker clock 10:41:15Z). Identity unchanged. Built-in network Ids equal at start and end. Settings hash equal. All 9 volume FULL records equal (the 7 protected and the 2 anonymous). 0 containers at start and end. No lane leftover by exact name, label or prefix. Sampler: 15 samples, 0 failed, 1 bridge Id, 0 skew violations, 0 read failures, at most 1 compose project, no other project seen. So there was no VM restart or sleep during the run. |
| 10:41:24 secret scan | exit 1 with the expected single problem `no captured values: the scan proves nothing`. stackValues 9; raw files 8, raw hit files 0; public files 71, public hit files 0; JWT-shaped files 0. |

#### The 22 detailed checks

| Check | Result | QA-observed values |
| --- | --- | --- |
| `PRE` | PASS | node 24.21.0, docker 29.9.1, compose 5.6.0; port and subnet free; 0 other containers |
| `CLONE` | PASS | HEAD `aaa823b` |
| `Q1-UP0` | PASS | `stack:up` exit 0 at the first run; no bind error |
| `H1` | PASS | project `qa-reset-parent-r1`; services cogniate-app, lti-service, moodle, postgres, proxy |
| `Q1-P0` | PASS | `P` dev/ino `16777233/8434866`, directory, uid 501, mode 0700 |
| `Q1-C0-UP` | PASS | 5 services running and healthy; exact nested binds; fresh in-container view |
| `Q1-C1-RESET` | PASS | see the Q1 table |
| `Q1-C1-UP` | PASS | see the Q1 table |
| `Q1-C2-RESET` | PASS | see the Q1 table |
| `Q1-C2-UP` | PASS | see the Q1 table |
| `Q1-C3-RESET` | PASS | see the Q1 table |
| `Q1-C3-UP` | PASS | see the Q1 table |
| `Q1` | PASS | 3 of 3 cycles |
| `Q2-FIXTURE` | PASS | F = `pkg_qaq23a8d8f29e69e1838`; QA count `C_qa` = 1; F never existed |
| `Q2-RESET` | PASS | exit 0; `P` is the same inode, empty, 0700; both exact volume names absent; no lane container |
| `Q2-BACKUP-X0` | PASS | exit 0; manifest `source: legacy`; exactly QA's 2 files with QA's sizes and hashes |
| `Q2-IMPORT-REFUSAL` | PASS | exit 1; one `storage_content_check` line `content_missing`, `checked` 1, the folder F; no bind error; target empty `FRESH`; nothing else changed |
| `Q2-BACKUP-X1` | PASS | exit 0; manifest = QA's hashes |
| `Q2-IMPORT-PASS` | PASS | exit 0; one `pass` line, `checked` 1, `missing` []; QA reads: identities `kind: import`, generation 1, `firstStart: completed`, one `pairId`; volume bytes = QA's legacy bytes |
| `Q2-UP` | PASS | exit 0 at the first run; same `P` inode; healthy; exact nested binds; F's file visible in `cogniate-app` with the same SHA-256 |
| `Q2` | PASS | all Q2 checks |
| `TEARDOWN` | PASS | `stack:down` exit 0; 0 containers, 0 volumes (also by exact lane names) and 0 networks left |

Counts: 22 PASS, 0 FAIL, 0 NOT RUN. `summary.json` has `abort: null`.

#### Q1 cycles (all QA reads)

Each cycle planted these items in `P`: `.qa-marker`, `.qa-dotdir/x`, a link `qa-link` to a file outside the clone, and `packages/qa-q1-c<i>/index.html`. It also planted the lti-service and log markers and set `chmod 0755 P`. QA made the kept-file listing (10 files: `.env`, `infra/.certs/*` and `infra/.data/fixtures/*`) before each reset.

| Cycle | Reset ms | Reset call → up call ms | Up ms | Result |
| --- | --- | --- | --- | --- |
| 1 | 3894 | 4091 | 31908 | PASS |
| 2 | 5000 | 5179 | 31817 | PASS |
| 3 | 3741 | 3919 | 31831 | PASS |

In every cycle:
- R1, R2: `P` kept dev/ino `16777233/8434866`, uid 501, mode 0700 (it was 0755 before), and had no entries. This includes the dot names and the link.
- R3: the target of the outside link was unchanged (inode `8434850`, mode 0600, SHA-256, names).
- R4: these paths were present before and absent after: the lti-service marker and folder, the log marker, `backups`, `build-queue` and `.secrets/app`. `seed.json` was not exercised, as expected.
- R5: both exact volume names were absent (exact-name inspect and `volume ls`). R6: no lane container. R7: the kept listing was equal. R8: no bind error text.
- U1, U2: the same inode; `packages` and `uploads` were 0700 directories of uid 501.
- U3: all 5 services were running and `healthy` at the first inspect.
- U4: `cogniate-app` had exactly `/data` = volume `qa-reset-parent-r1_appdb`, and `/data/packages` and `/data/uploads` were binds with the exact source `<clone>/infra/.data/cogniate-app/<name>`. `lti-service` had `/data` = `qa-reset-parent-r1_ltidb`.
- U5: the new host marker had the same SHA-256 inside the container. The erased `qa-q1-c<i>` folder was absent inside, and the in-container listing showed only the new marker folder.
- U6: no bind error text. No bind error text is in any of the 29 command logs.

#### Q2 facts (all QA reads unless stated)

- Fixture: read-mode copy-out of the product-made pair (`lti.db` 114688 bytes, `cogniate.db` 315392 bytes). QA's synthetic legacy `cogniate.db` SHA-256 `fd46056e…6a36`; `lti.db` `fec3b7c2…ff3a`.
- Import `stack:data-import -- --from X0` (609 ms, exit 1). Docker-clock start second 1792579230 (10:40:30Z).
  - JSON lines (QA parsing): `storage_lock_acquired`, then `storage_content_check` (`result: "content_missing"`, `checked: 1`, `missing: ["packages/pkg_qaq23a8d8f29e69e1838"]`), then `storage_refused` (`command: "import"`, `code: "content_missing"`), then `storage_lock_released`. No `storage_restore_cancelled`, rollback or drill line. The human text ends with "Nothing was changed.". These output facts are information; the Q2 oracles are the ones in the table above.
  - Both volumes existed after the import. Compose made them: labels `com.docker.compose.project=qa-reset-parent-r1` and `com.docker.compose.volume=ltidb|appdb`, `CreatedAt` 10:40:30Z (not before the start second).
  - QA listing (read-mode fixture container): `ltidb` only `.` (dir, 501:20, 0700). `appdb` only `.`, `packages` and `uploads` (dirs, 501:20, 0700). No `.storage-journal.json`, no `.storage-identity.json`, no `.restore-*`.
  - `nothingChanged`: no difference. No storage container was left. The legacy files kept their bytes.
- Import `--from X1`: exit 0; one `pass` line. QA reads: both identities `kind: import`, generation 1, `firstStart: completed`, `pairId` `afab2d22…`; both journals `committed`; volume `lti.db` and `cogniate.db` SHA-256 equal to QA's legacy files; no `-wal` or `-shm`.
- `stack:up` (31592 ms): same `P` inode; 5 services healthy; exact content binds; the file in F has SHA-256 `57722eec…c908` on the host and inside `cogniate-app`.

### R2.4 Cleanup, modes and scan coverage

- Teardown (ADR-012 §15): `lane-ownership.json` has 50 records (25 containers, 5 networks, 20 volumes) and 0 ledger errors. After `stack:down`, it removed 4 resources: the volumes `qa-reset-parent-r1_appdb`, `_ltidb`, `_moodledata` and `_pgdata`, made by the last `stack:up`. It kept 0 and failed 0. QA did no manual removal. QA ran no prune, pull, settings change or restart.
- W4: no lane leftover; the 7 protected and 2 anonymous volumes have identical FULL records; built-in network Ids are unchanged. **Window RETURNED** at 10:41:24Z. After that, QA ran no Docker command.
- Modes (actual):
  - 0700: run root, `public`, `private`, `tmp`, `source`, `review`, `infra/.data/cogniate-app` and its `packages` and `uploads`, `infra/.secrets`, `infra/.certs`, and the backup folders.
  - 0600: `.env`, the backup files and manifests (`X0`, `X1`), the runner logs and the gate body.
  - 0644 during the run: four database copies in `private/q/` (the read-mode copy-out in `storage/out/q2-src-*` and the fixture copies in `q2-fixture-*`). The copy keeps the mode of the container file. 0555: QA's fixture script copy in `private/q/storage/bin/`. All five are inside 0700 folders in the 0700 root, so no other account can open them. The Round 1 root has the same five modes; the Round 1 text "No secret file is readable by group or other" did not list them.
  - **Permission deviation, corrected after the run.** The grant requires secret files at 0600, so the four 0644 database copies were a deviation during the run. At 10:46:56Z, after the window, the Lead had QA set only these four files to 0600 (no-follow open, regular file, owner and inode checks). Their inodes, sizes and SHA-256 did not change. The fixture script (0555), the Round 1 root and every other file did not change. No Docker command, rerun or tool edit. The evidence manifest is unchanged (`d8f6556a…75e6`, 88/88 OK after the correction; it holds content hashes, not modes). Correction record: `review/mode-correction.json` (before and after: path, type, uid, gid, mode, inode, size, SHA-256).
  - 0755: the clone and its normal folders (the runner child ran under umask 022), and the artifact folder in `source/tests/host/artifacts` (0755/0644). Both are inside the 0700 root.
  - QA did not chmod any shared ancestor (`cogniate-qa-runs` stays 0755). QA did not change `HOME`.
- Secret scan coverage: 1 clone, 8 raw files, 71 public files (`public/` and the artifact folder; 2 binary), 0 private browser files. Hits: 0 raw, 0 public, 0 JWT-shaped. Limit: Q1 and Q2 capture no LTI or browser value, so the scan has no captured value to search for, and it proves no absence of such values. `private/` (backups with lane data) is private by design and not scanned as public.

### R2.5 Observations (information only, not findings)

- In `docker inspect`, the reported `Source` of some other binds of `cogniate-app` (for example `build-queue/*`, `/repo/*`, `/certs/root.crt`) changed between `/Users/…` and `/host_mnt/Users/…` across cycles. The two content binds always showed the exact `/Users/…` source. U4 checks only the content binds.
- The bridge Id changed between Round 1 (`74288f53…`) and this window (`cf6b8ae1…`). The W1 pre-wake read still showed the cached Round 1 Id. This change happened before this window; inside the window, the sampler saw one bridge Id.

### R2.6 Limits

- One host, one attempt. The Docker Desktop mechanism of the earlier bind error stays unknown.
- Q1 shows the operator path reset → up 3 times, including the build-queue binds of `stack:up`. It does not send a build request, and it does not measure the `d-content-folder` move or a manual deletion of `P` (ADR-012 §15 limit).
- Q2 covers only the import refusal into absent volumes. The restore half (Q3) and the recovered-`FRESH` boundary (Q4) were not granted and did not run. Host QA H1–H7 (`content-refusal-qa.md`) covers those code paths without Docker.
- The default-subnet caveat stays: `172.28.0.0/16` is the product default. W3 checked the start, and the sampler saw no other project during the run.
- The full 488-row rounds, the legacy suites, M2 and T7 were not run. All 32 real-LMS rows stay UNVERIFIED.

### R2.7 Evidence (private, kept)

Run root `/Users/quangnguyen/cogniate-qa-runs/qa-reset-parent-r1-aaa823b2-20261021T1037Z` (0700). `…/artifacts/` below is `source/tests/host/artifacts/qa-reset-parent-r1-aaa823b2-2026-10-21T10-37-50-941Z/`.

| File | SHA-256 |
| --- | --- |
| `review/evidence-manifest.sha256` (88 files of `public/`, `private/` and artifacts, made right after the run; 88/88 OK again before this report) | `d8f6556a410a3e9062ab7a345699239de953051dccc81de79f458fdd6a3075e6` |
| `public/launcher.log` | `a13fa850b7d1f99d6f580416dfc6ab1633b9198b9e5e8864d848f4001a76ff80` |
| `public/run-exit.json` | `76cbf781e4f4339998c610624596053a22a6cbe3dd63125e379e76bd5a02bc52` |
| `public/precheck.json` | `7c20b6a4e0b367e828272809a11198539d904bf7dbbd10498372cd14441bc7bd` |
| `public/w1-wake.json` | `bdac4319cbdc57acfb09d8782e719adc53586a682ca7b61c3be11e17de5f03f3` |
| `public/w2-liveness.json` | `f9e589f5895839898147dcef1d739a64599a478328b616c79e42a1006eff498b` |
| `public/w3-formal-start.json` | `f6433ad9118fbe45728d9760889fecc2bab74cf9e4e8ea0cb59bc5043260178f` |
| `public/gate-message.txt` | `0fdf86233bfc076fc78da4a6a833d84a8be9cadc3d50cdf68cfa16340055ce03` |
| `public/w4-end.json` | `0d52b75e77f4b9e6eda01cbf3bbfdf8d3d398c94e747f7c8434369fb8e18e9bf` |
| `public/w4-compare.json` | `a6bb98e9288f500bbdfa893b5b7eced0c89af898671b0eb9404707330c2dd760` |
| `public/sampler/lane-containers.json` | `64e63496f3b101a33c9740d71edae5c4afdcdd82aff7b9adee7f07dbd9f54911` |
| `public/secret-scan.json` | `4e8313ddc9aca62ea5f7ffe11b4857552a64ff944e2843f5a8d2fca36b2f0fd9` |
| `…/artifacts/summary.json` | `8d076dc1f310e6404aaec1cfd7e34bb5d41a2a8cc2544da703cfc3ef409c4ca3` |
| `…/artifacts/q1-q2-evidence.json` | `32f228353a4177979917a6c103dffd8ab02c7ef264dc18c43c3a87ed9605d8f5` |
| `…/artifacts/lane-ownership.json` | `b93e70b88face9e0fd74f9d8abff1c0328ceeb0362d34404e68cbdb41d7ec079` |
| `…/artifacts/cmd/22-q2-import-X0.log` | `02be224a7b7dbdd14c586fd9a8998a04accfc5a0d5a957ada7489d3f3bd0b709` |
| `…/artifacts/cmd/23-fixture-list.log` | `dcff0b5735e1bf4764e42edffc6ea0a4c5b4f748902ac643e810b1bbec0fda89` |
| `…/artifacts/cmd/25-q2-import-X1.log` | `d2f328d34c3b79e615817cb4323bbef31950b9cc88c5ca294787786924af5d63` |
| `…/artifacts/cmd/26-fixture-fileset.log` | `c582968ce01957701aa906c10987a5f07b7f1b85f9b42c9e41ec8a35e7e5ea1d` |
| `…/artifacts/cmd/27-q2-up.log` | `c8f54d86abc6662bf75be6f8c65a3169929f2362e1bbb47424ad64342734c243` |
| `private/runner.stdout.log` | `88a084b923d0aa090ca876f710094bd4a6a23051251d918f7f54f351236aee3c` |
| `review/mode-correction.json` (post-run correction record; separate from the manifest) | `52ed0d7f7ecdeae8d9da5fa3ee10e6f1ba30f90e1f92c7a9f4cfa66608e2e846` |
| `review/mode-correction.py` (the correction script) | `62e6bcf6e54b5c5fb794500547f176be47572a54781cf931d9af930db4d54147` |

Preparation addendum root: `/Users/quangnguyen/cogniate-qa-runs/claude-reset-parent-q1q2-prep-aaa823b2-20261021T1028Z` (`ADDENDUM.md` `4009596d…7a56`; `evidence/provenance-aaa823b.json` `b8ba9476…298d`). Dry-run root: `…/qa-reset-parent-r1-aaa823b2-20261021T1029Z-dry`.
