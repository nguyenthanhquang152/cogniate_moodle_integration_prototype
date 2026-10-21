Verdict: APPROVE
Round: 2

# M1 storage lock release: design confirmation, Reviewer-A (correctness and safe status propagation)

Bounded confirmation of W-1, the repair scope, the acceptance cases and the O-1 deferral. It is not a new storage audit. I did not read the Reviewer-B report of this task.

## 1. Target and inputs (all hashes checked)

| Input | Identity |
| --- | --- |
| Target | `docs/architecture/tasks/storage-command-conformance.md` at `3a5b61ef35cda9b15f9b03db948403edbb68a8e0`, SHA-256 `cc1b0753bf84cf94948a5f45fb523139731ffa81c9bdac96cdcef7883c6122f0` (worktree file equals the commit) |
| Product | `01ce5bc`: `storage-oplock.sh` `90d24679…`, `storage-oplock.test.mjs` `e2b2224b…`, `storage-compat.sh` `65be43f2…`. Tests tree `4c7e067` at `01ce5bc` and at `3a5b61e`. |
| ADR-012 | `4410e85`, `165a78ee…`: §7 lines 237, 254, 285–290, 301; §12 line 585. The diff to `3a5b61e` touches only the status line, the revision history and §4. |
| Charter / triage | charter `5289f7f7…` §5; triage at `2d763fe` and at `3a5b61e`: `ade4e8a0…` (unchanged) |
| QA | report `be41847`, `bdc727ed…`; evidence `MANIFEST.sha256` `57039ac7…`; `T.json` `20e75321…`, D1 log `81e7faf2…`, D3 log `180188f5…` equal their manifest lines |

Method: read-only inspection. One small bash probe of a model of the handler (not the product) on the host `/bin/bash` 3.2.57, the only bash on `PATH`. Probe folder `$TMPDIR/r1a-relprobe.ObqIqq` (0700; files 0600; `p.sh` `b6ec3fe6…`, `q.sh` `1a083697…`). No repository code, Docker, network or service ran.

## 2. Disposition by item

| Item | Result | Severity of open points |
| --- | --- | --- |
| Q-R1A-01 is a contract violation | **Confirmed.** `T.json` has exactly one REQUIRED failure: `N5-lost` `C6.main.exit1` (expected 1, actual 0). S6 exits 0, N8 7, S7 143 (INFO). Source: `storage-oplock.sh:388` `\|\| true`; `:412–413`; trap `:375–377`. | — |
| W-1 (proposed wording) | **Confirmed** as sound contract precision. | A-RD-04 NIT |
| §3.7 scope | **Confirmed** as minimal and bash only. | A-RD-01 MINOR |
| §3.8 cases and mutants | **Sufficient with two additions.** | A-RD-01, A-RD-02 MINOR; A-RD-03 NIT |
| O-1 log-only MINOR deferral | **Confirmed.** No required row in tests tree `4c7e067` depends on it (§5). | A-RD-05 NIT |

No BLOCKER or MAJOR. The MINOR items belong in the Author brief and the QA criteria. They do not block the W-1 decision.

## 3. Proposed wording vs current requirements

- **Current requirement (ADR-012 at `4410e85`, unchanged at HEAD):** line 286 "log `storage_lock_lost` and exit 1", for the holder (line 237). The same rule applies to the trap release (line 290). The §12 wrapper rule is at line 585. This binds now, with or without W-1. Today every supported path fails it in the main case (holder status 0).
- **Proposed W-1 (not yet in force):** exit 1 only when the status would otherwise be 0. A nonzero status stays as it is. The §12 line 585 cross-reference is added.
- W-1 is sound. (1) It keeps the only safety signal: a lost lock never gives exit 0. (2) Exit 1 already has many meanings (`die`, a "stop now" check, an `addContainer` refusal), so overwriting 7, 130 or 143 with 1 adds no information. The event names the lost lock in every case. (3) 130 and 143 keep their signal meaning for npm and the harness. (4) It agrees with §12 "the exit code is the command's". (5) R1-A QA already graded only the main case as REQUIRED (N8, S7: INFO). So W-1 does not change a frozen verdict.
- If W-1 is rejected, the literal text applies, and R-6 and R-7 expect 1 (disposition §3.6). That is internally consistent too.

## 4. Case checks (requested routes)

