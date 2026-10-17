# T2b: Negative launch matrix and the `acceptance` profile

Owner: Author. Depends on: T2a. Runs right after T2a (security-critical, not deferred). Security §2.2 (check → code map), §9. Local stack §3. QA rules: [`README.md`](README.md).

## Goal

Prove each of the 12 launch checks black-box with tokens that QA signs itself, and give QA the helper hosts that negative network tests need.

## Scope

In:

- Compose profile `acceptance` (local-stack §3), started with `STACK_PROFILE=acceptance npm run stack:up`:
  - `evil.test` sink: answers 200 to every request and logs `sink_hit {host, method, path}` to `infra/.logs/sink.jsonl`.
  - `qa-platform.test` static host: `https://qa-platform.test/<path>` serves `tests/fixtures/qa-platform/<path>` (`.json` as `application/json`). QA writes its JWKS there at run time (no test private key in git). Every request logs `qa_platform_hit {method, path}` to `infra/.logs/qa-platform.jsonl`.
  - A second leaf certificate (`infra/.certs/qa.crt`, SAN `evil.test`, `qa-platform.test`, signed by the dev CA). The T1 leaf does not change.
  - The two names are added to `OUTBOUND_PRIVATE_HOST_ALLOWLIST` of `lti-service` and `cogniate-app` in this profile only.
  - `/healthz` and `service_started` show `"profile": "default" | "acceptance"` and the active allowlist.
  - `npm run test:acceptance` starts the stack with this profile, runs the suite, and restores the default profile at the end (also on failure). A run that stops halfway leaves the profile on; `/healthz` shows it, and `npm run stack:up` (no `STACK_PROFILE`) restores the default.
- No product logic changes beyond T2a, except fixes that the matrix finds.

## Side items from the T2a review

Fix these in T2b (code owner: Author). QA checks the ones with an AC.

| Id | Item | Spec |
| --- | --- | --- |
| A-T2a-01 | One event per attempt: no false `timeout` event after a refused redirect or an oversize response. | security §9 |
| A-T2a-02 | If a JWKS refresh fails, keep using cached keys up to 24 h after the last good fetch instead of failing every launch. | security §2.4, contract §4, AC-T2-32 |
| B-T2a-02 | One typed list of API error codes (contract §1.3) in `packages/shared` `errors`, used by every handler. | contract §1.3 |
| B-T2a-03 | `launch_check_failed` gets a `detail` field with a safe reason (`skew_s=…`, `kid_unknown`, `jwks_fetch_failed`, …). | contract §5, AC-T2-30 |
| B-T2a-04 | Migration checksum: stop at start if an applied migration file changed. Use the shared migration runner (ADR-008 `migrations`). | ADR-006 |
| T4a note | LTI service error pages also mark the next-action sentence with `data-error-action`. | security §2.2, AC-T2-30 |

## Acceptance criteria

Setup: T2a setup with `STACK_PROFILE=acceptance`. QA captures launch POSTs with Playwright and posts them itself. QA registers a QA platform (issuer `https://qa-platform.test`) with `POST /api/platforms` and signs its own tokens.

- **AC-T2-09** Replay of a used `id_token` + `state` from the same browser context → page `INVALID_STATE`, no redirect. Log `launch_check_failed {check: 1}`.
- **AC-T2-10** A captured form (not yet used by the browser) posted from a new browser context → page `STATE_COOKIE_MISSING` with the resource-link help text. No redirect. A second post of the same form with the cookie → `INVALID_STATE` (the state was used up).
- **AC-T2-11** Tampered payload (one character changed, same signature) → `INVALID_SIGNATURE`.
- **AC-T2-20** QA platform token with `alg=none`, and one with `HS256` (key = the JWKS `n`) → `INVALID_ID_TOKEN` (check 4).
- **AC-T2-21** Unknown `kid` and the refetch limit: (1) at least 61 s after the last JWKS fetch for the QA platform (QA waits or uses a fresh QA platform), a QA token whose `kid` is not in the QA JWKS → `INVALID_SIGNATURE` (check 6), exactly one `outbound_request {host: "qa-platform.test"}` with the trace id of that response, and one `qa_platform_hit` on the JWKS path. (2) A second unknown-`kid` post within 60 s → `INVALID_SIGNATURE`, no new `outbound_request` and no new `qa_platform_hit`.
- **AC-T2-22** A real Moodle token held for 125 s, then posted with a fresh state and cookie of a new login (QA intercepts both) → `TOKEN_EXPIRED` (check 7).
- **AC-T2-23** The token of launch A with the state and cookie of launch B (same user, same platform) → `INVALID_NONCE` (check 8).
- **AC-T2-24** QA platform token with `aud` = another client id, and one with two `aud` values and no `azp` → `INVALID_ISSUER_OR_AUDIENCE` (check 5).
- **AC-T2-25** QA platform token with `version = 1.1` and one with `message_type = LtiSubmissionReviewRequest` → `UNSUPPORTED_MESSAGE_TYPE` (check 10).
- **AC-T2-26** QA platform resource-link token without `resource_link`, and one without `sub` → `MISSING_CLAIM` (check 11).
- **AC-T2-27** QA platform token whose `target_link_uri` differs from the login value → `INVALID_TARGET_LINK_URI` (check 12).
- **AC-T2-28** A POST to `/lti/launch/cogniate` with `error=access_denied` and a valid `state` (no `id_token`) → page `PLATFORM_ERROR` showing `access_denied`. The same state later → `INVALID_STATE`.
- **AC-T2-32** JWKS refresh failure: QA makes the QA platform JWKS fail (removes the file, so `qa-platform.test` answers 404) at least 61 s after the last fetch. (1) A QA token with an unknown `kid` → `INVALID_SIGNATURE`, `launch_check_failed {check: 6, detail: "jwks_fetch_failed"}`, and one `outbound_*` event for the failed fetch. (2) Then a QA token signed with the cached key → the launch is accepted. QA restores the file.
- **AC-T2-30** Logs and markers: every error page of AC-T2-09 to AC-T2-28 has `data-error-code`, `data-trace-id` and a non-empty `data-error-action` element; the trace id is in a `launch_check_failed` or `login_rejected` event with the right `check`, `code` and a non-empty `detail` (B-T2a-03) that contains no token or key. In the whole T2b run, the number of `qa_platform_hit` lines on the JWKS path = the number of `outbound_request {host: "qa-platform.test"}` events. AC-T2-29 repeated in this profile gives zero `sink_hit`. The log contains none of the captured secrets of this run. `/healthz` shows `"profile": "acceptance"` during the run and `"default"` after `npm run test:acceptance` ends.

## Self-check

`npm run check` green. The Author runs `STACK_PROFILE=acceptance npm run stack:up` and `npm run stack:up` once and reports both `/healthz` outputs.
