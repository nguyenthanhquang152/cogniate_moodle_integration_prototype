# Storage reset parent repair (ADR-012 revision 3.4)

Owner: Architect (design). Implementation: backend Author. Verification: independent QA. Review: Reviewer-A and Reviewer-B review this brief, [ADR-012](../adr/ADR-012-sqlite-volume-storage.md) revision 3.4 and the implementation together. Status: **proposed, not accepted**. Date: 2026-10-21. Task `task_0de615829d29`.

## 1. Facts

| Input | Value |
| --- | --- |
| Failed run | common QA, candidate `9cdd768` (product equal to `a784522`), round 1, phase `storage`, import half of `M1-41.common.e-old-schema`, 07:40:46 UTC |
| Diagnosis | `/Users/quangnguyen/cogniate-author-diagnostics/m1-41-content-missing-9cdd768-20261021T0746Z/diagnosis.md`, SHA-256 `5ebbdc4564b6c224550c3724587e73455a525d7c48d371757ea95c51e38798e2` (§10) |
| Trials | `…/docker-repro/trials/trials.jsonl`, SHA-256 `d67c404bf7dd99559ff655e7300e6d5a00b21fe50115f3f9a0ea5f724c5222df` |
| Tests in use | `0e83e3c` (QA harness repair only; product unchanged since `a784522`) |

`P` is `infra/.data/cogniate-app`. `stack:reset` deleted `P`. QA made `P` again with legacy files. 1.21 s later, `stack:data-import` made `packages` and `uploads` before its Docker call (diagnosis F1–F3, F8: the product order is correct). The daemon refused the maintenance container: `bind source path does not exist` for `…/cogniate-app/packages`. The container did not start, so the content check never ran.

Trials (plain `docker run`, read-only scratch binds, 20 sequential trials per series; a hold container bound the child first):

| Series | Topology | First result | Diagnostic retry up to 5 s |
| --- | --- | --- | --- |
| R1 | new parent, new child, bind at once | 20/20 visible | not needed |
| R2 | delete and make the parent again; new child 1.2 s later | 20/20 `bind source path does not exist` | 0/20 visible; last try 5.1 s after the child, 6.3 s after the parent |
| R3 | keep the parent; delete and make only the child again | 20/20 visible | not needed |
| R3b | keep the parent; move a grandchild away | 20/20 `ENOENT` (no stale view) | not needed |

Not known: the mechanism inside Docker Desktop, the upper bound of the R2 window, and what ends it.

Inference (diagnosis §10.3, not measured): before ADR-012 the app bound `P` itself, a child of the kept `infra/.data` (R3). The ADR-012 nested binds sit one level lower, under the folder that the reset deletes (R2). So the failure is new.

Exposed today (topology R2): `stack:reset`, then inside the window any container that binds `packages` or `uploads`. Measured for the import. By topology also: every maintenance run (volume backup, restore, `--recover`, quarantine) and `stack:reset` → `stack:up` (`e2e:reset`, `b-sequence`, AC-T1-10, AC-T2-31; not tested).

## 2. Decision: Option A

The normative rule is the content-parent rule of ADR-012 §15. In short: `stack:reset` keeps `P` when it is a real directory of the host user, removes every entry of `P` (dot names too; links as links), and sets `P` to `0700`. An absent `P` stays absent. Any other entry at `P` is removed as before. The rule replaces only the removal of `P`, at the same point.

So the product reset never makes topology R2. The next command makes `packages` and `uploads` under the kept `P`: topology R3 (visible, 20/20). The trials bound only `packages` and kept no other file in the parent; that the same holds for `uploads` and for the legacy files is an inference, which §6 RA measures.

| Not chosen | Reason |
| --- | --- |
| bounded retry (diagnosis §7) | withdrawn: the window is longer than 5.1 s and its bound is not known |
| fixed sleep | guesses an unknown window |
| `create_host_path: true` | Docker can make a root-owned content folder (ADR-012 §4) |
| Option B now (a new refusal code for this Docker error) | after Option A, no row needs it. A true next step needs a measured window or a measured way to end the state; neither exists. See §8. |

