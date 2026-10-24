Verdict: APPROVE
Round: 1

# T7 C10 repair and identity-only wrapper copy: Reviewer-A

Reviewer-A, lens "Is it right and is it safe?" (correctness, kept acceptance, safe identity binding).
Model: `claude-opus-5-5` (Claude Opus 5.5), as the session reports it. I cannot observe my effort setting from inside the session. The Lead's launch receipt (`msg_9b6a750c86bd`) records `xhigh`.
Task `task_f9a288ecf478`, dispatch `ctx_369dec2e4116`. Review finished at about 16:20 UTC on 2026-10-23.
Blind: I did not read Reviewer-B's report or messages.

This is a source and identity review on the host only. I ran no Docker command, no browser, no stack, no T7 runner and no network call. I did not execute or source either wrapper. **This review does not give a runtime PASS.** A new T7 invocation with a fresh preflight, a fresh root and a new grant is still necessary.

## 1. Reviewed identities (exact)

| Item | Value |
| --- | --- |
| C10 commit | `97b68af439b6565f891042b20497b18aadca6a24` (parent `af2da195…`, "test: stabilize T7 screenshots and redact clone secrets") |
| C10 root tree / tests tree | `04c0d748ef8739b1d86855ac8f7d7bbd4f85665e` / `ec2d86f590902ee99997d6ed2b78599dc3006072` |
| C9 base / tests tree | `9eb504f5bff4be7e291570fde12fdf9919a07fa1` / `667e83a9a6a0187d742eb68a17293e4b7302100f` |
| Product C6 | `4008afb92fe983d52db33442e060210b929966c8` (tree `6c8f7925…`) |
| `tests/e2e/lib/flows.ts` at C10 | SHA-256 `e8577c878240146d070d7b13a7901f2b56ee189a0d12cfc61861d60084c476a2` |
| `tests/e2e/2-scenario-b.spec.ts` at C10 | SHA-256 `ff7cd8c34bbc6f5785bad3dad8c89a4a984b30a711dfaf824e3868d40e50c00a` |
| `tests/e2e/host/run-t7.mjs` at C10 | SHA-256 `a23659dfb8f02e7d3a5dcf8020bff05a877217ea39703fa6043773ac84ab2c03` |
| `tests/e2e/host/t7-env-secrets.mjs` at C10 (new) | SHA-256 `f9b538de16a59da79928dd5ccffea20b8234103acd045aeb5a19730b13bebba4` |
| Original wrapper `R/notes/scripts/run-t7-window-v3.sh` | 27,362 B, 0700, `70d3363406d1eece764646afc72bec821be34f2aa5e4b051004ac92ab7bda71f` (unchanged) |
| New wrapper `R/notes/scripts/run-t7-window-v3-c10.sh` | 27,486 B, 0700, `a9ac8f5632ad67cdd9d0e25da07f61c143589944826e8e6bab68cc5ac1fb8f96` |
| Frozen source `R/notes/t7-c10-frozen/source` | detached HEAD = C10, root and tests trees equal C10, clean |
| Substitution map / input bindings | `803cf8da…2dc5` / `99f8c649…cd89b` |
| Finalization manifest / identity diff | `42a81af7…2327` (2,374 B) / `162105e9…da94` (hashes only; I used my own checks) |
| Design inputs | diagnosis v2 `5d07c950…2236`; Architect redaction decision v2 `db7d6c67…064a` |

