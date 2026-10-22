Verdict: APPROVE
Round: 2

# LA-E5-03 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 9cbd043^1 9cbd043` (what the merge added; lane `la-s1`). Related:
  - request 2: S2 commit `788e4de`, merged as `4a2234d`, the `onFail(scheme, code, part)` argument in `http/auth.ts`;
  - the shared `http/retry-after.ts` from LA-E5-14 (`77919da`, BD-A2-16).

  These files at `HEAD` are the same as at `9cbd043`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-03.md`; LA-ADR-06 D1 (with the `Retry-After` rule); contract delta §1.3, §1.4, §1.6 and §3; security-delta §11; A2 BD-A2-16 to BD-A2-20.
- I ran on the host (no Docker): 6 vitest files, 57 tests pass (`rate-limit`, `rate-limit-http`, `operator/rate-limits`, `store/settings`, `retry-after`, `auth`).
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| No bucket lets one sender block every tenant | Correct once the proxy is trusted (gap: A-LA-E5-03-01). The hard address classes (`protocol`, `registration`, `keys`, `auth_failure`) are keyed by the client address, and `api`, `admin` and `operator` by the key id. The account classes `protocol_account` and `registration_account` are soft: they log `rate_limit_soft` at most once a minute and never refuse (`http/rate-limit.ts:139`, `:146`). So one sender can drain only its own address, its own key or its own tenant's key budget. The LRU bound (100,000 keys) can only evict buckets, and an evicted bucket comes back full, so the bound weakens limits but never blocks another client. |
| `auth_failure` only before a valid key | Correct. `auth.ts` passes `part: 'api_key'` for every `401` before the key is proven: no or malformed header, wrong scheme, unknown, expired or revoked key, or the key of a closed account. It passes `'credential'` for an ltik or service-key `401` under a valid key, and a `403` (scope, suspended) is not a `401`. `app.ts:127` spends a token only for `'api_key'`. Every `/api/*` request checks its address bucket without spending (`:140`, `spend = false`, no bucket created), so once the bucket of that address is empty, a valid key from that address also gets `429` until the refill (AC-05, A-LAD-02; tests). The operator listener does the same with operator keys. |
| IPv6 /64 and proxy trust | Not spoofable by a client. `addressKey` turns an IPv6 address into its /64. An IPv4-mapped IPv6 address becomes the plain IPv4 address, and a zone id is dropped, so neither gives a second bucket (AC-10). Fastify uses `X-Forwarded-For` only when `proxy.trust(peer)` is true, and the trusted set holds only the configured CIDRs and the resolved addresses of the configured host names. `X-Forwarded-For` from an untrusted peer is ignored (test "ignores spoofed X-Forwarded-For"). Behind the trusted proxy, the closest untrusted hop is the client, and that address is logged. A bad CIDR or host value stops the start. |
| Order (D1) | Correct. The address classes run in an `onRequest` hook, by route pattern, before any database read. The soft account check reads the account only after its address check. `api` and `admin` run after the full `authenticate` (`app.ts:129`). `operator` runs after the operator key lookup. `/healthz`, `/readyz` and `/metrics` match no class. |
| Answers and `Retry-After` | Equal by construction. A refusal throws `RATE_LIMITED` with `details.retryAfter` = the whole seconds until one token refills (at least 1). The one API error handler normalizes the value with `retryAfterSeconds`, sets the `Retry-After` header and writes the same number back into the body. Protocol and registration routes get the `429` page with `Retry-After` from the same helper, and no cookie. `keys` answers the JSON error. |
| Settings and audit | Correct. `PATCH /operator/v1/rate-limits` is strict (an unknown class or a value below 1 gives `400`). It stores `service_setting` and writes one `settings.rate_limits` event in the same `audit.change`. The new values reach the shared limiter only after the commit, and a failed audit insert rolls back with no cache change (test). Both listeners share one limiter per database, and a changed limit starts a fresh budget at once (AC-08). A per-account override (`limits`) applies only to account-keyed classes, so a tenant value cannot change an address budget. |
| Session cap (BD-A2-20) | `checkRegistrationSessionCap` counts `open` and `completing`, unexpired rows per (address key, account). Rows from before the new column (`client_key` `NULL`) do not count. Migration `012` is additive. LA-E5-06 makes the call. |
| UNIT ACs fail on the old behaviour | Yes. AC-10 needs `addressKey`. AC-13 is the BD-A2-16 module and error-handler line (LA-E5-14), which the dispatch reuses. |
| "Must not edit" and ownership | Respected. `lti/**`, `routes/{protocol,registration}.ts` and `store/accounts.ts` are unchanged. `auth.ts` came from S2 as request 2. The `infra/compose.yaml` line is the named `TRUSTED_PROXY_CIDRS=proxy`. |

## Findings

- **A-LA-E5-03-01 (MINOR): while the proxy name does not resolve, every client behind the proxy shares the proxy's address buckets, for up to 60 s and without any log line.**
  - Where: `services/lti-service/src/http/rate-limit.ts:179-212` (`createTrustedProxy`: resolve at start, then every 60 s; a failed lookup removes trust) and `http/app.ts:110-113`. `infra/compose.yaml` sets `TRUSTED_PROXY_CIDRS: proxy`, and no `depends_on` orders `proxy` and `lti-service`.
  - Problem:
    - Failing closed is right for spoofing. But then every request through Caddy is keyed by Caddy's address, so the hard `protocol` budget (600/min, burst 200), the `keys` budget, and the `auth_failure` budget of external API callers (120/min) are shared by all clients.
    - In that window, one sender can drain them for every tenant behind the proxy: 200 fast logins, or 120 bad API keys. Normal load can drain them too: a class of learners that starts at once can pass the burst of 200.
    - The window opens when `lti-service` starts before `proxy` resolves (they start in parallel), when `proxy` is recreated with a new address (for example after a Caddyfile change), and on any lookup failure. It closes only at the next 60 s refresh.
    - Nothing in the logs shows that the trusted set is empty.
  - Suggested fix (keep fail-closed):
    - While a configured host name has no answer, retry every 5 s instead of 60 s.
    - Refresh on demand (at most every 5 s) when a request comes from an untrusted peer and the last refresh failed.
    - Log `trusted_proxy_unresolved {host}` (warn) once per failure and `trusted_proxy_resolved {host, addresses}` when it recovers.
    - Add one test: a resolver that fails once, then succeeds, gives trust within 5 s.
- **A-LA-E5-03-02 (NIT): the `settings.rate_limits` event names the changed fields but not their new values.**
  - Where: `services/lti-service/src/http/operator/rate-limits.ts:17-21` (`details: { fields }`).
  - Problem: limits are not secret, and D4 lets `details` hold the values of non-secret fields. With only names, the log can show who changed `classes.protocol`, but not that they set it to 1 per minute. A changed limit can block launches, so the value matters for an investigation.
  - Suggested fix: put the new values (and `null` for a removed override) into `details`, for example `{ classes: { protocol: { ratePerMinute: 3, burst: 3 } } }`. The size stays far under 4 KB.

## Notes (no finding)

- A tenant with many IPv6 /64 prefixes gets one full address budget per prefix. That is a property of per-address limits; D1 leaves the hard limit for many addresses to the edge (WAF, LG).
- The `api` and `admin` buckets are keyed by the API key id, so all Cogniate libraries share the first-party key's budget. D1 accepts this (A-LAD-11). It is per tenant, not across tenants.
- The K1-SIM ACs (AC-01 to AC-09, AC-11, AC-12) wait for QA-2's Docker window. The unit tests above cover their logic.

## Round 2

- Reviewer: Reviewer-A2 (the same lens A, plan LD-22). Date: 2026-10-22.
- Diff: the S1 fix commits `511da0f`, `4e0ac6a`, `c560133`, `cf92882`, `9eb7ec7`, `5f2a57e` and `ec0534e`, inside merge `8706619`. I read each commit on its own and did not review the LA-E5-05 commits of the same merge. Rulings: A2 BD-A2-29 and BD-A2-30.
- I ran on the host (no Docker), in a throwaway `git archive 8706619` copy: `vitest run services/lti-service/src/http` gives 21 files and 324 passed. I also ran 6 mutants on the fixes.
- Blind review: I did not open the other reviewer's file.
- **Round 2 counts: 0 open findings. The round-1 MINOR and NIT are closed. 1 NIT note below (no change needed).**

| Id | Round 1 | Round 2 result |
| --- | --- | --- |
| A-LA-E5-03-01 | MINOR | **Closed.** `createTrustedProxy` now retries in 5 s while any configured host has no address, and otherwise every 60 s. A one-shot timer is set after each refresh, so refreshes never overlap. It logs `trusted_proxy_unresolved {host}` (warn) for each host without an address (BD-A2-30). The trusted set stays fail-closed: a failed lookup still adds nothing. Duplicate host entries are merged. A test with a resolver that fails once, then succeeds, gives trust after the 5 s retry. Mutants Q1 (retry after 60 s) and Q5 (no log line) are each killed. The open window shrinks from up to 60 s to about 5 s after the proxy name resolves. |
| A-LA-E5-03-02 | NIT | **Closed.** The `settings.rate_limits` event now has `details: { fields, ...parsed.data }`: the changed classes with their new `ratePerMinute` and `burst`, `null` for a removed override, and `registrationSessionsPerAddress`. Limits are not secret, and the strict schema bounds the size. Mutant Q4 (names only) is killed. |

Other fix items, checked for lens A:

- **BD-A2-30 answer body.** `details.limit` is `{ class }` for the address classes (`protocol`, `registration`, `keys`, `auth_failure`), and `{ class, ratePerMinute, burst }` only for `api`, `admin` and `operator`. The values come from the validated override chain (account, then settings, then env, then default), so the body never holds an address, a key, a key id or an account. Mutant Q2 (numbers also for address classes) fails 5 tests.
- **BD-A2-30 log.** `rate_limited` adds `trace_id` and `key_id` (for the key classes; the address classes keep `client_ip`), and `key_kind` is `address`, `api_key` or `operator_key`. Mutant Q3 (no trace id) fails 8 tests.
- **The named peek** `refuseIfBlocked` reads the `auth_failure` bucket without creating or spending it, as before (mutant Q6, spending, fails 6 tests). `ADDRESS_ROUTE_CLASSES` keeps the same three classes and adds the storage-check path to `protocol`, as LA-ADR-05 D1 rule 10 asks.
- **Start-up errors** name the Zod path (and an unknown key) of `LTI_RATE_LIMITS`, or the bad entry of `TRUSTED_PROXY_CIDRS`. These are operator settings, not secrets, so naming them is safe.
- **BD-A2-29** is a doc comment only (`store/audit.ts`).

- **NIT note (no change needed):** while a host stays unresolved, `trusted_proxy_unresolved` repeats every 5 s, and no line marks the recovery. A `trusted_proxy_resolved {host}` line would make the recovery visible in the log.
