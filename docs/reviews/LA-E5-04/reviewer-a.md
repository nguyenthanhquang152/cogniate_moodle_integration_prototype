Verdict: CHANGES_REQUESTED
Round: 1

# LA-E5-04 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff a00c090^1 a00c090` (what the merge added; lane `la-s1`), including the RQ-2 commits `5a422c9` (`createFirstToolKey` in S2's `store/tool-keys.ts`, BD-A2-07) and `1f860ad` (S2's cleanup test fixture). These files at `HEAD` are the same as at `a00c090`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-04.md`; LA-ADR-06 D2 (with the paragraph "Operator writes on a closed account"), D4 and D7 "First key"; LA-ADR-07 D1; contract delta §1.1, §1.5, §3 and §5; A2 BD-A2-07 and BD-A2-12.
- I ran on the host (no Docker):
  - 11 vitest files, 170 tests pass (`accounts/**`, `operator/accounts`, `operator/shared-platforms`, `http/auth`, `store/accounts`, `store/tool-keys`, `cli/**`).
  - One probe script outside the repo, against an in-memory database (A-LA-E5-04-01).
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Tenant isolation | Correct. The tenant API still finds the account only from the API key's hash. The new gate adds a `401` for a `closed` account, the same answer as an unknown key, so the gate is not an account oracle. It adds `403 TOOL_ACCOUNT_SUSPENDED` for a `suspended` account only after the credential is valid, for Bearer, `SERVICE-AUTH` and `LTIK-AUTH` (`http/auth.ts`). Operator writes name the account in the path. The shared platform is created under that account only. No answer contains a key or a hash: `toAccount` has no `api_key_hash`, and the shared-platform answer has only the public key PEM. |
| Close is atomic and final | Correct for the account's own data. `updateAccount` runs in one transaction inside the `audit.change` (`store/accounts.ts:76-95`). It checks `requireWritableAccount`, then writes the row, and on `closed` it replaces `api_key_hash` with an unusable hash, revokes every `api_key` row (once LA-E5-07's table exists) and every service key. The `account.status` event commits with it. A later `PATCH`, `ensureAccount` (bootstrap) or shared-platform create gives `409 ACCOUNT_CLOSED`. Gap on other lanes' write routes: A-LA-E5-04-01. |
| BD-A2-12 order and place | Correct in this task's routes. `PATCH` and `POST …/shared-platforms` check `404`, then `409 ACCOUNT_CLOSED`, before the body `400`. The same helper runs again inside the change transaction, so a concurrent close cannot slip in between. Each refusal writes one `refused` event. |
| Account create (BD-A2-07) | Correct. The body check and a pre-check of the id (`409 ACCOUNT_ALREADY_EXISTS`) come before any RSA work. `prepareToolKey` (async) runs before the `audit.change`. One change then inserts the account (with a repeat id check) and `createFirstToolKey`, which is guarded: the account exists and has no key in any state, else a plain error. One `account.create` event has `details.kid` and the field names. New accounts get the SHA-256 of 32 fresh random bytes as `api_key_hash` (AC-12) and the `allowlist` claim policy. Tests: a failed audit insert and a failed key preparation each leave no account and no key. |
| Audit events | Every successful write has exactly one event (`account.create`, `account.status` when `status` changes, else `account.update`, `platform.create_shared` also for the `200` repeat with `created: false`). Each `4xx` has one `refused` event. Reads write none. The details hold field names, `status` and `kid` only. |
| Path-mode resolver | Safe. `resolveAccount` takes only `params.account` and accepts it only if it matches `ACCOUNT_ID` (`^[a-z0-9][a-z0-9-]{0,62}$`). So an encoded slash, `..`, upper case, Unicode or an over-long id resolves to `null`, not to another account. `protocolUrls` builds from the configured `PUBLIC_LTI_URL` and the stored id, and refuses host mode. AC-10 (today's `cogniate` URLs byte for byte) has a test. The call sites are LA-E5-06. |
| Tool URL and setting checks | Correct (AP-06-09). The value must be `https`, with no user info and no `#`, at most 2,048 characters and no surrounding spaces. Its host (without port or trailing dot) must not be the LTI or content host. `publicBaseUrl` accepts only `null`. `claimPolicy` and `limits` are strict shapes. These URLs are browser redirects, never server-side fetches, so an IP host is not an SSRF path. |
| Migration `010` (AC-11) | Correct. Old rows get `status: active`, `status_changed_at = created_at`, path mode, `claim_policy` `null` and `service_key_write_scope: context`. The tool URLs are unchanged (test on an M1 fixture). |
| UNIT ACs fail on the old behaviour | Yes. AC-10, AC-11 and AC-12 need the new resolver, columns and create path. |
| "Must not edit" and ownership | Respected. `lti/**`, `routes/{protocol,registration}.ts` and `store/service-keys.ts` are unchanged. The `tool-keys.ts` edit and the cleanup fixture are the RQ-2 commits. `http/auth.ts` is S1's in B1. |

## Findings

- **A-LA-E5-04-01 (BLOCKER): on a closed account, the operator API still creates and activates signing keys.**
  - Required outcome (LA-ADR-06 D2, "Operator writes on a closed account", BD-A2-12): "A write that adds, enables or changes anything gives `409 ACCOUNT_CLOSED`: `PATCH` of the account, API key issue, **signing-key create and activate**, shared-platform create, and every later write route of an account. … One check in one place: a helper of the accounts store (S1) … Every account-scoped operator write calls it inside its `audit.change` transaction."
  - Where: `services/lti-service/src/http/operator/signing-keys.ts:35-39` and `:53-54`, and the store checks they call (`store/tool-keys.ts:43`, `requireSigningKeyAccount`, which gives only `404`). `requireWritableAccount` is called only by this task's routes.
  - Evidence: a probe with `buildOperatorApp` on an in-memory database, all through the operator API:
    - `POST /operator/v1/accounts` (`zz-closed`) → `201`.
    - `PATCH … {status: "closed"}` → `200`.
    - A later `PATCH {name}` → `409 ACCOUNT_CLOSED`, which is correct.
    - But `POST …/zz-closed/signing-keys` → `201`, and `POST …/signing-keys/<kid>/activate {force: true}` → `200`.
  - Problem: close is not final for signing keys. A closed account gets a new published key and a new active key, each with an `ok` audit event, against a required control of the tenant model this task builds. The route files are S2's (LA-E5-10), so the fix needs S2 or a Lead RQ-2. Retire immediate must stay allowed (it only removes access).
  - Suggested fix:
    - Call `requireWritableAccount` inside the transactions of `createNextToolKey` and `activateToolKey`, and as the route pre-check before `prepareToolKey`, so the order is `404`, `409 ACCOUNT_CLOSED`, then the body.
    - Leave `removeToolKey` on the existence check.
    - Add one unit test per route: on a closed account, create and activate give `409 ACCOUNT_CLOSED` with one `refused` event, and retire immediate still gives `200`.
    - Record the same call as a rule for LA-E5-07's issue route (BD-A2-12 already names it).
- **A-LA-E5-04-02 (MINOR): `lti:bootstrap` on an existing account silently resets the operator-set tool URLs.**
  - Where: `services/lti-service/src/store/accounts.ts:141` (`ensureAccount` sets `name`, `launch_url`, `deep_linking_url` and `registration_url` from `PUBLIC_APP_URL` on every run).
  - Problem:
    - This task makes the three tool URLs operator-settable per account (D2). A later `lti:bootstrap --account <id>` (for example the `npm run seed` path, which bootstraps `cogniate` and `qa-second`) overwrites a `PATCH`-ed `launchUrl` with the Cogniate app URL, with no audit event.
    - That account's launches (with their `ltik`) then go to the Cogniate app instead of the account's own tool. The app's own API key cannot read another account's `ltik`, so no data leaks through the API. But the redirect target and the audit trail are wrong.
    - D2 says only that the bootstrap of `cogniate` keeps the app URLs.
  - Suggested fix: in `ensureAccount`, set the tool URLs only when it creates the row (or only for `cogniate`). On an existing account, change only the name. LA-E5-05 then moves the CLI to the audited API.
- **A-LA-E5-04-03 (NIT): the `PATCH` audit action is chosen from a read outside the transaction.**
  - Where: `services/lti-service/src/http/operator/accounts.ts:64-68` (`current` and `changedStatus` before `ctx.audited`).
  - Problem: when two `PATCH` calls change `status` at the same time, the second one's action (`account.status` or `account.update`) and its `details.status` come from the state before the first commit, so the event can name a status change that did not happen. The data is still right (the store checks inside its transaction).
  - Suggested fix: let `updateAccount` return whether `status` changed, and set the action from that. For example, write the event with `audit.change`'s `describe`, or use one action `account.update` with `details.statusFrom`/`statusTo`.

## Notes (no finding)

- The K1-SIM ACs (AC-01 to AC-09) wait for QA-2's Docker window. AC-08 also waits for LA-E5-07. The unit tests above cover their logic.
- `lti:shared-platform` (direct database write) and `lti:bootstrap` still change data without an audit event until LA-E5-05, as the spec says (Out).
