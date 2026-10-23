Verdict: PASS
Round: 1

# M1 content refusal repair: independent host checks H1–H7 (QA, held)

Independent QA, 2026-10-21. **Result: the candidate `aaa823b` passes every host check H1–H7 of [storage-content-refusal-repair](../../architecture/tasks/storage-content-refusal-repair.md) §6, with every collateral check.** This is a host-only check with no Docker. It gives no runtime acceptance credit. The §7 runtime checks (Q1, Q2) and the §8 item 6 gates stay open. All 32 real-LMS rows stay UNVERIFIED.

## 1. Identity

| Item | Value |
| --- | --- |
| Role | Fresh independent QA. Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort, no subworkers. Independent of the Author and the reviewers. Orca session `orca_session_id:3f8c140c-a0cc-4069-8df6-3eeeb32d2d12`. |
| Task | Run `run_ebe671ad72a9`, task `task_b9f5ddc04fcd`, dispatch `ctx_f4ca2198db32`. Lead: the existing coordinator. |
| Design | Frozen at `2323361f91846a1fa21018d36694639d33ab2648`. Brief SHA-256 `e7bcf8e0848c56c977a1c5dddd0281e0c194f6834c245542d45accc979ac8f47`. |
| Candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3`, tree `38ccfc747a4c7d74171becf59def6919f0b1be6d`, tests tree `4c7e067feedc644f955afee37806f06e7273dd04`. `infra/scripts/stack-data.mjs` SHA-256 `5c3fde5cab845e27bbb942c69cc4a4578964a2c66171ba068b625f15b4a7c258` (equal to the Lead's value). |
| Owned file | This report only. No other repository file changed. No commit, no push, no Docker call, no stack, no account, no tunnel. `pnpm-workspace.yaml` is untouched. |
| Private root | `/Users/quangnguyen/cogniate-qa-runs/qa-content-refusal-h1h7-20261021T0952Z` (mode `0700`, made under umask `077`; no shared ancestor changed). Below, `<root>` means this folder. |

## 2. Independence record

1. QA read only the charter, `docs/research/inputs.md`, the brief, ADR-012 at `2323361` (§1 header, §3–§6, §8, §10, §11, §16) and the M1 clarification diff. It did not read Author code, diffs, tests or notes, the old QA reproducer, or a reviewer file.
2. QA then wrote and froze its criteria: `<root>/criteria/content-refusal-h1h7-criteria.md`, SHA-256 `4558067a29a80187b4e8eee02d56c7750445f3bb788230be1d9a89d3a09c9889`, frozen 2026-10-21T09:57:51Z, mode `0400`. The Lead verified this hash (`msg_a22bc1f7b2b6`).
3. Only after the freeze, QA read the **baseline** `2323361` public interface (`git show`, never the shared worktree) to wire the runner. Wiring and corrections are in `<root>/criteria/addendum.md`, SHA-256 `f8933b39af077cb97f791f05fc9aab0ff8036f53a03eccbd200b4590ba3c17ab`, mode `0400`.
4. QA did not read the candidate source or its diff. It read only the changed path names (scope check, §4).

Addendum content (no expected result removed or relaxed):

| Item | Content |
| --- | --- |
| A1 (Lead correction) | The product child gets no `HOME` variable. QA made no private home. |
| B1, `QA-PREP-01` (criteria precision, found and classified before any candidate run) | H4b (1) allowed the lti journal creation but named only the `lti/` root `mtime`. On APFS an added entry also changes the folder `size` (QA measured 64 → 96). Correction: in H4b (1) only, the `lti/` root entry may differ in `size` and `mtime_ns`. Type, owner, mode and inode stay checked. The Lead accepted it (`msg_0a4307bb355f`). Every refusal keeps the full listing equality. |
| C1–C11 | Wiring: command lines, `--data <case>/data`, `--content <case>/content/packages`, `STORAGE_LOG_DIR=<case>/logs`, child environment, fixture tables (`schema_migration`, `package`), legacy manifest fields, product volume backup as a setup step, H7a code `backup_damaged`. |
| D1–D3 | Control K9 (Lead request), parse hardening of setup oracles, baseline record. |

## 3. Method

- **Runner.** QA's own Python tools (`<root>/tools`, frozen, hashes in `<root>/criteria/prep-freeze.sha256`, SHA-256 `e28f17b95d9ff774d4690f4803438251dd32800c0cf6650381626569eb399e27`). The candidate `stack-data.mjs` runs from a fresh `git clone --no-local --no-hardlinks` at the exact SHA, with `node` v24.21.0, as the host user (uid 501, gid 20). Product commands are setup steps or the command under check. They are never their own oracle.
- **Child environment.** `env -i` with only `PATH` (the docker stub first), `TMPDIR` (a new empty QA folder for each command), `HOST_UID=501`, `HOST_GID=20`, `LC_ALL=C`, `DOCKER_HOST=unix://<root>/no-docker.sock` (no daemon), `STORAGE_LOG_DIR`, and `STORAGE_DRILL=1` only for drills. Child umask `022`; QA launcher umask `077`.
- **Targets.** One fresh case folder per subcase. Roots prepared first: `lti-service/` `0700` empty; `cogniate-app/` `0700` with empty `packages/` and `uploads/` (`0700`).
- **Fixtures.** QA SQLite databases (Python `sqlite3`, rollback-journal mode). App rows `pkg-1 → packages/p1`, `pkg-2 → packages/p2`, `pkg-3 → packages/p2`: 3 rows, 2 distinct paths. So QA's count `N` = 2 and, with `p1` removed, `M` = `["packages/p1"]`. QA wrote the legacy backup `L` and its manifest. Volume backups `V` and `V2` came from the product backup mode and QA verified them with its own parser.
- **Oracles.** O1 recursive `lstat` listing (path, type, uid, gid, mode, size, SHA-256, link target; strict layer `mtime_ns` and inode). O2 JSON-line events from stdout + stderr, and from the log-file lines that the command added. O3 QA journal parse. O4 TMPDIR empty after the command. O5 docker stub log empty. O6 listing of the whole private root, minus the declared writable roots of that command and minus QA's `evidence/`. O7 no uid 0; host uid in targets, TMPDIR, backups and content.

