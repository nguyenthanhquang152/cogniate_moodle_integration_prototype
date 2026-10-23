Verdict: APPROVE
Round: 2

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?”

Reviewed QA commit `3b8b3a5c3d6a73829fcb56f69209eb01f9c6539f`, integrated at `d92486f5`, against BD-A2-110, BD-A1-114, LA-ADR-05 D1, LA-ADR-04 D8 and plan §6.1 LD-9. Scope is the proposed WE-F6 / LA-IC-06 change to `M1-08.canvas.login-redirect`. **Findings: 1 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

### A-LD9-R2-01 — BLOCKER — Storage-key assertion requires the wrong length

**Location:** `docs/reviews/LA-E7-08/ld9-addendum-r2.md:89` (proposed `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:30`; repeated in addendum `:32`, `:34`, `:147`).

**Problem:** The patch requires `/^cog_state_[0-9a-f]{16}$/`, but BD-A2-110 explicitly requires `/^cog_state_[0-9a-f]$/`. LA-ADR-05 D1 rule 3 (`docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md:94`) defines one hex digit, the first digit of the state hash, so the tool uses at most 16 storage keys. Sixteen possible keys does not mean a 16-digit key. A conforming login response fails this assertion before the test reaches its cookie launch.

**Evidence:** Extracted the proposed regex from the patched test in a private clone and exercised it with Node's real `assert.match`. All 16 valid keys, `cog_state_0` through `cog_state_f`, are rejected; the out-of-contract `cog_state_0123456789abcdef` passes. This is a wrong test oracle, independent of the pending SIM run.

**Suggested fix:** Remove `{16}` from the proposed assertion and correct the matching descriptions and summary row. Keep the one-digit requirement from BD-A2-110; do not change the product to satisfy this proposed test.

### A-LD9-R2-02 — MINOR — The explanation attributes different security rules to the ADR

**Location:** `docs/reviews/LA-E7-08/ld9-addendum-r2.md:30` and `:31`.

**Problem and evidence:** The addendum says the target accepts up to 128 printable ASCII characters and describes an `authorizationServer`-first storage-origin algorithm. The cited ADR instead permits at most 64 characters from `[A-Za-z0-9_-]` (or `_parent`), requires the profile's storage trait, and chooses the authentication endpoint's origin when that trait says `authOrigin`, otherwise the trait's fixed origin (LA-ADR-05 D1 rules 1–2, `:91–93`; API delta §2.1 agrees). Rule 1a defines profile trait values; it does not define the claimed token-audience exception. The proposed Canvas target and origin assertions themselves are correct, so this is not an additional execution blocker.

**Suggested fix:** Replace these descriptions with the actual trait, target and origin rules. Keep the Canvas expectation `new URL(CLOUD.auth).origin`.

### Verification and boundaries

- Confirmed the source gate's HEAD and `la-gate-test-3` both resolve to `e46bb27c9487d332f40fcefd4dd880304d1d31f1`. Created `/tmp/la-review-a-4aedf2d7c7c0` with `git clone --no-hardlinks --branch la-gate-test-3 --single-branch`; the shared gate source remained read only.
- Extracted the exact diff block from the pinned addendum into `reviewer-addendum.patch`. `git apply --check --verbose reviewer-addendum.patch` **passed** against the private frozen checkout. Applied it there for inspection; `git diff --check` also passed. It changes one test file, 21 insertions and 4 deletions.
- A comparison against the frozen file confirms all other cases are byte-identical. Outside the named case, only the `httpsRequest` import is added. All original assertions from `client_id` through the state cookie are byte-identical, including both hints, `scope`, `response_type`, `response_mode`, `prompt`, and state/nonce lengths. They now read the query from `data.authUrl`; no existing hint assertion is weakened.
- The patch correctly adds status 200/no Location, the specified cache/referrer/CSP headers, JSON target/origin/state equality, then follows `authUrl`, posts the returned form with the original state cookie, asserts launch 303 and retains `canvas-oidc.missing === []`. Secret capture is retained. The key oracle above is the exception to the required expected answer.
- The frozen-tree scan finds `lti_storage_target` only in this case. No shared helper or product file changes; no LMS name added to a core path. The submitted QA commit itself changes only the addendum document, pending LD-9 approval. This review does not approve the full wave gate or claim live acceptance evidence.
- Private evidence: `reviewer-scope.log`, `reviewer-key-pattern.txt`, `reviewer-key-probe.log` and the extracted patch. No dependency installation, stack, Docker, live request, host stack runner or commit. Type checking and live SIM were not rerun. Reviewer-B's file was not opened. Only this review file was written in integration.


## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed the Round 2 addendum at `02cdf091` against BD-A2-110, BD-A1-114, LA-ADR-05 D1, LA-ADR-04 D8 and plan §6.1 LD-9. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT. All Round 1 finding IDs are closed.**

- **A-LD9-R2-01 / B-LA-E7-08-LD9-03 closed:** the proposed assertion is now `/^cog_state_[0-9a-f]$/`. A host probe using the regex extracted from the applied patch accepts all 16 valid keys and rejects seven invalid samples, including the former 16-digit key. The Round 2 rationale and table agree.
- **A-LD9-R2-02 / B-LA-E7-08-LD9-04 closed:** Round 2 corrects the target limit/grammar, profile trait and authentication-endpoint origin rules. Helper locations, non-302 return behavior, simulator hostname, frozen scan and package/script names match the pinned source. The cited Slot 3C summary, case ledger and command log exist and confirm `200 !== 302` at `21-canvas-protocol.test.ts:19:10`; the plan and ADR references now point to the actual decisions.

BD-A2-110 checks:

| Required answer | Result |
| --- | --- |
| Login 200, no Location, cache/referrer headers and exact nonce CSP pattern | All asserted. |
| Parse `lti-storage-data`; target, auth origin, one-digit key and state equal to `authUrl` state | All asserted with the specified values. |
| Preserve authorize URL, client/redirect IDs, both hints, scope, response type/mode, prompt, state/nonce lengths and state cookie | Assertions are byte-identical to the frozen case; only the URL source changes to `data.authUrl`. No hint check is weaker. |
| Complete cookie launch and retain simulator check | Follows `authUrl`, parses/posts the form with `started.cookie`, retains secret capture, asserts 303 and unchanged `canvas-oidc.missing === []`. |

`git apply --check --verbose` and `git diff --check` pass in `/tmp/la-reviewer-a-ctx-4f6925776076`, a fresh `--no-hardlinks` clone at `la-gate-test-3` (`e46bb27c`). Applied blob: `36a3ffa818b0721a722996c71438bfdff06b74e3`. Only the named case and its `httpsRequest` import change (21 insertions, 4 deletions); every other case and shared helper is unchanged. The frozen scan finds only this case sending `lti_storage_target`. No product/core path changes are proposed; this is the QA-owned LA-IC-06 list.

Evidence: `/tmp/la-reviewer-a-ctx-4f6925776076-evidence/` (`round2.patch`, `apply-check.log`, `scope.json`, `key-probe.json`, `reference-check.json`). The gate source remains clean and untouched. No dependency installation, typecheck rerun, Docker, stack, live request or commit; the authorized M1 SIM re-gate remains pending. Both Round 1 reports were read at `02cdf091` as explicitly requested; no Round 2 Reviewer-B content was opened. Only this review file changed in integration.
