Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Can a human team own it? Reviewed addendum r6 at `a2dc6270` against BD-A1-120, BD-A2-113, ADR-012 §17, LA-ADR-04 D8 and plan LD-9. The identity patch is narrow and the evidence hashes match, but the addendum does not accurately describe that evidence. **0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.**

### B-LA-E7-08-LD9-R6-01 — MAJOR — Preserve the diagnostic's measured scope and pass criteria

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r6.md:45–50`.

**Problem:** The G-1 summaries claim measurements that the cited reports explicitly exclude, and omit the whole-group kill result that permits the binding to move. A future maintainer would inherit the wrong account of the lock's verified scope.

**Evidence:** Line 49 claims both `docker run` and `docker compose run`, under `/bin/sh` and `/bin/bash`. Both source reports §3 and §7 instead specify only `docker compose run`, a `/bin/bash` stub made group leader by `perl setpgrp`, and a client waiting for a dependency; other shells and command paths are unmeasured. Line 50 describes a `sleep 30` orphan hold with t+2/t+15 probes. The actual target is `sleep 300`; the 30-second measurement is the absence of clients and containers after a **whole-group SIGKILL before creation**, watched for 30.94 s and 30.49 s, with four container filters, event checks and positive controls. ADR-012 §17's “G-1 result 2” records this correctly. The reports' hashes are correct and their actual criteria pass; this finding concerns the addendum's account, not a failed diagnostic.

**Suggested fix:** Replace the two summaries and “orphan-hold” description with the actual protocol and measured scope. Name both the parent-only survival result and the whole-group no-survivor/no-container result, the watch durations and positive controls. Retain the explicit boundary that this is design-gate evidence, with no acceptance credit. Existing reports suffice; no new Docker run is needed to correct the text.

### B-LA-E7-08-LD9-R6-02 — MINOR — Make the proof table point to the real evidence producers

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r6.md:133–134`.

**Problem / evidence:** Neither `tests/host/m1-storage-sim.mjs` nor `tests/host/m2-storage-compose.mjs` exists at the pinned base or after the proposed patch. The entry points are `tests/host/run-m1.mjs` and `tests/e2e/host/run-m2.mjs`; `tests/host/core.mjs:155–162` emits `g1-client-identity.json` and `G1-IDENTITY`. Also, A-S-14 injects recorded identity answers and derives hash answers from `BOUND_IDENTITY`; it proves comparison behavior, not the installed host's identity. That evidence is supplied separately by the diagnostic, binary hash checks and future live boundaries.

**Suggested fix:** Correct the runner references and name the identity artifact/row as the live proof. Separate mocked self-test coverage from the real host checks. Label D1/D2 as required pending proof until their run records exist, rather than leaving the present-tense PASS wording ambiguous.

### Verification and boundary

- Both diagnostic report SHA-256 values, both installed binary SHA-256 values and the external patch SHA-256 match the addendum: **5/5**. The embedded diff is byte-for-byte equal to the patch artifact. No Docker executable was invoked.
- Fresh private `git clone --no-hardlinks`: `/tmp/ld9-r6-review-b-xor8gqoh/repo`, pinned to `la-final-test-1` / `85ddf97332063f75bdc5636cb410fc0d6ee25099`. The patch applies cleanly and changes only the two named QA files. Comparison behavior and all six single-field refusal assertions remain intact.
- `node --test tests/host/storage-docker.selftest.mjs`: **6/6 PASS**. Restoring only the old binding while retaining the proposed test produces the expected A-S-14 failure (**5 pass, 1 fail**); restoring the patch returns **6/6 PASS**. No dependencies were installed. Artifacts in the parent folder: `hash-checks.json`, `proposed.patch`, `apply-check.log`, `base-and-scope.json`, `patched.log`, `old-binding.log`, `restored.log`, `proof-paths.json`.
- The frozen source remains clean. The environment-change/no-LA-IC classification and QA ownership are correct; no product, architecture, storage algorithm or core LMS path changes are proposed. No UNIT AC applies to the addendum itself. No stack, runtime acceptance, broad host runner or commit was run. Only this review file was written in integration; no Reviewer-A file was opened.

## Round 2

Verdict: **APPROVE**. Reviewed the r6 correction at `be4557f4`; r7 in the same commit is outside this dispatch. **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT open.**

- **B-LA-E7-08-LD9-R6-01 — Closed.** Lines 214–253 explicitly supersede the incorrect summary and now match both diagnostic reports and ADR-012 §17: the Bash/group-leader/dependency protocol, parent-only survival, whole-group kill before creation, no survivors or containers during the 30.94 s / 30.49 s watches, event checks, positive controls and measured-scope exclusions. The no-acceptance-credit boundary is explicit.
- **B-LA-E7-08-LD9-R6-02 — Closed.** Lines 259–266 replace the nonexistent runner references with the real M1 and M2 entry points and identify `g1-client-identity.json` and `G1-IDENTITY` in `summary.json`. Mocked identity tests, host checks and pending live D1/D2 proof are separate, consistent with plan LD-25.

### B-LA-E7-08-LD9-R6-03 — NIT — Use the actual identity function name

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r6.md:266`.

**Problem / evidence:** The row calls the function `checkClientIdentity`, but `tests/host/core.mjs:155` defines `identityBoundary`, called at line 206. The cited file, line range and output artifacts are correct, so this does not prevent tracing the proof.

**Suggested fix:** Replace `checkClientIdentity` with `identityBoundary`.

### Round-2 verification and boundary

Read-only checks confirm that both diagnostic report hashes still match, and the embedded patch is unchanged from Round 1 and byte-for-byte equal to the external artifact (`051af77f1aa074e328d879a576435ba9848daaeffed222c6e7a39663f83eff2e`). All ten revised source/runner paths exist at the clean pinned base `85ddf973`. Checked the identity row and artifact producers in `core.mjs`. The unchanged patch retains Round 1's **6/6** self-test result and old-binding negative control; no tests were rerun for this text-only correction.

Only this review file was edited. No Docker, dependency installation, stack, runtime runner or commit; no Reviewer-A file was opened. D1/D2 runtime proof remains pending and is not granted by this approval.
