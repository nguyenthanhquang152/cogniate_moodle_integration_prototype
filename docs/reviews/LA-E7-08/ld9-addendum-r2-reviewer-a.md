Verdict: CHANGES_REQUESTED
Round: 1

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