## 3. Contract check

| Contract | Result with Option A |
| --- | --- |
| Data erasure | the same: no entry of `P` survives, also dot names. `lti-service`, backups, build queue, `.secrets/app`, logs, seed and key files, knobs and profile file go as before. |
| Links | a link inside `P` is removed as a link; its target does not change. A linked `P` is removed as a link, as before. Nothing outside the checkout changes. |
| Absent `P` | stays absent; §4 makes it at the next guarded command (as before) |
| Owner and mode | no `chown`. A kept `P` has the §4 state: host user, `0700`. A `P` of another owner is removed as before, so an old root-made `P` still goes. |
| Legacy cleanup | the app legacy set is inside `P`, so it goes; `infra/.data/lti-service` goes as before. Both legacy sets are empty after the reset (§10 row L4). |
| Kept paths | `.env`, `infra/.certs/`, `infra/.data/fixtures/` (unchanged list), and the empty `P` |
| Exact path, project guard | the rule names one exact path. The guard, the lock, `require_own_project` and the no-`.env` project rule run first, unchanged. |
| Partial Docker removal | a failed `down -v` (or a failed label removal without `.env`) exits before the rule; `P` does not change (as before) |
| Lock | unchanged; the rule runs while the lock is held |
| Confirmation | `stack:reset` asks nothing (unchanged). `confirm_stack_delete` (`e2e:reset`, `test:e2e`) skips its question only when no stack data exists, and an existing `P` counts as data. After a reset with no later start, the empty `P` now makes it ask, or stop without a terminal and without `--yes`. This is fail-closed; QA runners pass `--yes`. No `lib.sh` change. |
| Old builds | their `stack:reset` is forbidden while the override is active (§12); unchanged |
| QA assertions (read-only check of `tests/**` at `0e83e3c`) | none needs `P` absent after a reset: `b-sequence` (both volumes absent), `@old-schema-setup` (`mkdirSync` with `recursive`; a legacy target must not exist), `e-old-schema`, `e-content-missing`, AC-T1-10, AC-T2-31, T7 `stackSnapshot` (before and after a refused command). No QA change is needed for this repair. |
| Architecture text | ADR-006 ("deletes the volumes and these folders") and `local-stack.md` ("removes … the bind data") stay true. ADR-012 §3, §7, §15 and §16 change. |

## 4. Implementation (backend Author)

| File (only these) | Change |
| --- | --- |
| `infra/scripts/stack-reset.sh` | apply the ADR-012 §15 rule instead of `"$INFRA_DIR/.data/cogniate-app"` in the removal line, at the same position. Update the header comment and the success line (name the kept empty folder). |
| `infra/scripts/stack-reset.test.mjs` (new) | the §5 cases; `npm run test:infra` runs it |
| `infra/README.md` | the `stack:reset` row: "every entry of `infra/.data/cogniate-app/` (the folder stays, empty)" instead of the folder |

Required properties:
- Test `P` in the order of `prepare_content_folders`: link (`-L`), then directory (`-d`), then owner (`-O`).
- List the entries without following links, for example `find "$P" -mindepth 1 -maxdepth 1 -exec rm -rf {} +`. Do not use `find -L` or `-H`, a trailing `/` on a path, or a glob that skips dot names.
- A failed removal stops the script (`set -e`). Do not hide it.
- No new sleep, retry, Docker call, refusal code, `create_host_path` change or `lib.sh` change.

## 5. Unit and mutation controls (Author, no Docker)

Fixture: a scratch checkout whose root path contains a space; copies of `stack-reset.sh`, `lib.sh`, `storage-oplock.sh` and `storage-compat.sh`; a minimal `.env`; a fake `docker` first on `PATH` (it answers `info` and `ps`, lists nothing, and `compose … down` exits `FAKE_DOWN_EXIT`, default 0). No test calls the real Docker.