| Route | Assessment and evidence |
| --- | --- |
| `run` | (c) is necessary. Under `set -euo pipefail`, a release that returns 1 as a plain command ends the shell with 1 (probe `explicit-plain`: 1). `run` has these options (`:395`, `:411`), so child status 7 would become 1 before `exit "$code"`. R-6 on `run` kills this. |
| Sourced `EXIT` with/without `set -e` | (b) is necessary. Probe, the "`\|\| true` removed, no guard" mutant: with `set -euo pipefail`, statuses 0/7/143 all become 1 (W-1 broken). Without options, 0 stays 0 (main case broken). The guarded shape (`s=$?` at entry, `release \|\| lost=1`, `exit 1` only when lost and `s == 0`) gives 1/7/1/143 for zero/seven/errexit/TERM under both option sets. The with/without matrix in §3.8 is needed and is enough. |
| Explicit release, then `EXIT` | Correct in `run`. On the sourced path, see A-RD-01. |
| Signal / child precedence | `exit 143` from the TERM trap reaches the `EXIT` handler as `$? = 143`. TERM during a foreground child runs after the child ends (probe `termchild`: 143, one event). R-3 and R-7 cover this. |
| Copied old wrapper | `storage-compat.sh:163–179` is unchanged. It sources the copy (`:165`), gets the trap from `storage_lock_acquire`, and ends with `exit "$code"` or `die` (exit 1). So the repaired helper reaches the old route only through the copy and the hash line (R-12). See A-RD-02. |
| Foreign lock | JS `release()` (`:170–176`) is unchanged and never moves a foreign record. The bash repair needs no folder operation. R-4 (F byte-identical, no `rel-`/`stale-`), R-5 and the "removes or moves F" mutant are sufficient. |

## 5. O-1 evidence

- D1 and D3 exit 1. Their REQUIRED checks (`T.json`: emitter fields, `lockGone`, `noRel`) pass, and none asks for a release event. The D1 exit is INFO. D1 logs only `storage_lock_acquired`; D3 adds `storage_lock_refused`.
- The release-event consumers in the tests tree are a-lock-scope (`tests/host/storage-rows.mjs:437`), the backup release (`:407`) and the old-route `lockHeld` (`tests/host/storage-compat-route.mjs:137`, `:237`). Each of these rows also requires exit 0 of the guarded command (`storage-rows.mjs:405`, `:427`, `:434`; `storage-compat-route.mjs:136`, `:236`). Every O-1 trigger exits 1 (`storage-oplock.sh:151`, `:163`, `:330–340`). So O-1 cannot be the only cause of a required-row failure. The A5 refusals (`g-orphan-refusal`, `storage-rows.mjs:733`) take no lock and need no release event.
- This closes the disposition's §6 uncertainty for tree `4c7e067`. The deferral covers only the missing log line. If a later tests tree or the new QA round has a REQUIRED check that fails because of O-1, the deferral does not waive that check.

## 6. Findings

**A-RD-01 (MINOR)** `storage-command-conformance.md:92` (b), `:119`. Rule (b) says "exit 1 only when the release was lost". It does not say that the handler must also use a lost result recorded by an earlier explicit `storage_lock_release`. Evidence: the probe mutant "the handler checks only its own release" passes the sourced trap cases. By (c), it also passes every `run` case. It also passes the updated unit test at `storage-oplock.test.mjs:208–211`, because the release is the last command there. It fails only R-8 on the sourced path without `set -e` (explicit release lost, status ignored, then exit 0 → 0; W-1 requires 1). Fix: in (b), write "when any release of this holder was lost (explicit or by the trap)". Add this mutant to the list, and run R-8 sourced so that the explicit release's status cannot end the shell.

**A-RD-02 (MINOR)** `:114` R-11. Expected "exit 1" cannot tell the lost rule from a failed `status_check` "stop now" (`storage-compat.sh:178`, `die` = 1). With stubs that fail the mount check, the unrepaired helper also passes. Fix: add a paired control with the same stubs and no loss (exit 0, "storage-compat status: OK"). In the lost case, stderr has no "stop now" text. Optional: a lost case with command exit 7 → 7.

**A-RD-03 (NIT)** `:92`, `:100`. The guarded scripts use `set -euo pipefail`, not only `set -e`. In the probe, a flag read without a default under `set -u` turns 0/7/143 into 1 when nothing is lost. `run` R-1 catches it, but the text should match. Fix: in (b), "independent of `set -e`, `set -u` and `pipefail`". Run the sourced matrix as "`set -euo pipefail` and no options". QA records `bash --version` (host: 3.2.57).

**A-RD-04 (NIT)** W-1 `:78`. "the command's own failure, 130 after `INT`, or 143 after `TERM`" can be read as a complete list. Other nonzero statuses must also stay, for example a §12 "stop now" 1 or 126/127. Fix: "for example".

**A-RD-05 (NIT)** `:129`. "O-1" also names a different observation in ADR-012 revision 3.6 (triage §11, a §4 privilege sentence). Fix: record the deferral as "R1-A QA O-1 (quiet A6 release)".

Observation, no change requested: charter §5 lists "an acceptance criterion fails" under BLOCKER, and `C6.main.exit1` is a frozen REQUIRED check. Disposition §6 is correct that MAJOR and BLOCKER have the same gate effect.

