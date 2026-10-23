Verdict: CHANGES_REQUESTED
Round: 1

# LA-E6-01 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `981f5e26`, `5cc87e45`, `10c2fc88`, `d750972a`, `529b3731`, `1b286871`, `3eb1c7f6` and `4173b387` (merge `49f1ce48`) against the task spec, LA-ADR-08 D4, contract delta §2.6/§5/§6, app API delta §3.7, BD-A2-98/99 and plan §6.1.

### A-LA-E6-01-01 — BLOCKER — Malformed key entries give a successful JWKS check

**File:** `services/lti-service/src/http/routes/platform-check.ts:57`.

**Problem:** `checkJwks` treats any non-empty `keys` array as a valid key set, even when it contains no key. This produces a wrong connection-check result, contrary to BD-A2-98 and D4's `invalid_jwks` rule.

**Evidence:** private real-route probes return HTTP 200 with each of `{"keys":[null]}`, `{"keys":["not-a-key"]}` and `{"keys":[{}]}` from the JWKS endpoint, alongside a successful token response. All three checks answer `jwks: { ok: true, keys: 1 }` instead of `{ ok: false, detail: "invalid_jwks" }`. The app computes `result: "ok"` from the two booleans, so the portal can show "Cogniate can reach {LMS}." for this invalid key set. The existing unit tests cover an empty array and invalid JSON, but not invalid entries. The installed launch-verification library also rejects these inputs: `JWKSInvalid` for null/string and `JWKSNoMatchingKey` for the empty object with RS256.

**Suggested fix:** validate the key-set document and its key entries before reporting success; an array with no actual key must give `invalid_jwks`. Add the three cases above and retain a valid-key success control. No launch or signature verification request is needed for this check.

### Other review results

- Tenant lookups stay scoped to the caller's account/library. App session and CSRF checks, LTI Bearer/admin scope, the admin rate class, and the connection/platform minute limits apply. Staged, pending and disabled app connections, inactive platforms and inactive deployments are refused before outbound work. A concurrent app probe permits one check and refuses the duplicate.
- Both platform requests use the guarded client. A private probe using the real guard blocks HTTP JWKS and private-IP token URLs without invoking transport. The check uses a separate token client, selects only the permitted AGS scope, and does not return or retain a token in the shared cache.
- Success and failure probes find no token/assertion value in responses, logs or audit details. Attacker-controlled OAuth error text is reduced to a fixed result class. `token_result` and `tokenResult` remain visible without weakening shared redaction. The public audit test verifies one `platform.check` event and its API-key actor.
- UNIT AC-09 has tests for capability/status gating, all result texts and the panel on the real connection page. Removing the panel mount makes the Canvas and generic page tests fail. The authorized RQ-2 mount/client changes are isolated; no forbidden channel manifest or platform/connection route file changed, and F1 finds no LMS-name branch in core code.

### Verification

Fresh private clone `/tmp/la-reviewer-a-ctx-a3585ad0ddc5`, pinned to `b644f1db908c968e83c292abf66e481ccf741465`, with its own `npm ci` and the Vitest cache deleted before every run:

- Public LTI, app, client and portal suites: **108/108**. K0: **145/145**.
- Private probes: **6 passed, 3 failed**; all three failures reproduce A-LA-E6-01-01. The unauthenticated app probe supplies a valid Origin so it reaches the session guard; missing-Origin refusal is tested separately.
- Five negative controls are detected: removing platform readiness, connection readiness, the minute limit, the safe result-log name, or the portal panel mount. Restored public checks: **96/96**.
- LTI, app and portal typechecks and targeted lint pass. F1: **0 hits**. F5: **6 rules, 0 hits**.

Probe sources are saved under `/tmp/la-reviewer-a-ctx-a3585ad0ddc5-probes`; logs use the same prefix, including `-probes-confirmed.log`. Product files were restored and temporary probes removed; the clone is clean. Only this report changed in integration. No Docker, stack, commit or other reviewer's file was used. The malformed-JWKS fix and its regression tests remain required; SIM acceptance and runtime regressions remain QA work.