| Case | Setup | Expected |
| --- | --- | --- |
| U1 standard | `P` mode `0755` with `cogniate.db`, `cogniate.db-wal`, `.hidden`, `.hidden-dir/x`, `packages/p1/index.html`, `uploads/.tmp/u1`, and a link `linked` to an outside folder with one file. Also `infra/.data/` `lti-service/lti.db`, `backups/b`, `build-queue/requests/r`, `fixtures/f.zip`; `infra/.secrets/seed.json`, `infra/.secrets/app/k`, `infra/.logs/x.jsonl`, `infra/.certs/root.crt`. | exit 0. `P` has the same `dev` and `ino`, is a directory of the test user, mode `0700`, no entry. The outside folder and its file are unchanged (names, SHA-256, mode). `lti-service`, `backups`, `build-queue`, `seed.json`, `.secrets/app`, `.logs/x.jsonl` are absent. `.env`, `f.zip` and `root.crt` are unchanged (SHA-256). The success line is printed. The lock folder is gone. |
| U2 absent | no `P` | exit 0; `P` is still absent |
| U3 linked `P` | `P` is a link to an outside folder (mode `0750`) with files | exit 0; the path `P` is absent; the outside folder has the same names, SHA-256 and mode |
| U4 file `P` | `P` is a regular file | exit 0; `P` is absent |
| U5 refusal first | (a) `FAKE_DOWN_EXIT=1`; (b) the compatibility marker in `.tmp/compose.knobs.yaml` | exit not 0; the listing of `P` (names, types, SHA-256, `ino`, mode) is equal before and after |
| U6 cannot remove | `P` holds a folder with mode `0500` that holds a file (skip when the test runs as root; restore the mode in cleanup) | exit not 0; no success line |

A `P` of another owner needs root. Reviewers check that branch by reading; it is the old removal.

Each mutation must make at least one case fail. The Author reports the failing case for each mutation.

| Mutation | Caught by |
| --- | --- |
| remove `P` (the old line), or remove `P` and make it again | U1 (`ino`) |
| skip dot names (a glob without `dotglob`) | U1 (empty) |
| drop the link test on `P` | U3 |
| drop the mode step | U1 (mode) |
| move the rule before the Docker removal or before the guard | U5 |
| ignore a removal error (`\|\| true`) | U6 |
| make `P` when it is absent | U2 |

## 6. Targeted scratch reproduction (Author diagnostic; needs a Lead Docker grant)

The same gates and limits as diagnosis §6 and §10: G-1 identity match, W1–W4, owned label and name prefix, the cached pinned image with `--pull never`, `--rm`, `--network none`, read-only scratch binds only, one run after the other, no Compose project, no lane and no product stack. Each trial uses a new scratch checkout with copied scripts (hashes recorded). The reset runs the copied script with the fake `docker` of §5, so it changes no Docker object. `prepare_content_folders` runs from the copied `lib.sh`. The bounded retry (0.25 s to 5 s) only measures; it is not product behavior.

| Series | Steps | Expected |
| --- | --- | --- |
| RA (20) | `prepare_content_folders` makes `P`, `packages` and `uploads`; the trial writes marker `old` in `packages`, and `cogniate.db` and `.hidden` in `P`. After 2 s, a hold container binds `packages` and `uploads`. Run the **candidate** `stack-reset.sh`: `P` keeps its `ino` and is empty. Write `cogniate.db` into `P`. After 1.2 s, `prepare_content_folders`, then marker `new` in `packages`. At once, a probe binds `packages` and `uploads` and reads both markers. | 20/20 visible at the first try; `new` present, `old` `ENOENT` |
| RC control (5) | the same with the frozen `a784522` `stack-reset.sh` | 5/5 `bind source path does not exist`: the trial can see the fault |
| RD (20, optional) | as RA up to the hold run; then move `P` to a sibling folder (the `d-content-folder` fixture move); `prepare_content_folders`; marker `new`; probe at once | not known; see the rules below |