Note: in the bash layer, any nonzero status of the release subcommand (lost, or an I/O error) becomes exit 1 when the status is 0. That is fail-closed and needs no new case.

## 7. Preserved

The R1-A QA Round 1 FAIL report, the R1-A source approvals (`7fbf7c8`, `0a97fe9`) and the frozen triage at `2d763fe` are unchanged. I changed only this file. `pnpm-workspace.yaml` is unchanged.

## Round 2

Verdict: **APPROVE**. This is a bounded confirmation of revision 2 of the disposition and of ADR-012 revision 3.7 (W-1). It is not an implementation review or a new storage audit. No BLOCKER, MAJOR or MINOR. All Round 1 items of both reviewers are closed. Two new NITs do not block the Author brief.

### R2.1 Provenance and inputs

- Fresh instance: Claude Code, Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_4893194a3c38`, dispatch `ctx_02ca8b88c0e1`. This instance did not write Round 1. It read the Round 1 report (`3b189d3`, SHA-256 `6a349807…`) and the Reviewer-B Round 1 report (`0c694d8`, `b7e89fb2…`, read with `git show`) only for the finding context. It did not read a Reviewer-B Round 2 report or output.
- The header above changes from `Round: 1` to `Round: 2` (charter §6, and the repository precedent). The Round 1 text is unchanged.

| Input | Identity (all checked) |
| --- | --- |
| Target | commit `2362a20fc4cdd9c21c9283dc7099068c6565eb31`; it changes only the two paths below |
| Disposition | `docs/architecture/tasks/storage-command-conformance.md` SHA-256 `1128b9c198ba79d9cac6471874eecdd2c48b40bc555e525f107d31846b8265de` (worktree = commit) |
| ADR-012 | `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` SHA-256 `2b3b601b771559870b2f997159c45ce366c203171c701acb4064c6dba41a1d7d` (worktree = commit) |
| Baselines | at `3a5b61e` and unchanged at `3787986`: disposition `cc1b0753…`, ADR-012 `57602ca4…` |
| Frozen triage | `storage-full-round-triage.md` at `2362a20`: `ade4e8a0…`; last change `2d763fe` |
| R1-A QA report | `storage-command-qa.md` `bdc727ed…` (`be41847`); no change from `3a5b61e` to `2362a20` |

Method: read only (`git show`, `git diff`, `shasum`, `grep`). Two targeted reads at `01ce5bc`, only to check R-8 and R-11: `storage-oplock.sh` (`storage_lock_release`, the `run` branch) and `storage-compat.sh` (`status_check`, the `run` branch). No probe, no source execution, no Docker, network, service or setting. The Round 1 probes of both reviewers (host `/bin/bash` 3.2.57) already measured the single-rule shape. No concrete ambiguity needed a new probe.

### R2.2 One final-status rule (B-RD-01)

| Required property | Text at `2362a20` | Result |
| --- | --- | --- |
| One rule, in the `EXIT` handler only | §3.7 (b) "The `EXIT` handler alone sets the final status"; (d) "`run` keeps `exit "$code"` and has no status branch of its own" (line 97). The note at line 103 removes the two rules of revision 1. | Confirmed |
| Any nonzero release result is recorded, explicit or trap | (a) "records any nonzero status of the release subcommand as a failed release of this holder"; (b) "in the handler or in an earlier explicit `storage_lock_release`" | Confirmed |
| No premature errexit | (a) "never ends the caller through `set -e`"; (c) "must not depend on `set -e`, `set -u` or `pipefail`", with safe defaults. At `01ce5bc`, `run` sets `set -e` again before its explicit release (`storage-oplock.sh:408–412`). So (a) is necessary on `run` too, and `run` R-6 finds a violation. In the handler, an errexit failure replaces the status, a normal end keeps the entry status, and `exit 1` gives 1 (Round 1 probes). | Confirmed |
| An earlier failed release is remembered | (b), R-8 (ii). `run` R-4 finds it too: `run` releases explicitly and then calls `exit 0`. R-8 "exactly one released or lost event" prevents a second release. | Confirmed |
| Every nonzero status is kept | (b) "any nonzero entry status stays"; R-2, R-3, R-6, R-7, R-8 (iii) | Confirmed |
| Release error without `storage_lock_lost` | line 104: fails closed; QA does not report it; W-1 stays limited to `storage_lock_lost`. The ADR has no release-error rule, so this does not conflict with §7 or §12. | Confirmed |

### R2.3 Sourced matrix and mutants

- Line 108: R-1 to R-8 run on the sourced path twice, with `set -euo pipefail` and with no options. QA records `bash --version`. This is the matrix that A-RD-03 and B-RD-02 asked for.
- Each mutant on line 127 has a case that discriminates it:

| Mutant | Killed by | Observed vs expected |
| --- | --- | --- |
| Release result discarded | R-4, R-5, both paths | 0, not 1 |
| Lost overrides every status | R-6, R-7 | 1, not 7, 130 or 143 |
| Explicit release ends the caller through `set -e` | sourced R-8 (iii) with `set -euo pipefail`; also `run` R-6 | 1, not 7 |
| Handler uses only its own release result | sourced R-8 (ii), both option sets; also `run` R-4 | 0, not 1 |
| Flag read with no default under `set -u` | sourced R-1 with `set -euo pipefail` | 1, not 0 |
| Only the `run` path / only the trap path repaired | sourced R-4 / `run` R-4 | 0, not 1 |
| Release removes or moves F | R-4 | F changed |

### R2.4 R-11 old-wrapper pair (A-RD-02, B-RD-04)

- Line 122: a pair with identical stubs. Control: not lost, exit 0, `storage-compat status: OK`. Lost: exit 1, F kept, no "stop now" text on stderr.
- `status_check` (`storage-compat.sh:93–108` at `01ce5bc`) does not read the lock record. So a foreign record F after the command does not change the status check, and the only source of exit 1 in the lost case is the handler. The pair discriminates.
- `enable` copies from the repair SHA (fresh enable). The §4.5 M4 note (line 172) covers checkouts that ran `enable` before the repair.

### R2.5 W-1 in ADR-012 revision 3.7

- The diff `57602ca4…` → `2b3b601b…` has four hunks only: the status line (line 3, one added sentence), the history (one new line 18), §7 release step 1 (line 288) and §12 (line 587, one added sentence).
- Line 288 is byte-identical to the W-1 quote in the disposition (line 82). The §12 sentence equals line 84. The text keeps the A-RD-04 and B-RD-03 (a) change ("any nonzero status …, for example").
- No hunk is in §4. The revision 3.6 privilege sentence (line 103) does not change. No other §7 rule changes: the trap rule (line 292) and the event list (line 315) are as before. Apart from the status line, the ADR names `storage_lock_lost` in only three places: step 1, the event list and the new §12 cross-reference. So no ADR text still requires a literal "exit 1" in every lost case.
- The status line and the history say "proposed and not accepted" and "It is no product acceptance". The history cites `3b189d3` and `0c694d8` as confirmation in principle. This agrees with both Round 1 reports.

### R2.6 Closure of Round 1 items

| Item | Status | Evidence at `2362a20` |
| --- | --- | --- |
| A-RD-01 (MINOR) | Closed | §3.7 (b) uses an earlier explicit failed release; mutant "handler uses only its own release result"; R-8 (ii), (iii) |
| A-RD-02 (MINOR) | Closed | R-11 control and lost pair; no "stop now" text (R2.4). The optional "lost, command exit 7 → 7" is not added. Sourced R-6 covers that cell with the same handler. |
| A-RD-03 (NIT) | Closed | §3.7 (c); line 108 matrix; `bash --version` |
| A-RD-04 (NIT) | Closed | "any nonzero status …, for example" (line 82, ADR line 288); reason at line 90 |
| A-RD-05 (NIT) | Closed | "R1-A QA O-1" in the title, line 28, line 120 and the §4 heading; note at line 141 |
| B-RD-01 (MAJOR) | Closed | R2.2 |
| B-RD-02 (MINOR) | Closed | line 108 |
| B-RD-03 (MINOR) | Closed | (a): line 82; (b): line 104 |
| B-RD-04 (NIT) | Closed | R-11 fresh `enable` from the repair SHA; M4 note at line 172 |

### R2.7 New findings (nonblocking)

**A-RD2-01 (NIT)** `storage-command-conformance.md:129`. The note says "Revision 2 changes only the first paragraph of §3.8, R-8, R-11 and this list". R-9 (line 120) also changed: "O-1" became "R1-A QA O-1". It is a label change only, and the history line 7 lists the O-1 label fix. Fix at the next edit, if any: add "and the O-1 label in R-9". No gate effect.

**A-RD2-02 (NIT)** `:119`, R-8 (iii). The mutant "explicit release ends the caller through `set -e`" is killed only when (iii) calls `storage_lock_release` as a plain command (no `||`, `if`, `!` or `&&`). The mutant list (line 127, "1, not 7") makes this clear, but R-8 does not say it. QA writes "plain call" in its frozen criteria. No design revision is needed.

### R2.8 Preserved

- The frozen triage at `2d763fe` (`ade4e8a0…`) is unchanged.
- The R1-A QA Round 1 FAIL report (`bdc727ed…`) is unchanged. The source approvals `7fbf7c8` and `0a97fe9` stay valid only for the `01ce5bc` diff (line 177). There is no runtime or QA credit: lines 176 and 183, and the ADR status line and history.
- This round changes only this file: the `Round` line of the header and this section. `pnpm-workspace.yaml` is not changed.
