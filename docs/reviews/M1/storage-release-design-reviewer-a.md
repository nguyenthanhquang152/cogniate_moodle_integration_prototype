Verdict: APPROVE
Round: 1

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
