Verdict: APPROVE
Round: 1

# LA-E5-06 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 028c30a^1 028c30a` (lane L commit `87a5ada` plus the RQ-2 commits `af9bcf8` (S2 file) and `73ba9ce` (S1 file); the same merge holds the LA-E3-06 fix round, reviewed in `docs/reviews/LA-E3-06/reviewer-b.md`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-06.md`. Design: LA-ADR-06 D2 (resolver, status effects), D1 (session cap); contract delta §1.3, §1.5, §2.3, §2.4; BD-A2-20, -48, -49. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 3 NIT.**

The refusals are clear for both readers:
- A learner sees "This Cogniate tool is switched off. Ask your Cogniate admin." (`403 TOOL_ACCOUNT_SUSPENDED`), or "Too many registrations are open. Wait one hour, or finish the open registration in {LMS}." (`409 REGISTRATION_SESSION_LIMIT`). The hour matches the session limit (`SESSION_MAX_MS` = 1 h).
- The operator gets a stable detail per refusal (`account_suspended`, `unknown_tool_account`, `registration_session_limit`).
- The gate runs before any state row, cookie or outbound fetch, and the tests prove that: no `Set-Cookie`, no configuration fetch.
- The protocol code now takes its URLs from one object, `protocolUrls(account)`.
- The new F5 rule `protocol-urls` refuses a hand-built `/lti/launch/…` URL in the LTI service with a message that names the resolver.

My NITs are about how the resolver is passed around.

## How I checked

- Scratch clone of `028c30a` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service`: **77 files, 968 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0. `node --test infra/scripts/fitness/protocol-urls.test.mjs`: 2 of 2.
- `node infra/scripts/fitness/rules.mjs`: `F5 PASS: 6 rules … 0 hits`. A probe `base + '/lti/launch/' + id` as `services/lti-service/src/lti/probe.ts` gives one `protocol-urls` hit: "Build protocol URLs with accounts/resolver.ts protocolUrls(account) (LA-ADR-06 D2)". The same text in an app file passes, because the rule covers the LTI service only (BD-A2-48). The channel copies of these paths are my LA-E1-08 finding B-LA-E1-08-01.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `lti/{target,login,launch,registration,checks,deep-linking,codes}.ts`, `http/routes/{protocol,registration}.ts`, `http/service-context.ts` (the DL caller that BD-A2-49 names), the new F5 rule and its test. RQ-2 edits in `store/registrations.ts` (S2: keep `client_key` until completion) and `store/settings.test.ts` (S1 fixture). No edit of `accounts/**`, `store/accounts.ts`, `http/rate-limit.ts`, `http/app.ts`, `http/auth.ts` or app files. OK. |
| Ownership | Lane L in B2, plus the two RQ-2 lines. OK. |
| No behaviour change outside the spec | For an `active` account the URLs are today's values (`target.test.ts` and the registration request test); only the status and cap refusals are new. |
| No LMS name in core | None added. |
| UNIT AC | AC-09 (`lti/target.test.ts`): `isOwnLaunchTarget` accepts the account's launch URL (with or without a query) and refuses another account's launch URL, the login, keys and register URLs, the app's launch and deep-linking URLs, and malformed values. The protocol and registration tests cover the status pages (no cookie) and the cap per account, with release on completion and expiry. |

## Findings

### B-LA-E5-06-01 — NIT — The resolver is built in five places per request, sometimes with a made-up request

- **File:** `services/lti-service/src/lti/login.ts:38-40`, `lti/launch.ts:87`, `:113-115`, `http/service-context.ts:54`, `http/routes/protocol.ts:14`, `http/routes/registration.ts` (route setup).
- **Problem:** The design note says the protocol URLs are "computed once per request from the loaded account". Instead, each function calls `createAccountResolver(db, urls.lti)` again. The functions outside HTTP pass a made-up request object (`resolveAccount({ params: { account: accountId } })`). A reader must check that all five copies resolve the same account, and LG host mode, which needs the real request, will have to change each one.
- **Suggested fix:** Build the resolver once in the route context (`ctx.resolver`), resolve the account in the route, and pass `account` and `protocolUrls` into `initiateLogin`, `handleLaunch` and `handleStorageCheck`. If the resolver API (S1, LA-E5-04) should offer `accountById(id)` for the non-HTTP callers, ask S1 by RQ-1.

### B-LA-E5-06-02 — NIT — Two identity wrappers and a nested `ReturnType` type

- **File:** `services/lti-service/src/lti/target.ts:1-12`.
- **Problem:** `launchUri(urls)` now returns `urls.launch`, and `loginUri(urls)` returns `urls.login`. The doc comment above `launchUri` still describes a URL that it no longer builds. `ProtocolUrls` is `ReturnType<ReturnType<typeof createAccountResolver>['protocolUrls']>`, which a reader must unpick to learn the five fields.
- **Suggested fix:** Use `protocolUrls.launch` and `.login` directly, and remove the two wrappers. Export a named `ProtocolUrls` interface (`launch`, `login`, `keys`, `register`, …) from the resolver module (S1, by RQ-1), or declare it once here with its fields.

### B-LA-E5-06-03 — NIT — The account-status helper lives in `launch.ts`

- **File:** `services/lti-service/src/lti/login.ts:15` and `http/routes/registration.ts` import `protocolAccountError` from `lti/launch.ts`.
- **Problem:** Login and registration now depend on the launch module for a rule that belongs to all protocol entry points (contract delta §1.5). A reader who looks for the status rule will not look in `launch.ts`.
- **Suggested fix:** Move `protocolAccountError` (and the `account_suspended` / `unknown_tool_account` detail mapping that the three callers repeat) into a small `lti/account-status.ts`.

## Not checked

- K1-SIM AC-01 to -07, -10 and K0 AC-08 (QA). The storage-check route's own status gate (LA-E3-02).
