Verdict: APPROVE
Round: 1

# T7 C10 repair batch and v3-c10 wrapper identity: Reviewer-B (lens B: can a human team own it?)

Reviewer: independent Reviewer-B. Task `task_7c674d6c271f`, dispatch `ctx_e2ac570ca7ae`, run `run_ebe671ad72a9`.
Date: 2026-10-23, about 16:03–16:20 UTC.
Scope: the C10 four-file T7 test batch (screenshot repair and clone-secret redaction) and the identity-only private wrapper copy `run-t7-window-v3-c10.sh`. The Lead extended the original two-file scope to four files in `msg_3508953383cd`.

The verdict APPROVE covers source, evidence-design and identity review only. It is NOT a runtime PASS.
The r8 attempt (`t7-attempt-r8-20261023T1510Z`) stays FAILED, and its failure scan stays FAILED.
A fresh preflight, a fresh attempt root, a new grant and the unchanged full T7 run must come before any T7 acceptance.
Findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT.

## 0. Model, independence and method

- Model: `claude-opus-5-5` (Claude Opus 5.5), as my session context states. Effort: the session environment has `CLAUDE_EFFORT=xhigh`. The Lead's `msg_3508953383cd` also states the launch as `claude-opus-5-5 xhigh`. I cannot see the effort setting in any other way.
- I did not read Reviewer-A's report, notes or messages. One `ls` of `R/notes` showed the folder name `t7-c10-reviewer-a`. My final `git status` showed the untracked file name `docs/reviews/M3/t7-c10-reviewer-a.md`. I opened neither.
- Before the Lead sent C10, I read the uncommitted test diff in this shared worktree as preparation only. All results below come from the commit objects, from private clones of C9 and C10, and from the frozen files at the hashes in §1.
- Host only. I ran no Docker command, no browser, no test run, no npm command and no network command. I changed no product, test, guide, team or other review file. I did not touch `pnpm-workspace.yaml`.
- Offline commands: `tsc --noEmit` and `playwright test --list` in private clones. `--list` loads the spec files but starts no browser. I also ran `node --check`, `bash -n` (syntax only, the wrapper did not run), and one Node check on synthetic values that imports the real C10 helper.
- Trace probe (§4): I streamed `0-trace.trace` / `1-trace.trace` from the failed r8 `trace.zip` files with `unzip -p` into a private script. I extracted no file to disk. The script prints only call ids, URL pathnames, click selectors and booleans, never values, URL queries or page text. The source `trace.zip` files are unchanged. For example, the run-2 A4 trace is still `ad5f9591…15be`.
- Private evidence: `R/notes/t7-c10-reviewer-b/` (R = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`). Folders are 0700, files 0600 and scripts 0700. `MANIFEST-reviewer-b.sha256` lists 22 files and does not list the two clones. The first `--list` attempt failed because macOS has no `timeout` command. I kept its two 37-byte error files (`pw-list-c9.txt`, `pw-list-c10.txt`), and the `-r2` files hold the real lists. The two clones there have a `tests/node_modules` symlink to this worktree's `tests/node_modules` (TypeScript 5.9.3, Playwright 1.56.0, lockfile `213718dd…56bc`, equal at C9 and C10).

## 1. Reviewed identities (verified by me)

| Item | Value |
| --- | --- |
| Product C6 | `4008afb92fe983d52db33442e060210b929966c8` |
| Base tests C9 | `9eb504f5bff4be7e291570fde12fdf9919a07fa1`, tests tree `667e83a9a6a0187d742eb68a17293e4b7302100f` |
| Candidate C10 | `97b68af439b6565f891042b20497b18aadca6a24` (parent `af2da195`), tree `04c0d748ef8739b1d86855ac8f7d7bbd4f85665e`, tests tree `ec2d86f590902ee99997d6ed2b78599dc3006072` |
| C10 blobs | `flows.ts` `7159f4f5…`, `2-scenario-b.spec.ts` `f243c855…`, `host/run-t7.mjs` `9e1b7398…`, `host/t7-env-secrets.mjs` `aaece121…` (new) |
| Unchanged shared blobs | `tests/host/lib.mjs` `fa61f2e7…`, `e2e.ts` `0808b917…`, `moodle.ts` `894b500a…`, `learner.ts` `65e608bf…`, `portal.ts` `0ffde7e2…` |
| Original wrapper v3 | `R/notes/scripts/run-t7-window-v3.sh`, 27,362 B, 0700, `70d3363406d1eece764646afc72bec821be34f2aa5e4b051004ac92ab7bda71f` (preserved) |
| New wrapper v3-c10 | `R/notes/scripts/run-t7-window-v3-c10.sh`, 27,486 B, 0700, `a9ac8f5632ad67cdd9d0e25da07f61c143589944826e8e6bab68cc5ac1fb8f96` |
| Frozen C10 source | `R/notes/t7-c10-frozen/source`: detached HEAD `97b68af4…`, tree `04c0d748…`, clean status including ignored files |
| Finalization manifest | `R/notes/t7-c10-finalization/r1/MANIFEST-finalization.sha256`, 2,374 B, `42a81af79df2e57f8298bb7c2ce8ccc371a1b83083df8f540b27e6fee1df2327`, 12/12 entries verified |
| Qualified r2 manifest | `MANIFEST-candidate-r2.sha256`, 8,577 B, `e4f60300…b05c`, 42/42 entries verified by size, hash and mode |
| Host-ready manifest | `R/notes/MANIFEST-host-ready.sha256`, 84/84 entries verified (includes `observe2.mjs` `d60dc920…`, `prepare-checkout.mjs`, `t7-gate.mjs`, `secret-scan.mjs`, runlog tools, `t7-capture-watch.mjs`, `preready-btw03.mjs`, `anon-check.mjs`) |
| Design inputs | diagnosis v2 `5d07c950…2236` (7,633 B); redaction decision v2 `db7d6c67…064a` (5,743 B) |

## 2. Acceptance checks

| Check | Result |
| --- | --- |
| Exact C9→C10 test diff | PASS. `git diff --name-status C9 C10` outside `docs/**` lists exactly the four files: M `2-scenario-b.spec.ts`, M `host/run-t7.mjs`, A `host/t7-env-secrets.mjs`, M `lib/flows.ts`. The C10 commit itself touches only these four. |
| Product equality with C6 | PASS. No difference outside `docs/**` and `tests/**`. The `services`, `apps`, `packages` and `infra` trees are equal, and the root file list is equal. |
| Typecheck | PASS. `tsc --noEmit -p tsconfig.json` exit 0 and empty output at C9 and at C10. |
| `.mjs` syntax | PASS. `node --check` on `run-t7.mjs` and `t7-env-secrets.mjs` exit 0. (`tsconfig` does not cover `.mjs`.) |
| Title inventory | PASS. `QA_SUITE=e2e playwright test --list`: "18 tests in 6 files". The output is byte-identical at C9 and C10, including file:line:column. That is 17 default tests plus the DEMO test. A static extraction gives the same 18 titles. |
| Forbidden changes | PASS. The changed lines add no `force`, `dispatchEvent`, `requestSubmit`, keyboard submit, timeout, retry, deadline, sleep or wait for a Moodle class. They change no `expect(…)` and no `test(…)` title. `saveAndReturn` and `cancelActivityForm` are unchanged. |
| M2, M1 and legacy import closure | PASS. My static resolver of relative imports over all 251 `tests/**` files at C10 finds the following. The M2 closure (15 entry files, 36 files in total) has none of the four edited files. The M1, legacy and other closure (199 entries, 201 files) has none. The only importer of `t7-env-secrets.mjs` is `run-t7.mjs`. The only importers of `flows.ts` are the scenario A and B specs. Playwright configs: T7 `testMatch **/*.spec.ts` under `e2e/`; M2 `**/*.m2.ts` only. |
| Screenshot evidence | PASS (§3). The evidence names, the folder, the attachment names and the return value are the same. |
| Redaction batch | PASS (§5). No scanner weakening. |
| Wrapper identity | PASS (§6). Exactly seven permitted lines. |
| Qualified dependency hashes | PASS. The r2 manifest (42/42) and the host-ready manifest (84/84) match by size, hash and mode. The original v3 is one of the 42. |

## 3. Screenshot repair: evidence and maintenance

- `viewportShot` (`tests/e2e/lib/flows.ts:12-19`) has the same output as `shot` (`tests/e2e/lib/e2e.ts:132-138`), except that it captures only the viewport. It uses the same `EVIDENCE` folder, the same name rule `name.replace(/[^\w.-]+/g, '_')`, the same attachment name and content type, and the same return path relative to `ART`. So the evidence file names and the report attachments do not change.
- `shot` falls back to a viewport capture when the full-page capture fails. `viewportShot` has no fallback. A failure in it fails the test, the same way a failed fallback in `shot` does. This is acceptable.
- Activity form (`flows.ts:32-33`): the step scrolls `#id_activitycompletionheader` into view, then captures the viewport. QA cites `A4-*-activity-form.png` only for AC-T7-05 (completion "Receive a grade"), in `docs/reviews/T7/qa.md:28`. The new image centres the completion section, so the evidence for that claim stays clear. It may no longer show the activity name. An assertion already checks the name (`flows.ts:30`), and the T7 spec (`docs/architecture/tasks/T7.md`) requires no full-page form image.
- The scroll is a Playwright action with the existing 15 s `actionTimeout`. It is not a wait for Moodle state. The diagnosis v2 permits it.
- B5 picker (`2-scenario-b.spec.ts:199`): the open picker modal is in the viewport. `B5-picker-thanh.png` supports AC-T7-08 together with `summary.json` (`pickers`), and the assertion uses `picker.titles`. The evidence keeps its meaning.

## 4. Trace probe: are other screenshots exposed?

The diagnosis says that only two full-page captures come immediately before a sticky-footer click. I checked this claim on the failed r8 traces (runs 1–3; tests A1-A2, A4, B1-B2, B4 and B5).

| Capture | Page | `hasstickyfooter` before → after | Next click | Cases |
| --- | --- | --- | --- | --- |
| `${pickerKey}-picker` (`flows.ts:28`, full page, unchanged) | `/course/modedit.php`, modal open | true → true in every case | "Add to Moodle" in the picker, not in the footer | 10/10 kept |
| `${pickerKey}-activity-form` (now viewport) | `/course/modedit.php` | true → true in 8 cases; true → false in run-2 A4 (`call@1812`) | "Save and return to course", inside `#sticky-footer` | 1/9 lost; then 30 "outside of the viewport" log lines |
| `B5-picker-thanh` (now viewport) | `/course/modedit.php` | true → true | modal close, then footer Cancel | 2/2 kept (run 2 B5 did not reach it) |
| `readToolSettings` captures (A2/B2, unchanged) | `/mod/lti/toolconfigure.php`, `/mod/lti/typessettings.php` | false → false | Cancel or tool card | no sticky footer on these pages |

- Result: the two edited captures are the only exposed ones. This agrees with the diagnosis. The probe also reproduces the diagnosis facts for run-2 A4.
- The mechanism stays inferred. The probe shows the class change at the capture boundary. It does not show why the class did not come back. The next runtime must still inspect the A4, B4 and B5 sticky-footer clicks in each run for "outside of the viewport" retries.

## 5. Redaction batch (`run-t7.mjs`, `t7-env-secrets.mjs`)

- `run-t7.mjs` changes in exactly two lines: the new import (`:25`) and the condition in `addSecretsFromClone` (`:112`). `secretsInFile` registration, the compose call, its log, and the runner steps, arguments and deadlines are unchanged.
- `isCloneEnvSecret` is pure and has no side effects. It is the C9 rule OR the unchanged shared `isSecretCandidate`. My synthetic check imports the real C10 module (12 keys, values made up) and gives these results:
  - It is an exact union, and a strict superset of the C9 rule.
  - `DB_PASS` is added (C9 false, C10 true).
  - An all-digit `*_PASSWORD` value and a `KEY` value that starts with `/` stay redacted only because of the C9 part of the union. This confirms the reason for the union in the decision v2.
  - `COMPOSE_PROJECT_NAME=qa-e2e-m3-r3`, `STACK_SUBNET`, `PUBLIC_PORT`, the `PUBLIC_*_URL` values and an absolute path stay unredacted. So the runner summary and step notes keep the project name.
- `gen-env.sh` (C6) writes the nine secret keys and the public keys listed in `.env.example`. Only `DB_PASS` was outside the C9 rule. `DB_PASS` is `hex 16`, so random collisions in logs are not a real risk.
- No scanner weakening. The scanner `secret-scan.mjs` (`29b811ad…`) is unchanged. It loads `tests/host/lib.mjs` from the C10 host checkout, and that blob is unchanged (`fa61f2e7…`). `t7-gate.mjs` (`33ef3b93…`) is unchanged. The wrapper's T14 scan targets are unchanged.
- I did not re-run or hash-check QA's synthetic controls (selftest-v2: script `6a9dafe7…`, results `5f20a4a4…`). My synthetic check is independent of them. The runtime proof is still the standard scan with 0 shared hits, including `cmd/03-compose-config-name.log`.

## 6. Wrapper v3 → v3-c10 (identity only)

`diff` shows exactly seven changed lines and nothing else:

| Line | Change | Assessment |
| --- | --- | --- |
| 32 | `SHA` C8 → C10 | permitted |
| 284 | comment "C8 checkouts" → "C10 checkouts" | permitted (text only) |
| 287 | `prepare-checkout --source "$FROZEN_R/source"` → absolute `…/notes/t7-c10-frozen/source` | permitted new frozen-source path (NIT B-C10-02) |
| 295 | `DEST` prefix `qa-e2e-m3-r3-5561e8f7-` → `-97b68af4-` | permitted (clone folder name) |
| 396 | artifact glob `qa-e2e-m3-r3-5561e8f7-*` → `-97b68af4-*` | required. `run-t7.mjs:73` builds `RUN_ID` from `PROJECT` and `sha.slice(0, 8)` |
| 577 | `m2Sha: SHA` → literal C8 `5561e8f7…` | permitted by Lead `msg_26ca06b0cb76` (accepted M2 stays C8) |
| 578 | tree note C8 → "C10 (97b68af4) is tree-identical to C6 (4008afb9) outside docs/** and tests/**" | true (§2) |

- `PREV_W4` handling is byte-identical. This covers the 19,913-byte and `544142a1…38fd` checks in the grant guard and in the T0 baseline step, the `stage`, `liveness` and `problems` predicates, the T0 record and the evidence fields.
- Every other line is byte-identical. This includes the root claim, the guards, the deadlines, the lane flags, the image refs, `RUNENV`, the observer hash pin, the tool paths and arguments, the T0–T14 order, cleanup, the exit codes and the B-TW-02 assertions.
- `testSha` and `sha` now resolve to C10. `productSha` stays C6.
- `bash -n` exits 0. The original v3 is preserved at its hash, and the r2 manifest still verifies it.
- The frozen source is clean at detached HEAD C10. C10 is also an ancestor of its branch ref, so `prepare-checkout`'s `git clone` + `checkout --detach` can reach it. None of the qualified tools that the wrapper calls pins C8 test bytes. `prepare-checkout`, `preready-btw03`, `lane-watch-r5` and `t7-gate` check HEAD against `--sha`, or check counts. `lane-watch` derives the runner path from `--source`.

## 7. Findings

### B-C10-01 — NIT — `tests/e2e/lib/flows.ts:12`

- Problem: `viewportShot` copies the name rule and folder logic of `shot`. Its comment does not say why it lives in `flows.ts` (`e2e.ts` is shared with M2 and must stay unchanged). It also does not say that its name rule must stay equal to `shot`'s rule so that evidence names do not change.
- Evidence: `flows.ts:12-19` compared with `e2e.ts:132-138`.
- Fix: add one comment line in a later tests batch. Do not change C10 for this.

### B-C10-02 — NIT — `R/notes/scripts/run-t7-window-v3-c10.sh:287`

- Problem: the new frozen-source path is an absolute literal. Every other path in the script is `"$FROZEN_R/…"`.
- Evidence: the literal has the same prefix as `FROZEN_R` (line 10), so the runtime argument is identical. There is no behaviour difference.
- Fix: none now, because any edit needs a new identity review. Use `"$FROZEN_R/notes/…"` in a future copy.

### Observations (not findings)

- O-1: `flows.ts:28` keeps a full-page picker capture before modal interactions. The traces in §4 show that it kept the class in 10 of 10 cases. The runtime trace check stays required.
- O-2: The shared rule (and so the scanner) does not detect all-digit values or values that start with `/`. This is older than C10 and C10 does not change it. The union keeps runner redaction for those values. It is out of this scope.

## 8. What remains (not covered by this review)

- A fresh preflight, a fresh `t7-attempt-*` root, a new grant, and then one T7 invocation with the unchanged acceptance. That is: 3 × 17 PASS, only the DEMO skip, all 15 criteria, the demo within 180 s, four confirmations, keep and teardown proof, B-TW-02, the scans with 0 shared hits, and W3/W4, the sampler and all 32 full records.
- The A4, B4 and B5 sticky-footer click traces must show no "outside of the viewport" retries.
- Final architecture conformance, guide claims, Docs QA and the final reviews stay held. No push. The Lead commits this file by path.