Decision rules:
- RA 20/20 with a fresh view, and RC 5/5 refused → go to §7. This gives no acceptance credit.
- Any RA refusal → stop: Option A does not remove the trigger. Report to the Lead. No retry or sleep fallback.
- Any stale view (RA or RD: `old` present or `new` absent) → stop and report a correctness finding.
- Any RC success → RA is not conclusive; report it.
- RD refused at least once → §8, `d-content-folder`.

RD justification: `d-content-folder` is a mandatory row in both rounds. Its second half moves `P` away and then runs `stack:up`. Option A does not change that. Without RD, the next full round is the first measurement, and a failure there stops the round. RD adds about 2 to 4 minutes to the same window.

## 7. Independent QA (targeted check before the full runs)

QA, independent of the Author, runs in a fresh QA lane on the repaired candidate SHA, with the W1–W4 boundary and the ADR-012 §15 lane rules. There are no added waits between the steps. QA's own `lstat`, listings, hashes and parsing are the oracles, not product output alone. QA writes a new report in `docs/reviews/M1/`. These checks are not AC rows and change no inventory.

| Check | Steps | Expected |
| --- | --- | --- |
| Q1 operator path, 3 cycles | `stack:up`. QA records `dev` and `ino` of `P` and plants `.qa-marker` in `P` and a file in `packages`. `stack:reset`, then at once `stack:up`. | Each reset: exit 0; `P` has the same `dev` and `ino`, is a directory of the host user, `0700`, with no entry; `lti-service` is absent; both exact lane volume names are absent; `.env`, `infra/.certs/*` and `infra/.data/fixtures` are unchanged. Each `stack:up`: exit 0 at its first run, both services healthy; `docker inspect` of `cogniate-app` shows the two nested binds with the exact host sources. |
| Q2 import refusal path | After a `stack:reset`, QA places its own synthetic legacy databases; the app database names a package folder that is absent. `stack:data-backup -- --source legacy`, then `stack:data-import`. | The import exits 1 with `content_missing` and one `storage_content_check` line, `result: "content_missing"`, that names the folder (so the maintenance container ran). No `bind source path does not exist`. The target stays `FRESH` (ADR-012 §11 item 5). Then QA adds the folder, makes a new legacy backup, and the import exits 0 with `result: "pass"`; `stack:up` exits 0. |

## 8. Acceptance and follow-ups

Acceptance (no gate changes). Order: 1, then 2 in parallel with 3, then 4 and 5.
1. Author: `npm run check` is green, with the §5 cases and the mutation record.
2. Reviewer-A and Reviewer-B, blind and independent: ADR-012 revision 3.4, this brief and the implementation diff together.
3. §6 RA and RC (diagnostic only).
4. §7 Q1 and Q2 PASS.
5. On the repaired candidate SHA, the existing AC-M3-01 gates: two full rounds of 488 rows with the same result per row, the legacy suites, the fresh M2 browser rows, three T7 runs and the G-1 identity binding. Every assertion, row id, label and count stays the same, also the exact `content_missing` assertions of `e-content-missing` and `e-old-schema`. Diagnostics give no credit.

Not in this repair:

| Item | Status |
| --- | --- |
| Option B: a `storage_refused` code for this Docker error | deferred (MINOR). Condition: a measured window bound, or a measured way to end the state. Then map only this error for the two content sources, with that measured next step; never `content_missing`. |
| Deletion or move of `P` by hand | stated limit (ADR-012 §15) |
| `d-content-folder`, second half | no change now. If RD refuses at least once, the Architect gives the Lead a bounded M1 and QA fixture proposal (candidate: QA moves away only `packages` and `uploads`, and `P` stays; `a-fresh` still covers the creation of `P`). A stale view instead is a correctness finding. |
| `build-queue` binds | the same delete-parent topology, but short syntax (`create_host_path` is not `false`). No failure is recorded: the T7 PASS at `aff4882` (2026-10-20) ran `e2e:reset` (reset, then up) before each run with this topology. Not measured; not changed. Q1 and T7 exercise it. |
| Index citations | `docs/architecture/README.md`, `tasks/README.md` and M1 cite revision 3.3. After acceptance, the Lead can authorize their update to 3.4. No row text changes. |
