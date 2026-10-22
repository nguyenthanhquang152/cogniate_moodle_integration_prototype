Verdict: APPROVE
Round: 1

# LA-E3-02 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E3-02.md`. Design: LA-ADR-05 D1 rules 1a and 5–11, and its security property; contract delta §1.5, §2.2, §6, §7; BD-A1-33, BD-A1-34.

Diff: `git diff d3c4848^1 d3c4848` (11 files).

Method: a throwaway `git archive d3c4848` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service and kernel unit tests (72 files, 877 passed) and 10 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E3-02-01 | MINOR | `cleanupStorageChecks` has no caller yet, while this commit turns the storage path on for every Canvas profile. So `storage_check` rows (with the kept launch claims) are never deleted until S1's RQ-1 line lands. |

There is no BLOCKER and no MAJOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E3-02-01 — MINOR — the 10-minute retention of `storage_check` is not wired

- **File:** `services/lti-service/src/store/storage-checks.ts:38` (`cleanupStorageChecks`). `git grep` finds no caller in product code at `d3c4848`.
- **Problem:** LA-ADR-05 D1 rule 11 and contract delta §7 keep `storage_check` rows for 10 minutes. Each row holds the prepared launch: the kept claims after the claim policy, the platform, the deployment and the origins. The spec gives the call to S1 by RQ-1, in the LTI retention job (LA-E5-19 AC-09, "pending: LA-E3-02"). This same commit sets `platformStorage` on every Canvas profile, so every framed Canvas launch without a cookie now writes a row, and no row is ever removed.
- **Suggested fix:** the Lead routes S1's one line (`cleanupStorageChecks(db, ctx.now())` in `jobs/retention.ts`, one more `retention_cleanup` table) with this merge, or before a stack with real Canvas launches runs. LA-E5-19 AC-09 then closes.

## Checks that pass

| Item | Result |
| --- | --- |
| No replay (lens focus) | `consumeStorageCheck` is one `UPDATE … SET used_at … WHERE check_hash = ? AND tool_account_id = ? AND used_at IS NULL AND expires_at > ? RETURNING`. That one statement checks single use, the 120 s life and the account. The check token is 32 random bytes, only its SHA-256 is stored, and a malformed token is refused before the query. The OIDC state was already used up at check 3. Mutants S3 (reuse) and S4 (`>=` at the expiry boundary) are killed. |
| No cross-account, no cross-origin (lens focus) | The account status gate runs first (`suspended` → `403 TOOL_ACCOUNT_SUSPENDED`, `closed` or unknown → `UNKNOWN_TOOL_ACCOUNT`, with the contract delta §1.5 text). Then `Origin` must equal the origin of `PUBLIC_LTI_URL` (a missing header, `null` or another site → `400 INVALID_STATE storage_origin`). Both run before the consume, so the row stays unused. The consume binds the URL account. Mutants S1 (Origin check after the consume), S2 (any account) and S6 (no account gate) are each killed. |
| Constant-time compare | `safeEqual(sha256Hex(value), rec.stateHash)`: both are 64 hex characters. An empty value gives `STATE_COOKIE_MISSING` with the rule-8 help text (mutant S8 is killed). Any other value gives `INVALID_STATE storage_mismatch`. |
| Prepared launch single use (lens focus) | No ltik exists before the check. The row is consumed once, and only then does `completeLaunch` store the launch and make the ltik. That is the same function as the cookie path, so `binding: "storage"` and `"cookie"` give the same `303`, cookie clear and `product_family_code` update. The prepared launch is built after checks 4–14 and the claim policy, so a bad signature gets its error page, not the storage page (AC-07). |
| Page data (lens focus) | `storageCheckPage` drops `stateHash` and puts only its first digit into the key, so the page carries the post URL, the check token, the target, O, the key and a random message id. It has no state value and no claims (mutant S7 is killed). The JSON block uses the escaped `scriptJson` of LA-E3-01. CSP `… form-action 'self' …` and `Referrer-Policy: same-origin` follow rule 7, so the form POST carries our `Origin`. `get_data` goes only to O, never to `*` (mutant S9 is killed). Replies count only from O, with the `.response` subject, the same `message_id`, no `error` member and a string `value`. |
| Cookie first, and the 16-slot key (lens focus; this corrects my LA-E3-01 note) | Only a **missing** cookie with a stored target takes the storage path. A cookie that is present, even a wrong one, keeps today's check 2 failure (mutant S5 is killed). So the cookie is always tried first. On the storage path there is no cookie left to fall back to. If a parallel login with the same first digit overwrote `cog_state_<d>`, the posted value differs, and the check fails closed with `storage_mismatch` (rule 8), so the user starts again from the LMS. This is safe. The chance (1/16 for two logins at the same time in one browser) is the design trade-off of rule 3, a design note for A2 and not a defect. My LA-E3-01 note said "fall back to the cookie", which was not exact. |
| Retention function | `cleanupStorageChecks` deletes rows created more than 10 minutes ago and keeps newer rows (AC-04; mutant S10 is killed). See A-LA-E3-02-01 for the missing caller. |
| Method rule | Every method except `POST` on the storage-check path gives `405` with `Allow: POST`. |
| Canvas trait values | Every Canvas profile gets `{ targetFrame: 'from-login', origin: 'authOrigin' }` through the shared `canvas` base, which includes `canvas-sim-cloud`. `standard` and Blackboard stay `null`. The cookie path stays the first choice, so a Canvas launch that has its cookie behaves as before (AC-10). |
| 120 s window (note) | The prepared launch can complete up to 120 s after the checks, without a new platform `active` check. The design accepts this ("exactly as the cookie path"), and the app's launch routing still refuses a disabled connection, so the effect is small. |
| Ownership | `lti/codes.ts` gets one new code, `TOOL_ACCOUNT_SUSPENDED`, with the contract delta §1.5 text. The spec allows "new detail values only" in that file, so the Lead may record this. No other "Must not edit" file is touched. |
