Verdict: APPROVE
Round: 1

# Reviewer-A: T2b review (lens: "Is it right and is it safe?")

Scope:

- `git diff 433cf5e 162d4d4 -- . ':!docs' ':!tests'`: the acceptance profile (compose, `qa-hosts.mjs`, `qa.crt`, the profile logic in `lib.sh`, `stack-up.sh` and `qa-suite.sh`), the negative-check details, and my T2a side items.
- Also: the typed API codes, the shared migration runner, and `data-error-action`.
- Spec: `tasks/T2b.md`, `security.md` §2 and §9.

Method:

- I read all the code and ran my earlier tests again, now against the new code:
  - `outbound.ts` with a local `node:https` server (302 and oversize answers);
  - the blocked ranges;
  - three launches at the same moment on an empty JWKS cache, with the real `jwks.ts`.
- To make the `jose` import resolve, I put my probe script for about one second in `services/lti-service/` and then deleted it. I changed no other file.
- Read-only live checks: both `/healthz`, the container environment, containers, certificate files, an error page, and a log scan.
- I did not read `reviewer-b.md`.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.

## Key risk: can the acceptance profile leak into the default profile? No.

- **Allowlist.**
  - `OUTBOUND_PRIVATE_HOST_ALLOWLIST: moodle.test${ACCEPTANCE_ALLOWLIST_EXTRA:-}` (and the same with `lti.cogniate.test` for the app).
  - `lib.sh` derives the extra value only from the saved profile, and always exports it, empty for `default`. Shell values win over `--env-file` in compose, so a stray line in `.env` cannot add hosts.
  - A changed value changes the service config, so `stack:up` recreates the service.
  - Live (default profile): `/healthz` gives `"outbound_allowlist":["moodle.test"]` (LTI) and `["lti.cogniate.test"]` (app). `docker inspect` shows the same values.
- **Hosts.**
  - `sink` (`evil.test`) and `qa-platform` (`qa-platform.test`) have `profiles: ["acceptance"]`.
  - `stack:up` without a profile removes them.
  - Live: neither container runs. Without them the two names do not resolve (`.test` has no public DNS), so even a leaked allowlist entry would reach nothing.
- **Certificates.**
  - `qa.crt` (SAN `evil.test`, `qa-platform.test`) is signed by the name-constrained dev CA (`openssl verify`: OK). It is a separate leaf, so the stack leaf does not change.
  - `qa.key` has mode 600 and is mounted only into the two acceptance containers.
  - `prepare_e2e` copies only `qa.crt` into the public certificate folder.
- **Profile switch.**
  - Only `stack:up` changes the profile (`.tmp/stack-profile.<project>`).
  - `test:acceptance` restores `default` in an `EXIT` trap, also after a failure or Ctrl+C.
  - Live log: `service_started` lines with `acceptance`, then `default` at the end of the run.
- **QA static host.** `fileFor` decodes once, rejects `..`, `\` and NUL, and checks the path against the root before and after `realpath`. So `/certs/qa.key` (outside `/fixtures`) cannot be served.

## T2a side items

| Id | Status | Evidence |
| --- | --- | --- |
| A-T2a-01 | Resolved | `fail()` clears the timer and logs once; later socket events log nothing. My real-server test: one 302 → `["outbound_blocked:redirect"]`, one oversize body → `["outbound_blocked:too_large"]`. Before the fix, each had a second `timeout` event. |
| A-T2a-02 | Resolved (see A-T2b-01) | `jwks.ts`: refresh after 10 min, at most one attempt per minute per URL. A failed refresh keeps the cached keys until 24 h after the last **good** fetch, then drops them. An unknown `kid` causes one refetch (if allowed) and is then rejected (`kid_unknown`, or `jwks_fetch_failed` when the refetch fails). The fallback **never** accepts a `kid` that is not in the cached set. **A revoked key cannot live forever:** a good refresh replaces the whole set, and without good refreshes the set is dropped 24 h after the last good fetch. So a revoked key stays usable at most 24 h, and only while every refresh fails. This bound is in security §2.4. |
| A-T2a-03 | Resolved | Check 5: more than one `aud` needs `azp`, and an `azp` that is present must equal the client id (`azp_missing`, `azp_mismatch`). |
| A-T2a-04 | Resolved | The client has its own `https.Agent` (no global agent, no environment proxy). `::/96`, `2002::/16` and `fec0::/10` are blocked: in my test `::127.0.0.1`, `2002:7f00:1::` and `fec0::1` were blocked, and `2001:4860::8888` was allowed. |
| A-T2a-05 | Resolved | `lti-bootstrap.sh` pipes the CLI output to `node` on stdin. |
| B-T2a-03 (`detail`) | Safe | All `detail` values are fixed words, or `name=<safeWord>`, where `safeWord` keeps only `^[A-Za-z0-9_.-]{1,40}$`, else `other`. A 43-character ltik or state cannot fit. The live values were only safe words, for example `alg=none`, `alg=HS256`, `version=1.1`, `kid_unknown`, `jwks_fetch_failed`, `azp_missing` and `error=access_denied`. The two lines without `detail` are my own T2a probes from before this code. |
| Check 4 order | Correct | The header is read first, so `alg=none` with an empty signature is logged as `alg=none`. Empty payload or signature parts still fail. |
| Migrations (B-T2a-04) | Correct | SHA-256 for each applied file, one `BEGIN IMMEDIATE` transaction per file, and the service stops if an applied file changed or is gone. |
| `data-error-action` | Correct | Live: `<p data-error-action>This launch was already used or is too old…`. The text is escaped. |

Live logs (all 5 files, including `sink` and `qa-platform`): no API key, no JWT-like string and no 43-character token.

---

## MINOR

### A-T2b-01 — MINOR — Launches during a JWKS fetch fail instead of waiting for it

- **Location:** `services/lti-service/src/lti/jwks.ts:45-105` (`attempt` sets `attemptAt` before the `await`; `canAttempt` is false for the other callers).
- **Problem:** While one JWKS fetch is in flight, the launches that come at the same moment do not wait for it. They fail at once, with `jwks_unavailable` on an empty cache or `kid_unknown` for a new key.
- **Evidence:** My test with the real `jwks.ts` and outbound client, a JWKS answer delayed by 300 ms, and three `verify()` calls at once on an empty cache gave `["ok","jwks_unavailable","jwks_unavailable"]`. This happens in real use:
  - right after the LTI service starts (empty cache) when a class opens the activity together;
  - when Moodle rotates its key (the unknown-`kid` path);
  - after the 24 h drop.

  The learner sees `INVALID_SIGNATURE` with "Start again from Moodle". Nothing unsafe is accepted; this is availability.
- **Fix:** Keep one in-flight fetch promise per JWKS URL. Callers that arrive during the fetch wait for it and then verify. The "at most one attempt per minute" rule still applies to new attempts. Add a unit test with three concurrent `verify()` calls on an empty cache, and one with a new `kid`.

## NIT

### A-T2b-02 — NIT — A killed acceptance run leaves the acceptance profile on for every later command except `stack:up`

- **Location:** `infra/scripts/lib.sh` (`saved_profile`, `apply_profile`); `tasks/T7.md` (AC-T7-13).
- **Problem:** This is by design and documented: `stack:restart`, `seed` and the QA runners keep the saved profile, and `/healthz` shows it. But T7 must run in the default profile. Today AC-T7-13 proves only that no knobs are active.
- **Fix:** In the T7 pre-check (or AC-T7-13), also require `"profile": "default"` and the default `outbound_allowlist` from both `/healthz`. Or make `warn_knobs` also print a CAUTION while the saved profile is `acceptance`.
