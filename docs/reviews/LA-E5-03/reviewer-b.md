Verdict: APPROVE
Round: 1

# LA-E5-03 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 9cbd043^1 9cbd043` (lane S1 commit `7299a8b`, plus the merges of S2's `onFail` part commit and L's `Retry-After` rule; merged as `9cbd043`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-03.md`. Design: LA-ADR-06 D1, contract delta §1.3, §1.4, §3, §6, BD-A2-16 to -20. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 4 NIT.**

An operator can read and tune the limits with the API alone:
- `GET /operator/v1/rate-limits` shows every class with `ratePerMinute`, `burst` and `source` (`operator`, `env` or `default`), plus the session cap and its source.
- `PATCH` with `null` removes an operator value. An unknown field gives "Invalid field: classes.foo.", and every change writes one `settings.rate_limits` event with the changed field names.
- A change applies at once and resets that bucket to the new burst, so the operator sees the effect on the next request.

A tool developer who gets a `429` learns how long to wait: the body says "Too many requests. Retry after N s.", and `details.retryAfter` and the `Retry-After` header carry the same N. The limiter is one module: the bucket map, the address key, the trust list and the session cap. The tests read like the D1 rules. My findings are about start-up errors that do not say what is wrong, and a `429` and log line that do not say *which* budget ran out.

## How I checked

- Scratch clone of `9cbd043` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service`: **57 files, 707 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0.
- Two probes of the start-up errors (B-LA-E5-03-01):
  - `LTI_RATE_LIMITS='{"classes":{"api":{"ratePerMinute":5,"burst":0.5}}}'` gives only `LTI_RATE_LIMITS must contain valid rate-limit settings`.
  - `TRUSTED_PROXY_CIDRS='10.0.0.0/8, 192.168.1.1/40'` gives only `TRUSTED_PROXY_CIDRS contains an invalid CIDR`.
- `infra/compose.yaml`: the Node services `depends_on: proxy: condition: service_healthy`, so the host name `proxy` resolves at LTI service start.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `http/rate-limit.ts`, `store/settings.ts`, `http/operator/rate-limits.ts`, migration `012_service_setting.sql` and their tests; `http/app.ts`; `http/operator/index.ts`; one `RATE_LIMITED` line in `api-errors.ts`; the `TRUSTED_PROXY_CIDRS: proxy` line in `infra/compose.yaml` (named in "Needs"). No edit of `lti/codes.ts`, `http/auth.ts`, `store/accounts.ts`, the L protocol files or app files. Requests 1 and 2 (the page code and the `onFail` part) come from their owners' merged commits. |
| Ownership | S1 files in B2, as above. OK. |
| No behaviour change outside the spec | `429` only above the limits (LA-IC-10). `/healthz` has no class. The `keys` route answers JSON `429` (it is a JSON endpoint); protocol and registration answer the HTML page (the `name === 'keys'` rethrow, `app.ts:147`). |
| No LMS name in core | None. |
| UNIT ACs fail on the old behaviour | AC-10: `rate-limit.test.ts` "IPv6 addresses share a /64 bucket, but not two prefixes"; there was no limiter before. AC-13: `http/retry-after.test.ts` (from L's shared-rule commit; I did not review it here). The design-note unit tests exist too: LRU bound and eviction, the session cap per address prefix **and** account. The HTTP tests cover the D1 order rules (address check before any database read, `api`/`admin` only after full auth, bad ltiks spend nothing), spoofed and trusted forwarding, both listeners sharing `auth_failure`, and a settings rollback when the audit insert fails. |

## Findings

### B-LA-E5-03-01 — MINOR — A bad `LTI_RATE_LIMITS` or `TRUSTED_PROXY_CIDRS` stops the start without saying what is wrong

- **File:** `services/lti-service/src/http/rate-limit.ts:110-111`, `:189`, `:191`.
- **Problem:** Both values are hand-written configuration. The spec's design notes plan to raise limits in the `acceptance` compose with `LTI_RATE_LIMITS`, so QA and operators will edit that JSON. A mistake stops the LTI service with one generic line. The Zod error that names the path (`classes.api.burst: expected an integer`) is dropped by the bare `catch`, and the CIDR error does not name the bad entry. The person must find the error by trial.
- **Evidence:** The two probes above. Neither value is secret.
- **Suggested fix:** Put the first issue into the message, for example: `LTI_RATE_LIMITS: classes.api.burst must be a whole number of 1 or more`, `TRUSTED_PROXY_CIDRS: "192.168.1.1/40" is not a valid CIDR or host name`. Add one unit row for each.

### B-LA-E5-03-02 — NIT — A `429` and its log line do not say which budget ran out

- **File:** `services/lti-service/src/http/rate-limit.ts:139-146`.
- **Problem:** The body says only "Too many requests. Retry after N s.". A developer whose **valid** key gets `429` because its address had 120 key failures (the `auth_failure` rule, AC-05) cannot tell that apart from its own `api` budget. The operator's `rate_limited` line names the class but has no `trace_id` (so it cannot be joined with the request) and no API key id (an account can have two keys, LA-E5-07).
- **Suggested fix:** Ask A2 for one additive field, `details.limit: "<class>"` (contract delta §1.3 and D1 fix the body today). Pass `req.traceId` and, for `api`/`admin`, the key id into the log line.

### B-LA-E5-03-03 — NIT — The route-to-class map is a nested ternary inside the hook

- **File:** `services/lti-service/src/http/app.ts:138-157`.
- **Problem:** The D1 table "class → routes" is split across three places: the address routes in the `onRequest` hook (`:141-143`, three string compares), the `api`/`admin` choice in the `auth` wrapper (`:129`), and `operator` in the operator listener. Someone who adds a protocol route (for example a new storage-check path) has to find the literal list in `app.ts`. The rule "`keys` answers JSON, not the page" is implicit too (`:147`).
- **Suggested fix:** Put an `ADDRESS_ROUTE_CLASSES` table next to `DEFAULT_RATE_LIMITS` in `rate-limit.ts`, with one comment line per class that points to D1. Look the class up in the hook, and add one comment on the JSON answer of `keys`.

### B-LA-E5-03-04 — NIT — `check(…, undefined, false)` hides a "peek"

- **File:** `services/lti-service/src/http/rate-limit.ts:135`; callers `http/app.ts:140`, `http/operator/index.ts:123`.
- **Problem:** `limiter.check('auth_failure', req.ip, undefined, false)` means "refuse if this address is already blocked, but do not spend or create a bucket". The positional `undefined, false` does not say that.
- **Suggested fix:** A named method, for example `limiter.refuseIfBlocked('auth_failure', req.ip)`, that calls `take(…, spend = false)`.

### B-LA-E5-03-05 — NIT — A failed DNS refresh of a trusted proxy is silent

- **File:** `services/lti-service/src/http/rate-limit.ts:196-210`.
- **Problem:** If `proxy` does not resolve at a refresh (a proxy restart with a new address, a DNS hiccup), trust drops at once. That is the right fail-safe. But then every client behind the proxy shares the proxy's address bucket, and `rate_limited` logs the proxy address, and no line says why. Compose makes the start-up case unlikely (the proxy is healthy first), so the risk is in a running stack.
- **Suggested fix:** Log `trusted_proxy_unresolved {host}` at `warn`, at most once per failing host per refresh (no address values needed).

## Not checked

- K1-SIM AC-01 to -09, -11, -12 (QA). LA-E5-06 calls the session cap; its end-to-end proof is there.
- Lens-A depth of the IPv6 parsing and of the trusted-hop choice beyond the unit cases.