## 4. Candidate checks (E2)

Evidence `<root>/evidence/clone-cand-aaa823b.txt` (SHA-256 `2a8d1ddb589582c216696fa03a076e15cfb75ae56d5b319497210a36eb6d5b29`).

| Check | Result |
| --- | --- |
| `HEAD` | `aaa823b25306c5e560f7c4050238b374dec4d4e3` |
| `git status --porcelain` | empty |
| Hard links | no work-tree file and no object file with a link count above 1; no `alternates` |
| Changed paths `2323361..aaa823b` | `infra/README.md`, `infra/scripts/stack-data.mjs`, `services/lti-service/src/cli/stack-data.test.ts`; outside product and tests only `docs/team/board.md`, `docs/team/multi-lms-plan.md`. Inside the approved scope. |
| Unchanged | tests tree `4c7e067…`; `sqlite-lock-probe.mjs` SHA-256 `cb665e4e21b58844ce97985f4dc15ef4b2a41cb6532e6cf2b1a0e604e61c8b38` (same as the baseline); `stack-data.sh`, `lib.sh`, `compose.yaml` not in the changed list |

## 5. Preparation verdict: READY

| Control | Result | Evidence (SHA-256) |
| --- | --- | --- |
| K1–K9 oracle controls (listing, parser, TMPDIR, docker stub, SQLite count, owner, outside change, end-to-end collateral through the runner) | 39/39 PASS (run `controls-prep2`) | `evidence/controls-prep2/controls.json` `128b2051c7afe96d3bc4fbfefaf8f31e2ddfe5067e7878887777bca89a79bd89` |
| Baseline negative control: H1–H7 on a fresh clone of `2323361` (product unchanged from `89fb4b4`) | 2 runs, the same verdicts, 0 mismatches with the prediction of criteria §7. FAIL: H1, H2-R1, H2-R2, H3a, H3b, H4a, H4b, H6-refuse (`rolled_back` journals added or rewritten, `storage_restore_cancelled`, no `storage_refused`, H4a exit 3 with a drill stop before the check, H6 `.tmp` removed). PASS: H5-import, H5-restore, H6-success, H7a, H7b, H7c. Stub 0 calls. | `evidence/baseline-2323361-r2/results.json` `db533bcb18a74233ddaa553d097ced8a2da0ba605ac1e7e1b0617469f0a0aa3f`; prep manifest (211 files) `evidence/prep-evidence-manifest.sha256` `4c5fbc4e9f949c8afa0ece746c4f884ea87b5e98ee5ff80a46daa29e43b589a5` |

