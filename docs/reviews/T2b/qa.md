Verdict: PASS
Round: 1

# T2b QA verification

| Item | Value |
| --- | --- |
| SHA | `1fa011da8f248e8836687bf84381d871b61554bc` (T2b code `162d4d4`, QA tests `1fa011d`) |
| Spec | `tasks/T2b.md` at `2254792` (side items of the T2a review, AC-T2-32, `data-error-action` in AC-T2-30) and `tasks/T2a.md` |
| Scope | T2a and T2b together (`run-t2.mjs --tasks T2a,T2b`): every T2a AC again (regression), every T2b AC, H6, H14, the AC-T2-07 knob pass, and the AC-T2-31 reset pass |
| Tests used | `1fa011d` plus two QA fixes (section 3). Changed files: `E/tests-diff-vs-sha.txt`. Only `T2b/qa-platform.test.ts` and `host/run-t2.mjs` matter for T2. The other changed or new files are T5a/T5b work in progress: they are not in the T2 task folders and do not run. The shared change in `lib/https.ts` (optional `raw` and `rawPath`) does not change the existing calls. |
| Date | 2026-10-17 |
| Runner | `COMPOSE_PROJECT_NAME=qa-t2b-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t2.mjs --sha 1fa011d… --tasks T2a,T2b --replace-tests` |
| Clean environment | New clone `~/cogniate-qa-runs/qa-t2b-r1-1fa011da-2026-10-17T06-31-39-049Z`. Preflight: no project `qa-t2b-r1`, no QA volumes or networks. |
| Isolation | The Author's stack (5 containers) was not touched. After the run: 0 QA containers, 0 volumes, 0 networks. |
| Evidence root | `E` = `tests/host/artifacts/qa-t2b-r1-1fa011da-2026-10-17T06-31-39-049Z/` (run 2). Run 1: `tests/host/artifacts/qa-t2b-r1-1fa011da-2026-10-17T06-23-45-594Z/`. |

The runner did these steps:

1. `seed:lti-manual` twice (host check).
2. Pass A: `QA_TASK=T2a,T2b`. `npm run test:acceptance` switched the stack to the `acceptance` profile and back.
3. Host check: `/healthz` of `lti-service` and `cogniate-app` shows `"profile": "default"` after the suite.
4. Knob pass: `LTIK_TTL_SECONDS=20`, AC-T2-07.
5. `stack:reset`, `stack:up`, `seed`, `seed:lti-manual`, then pass C (AC-T2-03, AC-T2-31).

Pass A: 35 tests, 0 failed, 1 skipped (AC-T2-07, which runs only in the knob pass, where it passed).

Run 1 failed only because of two QA test defects (section 3). In run 1 every AC passed except the in-container part of AC-T2-30. The product results were the same in both runs.

## 1. Results per acceptance criterion

`P` = `E/container-passA/` (`playwright-results.json`, `vitest-results.json`, `service-logs/`).

### T2b

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T2-09 | PASS | Replay of a used id_token + state in the same context: page `INVALID_STATE`, no redirect, `launch_check_failed {check: 1}`. | `P` |
| AC-T2-10 | PASS | A held form from a new context: `STATE_COOKIE_MISSING` with the resource-link help text, no redirect. With the cookie, the same form: `INVALID_STATE`. | `P` |
| AC-T2-11 | PASS | One character changed in the payload: `INVALID_SIGNATURE` (`detail: bad_signature`). | `P` |
| AC-T2-20 | PASS | `alg=none` and `HS256` with the JWKS `n`: `INVALID_ID_TOKEN`, check 4 (`detail` `alg=none`, `alg=HS256`). | `P` |
| AC-T2-21 | PASS | At ≥ 61 s after the last fetch, an unknown `kid`: `INVALID_SIGNATURE`, exactly one `outbound_request` to `qa-platform.test` with the response's trace id, and one JWKS hit. A second post within 60 s: no new fetch, no new hit. | `P` |
| AC-T2-22 | PASS | A Moodle token held 126 s, posted with the state and cookie of a new login: `TOKEN_EXPIRED`, check 7 (`detail: skew_s=67`). | `P` (annotation "held") |
| AC-T2-23 | PASS | The token of launch A with the state and cookie of launch B: `INVALID_NONCE`, check 8. | `P` |
| AC-T2-24 | PASS | Another `aud`, and two `aud` values without `azp`: `INVALID_ISSUER_OR_AUDIENCE`, check 5 (`aud_mismatch`, `azp_missing`). | `P` |
| AC-T2-25 | PASS | `version 1.1` and `LtiSubmissionReviewRequest`: `UNSUPPORTED_MESSAGE_TYPE`, check 10. | `P` |
| AC-T2-26 | PASS | No `resource_link`, and no `sub`: `MISSING_CLAIM`, check 11. | `P` |
| AC-T2-27 | PASS | `target_link_uri` different from the login value: `INVALID_TARGET_LINK_URI`, check 12. | `P` |
| AC-T2-28 | PASS | `error=access_denied` with a valid state: page `PLATFORM_ERROR` that shows `access_denied` (`check: oidc_error`). The same state later: `INVALID_STATE`. | `P` |
| AC-T2-30 | PASS | 26 error pages of AC-T2-09 to AC-T2-28: each has `data-error-code`, `data-trace-id` (shown on the page) and one non-empty `data-error-action`. Each trace id is in a `launch_check_failed` or `login_rejected` event with the right check and code, and a non-empty, safe `detail`. JWKS-path hits = 4 = `outbound_request` to `qa-platform.test`. AC-T2-29 repeated in this profile: 0 `sink_hit`, no `outbound_*` to `evil.test`. 84 captured secrets, none in a log. Profile: `service_started` shows `default` → `acceptance` (allowlist `moodle.test`, `qa-platform.test`, `evil.test`) → `default`. `/healthz` shows `default` after the suite (host check). | `P`, `E/summary.json` |
| AC-T2-32 | PASS | A fresh QA platform, its JWKS file removed 61 s after the first fetch. An unknown `kid` gives `INVALID_SIGNATURE` and `launch_check_failed {check: 6, detail: "jwks_fetch_failed"}`, with exactly one `outbound_*` event for the failed fetch (`outbound_request`, status 404). Then a token signed with the cached key: 303 with a ltik. The file was restored. | `P`, `P/service-logs/lti-service.jsonl` |
| H6 | PASS | `qa-platform.test` serves run-time files as `application/json`, and a correct QA token is accepted (303 with ltik). | `P` |

