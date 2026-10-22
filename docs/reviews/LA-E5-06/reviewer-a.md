Verdict: APPROVE
Round: 1

# LA-E5-06 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: the LA-E5-06 commits of merge `028c30a` (`git log --oneline 028c30a^1..028c30a^2 -- services/lti-service`):
  - `87a5ada`, the task;
  - `73ba9ce`, RQ-2 in an S1 file (`store/settings.test.ts` fixture);
  - `af9bcf8`, RQ-2 in an S2 file (`store/registrations.ts`: `client_key` stored and cleared at completion).

  Line references are at `HEAD`. The LA-E3-06 commits of the same merge touch only the scope lines of `http/routes/registration.ts`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-06.md`; LA-ADR-06 D1 (session cap), D2 (resolver, status effects); LA-ADR-07 D2; contract delta §1.3, §1.5, §2.3, §2.4; A2 BD-A2-20, BD-A2-48, BD-A2-49.
- I ran on the host (no Docker):
  - Vitest on `http/routes/protocol`, `http/routes/registration`, `lti/**`, `store/registrations` and `store/settings`: 236 tests pass.
  - `infra/scripts/fitness/protocol-urls.test.mjs`: 2/2 pass. F5 on the tree: `PASS`.
  - Four `rules.mjs --stdin` probes of `protocol-urls`.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT.**

## Checks

| Check | Result |
| --- | --- |
| A suspended or closed account can never start a launch or a registration | Correct. `protocolAccountError` gives `UNKNOWN_TOOL_ACCOUNT` (404) for a missing or `closed` account and `TOOL_ACCOUNT_SUSPENDED` (403) for `suspended`. The check is the first step of each protocol entry: login (GET and POST), launch, storage check and registration start. The admin `complete` is behind Bearer authentication, which already refuses a suspended or closed account. The new test, for both statuses: no `Set-Cookie` on login; a launch with a valid earlier state gives the page with no `Location`, the state row stays unused and no `launch` row is written; registration start writes no `registration_session` row; there are no outbound calls; and the other account keeps working. |
| The gate runs before any cookie, state or outbound fetch | Yes. Login: before `saveState` and the cookie. Launch: before `check1And3State`, so a refused launch does not use up the state. Registration: before the query parse result is used, the session cap and `fetchConfiguration`. |
| `GET /lti/keys/:account` | `suspended` still gives `200` with its keys; `closed` or missing gives `404` (test). |
| The resolver never gives one account's URLs to another | Correct. Every caller computes `protocolUrls(account)` once per request from the account it just resolved or authenticated: login and launch from the path account; registration `complete` and `signedDeepLink` from `caller.account`, the account of the Bearer key or ltik. `checkContentItems` used to take `launch.toolAccountId`; it now takes the caller's account, which is the same account because the ltik is bound to its launch. The target helpers only compare with the given `{ launch }`, and the test refuses another account's URL (AC-09). |
| Same URLs for an `active` account | Yes. The path-mode resolver gives `${PUBLIC_LTI_URL}/lti/{login,launch,keys,register}/${id}`. Account ids are already URL-safe, so the dropped `encodeURIComponent` changes no value. The storage-check URL is `launch + '/storage-check'`, as before. Host mode throws, and LA has no host mode. |
| Session cap (AC-05, AC-06) | `checkRegistrationSessionCap` counts `open` and `completing`, unexpired sessions per (address key, account), before the outbound fetch, and the `409` page writes nothing. `client_key` is stored on the session and cleared at completion (BD-A2-20). The test covers the cap, the per-account split, and the release on completion and expiry. Concurrency: A-LA-E5-06-01. |
| Page codes | `REGISTRATION_SESSION_LIMIT` `409` with its action line. `TOOL_ACCOUNT_SUSPENDED` `403` was already in place. |
| "Must not edit" and ownership | Respected. `accounts/**`, `store/accounts.ts`, `http/rate-limit.ts`, `http/app.ts` and `http/auth.ts` are unchanged. The two S-file test and store lines are the named RQ-2 commits. `lti/checks.ts`, `lti/deep-linking.ts` and `http/service-context.ts` are the callers that BD-A2-49 names. |

## Findings

- **A-LA-E5-06-01 (MINOR): the session cap is checked before an `await` and enforced nowhere after it, so parallel starts from one address can pass the cap.**
  - Where: `services/lti-service/src/http/routes/registration.ts:137` (count), `:140` (`await fetchConfiguration`, an outbound fetch to a URL that the caller chooses), `:161` (`createRegistrationSession`).
  - Problem:
    - Registration start is a public `GET`. Requests that arrive while the first ones wait for their configuration fetch all see the same count (no row exists yet), and each then inserts its own session.
    - A sender can point `openid_configuration` at a slow server of its own and start N requests at once. It then gets N open sessions from one address instead of the cap (3 in AC-05).
    - Only the per-address `registration` rate limit (its burst) bounds N. The sequential test (AC-05) cannot show this.
  - Suggested fix: keep the early check (no fetch when the address is already full). Then count again inside the same transaction as the insert in `createRegistrationSession` (or with an `INSERT … SELECT … WHERE (count) < limit`), and answer `REGISTRATION_SESSION_LIMIT` when that fails. Add a test with two starts held at the fetch.
- **A-LA-E5-06-02 (MINOR): F5 `protocol-urls` has false passes for two simple ways to build the URL.**
  - Where: `infra/scripts/fitness/rules/protocol-urls.mjs:16`. It matches only `/lti/<endpoint>/`, with a leading and a trailing slash, inside one literal.
  - Problem: probes at `services/lti-service/src/lti/probe.ts`:

    | Probe | Result |
    | --- | --- |
    | `` `${base}/lti/launch/${id}` `` | hit (correct) |
    | `` `${base}/lti/launch` + "/" + id `` | `F5 PASS` |
    | `` new URL(`lti/launch/${id}`, base + "/") `` | `F5 PASS` |
    | `[base, "lti", "launch", id].join("/")` | `F5 PASS` |

    AC-08 (the probe `'/lti/launch/'`) still fails as required, but the rule is meant to catch any new construction (BD-A2-48: "A pattern exemption still catches a new construction"). The tree has no such construction today.
  - Suggested fix: match `/?lti/(launch|login|keys|register)(/|$)`, so the leading slash is optional and a literal may end at the endpoint name. Keep the `:account` route-pattern exemption, and add the second and third probes as test rows. The segment-join form can stay out of scope; name that limit in the rule comment.

## Notes (no finding)

- A launch refused by the status gate leaves the browser's state cookie and the unused state row. The row expires with `STATE_TTL_MS`, and the account cannot use it while it is suspended or closed.
- AC-01 to AC-07 and AC-10 are K1-SIM and AC-08 is K0, and they wait for QA. The unit tests above cover their logic.