The baseline control shows that the H1–H4 and H6 oracles find the old order (QA-RP-01) and that H5, H6-success and H7 give no false failure on real product output.

## 6. Candidate verdict: PASS

Run `cand-aaa823b-r1`, 2026-10-21T10:18:04Z–10:18:09Z, one attempt. Command: `python3 -I -B tools/h_suite.py --phase cand-aaa823b-r1 --clone <root>/clones/cand-aaa823b`. 34 product commands, 656 assertions, 0 failed. Docker stub calls: 0 at start, 0 at end.

| Subcase | Commands (exit) | Assertions | Result |
| --- | --- | --- | --- |
| H1 import into empty `FRESH` | import `L` (1) | 40 | PASS |
| H2-R1 recovered `FRESH`, R1 state | drill `prepared-lti` (3), recover (1), import `L` (1) | 60 | PASS |
| H2-R2 recovered `FRESH`, R2 state | drill `staged` (3), recover (1), import `L` (1) | 60 | PASS |
| H3a restore into `OK`, `committed` journals | import (0), backup `V` (0), restore `V` (1) | 59 | PASS |
| H3b restore into `OK`, `rolled_back` journals | import (0), backup `V` (0), drill restore `staged` (3), recover (1), restore `V` (1) | 76 | PASS |
| H4a boundary, folder absent | drill import `prepared-lti` (1) | 40 | PASS |
| H4b boundary, folder present | drill import `prepared-lti` (3), recover (1), recover (0) | 55 | PASS |
| H5-import | import `L` (0) | 29 | PASS |
| H5-restore | import (0), backup `V` (0), QA write after `V`, restore `V` (0) | 50 | PASS |
| H6-refuse | import (0), backup `V` (0), 4 `.tmp` plants, restore `V` (1) | 58 | PASS |
| H6-success | restore `V` (0) | 30 | PASS |
| H7a damaged backup | import `Ldmg` (1, `backup_damaged`) | 23 | PASS |
| H7b other pair | import T1 (0), import T2 (0), backup `V2` (0), restore `V2` into T1 (1, `pair_mismatch`) | 47 | PASS |
| H7c import into `OK` | import (0), import `L` (1, `import_target_not_fresh`) | 29 | PASS |