### T2a (regression in the same run)

| AC | Result | Notes |
| --- | --- | --- |
| AC-T2-01 to -06, -08, -12 to -16, -18, -19, -29 | PASS | Same checks as T2a round 1. This includes the AC-T2-15 case of a platform switched off between login and launch, and the AC-T2-19 405 page. |
| AC-T2-07 | PASS | Knob pass (`LTIK_TTL_SECONDS=20`). The `acceptance` profile switch of `test:acceptance` keeps the knob. |
| AC-T2-31 | PASS | `seed:lti-manual` twice gives equal values. After the reset, pass C passes again. |
| H14 | PASS | `QA_TASK=T2a,T2b`: only T2a/T2b tests ran (AC-T2-* and the T2b control test H6). `QA_GREP=AC-T2-07` in the knob pass: only AC-T2-07 ran. |

### Side items of the T2a review

| Id | QA result |
| --- | --- |
| A-T2a-01 (one event per attempt) | Seen in AC-T2-32: the refresh that got a 404 gave exactly one event. There is no other AC. |
| A-T2a-02 (JWKS fallback) | AC-T2-32 PASS. The 24 h maximum age cannot be tested in one run. |
| B-T2a-03 (`detail`) | AC-T2-30 PASS: every `launch_check_failed` event has a `detail`, and each one is safe (for example `kid_unknown`, `jwks_fetch_failed`, `skew_s=67`, `missing=sub`, `alg=HS256`). |
| T4a note (`data-error-action` on LTI service pages) | AC-T2-30 PASS for the 26 pages. |
| B-T2a-02, B-T2a-04 | No AC. Not covered by QA (reviewers). |

### The Author's notes for this round

| Note | QA result |
| --- | --- |
| Acceptance profile with `STACK_PROFILE=acceptance npm run stack:up`; `test:acceptance` switches and restores it | Agrees (AC-T2-30 profile parts, host check). |
| `/healthz` has `outbound_allowlist` | Seen in `service_started`: default `["moodle.test"]`, acceptance adds `qa-platform.test` and `evil.test`. The QA T1 health tests and the AC-T1-05 host check read single fields, so they need no change. |
| JWKS fallback maximum age 24 h | Not tested (one run). |
| `QA_PLATFORM_DIR` | Not used. |
| Ctrl+C on `test:acceptance` exits 130 and restores the default profile | Not tested. |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.

## 3. QA-side changes in this round

Run 1 (`…2026-10-17T06-23-45-594Z`) failed on two QA defects:

1. **AC-T2-32 probe broke the AC-T2-30 count.** To confirm the 404, the first version of the AC-T2-32 test fetched the removed JWKS file from the test process. That made one extra `qa_platform_hit` on a JWKS path. Result: 5 hits against 4 `outbound_request` events, so AC-T2-30 failed. The logs show it: the QA hit at 06:26:42.352, then the service's own fetch at 06:26:42.378 with one `outbound_request` 404. Fix: no probe of the JWKS path. The test now checks the 404 through the service's `outbound_request` status.
2. **H14 check too strict.** The runner counted the T2b control test H6 as "outside the selected tasks". Fix: H6 is allowed when T2b is selected.

No new SHA is necessary for this round, because `--replace-tests` copied the fixed tests. The Lead can commit `tests/**`.

## 4. Not covered

- The 24 h maximum age of cached JWKS keys (`jwks_unavailable` after 24 h).
- Ctrl+C on `npm run test:acceptance` (exit 130, profile restored), and a run that stops halfway.
- B-T2a-02 (one typed list of API error codes) and B-T2a-04 (migration checksum): no AC.
