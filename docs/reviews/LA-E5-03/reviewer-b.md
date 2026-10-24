Verdict: APPROVE
Round: 3

# LA-E5-03 review, Reviewer-B (lens: "Can a human team own it?")

## Round 2 (Reviewer-B2)

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22), on this lens's file. This is a bounded check of the round-1 findings. Diff: `git diff 9cbd043 8706619` limited to the LA-E5-03 files (lane S1 fix commits `511da0f`, `4e0ac6a`, `c560133`, `cf92882`, `9eb7ec7`, `5f2a57e` and the BD-A2-29 comment `ec0534e`; the LA-E5-05 part of merge `8706619` is not reviewed here). I did not open the other reviewer's file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 new NIT.** Every round-1 finding is **closed**.

How I checked: a scratch clone of `8706619` (private `/tmp` folder, deleted after the run). `vitest run services/lti-service/src/http services/lti-service/src/store`: **33 files, 392 tests passed**.

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E5-03-01 (MINOR) | **Closed.** A bad `LTI_RATE_LIMITS` names the Zod path and rule (`LTI_RATE_LIMITS: classes.api.burst: …`; unknown keys are named too) and keeps the cause. Bad JSON says "expected valid JSON". A bad `TRUSTED_PROXY_CIDRS` entry is quoted (`"192.168.1.1/40" is not a valid CIDR`). Each case has a unit row. |
| B-LA-E5-03-02 (NIT) | **Closed** (BD-A2-30). `details.limit` is always present: `{ class, ratePerMinute, burst }` for the authenticated classes, `{ class }` only for the address classes. `rate_limited` now has `trace_id`, `key_id` for key budgets, and `key_kind` `address`, `api_key` or `operator_key`. A table test covers all seven classes. |
| B-LA-E5-03-03 (NIT) | **Closed.** `ADDRESS_ROUTE_CLASSES` (`rate-limit.ts:24`) is the one route-to-class table, with a D1 comment per class. The hook looks the class up there and says why `keys` answers JSON. |
| B-LA-E5-03-04 (NIT) | **Closed.** `refuseIfBlocked(address, traceId)` (`:158`) replaces `check(…, undefined, false)`. Both public methods call one private `evaluate`. |
| B-LA-E5-03-05 (NIT) | **Closed.** `trusted_proxy_unresolved {host}` is logged at `warn` (`:235`), and a failed lookup is retried after 5 s instead of one minute (`:245`). A test covers the log and the recovery. |

Also in this round: the `settings.rate_limits` audit event now records the changed values, including the removed overrides (`4e0ac6a`). The `audit.change` comment (`store/audit.ts:113`) now states the BD-A2-29 action rule and the "read inside the change" rule. That partly closes NIT B-LA-E5-04-06 in the LA-E5-04 review, which also asks for the third rule: a refused event always keeps the base action.

### New in this round

#### B-LA-E5-03-06 — NIT — The proxy warning repeats every 5 s during a long DNS outage

- **File:** `services/lti-service/src/http/rate-limit.ts:235`, `:245`.
- **Problem:** The warning is now logged once per refresh, and a failing host makes the refresh run every 5 s. A proxy host that stays unresolved writes 12 `trusted_proxy_unresolved` lines per minute (720 per hour) until DNS returns. The fast retry is right, but the log volume can hide other warnings, and nothing logs the recovery.
- **Suggested fix:** Log on a change of state only: `trusted_proxy_unresolved` when a host goes from resolved to unresolved, and at most once per minute while it stays unresolved; `trusted_proxy_resolved {host}` at `info` when it comes back. Also fix the wording of the second BD-A2-29 comment line in `store/audit.ts` ("Read the current state that chooses the action inside change(), in the same transaction") and add the third rule (a refused event keeps the base action).

## Round 1

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

## Round 3 (WE-F1 fix)

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-24. Lens B: can a human team own it? Scope: `git diff ecc19bbc^1 ecc19bbc` (`bbb984d6`), tested at `4e453a7c66b27e2c9cdc221a9ba0d734a68b19fe`. Read the prior B rounds, task spec, BD-A2-108, and the related design and operator guidance. No Reviewer-A file was opened.

**APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** Earlier non-blocking notes are outside this focused fix.

The code's admin default agrees with LA-ADR-06 D1, AC-14, the app contract, and security residual R-LA-9: 1,200 requests per minute, burst 600. Operability §2 and the LTI contract point to the same default table and override API. The operator runbook §5.4 gives commands to read the effective value and source, raise it globally or for one account, and remove a global override. The code comment links the change to WE-F1. No special first-party exemption or new limiter behaviour was added.

### B-LA-E5-03-07 — NIT — Make the new test title traceable and exact

**File:** `services/lti-service/src/http/rate-limit.test.ts:70`.

**Problem and evidence:** The test names BD-A2-108 and WE-F1, but not `AC-LA-E5-03-14`; searching this file for the AC id gives no match. Its title says it refills 20 tokens per second, while the assertion makes only one request after advancing one second. That meets AC-14's stated next-request check, but the title promises a stronger assertion.

**Suggested fix:** Prefix the test title with `AC-LA-E5-03-14` and say that the next request passes after one second. Alternatively, retain the refill wording and assert 20 successes followed by refusal at the same timestamp.

Verification used fresh private clone `/tmp/la-review-b-2db03b1f7b2d` with its own `npm ci`; the Vitest cache was deleted before each run. **61 tests passed across four files**: limiter, HTTP rate limits, operator rate limits, and Retry-After. This covers the existing UNIT AC-10/13 and new AC-14. Independently restoring the old rate or old burst made the new test fail. LTI typecheck, lint on both changed files, F1, and whitespace checks passed; both mutations were restored and the clone is clean.

The two-file diff fits the S1 fix routed by BD-A2-108. Protected files are unchanged, and no core LMS name was added. QA must still rerun the nine WE-F1 rows with default limits. No Docker, stack, or commit was used. Only this review file changed in integration.