What the passes show (QA's own oracles):
- **Every content refusal** (H1, H2-R1, H2-R2, H3a, H3b, H4a, H6-refuse): exit 1; exactly one `storage_content_check` (`content_missing`, `checked: 2`, `missing: ["packages/p1"]`, a 32-hex `opId`) on stdout and in the log delta; then exactly one `storage_refused` with `code: "content_missing"` and the right `command`; stderr has "Nothing was changed."; no `storage_restore_cancelled`, `storage_restore_rollback` or `storage_drill_*` event, no `pass`, no `content_check_failed`. Both target listings are equal in both layers (also the root folders' `size` and `mtime_ns`). Empty targets have no journal, `.restore-*`, `.previous-*` or `.tmp`. Existing journals keep their SHA-256, state and `opId` (R1 lti only; R2 both; `committed`; `rolled_back`). The check `opId` is in no journal.
- **H4b:** one `pass` check line before one `storage_drill_stop` (`prepared-lti`); the check, drill and lti journal `opId` are equal; lti `prepared`, no app journal, app root unchanged, the only lti change is the added journal (B1); recover → 1 (lti `rolled_back`, same `opId`); recover again → 0 with no change.
- **Successes** (H5-import, H5-restore, H6-success): exit 0; one `pass` line with `checked: 2`, `missing: []`; both journals `committed` with one `opId` equal to the check `opId`; in-place `lti.db` and `cogniate.db` have the backup's manifest bytes (H5-restore: not the post-`V` bytes; a new `opId`). H6-success removes all 4 `.tmp` plants; H6-refuse keeps them byte-equal.
- **Precedence** (H7a–c): the earlier code; no `storage_content_check` line; no `content_missing` text; targets unchanged.

Evidence: `<root>/evidence/cand-aaa823b-r1/` (per command: stdout, stderr, summary JSON with listings and journals). `results.json` `2ddc59901936ab360dc7da7550586dfe5d3567278818ccb3680eb8dca3ba74c7`; `assertions.json` `36d2347ee1c2fefad1b7645185b18b252e0bda51f6d98b7b56249093f07ac352`; candidate evidence manifest (107 files) `<root>/evidence/cand-evidence-manifest.sha256` `86e6b9d661f38b0fa92690d301f293cd159f735381b719224f53eb4989b831b1`.

## 7. Collateral coverage (actual)

Each of the 34 candidate commands got C-TMP, C-DOCK, C-OUT, C-ROOT, C-BAK and C-CONT (34 each, all PASS).

| Covered | Not covered |
| --- | --- |
| TMPDIR: a new empty QA folder per command; empty after every command (no scratch copy stays) | The OS temp folders outside the QA TMPDIR (`/tmp`, the per-user `/var/folders/…`) |
| Docker: stub first on `PATH` and a dead `DOCKER_HOST`; 0 calls | A Docker call through an absolute path would bypass the stub; the dead `DOCKER_HOST` would make it fail, and no such call shows in any output |
| Outside change: the whole private root in both layers (both clones with `.git`, tools, criteria, stub, every other case folder, the case folder itself and `data/`), minus the declared writable roots and `evidence/` | Files outside the private root, also the real user home and the shared worktree |
| Backups (`L`, `Ldmg`, `V`, `V2`) and the content and hold folders: equal in both layers | — |
| Owner: no uid 0 entry; host uid in targets, TMPDIR, backups, content | The root path of §4 (the program runs as the host user, so `prepareFolder` and `dropPrivilege` change nothing) |

## 8. QA-side items (no product finding)

| Id | Kind | Content | Effect |
| --- | --- | --- | --- |
| `QA-PREP-01` | criteria precision | B1 above. Accepted by the Lead before the candidate run. | none on the verdict |
| `QA-TOOL-01` | QA tool defect, preserved | A rerun of the controls at candidate time failed in K8 setup: K8 copies `<root>/tools` with its modes, and the freeze had set the files to `0400`, so K8 could not append to its own copy (`PermissionError`). K1–K7 had run; K8 and K9 did not; no result file. The first failure is kept in `evidence/controls-cand-aaa823b/FIRST-FAILURE.txt` (`ff0f62de7f28762bb52247039875b00eb61f17d090e8a1979bbd233d6df69e5d`) with its partial scratch. Follow-up for classification: the byte-identical tools (hashes checked against the freeze list), copied with mode `0600` into a fresh sandbox `<root>/scratch/ctl-sandbox-cand`, pass 39/39 (`evidence/controls-cand-aaa823b-sandbox/controls.json` `14071b56c4505ca12c0da0dd857c07b3ac6c25f6c626c230a89cbc83df7307ee`). No tool or criteria file changed. | none: the controls do not read the candidate; the accepted prep run is 39/39 |
| `QA-PROC-01` | QA process slip | After the candidate run, a typo in a QA analysis command (`cat > /tmp/qa-noop-check.<pid>`) made one empty file `/tmp/qa-noop-check.73908` outside the private root and waited on input. QA stopped it and removed the empty file. It was not a product command and it touched no evidence. | none |

## 9. Limits

- Host only, macOS APFS, `node` v24.21.0. The product container uses `node:24.22.0-alpine3.24` on ext4. The `stack-data.sh` wrapper (lock, positive stop check, maintenance container) did not run.
- The §4 root steps and the privilege drop did not run as root (host user).
- Not in H1–H7, so not checked here: `content_check_failed` (brief §5 U5, unit only), a kill inside step 1, concurrent changes, and that an unlisted backup file is not copied into the check scratch (reviewers check it by reading).
- The order "scratch removed before the line" is not visible from outside the process. QA checks only that the TMPDIR is empty after each command.
- One host, one attempt per command. QA did no mutation of the candidate; the baseline run is the old-order control.
- No runtime credit. Q1, Q2 (brief §7) and the §8 item 6 gates stay open. All 32 real-LMS rows stay UNVERIFIED.

## 10. Reproduce

```sh
R=/Users/quangnguyen/cogniate-qa-runs/qa-content-refusal-h1h7-20261021T0952Z
cd "$R" && umask 077
(cd criteria && shasum -a 256 -c criteria.sha256) && shasum -a 256 -c criteria/prep-freeze.sha256
tools/make_clone.sh <sha> <name>
python3 -I -B tools/h_suite.py --phase <new phase> --clone "$R/clones/<name>"
```