`R` = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`.

## 2. Scope

The Lead widened the scope in `msg_a8dff19b2a7c` from two files to four:

- the screenshot repair in `tests/e2e/lib/flows.ts` and `tests/e2e/2-scenario-b.spec.ts`;
- the runner redaction repair in `tests/e2e/host/run-t7.mjs` and the new `tests/e2e/host/t7-env-secrets.mjs`;
- the identity-only copy of the private v3 wrapper.

I did not reopen the accepted product, the host-tool qualification, or the M1, M2 and legacy results.

## 3. Checks and results

### 3.1 Test diff C9 → C10

- **PASS. The tests delta has exactly four files:** `M flows.ts`, `M 2-scenario-b.spec.ts`, `M run-t7.mjs`, `A t7-env-secrets.mjs`. The non-docs delta is the same four files. The other changes are in `docs/**` only. C10 descends from C9.
- **PASS. Product equality:** `git diff C6 C10 -- . ':!docs/**' ':!tests/**'` is empty. The frozen source gives the same empty result.
- **PASS. `flows.ts`:**
  - It adds `viewportShot()`. The function uses the same `EVIDENCE` folder and the same name rule (`/[^\w.-]+/g` → `_`). It uses the same attachment name and `image/png` type, and gives the same `ART`-relative return value as `shot()` (`e2e.ts:132-138`). Only `fullPage: false` is different.
  - `shot()` falls back to a viewport capture if a capture fails. `viewportShot()` makes that same viewport call once, so the failure surface does not change.
  - Only line 33 (`${pickerKey}-activity-form`) now uses `viewportShot()`. Line 32 scrolls `#id_activitycompletionheader` into view first, as the design prescribes.
  - The header id is real: `setCompletionReceiveGrade` (`moodle.ts:426-428`) uses it and passed in every A4 and B4 run so far.
- **PASS. `2-scenario-b.spec.ts`:** only the import line and line 199 (`B5-picker-thanh`) change.
- **PASS. `run-t7.mjs`:** only the import (line 25) and the line-112 condition change. The `secretsInFile` line, the compose call and all steps, arguments and assertions are unchanged.
- **PASS. `t7-env-secrets.mjs`:** it is the Architect's v2 text, byte for byte. It is pure and exports only `isCloneEnvSecret`.
- **PASS. Forbidden changes:** the diff adds no `force`, `dispatchEvent`, `requestSubmit`, keyboard submit, `waitForTimeout`, sleep, retry, explicit timeout, deadline, assertion or title change. The only added wait is the bounded `scrollIntoViewIfNeeded()`, which uses the configured 15 s `actionTimeout`. It does not wait for a Moodle class.
- **PASS. Shared helpers unchanged:** `e2e.ts`, `moodle.ts`, `learner.ts`, `portal.ts` and `tests/host/lib.mjs` are unchanged (the tree diff shows no other file). `lib.mjs` at C10 is byte-identical to C9.

### 3.2 Static checks (private archive of C10, existing lockfile-consistent `tests/node_modules`, offline)

- **PASS. Typecheck:** `tsc --noEmit -p tests/tsconfig.json` exits 0. A control at C9 also exits 0. `--listFilesOnly` confirms that the check includes `flows.ts` and `2-scenario-b.spec.ts`.
- **PASS. Syntax:** `node --check` passes for `run-t7.mjs` and `t7-env-secrets.mjs`. The tsconfig does not include `.mjs` files.
- **PASS. Titles:** the T7 suite (`tests/e2e/**/*.spec.ts`) has 18 `test(...)` titles at C9 and C10: 17 non-DEMO titles and `DEMO AC-T7-15`. The inventory, including each `test.setTimeout(...)` line, is identical (SHA-256 `ce55d44b…d027`). The runtime gate (`t7-gate.mjs:22`) still needs 17 PASS, 0 FAIL and 1 DEMO SKIP in each run.
- **PASS. M2 import closure:** my static closure from `run-m2.mjs` and every `tests/e2e/M2/*` entry has 36 files and no unresolved imports. It is identical at C9 and C10 and contains none of the four files. The closure of all `tests/host/*.mjs` (M1 and legacy runners) also contains none of them.
- **PASS. Who imports the new code:** only `run-t7.mjs` imports `t7-env-secrets.mjs`. Only `1-scenario-a.spec.ts` and `2-scenario-b.spec.ts` import `flows.ts`.

### 3.3 Screenshot hazard and evidence value

- **PASS. Inventory of `shot()` calls:** I listed every `shot()` call in the T7 specs and libraries at C9, with the action that follows it. Only `flows.ts` (form → `saveAndReturn`) and B5 (picker → `cancelActivityForm`) put a full-page capture directly before a sticky-footer click. C10 repairs both.
- **PASS. `readToolSettings` (`moodle.ts:228-229`):** it captures the tool settings page at full size and then clicks **Cancel**. The r8 run-1 evidence `A2-tool-A-settings.png` shows that this Cancel is an inline form button, not a sticky footer. So this path is not exposed.
- **PASS. B5 evidence still meaningful:** in the r8 run-1 `B5-picker-thanh.png`, the "Select content" modal is fully inside the 1440×900 viewport (y ≈ 25–875). A viewport capture therefore keeps the AC-T7-08 content.
- **Runtime check needed, A4/B4 form evidence:** `docs/reviews/T7/qa.md` cites `A4-*-activity-form.png` for AC-T7-05 ("Receive a grade"). Line 32 scrolls the completion header into view before the capture. So the image will very probably show the completion section. The activity name field may now be outside the image, but an `expect` assertion still checks the name. Only a new run can confirm the image content (see §5).

### 3.4 Redaction repair (synthetic values only; I read and printed no real secret)

I imported the actual C10 `isCloneEnvSecret` and the C10 `lib.mjs` into a private Node check:

- **PASS. Superset:** I tested 525 synthetic key/value pairs. There are 0 cases where the old rule is true and the new rule is false. In every case the new result equals `old || isSecretCandidate`.
- **PASS. Real `.env` shape** (from `infra/scripts/gen-env.sh` at C6): the old rule registers 8 keys and the new rule registers exactly the 9 secret keys. `DB_PASS` is the only new key. `COMPOSE_PROJECT_NAME`, `STACK_SUBNET`, `PUBLIC_PORT` and the `PUBLIC_*_URL` values are not registered.
- **PASS. Gate fields are not redacted:** the Redactor does not change a synthetic runner summary with the C10 SHA, the clone path and the project name. `lane-watch-core.mjs:237` and `t7-gate.mjs:16` compare these fields. A synthetic compose-config log loses the `DB_PASS` value and keeps `name`.
- **Negative control:** a narrow variant that uses only `isSecretCandidate` gives 70 superset violations. So the check can detect a regression.
- **QA evidence binds to the exact C10 blobs:** `redaction-selftest-v2.mjs` (`6a9dafe7…0773`) and its results (`5f20a4a4…b3ebd`) record helper `f9b538de…` and runner `a23659df…`. They report control A FAIL (1 `env:DB_PASS` hit), B PASS (0 hits, 9 keys redacted), C FAIL (sensitivity) and D (no regression). The failure-closeout scan (`7160f9d0…de4e`) has exactly 1 shared hit, `03-compose-config-name.log` / `env:DB_PASS`.
- **Note:** the qualified `secret-scan.mjs` imports `tests/host/lib.mjs` from `--source "$SRC"`. That file is unchanged, so the scanner's rules do not change at C10.

### 3.5 Identity-only wrapper copy

- **PASS. Exactly seven lines change:** lines 32, 284, 287, 295, 396, 577 and 578 differ from the original. Both files have 661 lines. Each original line equals the held `old` text (its hash checked). Each new line equals the template with C10 `97b68af439b6565f891042b20497b18aadca6a24` / `97b68af4`. If I undo the seven substitutions, I get the original bytes exactly.
- **PASS. Approved identity changes:**
  - line 577 `m2Sha: '5561e8f72a83de36a68877c6b26ffc8288ade735'` (Lead `msg_26ca06b0cb76`);
  - line 287 `--source …/notes/t7-c10-frozen/source`;
  - line 578, the product note. Its claim "C10 is tree-identical to C6 outside docs/tests" is true (§3.1).
- **PASS. Old C8 text that stays is historical only:** line 2 (runbook name), line 10 (`FROZEN_R` folder name) and the folder name inside the new line-287 path.
- **PASS. Behavior unchanged:** these items are byte-identical to the original:
  - every `PREV_W4` length, hash and predicate check (lines 58, 203, 214);
  - the grant, preflight, LA-hold and deadline guards;
  - the lane flags, port 8543, subnet 172.31.0.0/16, the runner argv `--runs 3 --demo --check-confirm --keep`, the gates, cleanup, the observer hash and the tool paths.
- **PASS. Every `$SHA` use follows line 32:** the host checkout, the clone, preready B-TW-03, lane-watch `--sha`, the runner `--sha`, `t7-gate --sha` and the evidence `sha`/`testSha`. The runner names its run folder `<project>-<sha.slice(0,8)>-…` (`run-t7.mjs:73` at C10), so the new `qa-e2e-m3-r3-97b68af4-*` selector (line 396) matches. The lane-watch argv check uses the runner path, not its bytes.
- **PASS. Safe binding:** `prepare-checkout.mjs` checks out the 40-hex SHA and needs HEAD = SHA and a clean clone. Git addresses commits by content, so the runtime trees are bound to C10 whatever the source HEAD is.
- **PASS. Frozen source:** mode 0700 under a 0700 parent. Detached at C10, clean (`status --porcelain --ignored --untracked-files=all` is empty). Not shallow, no alternates file, no active hooks, no `hooksPath`, `fsmonitor` or include settings. Its only remote is the local integration checkout, and no fetch occurs. C6 is present.
- **PASS. Syntax only:** `bash -n` exits 0. I never executed or sourced the copy.
- **PASS. Originals preserved:** the original wrapper hash is unchanged. `R/source` is still at C8 (`5561e8f7…`) and clean.
- **PASS. Qualified dependencies unchanged (re-checked after finalization, 16:15:50 UTC):**
  - all 42 entries of `MANIFEST-candidate-r2.sha256` (`e4f60300…5c`, 8,577 B) match by size, hash and mode;
  - the 10 extra read-only bindings match;
  - the older held records bind 9 of those 10 independently (`MANIFEST-host-ready.sha256`, `tool-hashes-r4-abs.sha256`). `detached-launch.py` (`4a1f1ed3…`) is bound in `docs/reviews/T7/qa.md:379`.
- **Fresh paths:** `t7-attempt-c10-20261023T1615Z`, `notes/t7-external-preflight-c10-20261023T1615Z` and `notes/t7-runtime-c10-20261023T1615Z` were absent at 16:15 UTC. This is for information only. The grant must bind them.

## 4. Findings

No BLOCKER. No MAJOR.

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-T7C10-01 | MINOR | `tests/e2e/lib/flows.ts:28` | The `${pickerKey}-picker` capture is still full-page. It occurs in the same A4/B4 flow, a few actions before the sticky-footer **Save and return to course** click (line 34). The Moodle mechanism is inferred, so a later run could show the same footer loss. | The design keeps this capture by intent. In the failed r8 run 2, `hasstickyfooter` was present before the form capture (`before@call@1812`), after this picker capture. In r8, eight picker captures ran. Seven were followed by a successful save. The eighth (run 2, A4 SCORM) failed only after the form capture. No evidence shows a hazard from the picker capture. | Defer. The required check of the A4/B4/B5 traces for "outside of the viewport" click retries will show any repeat. If it repeats, change this one call to `viewportShot`: the picker modal fits the viewport (B5 PNG), and the evidence name stays the same. |
| A-T7C10-02 | NIT | `docs/team/r8-t7-shared-host-verification-2026-10-23.md` ("M1, M2 and legacy load neither file") and the identity lines to come | The import closures of M1 and M2 exclude the edited files. But `run-m1.mjs:73` and `run-m2.mjs:38` run `npm run typecheck`, and the tsconfig includes `e2e/**/*.ts`. So their harness checks compile `flows.ts` and `2-scenario-b.spec.ts`. | Typecheck exits 0 at C10 (§3.2), so a rerun would not change. The accepted M1 (C9) and M2 (C8) evidence keeps its recorded identity. | In the C9→C10 identity lines, write "import closure excludes; typecheck at C10 PASS" and not "does not load". |
| A-T7C10-03 | NIT | `R/notes/final-architect-preparation/t7-required-evidence.md` item 4 (held) | The held final-binding checklist still names tests C8 `5561e8f7…` (tree `65eaefab…`) as the T7 identity. | C10 is now the T7 test identity (tests tree `ec2d86f5…`). | When final docs open, re-bind item 4 to C10 and keep M2 at C8. |

## 5. Conditions for the next runtime (no change to acceptance)

1. A fresh preflight, a fresh absent `t7-attempt-*` root and a new grant that binds the new wrapper hash `a9ac8f56…8f96`. No reuse of r8 artifacts.
2. Unchanged acceptance:
   - three default runs, each 17 PASS, 0 FAIL and only the DEMO skip;
   - all 15 criteria;
   - demo ≤ 180 s;
   - the four confirmation and refusal checks;
   - all W3/W4, lane, sampler and 32-volume checks;
   - `t7-gate` PASS.
3. The judge must also check these points in each run:
   - the A4/B4/B5 traces show the sticky-footer clicks with no "outside of the viewport" retries;
   - `A4-scorm-activity-form.png`, `A4-html-activity-form.png` and `B4-activity-form.png` show "Completion conditions" with "Receive a grade" selected;
   - `B5-picker-thanh.png` shows the full picker;
   - the T14 secret scan has 0 shared hits, including `cmd/03-compose-config-name.log`.
4. The r8 attempt stays FAILED history. Final conformance, guides, Docs QA and Lead closure stay on hold.

## 6. What I did not do

- I did not run the T7 runner, Docker, a browser or a network call. I did not execute the wrapper.
- I did not edit tests, product files, guides, wrappers or other review files.
- I did not read raw trace zips. I viewed three evidence PNGs from the r8 run-1 artifacts: A2 tool settings, A4 SCORM form and B5 picker. They contain no secret.
- I did not commit. The Lead commits this path.

## 7. Private review notes

Folder `R/notes/t7-c10-reviewer-a/` (0700; evidence files 0600, scripts 0700):

- `scripts/`: `verify-bindings.py`, `static-check.py`, `import-closure.py`, `verify-wrapper.py`, `env-secret-check.mjs`.
- `evidence/`:
  - bindings (preparation and final);
  - static C9 control and C10 results;
  - M2 closure at C9 and C10;
  - `tests/host` closure;
  - the wrapper check;
  - the synthetic predicate result.
- `work/`:
  - private archives of C9 and C10;
  - the wrapper-verifier self-test (one correct copy, and one copy with an unauthorized `--runs 2` change that the check detected);
  - the predicate-checker controls.
- `MANIFEST-reviewer-a.sha256` lists the scripts and evidence files.
