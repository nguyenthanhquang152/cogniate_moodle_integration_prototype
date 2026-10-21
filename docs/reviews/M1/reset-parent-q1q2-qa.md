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
