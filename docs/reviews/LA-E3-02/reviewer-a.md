Verdict: APPROVE
Round: 2

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

## Round 2 (fix round: storage-check CSP, BD-A2-103)

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, Claude session). Round 1 above was Reviewer-A2.
- Diff: `git show 2ea1f624` (merge `02f5d420`, lane L). It changes `lti/storage-pages.ts`, `lti/launch.ts` and two tests. The page was found by QA-E2E's live K2 run (`docs/reviews/LA-E7-07/qa.md` P3).
- References: A2 BD-A2-103; LA-ADR-05 D1 rule 7; security delta §5 (storage-check row).
- I ran these in the private clone at `02f5d420`. I deleted the Vitest cache before each run. No Docker.
  - Vitest on `services/lti-service`: 1326 tests pass.
  - `npm run test:k0`: 145 tests pass.
  - F1 PASS; `npm run typecheck`: exit 0; ESLint on `lti/`: clean.
  - A probe of `formActionSources` with 16 inputs, and of the login page CSP. The probe file is kept at `/tmp/ra-e201/e302/ra-csp.test.ts`.
- Blind review: I did not open the other reviewer's file.
- **Counts (this round): 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** Round 1's A-LA-E3-02-01 is not part of this fix.

| Check | Result |
| --- | --- |
| Exactly one extra origin, from the account's own tool URL | Holds. `formActionSources(toolUrl)` (`storage-pages.ts:89`) gives `'self' <origin>` or `'self'`, never more. The origin comes from `toolUrlOf(account, prepared.messageType)` (`launch.ts:85`): `deepLinkingUrl` for Deep Linking, else `launchUrl`. This is the same helper that builds the 303 in `completeLaunch`, so the allowed origin and the redirect target cannot differ. The test checks the full header and `new URL(result.location).origin` for a resource link, a Deep Linking launch (`:8443`), and a second account (its operator-set URL, not `PUBLIC_APP_URL`). The old code fails these tests (old header: `form-action 'self'`). |
| Never a wildcard or a scheme source | Holds. The origin must match `^https://[a-z0-9.-]+(:\d{1,5})?$` after URL normalization. Probe: `https://*.app.test/x`, `https:`, `javascript:…`, an empty string and `http://…` all give `'self'` only. |
| No header injection from an operator-set URL | Holds. The guard is an allow list on the serialized origin. Probe:<br>- `;` and `,` (literal or `%3B`/`%2C`), a space and `"` give `'self'`;<br>- tab and CR/LF are removed by the WHATWG URL parser before the origin is built (`https://a\r\nb.test` → `https://ab.test`). That is the same host that the 303 `Location` uses, because `toolRedirect` also parses with `URL`. No control byte reaches the header;<br>- IPv6 literals (brackets) give `'self'`; IDN becomes punycode; user info is not in the origin; `:443` is removed. |
| Other directives unchanged | Holds. The header is still `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action …; base-uri 'none'`. `Referrer-Policy: same-origin` and `cache-control: no-store` are unchanged. The nonce is fresh per page (test). The tool URL is a header value only: the test checks it is not in the HTML or the page data (`toolUrl` is removed from `publicData`). |
| No other page changed | Holds. Only `storageCheckPage` changed. Probe: the storage login page still sends `form-action 'none'`. Error pages have no form (BD-A2-103). |

Lens A note: the form's `action` stays our `postUrl`, and the page's scripts run only with the nonce. So the new source matters only for the redirect to the account's own tool, where the launch goes anyway.

### Verdict (round 2)

APPROVE for lens A. The storage-check page allows exactly the one tool origin of its own 303. The origin is guarded by an allow list, so no header injection and no wildcard are possible. Everything else in the policy is unchanged.
