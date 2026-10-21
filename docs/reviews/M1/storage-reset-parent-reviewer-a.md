Verdict: APPROVE
Round: 1

# Reviewer-A: storage reset content-parent repair (design and implementation together)

Reviewer: Reviewer-A (lens: "Is it right and is it safe?"). Fresh Claude Code Opus 5.5, xhigh. Blind: I did not read the Reviewer-B report or messages. Task `task_86a33c4d75b4`, dispatch `ctx_951c013113e5`. Date: 2026-10-21.

**Scope of this approval: source only.** This verdict covers the design text and the three product files. It gives no runtime credit. The RA and RC diagnostics, Q1 and Q2, and every existing AC-M3-01 gate stay open (§6).

## 1. What I reviewed

| Item | Pin |
| --- | --- |
| Candidate (product) | `89fb4b48ee388faff3060fe1a161a9f9d064de93` (product diff = commit `89fb4b4` only) |
| Design | `35d093d7a807391e779edf514d4ad2b63e8e0e66`: ADR-012 revision 3.4 (§3, §7, §15, §16) and `docs/architecture/tasks/storage-reset-parent-repair.md` |
| `infra/scripts/stack-reset.sh` | SHA-256 `aad3fbc1f0c48b884bcb410ca4995f2eae42dda80f2ffa2443c6b4d770f48e10` |
| `infra/scripts/stack-reset.test.mjs` (new) | SHA-256 `509157fc609b4d94c910760b7283a626a99359c42e919194072c856e6bd232e2` |
| `infra/README.md` (only the `stack:reset` row changes) | SHA-256 `a6de93d9bf5d23ce83076941fc526db3a518f128f20967116a93bf24f8c65efc` |
| Tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` at the candidate and at `HEAD` `6b1a814` (only `docs/team/**` differs after the candidate) |
| Read only, unchanged | `infra/scripts/lib.sh` (`prepare_content_folders`, `confirm_stack_delete`, `require_own_project`, `stop_build_runner`), `storage-oplock.sh` (traps), `e2e-reset.sh`, `qa-suite.sh`, `build-runner.sh`, `stack-data.mjs` (`legacySet`, `legacyDecide`), `infra/compose.yaml` binds, the `tests/**` rows that touch `P` |

The three file hashes are equal to the hashes in the Author report (`AUTHOR-REPORT.md`, SHA-256 `ab4fbdd3…1a5`). I read that report only after my own code and spec assessment.

`P` below is `infra/.data/cogniate-app`.

## 2. Method

1. I read the brief, the ADR-012 diff and the product diff. Then I read the unchanged callers and helpers.
2. I compared the rule in `stack-reset.sh` with the ADR §15 table, with brief §3 and §4, and with `prepare_content_folders`.
3. Host-only probes, in a new private scratch folder (`umask 077`, mode `0700`), with `/usr/bin/find` under `/bin/bash --noprofile --norc` (macOS 27.0.1, bash 3.2.57). There was no Docker daemon command and no stack.
4. I ran the candidate script and the parent-commit script (`89fb4b4~1`) on three failure edges. Each run used a copied checkout with a space in its path and a fake `docker` first on `PATH`.
5. I ran `node --test infra/scripts/stack-reset.test.mjs` once (8 pass, 0 fail, 0 skip). I did not repeat the broad root or infra checks.

## 3. Findings

| ID | Severity | Short |
| --- | --- | --- |
| A-SRP-01 | MINOR | ADR §15 "Failure" says the other removals do not change, but the reset now stops at the first failed host removal |
| A-SRP-02 | NIT | "the product reset never makes topology R2" needs its exact scope |
| A-SRP-03 | NIT | Three old phrases still say that the old app bind folder goes, or claim that `uploads` was measured |

There is no BLOCKER and no MAJOR.

### A-SRP-01 (MINOR): the failure contract does not state the stop at the first failed host removal

- **Where.** `infra/scripts/stack-reset.sh:38`, `:44-52`. `docs/architecture/adr/ADR-012-sqlite-volume-storage.md:706`. Brief `storage-reset-parent-repair.md:48` (row "Data erasure") and `:55` (row "Partial Docker removal").
- **Problem.** The old line removed six paths with one `rm -rf` and tried all of them. The candidate splits this into three steps: four paths (line 38), then the `P` rule (lines 44-51), then `infra/.logs` (line 52). Under `set -e`, a failure in an earlier step skips the later steps. ADR §15 says "The other removals of `stack:reset` do not change". That is true only on the success path. Brief §3 says the data erasure is "the same", which also describes only a success.
- **Evidence (scratch probe, fake `docker`).** Setup: `infra/.data/lti-service/locked/` has mode `0500` and holds a file. `P` holds `cogniate.db` and `packages/`. `infra/.logs/x.jsonl` exists.

  | Script | Exit | Success line | `P` after | `infra/.logs` after |
  | --- | --- | --- | --- | --- |
  | candidate `89fb4b4` | 1 | no | `cogniate.db`, `packages` (not attempted) | `x.jsonl` kept, plus the lock release line |
  | parent `89fb4b4~1` | 1 | no | absent | only the lock release line |

  Also, when the `P` rule fails (U6), line 52 does not run, so `infra/.logs` stays.
- **Safety assessment.** It is safe. Both versions exit 1 with no success line. The reset is not a recovery step (ADR-012 §9). The kept legacy files make the next `stack:up` refuse (`legacy_present`, L5) or fail closed in another way. They do not lead to a silent wrong state. `e2e-reset.sh:29` runs the reset under `set -e`, so a failed reset stops `e2e:reset` and `test:e2e`. No caller ignores the exit code. This follows brief §4 ("A failed removal stops the script (`set -e`)") and the Lead's KEEP-SPLIT decision `msg_2583d56e6293`. I do not ask for a code change.
- **Why it still needs a fix.** The normative ADR sentence and the actual failure behaviour disagree. An operator, or a later QA oracle, that reads §15 can expect best-effort removal after a failure.
- **Narrow remedy (Architect, text only).** In ADR §15 "Failure", replace the last sentence with: "A failed host removal stops the reset at that step (`set -e`). Later paths, also the `P` rule and `infra/.logs`, are not attempted. Fix the cause and run `stack:reset` again." Add the same sentence to the brief §3 table, or put "on success" in the "Data erasure" row. Optional (Author): add one U6 assertion that `infra/.logs` is still present. That makes the split visible to a mutation that joins the lines again.

### A-SRP-02 (NIT): scope of "the product reset never makes topology R2"

- **Where.** Brief `storage-reset-parent-repair.md:35`. Related: `stack-reset.sh:45`, `lib.sh:355`, ADR-012:708 (Limit).
- **Assessment.** For every `P` that the product could have bound, the claim is correct. The reset keeps `P` only for this exact test: `[[ -L ]] || { [[ -e ]] && { [[ ! -d ]] || [[ ! -O ]]; }; }`, false. That expression is the same as the refusal test of `prepare_content_folders` (`lib.sh:355`). So the "keep" set of the reset is the "accept" set of the start. A nested bind under `P` exists only if the start accepted `P`. A linked `P`, a non-directory `P` or a `P` of another owner after a bind can come only from a change by hand, and the §15 Limit already names that.
- **Gap.** `-O` compares with the effective user of the reset process. If a user runs the reset as another user (for example `sudo npm run stack:reset`), a `P` of the host user counts as "another owner". The reset then deletes `P`, and the next start by the host user can meet R2. This is not a practical mode (all other scripts assume the host user), but "never" does not say so.
- **Remedy (Architect, one sentence).** "For a `P` that the product made and bound (a real directory of the user who runs the reset), the product reset never makes topology R2. A `P` of another type, or a reset by another user, still deletes `P` (§15 Limit)."

### A-SRP-03 (NIT): old wording and one claim about what was measured

- `infra/scripts/stack-reset.sh:11`: "It also removes … the legacy bind folders and the content folders". Before ADR-012, `P` was the app's bind folder at `/data` (ADR-012:581). It now stays. Suggested text: "the legacy bind folder `infra/.data/lti-service`, every entry of `infra/.data/cogniate-app` and the content folders".
- `infra/scripts/stack-reset.sh:39`: "Docker Desktop did not see a new packages/ or uploads/". The R2 trials bound only `packages` (brief §2: `uploads` is an inference that RA measures). Suggested text: "a new packages/ (measured; uploads/ has the same topology)".
- `infra/README.md:94` (outside the one row that brief §4 allows): "`stack:reset` deletes … the old bind folders" now conflicts with the changed row at line 49. The Lead can defer this or give it to the README owner.
- No change is needed in `lib.sh:249-255`. "It keeps .env, infra/.certs/ and infra/.data/fixtures/" lists data, and the kept `P` is empty. The brief says that `lib.sh` does not change.

## 4. Properties checked (no finding)

| Property | Result | Evidence |
| --- | --- | --- |
| Guard order | The guard, the lock, `require_docker`, `require_own_project`, the build-runner stop and sweep, and a successful Docker removal (`down -v`, or the label removal without `.env` and with an explicit project) all run before the rule. A failure before the rule leaves `P` unchanged. | `stack-reset.sh:14-35`; U5 (a) failed `down`, (b) compat marker, (c) other checkout: the `P` snapshot (names, types, SHA-256, inode, mode) is equal. Mutations M5a/M5b were detected (Author record). |
| Test order and keep set | link (`-L`), then exists and directory (`-d`), then owner (`-O`), in this order. The expression is the same as `prepare_content_folders` (`lib.sh:355`). | Read. All seven `lstat` cases traced: absent, dangling link, link to a folder, file, FIFO, folder of another owner, own folder. |
| Absent `P` | It stays absent. The success line does not name the folder. | `stack-reset.sh:47` (`elif -d`); U2; mutation M7. |
| Linked `P` | The link is removed as a link (no trailing `/`). The target keeps its names, SHA-256, inode and mode. | `:46`; U3; mutation M3. |
| Non-directory `P` and `P` of another owner | `rm -rf "$content"`, the old removal. | `:45-46`; U4. The other-owner case needs root: I checked it by reading. It is the old line. |
| Every entry removed, dot names too | `find "$content" -mindepth 1 -maxdepth 1 -exec rm -rf {} +`: no `-L`/`-H`, no glob, no trailing `/`. | U1 (`.hidden`, `.hidden-dir`, `uploads/.tmp`). My probe also removed `-rf`, a name with a newline, a FIFO, `..x`, `.-`, a dangling link and a link to a folder. The link target stayed unchanged. |
| Links inside `P` | `rm -rf` on an entry that is a link removes the link only. | U1 `linked`; probe 4. |
| Linked start point (race view) | `/usr/bin/find` without `-H` lists nothing under a link start point. A swap of `P` to a link after the test cannot make `find` delete outside entries. | Probe 5. Residual risk: in that same-user race, `chmod 700` follows the link and changes only the mode of a target that the user owns. This needs a concurrent process of the same user while the lock is held. This is outside the threat model, so I give no finding. |
| Inode preservation | `find`/`rm` remove only entries. `chmod` keeps the inode. A second reset keeps the same inode. | U1 (`dev`, `ino`, twice); mutations M1a/M1b. |
| Mode `0700` | `chmod 700` after the removal (unconditional; the same result as "if it is not `0700`"). | U1 (`0755` → `0700`); mutation M4. Probe 7: an empty own `P` with mode `0500` ends as `0700`, exit 0. |
| Fail closed | `find -exec … +` returns non-zero when an `rm` fails. The other entries still go. The script stops before `chmod` and the success line. An unreadable own `P` (`0300`, `0000`) also gives exit 1 with no success line, the same as the old `rm -rf` (side-by-side run). | Probes 1, 2, 3, 6; U6; mutation M6. Errexit applies inside an `if`/`elif` body. |
| No new Docker call, delay, retry or `lib.sh` change | The diff touches only the three files. U1 asserts the exact Docker call list: `ps`, `info`, `ps`, `compose … down -v --remove-orphans`. | `git show --stat 89fb4b4`; U1. |
| No outside removal | Only links are removed, never their targets. | U1, U3, probe 4. An ancestor link (`infra` or `infra/.data` as a link) was outside the checkout before this change too, and the brief does not change it. |
| Other product writers of `P` | Only `stack:reset` removes or moves `P`. `stack-data.mjs` removes only inside the volumes. `build-runner.sh` reads `uploads` and is stopped first. Its `sweep` does not make `P`. | `grep` over `infra/scripts`; `build-runner.sh:31`, `:137`; `lib.sh:316-325`. |
| Legacy scan with an empty kept `P` | `legacySet` returns `[]` for an empty folder, the same as for an absent folder. So row L4 is unchanged. | `stack-data.mjs:83-90`, `:107-120`. |
| `confirm_stack_delete` | After a reset and no start, the empty `P` now makes `e2e:reset`/`test:e2e` ask. Without a terminal and without `--yes`, they stop. That is fail closed. The T7 runner and the storage rows pass `--yes`. The T7 confirm checks run while the stack has data, so they do not change. | `lib.sh:249`; `tests/e2e/host/run-t7.mjs:235`, `:260`, `:296-325`; `tests/host/storage-rows.mjs:464`. |
| QA assertions (read only, `4c7e067`) | No assertion needs `P` to be absent after a reset. `a-fresh` checks `0700` and the host user, and the rule keeps both. `b-sequence` checks only the volumes. `d-content-folder` moves `P` by hand (brief §8 follow-up, RD). | `storage-rows.mjs:301-304`, `:571-579`, `:1004-1006`; `run-t1.mjs:797-839`. |
| Success line | It names the kept empty folder only when `P` was kept. No product or test code parses the old text. | `stack-reset.sh:44`, `:50`, `:53`; `grep` over `tests`, `infra`, `services`, `apps`, `packages`. |
| README row | Only the `stack:reset` row changes. The text matches the rule. | `git show 89fb4b4 -- infra/README.md`. |
| Unit test quality | Every brief §5 case is present (U5 has one extra case, other checkout). The path has a space. The fake `docker` refuses unknown commands (exit 3). The cleanup restores modes without following links. The U6 message pattern also matches GNU `rm`. | `stack-reset.test.mjs`. 8/8 pass in my single run. |

## 5. Proven, inferred and pending (kept separate)

**Measured on one host (diagnosis §10, SHA-256 `5ebbdc45…98e2`; trials `d67c404b…22df`):** R1 (new parent and new child) 20/20 visible. R2 (parent deleted and made again, then a new child) 20/20 refused, with no recovery after 5.1 s. R3 (parent kept, child made again) 20/20 visible. R3b 20/20 `ENOENT` (no stale view). The M1-41 failure matches R2. Each trial bound only `packages`, with a short `--rm` container. That matches the product order: `down -v` removes the containers before the rule runs.

**Shown by code and unit tests (no Docker):** the reset keeps the inode of an own `P`, empties it, sets `0700`, and makes no new Docker call. So the product reset no longer deletes a `P` that a container could have bound (A-SRP-02 gives the exact scope).

**Inference, not measured:**
- After the repair, a product reset followed by a start gives the R3 view for both `packages` and `uploads`, with legacy files in `P` before the reset (RA must measure this).
- A real mode change of a kept `P` (for example `0755` → `0700`) does not change the daemon view. RA starts from `0700`, so its `chmod` changes only the ctime.
- The other maintenance paths and `stack:reset` → `stack:up` (Q1, Q2, T7).
- The `build-queue` topology (brief §8).
- The explanation that the old layout was R3.

**Pending (no credit from this review):** §6 RA 20/20 with a fresh view and RC 5/5 refused (diagnostic only). §7 Q1 (three cycles) and Q2. On the repaired SHA, the AC-M3-01 gates: two full rounds of 488 rows with the same result per row, the legacy suites, the fresh M2 browser rows, three T7 runs and the G-1 identity binding. Every assertion, row id, label and count stays the same, and I waive none.

## 6. Verdict

APPROVE for the source and the design text. There is no open BLOCKER or MAJOR. A-SRP-01 (MINOR) is a contract text precision item. The Lead can fix it with one Architect sentence, or defer it to `docs/human_review/deferred.md`. A-SRP-02 and A-SRP-03 are NITs. Runtime acceptance stays pending under brief §8 items 3 to 5.
