Verdict: CHANGES_REQUESTED
Round: 1

# LA-E5-24 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, Reviewer-B (can a human team own it?), 2026-10-23 UTC. Scope: QA-E2E commits `fa3ecc6a` and `4ec50888`, integrated in `29636fae`; all four drill files and `qa.md` read in full. Integration snapshot: `9b918a7e0fba8dbdf3d366e655da61646b90f812`.

### Findings

**B-LA-E5-24-01 — MAJOR — Failed drill diagnostics can retain a runtime bearer token.**

- **Location:** `tests/e2e/ltiaas/run-la-e5-24.mjs:592` (also `:532–533` and `la-e5-24-container-step.mjs:141`).
- **Problem:** The final `loadCapturedSecrets()` call runs only on success. A post-restore helper failure jumps past it; the `finally` block only removes the external backup. Operators cannot safely share the failed-run evidence without another secret scrub.
- **Evidence:** The container helper records the newly issued runtime token at line 446, then makes requests under `/rt/<token>`. Its timeout error includes the complete pathname. `r.exec` saves that error in `cmd/16-e524-post-restore-verify.log` before the caller asserts exit 0. The shared runner's final redaction replaces only registered secret values; neither its error handler nor its cleanup reads this newly updated captured-secrets file. A private host self-test extracted the actual command wrapper and post-restore error/finally path, stubbed the command execution to write a synthetic captured token and return a timeout error, and applied the real `Redactor`: the added assertion failed, while the original five tests passed. Moving the capture load into `finally` made all six pass. No Docker, network request, or live drill ran in this probe.
- **Suggested fix:** Load captured secrets on every container-step exit, including failure, before reporting or finalizing artifacts; retain backup cleanup if loading fails. Do not put bearer-bearing paths into timeout messages. Add a host regression test for a failed request after runtime-token capture, checking the final saved diagnostic rather than only the backup record.

**B-LA-E5-24-02 — MINOR — The help usage points to a nonexistent entry point.**

- **Location:** `tests/e2e/ltiaas/run-la-e5-24.mjs:310` (inherited help in `tests/host/core.mjs:53–54`).
- **Problem/evidence:** This entry point passes `task: 'LA-E5-24'` to `createRunner`, which prints `node tests/host/run-la-e5-24.mjs --sha <commit>`. That file does not exist; the actual entry point is `tests/e2e/ltiaas/run-la-e5-24.mjs`. The source-header example is correct, but an operator following `--help` gets a module-not-found error.
- **Suggested fix:** Provide drill-specific usage with the actual path and distinguish live execution from the host self-test/dry-run. If the shared help needs an entry-point parameter, request that change through its owner.

**B-LA-E5-24-03 — MINOR — Two backup hashes in the QA narrative disagree with its linked evidence.**

- **Location:** `docs/reviews/LA-E5-24/qa.md:69`.
- **Problem/evidence:** The final run's AC-01 row gives database SHA-256 prefixes `ab2df16e...` and `a874f632...`. Its linked `drill-backup-manifest.json` and `drill-backup-record.json` both give `31912432...` for `lti.db` and `07f5daea...` for `cogniate.db`. The backup ID, project and sizes agree. This transcription mismatch makes an operator checking backup identity investigate the wrong hashes; it does not invalidate the manifest validation.
- **Suggested fix:** Copy the actual prefixes from the final run, or omit the redundant hashes and link the manifest.

### Verification and ownership

- Reviewed against `CLAUDE.md`, base charter §§1/5, charter-LA, plan §6.1, task AC-01–06, operability §§7.1–7.3 and operator-runbook §13. The sequence matches the same-project cold-backup drill: stop, external database/content copy, record key-version IDs, write marker, stop, restore content/databases, restart, verify marker absence and learner/score flow, then remove the QA project. No storage-command or product change is included. The runbook's pending-verification wording needs the normal Docs evidence update; it is not a new code finding.
- All six task ACs are K1-SIM; there is no UNIT AC or changed product behavior requiring an old-product mutant. The five host self-tests cover real SQLite backup/restore, damaged/missing/incomplete/mismatched backups, planted secret forms, marker removal, content restoration and timing arithmetic. They passed in `/tmp/la-review-b-2ece617d7a9a` after its own `npm ci` (`/tmp/la-e5-24-b-r1-selftest.log`). The redaction failure probe and positive control are in `/tmp/la-e5-24-b-r1-redaction-probe.log` and `/tmp/la-e5-24-b-r1-redaction-fixed-probe.log`; the temporary extended self-test is saved at `/tmp/la-e5-24-b-r1-redaction-probe.selftest.mjs`. All private mutations were restored; the clone is clean.
- Read the existing final-run `summary.json`, backup manifest/record, secret-scan, post-restore and metrics artifacts under `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/`: 10/10 PASS, marker absent/404, package and commit 200, simulator score 90/100, portal status `sent`, RTO 26.574 s and RPO 19.815 s. The first-run summary has seven PASS rows and one ERROR/FAIL, as disclosed. These are inspected QA evidence, not a live rerun by this reviewer.
- The diff stays within the dispatched QA harness and QA report; no must-not-edit product/infra path or LMS-specific core path changed. Only this Reviewer-B report was written in integration. No other reviewer's file was opened; no Docker, stack, drill entry point, commit or push was executed.

**Result:** CHANGES_REQUESTED — 0 BLOCKER, 1 MAJOR, 2 MINOR, 0 NIT. Fix failure-path redaction and verify the saved diagnostic before approval; the two MINOR items can be deferred under charter §5.
