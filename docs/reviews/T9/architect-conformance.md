Verdict: CHANGES_REQUESTED
Round: 3

History: round 1 (at `2129b69`) was CHANGES_REQUESTED (MAJOR D1, P1, P2 open). Round 2 (section 9, after the fixes) was APPROVE for conformance. Round 3 (section 10) reopens P2 after a live grade mismatch, then records the focused repair PASS. T7 on `dd6dd11` and T4b1/T4b2 on `a5d9ddc` remain historical PASS evidence; they do not verify the repaired candidate.

# T9: Architect final conformance check

Question: do the code and the docs at `2129b69` match the ADRs, the two contracts (including LTI contract §8 D10, D14, D15) and `security.md`?

## Scope and method

| Item | Value |
| --- | --- |
| Code | `2129b69`. Its code is byte-identical to `63de503` (`diff -rq` of `services/` and `infra/`). Read from a read-only export (`git archive`). |
| Reference | `docs/architecture/**` in the working copy (the newest Lead decisions). |
| Areas | (1) LTI service. (2) Cogniate app backend. (3) Content host, player shell, SCORM and HTML runtimes. (4) Infra, local stack, repo layout. (5) Human-facing docs (`README.md`, `docs/guides/**`, `docs/human_review/**`, `infra/README.md`). |
| Method | Static reading of code and docs against each spec rule. Three helper agents did the first pass. The Architect checked the findings in the code. The Lead routed them. Nothing was run. `.research_cache/**` was not read by the helpers (clean-room, ADR-001). |
| Severity | Charter §5. |

Finding ids: `F` = LTI service, `A` = infra, `D` = human docs, `P` = app and runtimes (ids as in the Lead's routing message).

Continuation (2026-10-19): the dedicated Codex GPT-6-Astra Architect reconciles the existing QA and review evidence under the [continuation authority](../../team/charter.md#continuation-authority-2026-10-19). This is evidence reconciliation, not a new independent QA run or a cross-model review. Sections 1–7 retain the original findings; section 8 retains the Lead decisions; sections 9–10 record the later evidence.

## Summary

- No BLOCKER.
- Four MAJOR findings:
  - F5: Moodle in a subfolder. Accepted limitation, now open question Q18.
  - D1: the compatibility claim in the human docs says more than ADR-003 allows. Owner: Docs.
  - P1: a slow Moodle during registration gives the wrong page and leaves an active platform with no owner. Owner: Author.
  - P2: a race in the score sync can let a lower grade replace a better one in Moodle. Owner: Author.
- Every D1 to D15 difference row in LTI contract §8 is true in the code. D14 needed one spec fix (F4).
- ADR-001 clean-room holds. Product code names LTIAAS only in tagged tolerance comments (`ltiaas-0.0.4 tolerance`, D14 and D15). The `ltiaas` SDK is only in the test-only `compat` image.

## 1. LTI service

| Id | Severity | Where | Problem | Spec | Decision and owner |
| --- | --- | --- | --- | --- | --- |
| F5 | MAJOR | `services/lti-service/src/lti/registration.ts:62`; `services/cogniate-app/src/app/connections.ts:116-134`; `services/cogniate-app/src/clients/moodle-ws.ts:26` | A Moodle site in a subfolder (`https://school.edu/moodle`) cannot use dynamic registration. Moodle 5.2.4 sets `issuer = $CFG->wwwroot` (`mod/lti/openid-configuration.php` line 39), so it has the path. Our rule needs issuer = origin of the configuration URL (`ISSUER_MISMATCH`). `siteUrl` must be an origin, so web service URLs (T8) have the wrong path. Manual connect compares only the issuer origin, so it may work, but nobody tested it. MoodleCloud is not affected. | security §2.4; app contract §4 | **Accepted limitation → Q18** (Lead). No code or rule change before the hand-over: it is cross-cutting, and the local stack cannot test it. Q18 has the design and the size. Architecture README §6 lists it as "Not supported". |
| F4 | MINOR | `lti/deep-linking.ts:48` | `custom: null` becomes `custom: {}` in the signed JWT. The spec said "same as no `custom`". | LTI contract §3.2 | **Spec follows the code** (Lead). Fixed: §3.2 now says `null` becomes `{}`. No code change. |
| F6 | NIT | `platform/ags.ts:141-149` | A `null` metadata field in a line item response comes back absent. The spec said "passed through unchanged". | LTI contract §3.5 | **Spec wording, Architect.** Fixed: §3.5 says `null` is returned as absent and `""` as `""`. |
| F8 | NIT | `platform/error-mapping.ts:1-2`, `platform/token-client.ts:47`, `http/app.ts:82` | Three stale points in §1.3: `PLATFORM_REJECTED_REQUEST` text is plain data, not pre-escaped (B-T3a-03); a token endpoint `400` maps to `502 PLATFORM_ERROR`; a body over 256 KB gives `413 INVALID_REQUEST`. | LTI contract §1.3 | **Spec wording, Architect.** Fixed in §1.3. |
| F3 | MINOR | `http/app.ts:74`; `packages/shared/src/logger.ts:117-126` | At `LOG_LEVEL=debug`, `/healthz` lines also go into the JSON log file. Correct at the default `info` level. Same root cause as A4. | security §11; LTI contract §5 | **Author** (infra batch, with A4). |
| F1 | MINOR | `platform/error-mapping.ts:21,26-28` | `502 PLATFORM_ERROR` and `504 PLATFORM_TIMEOUT` do not put the trace id in `description`. The `X-Trace-Id` header still has it. | LTI contract §1.3 | **Deferred** (Docs lists it in `deferred.md`). |
| F2 | MINOR | `http/app.ts:86` | The `internal_error` event has no `method` and no `path`. | LTI contract §5 | **Deferred.** |
| F7 | NIT | `http/routes/protocol.ts:48` | `PUT` or `DELETE` on `/lti/launch/{id}` gives JSON `404`, not the `405` page. Only `GET`/`HEAD` give `405`. | LTI contract §2.2; security §2.2 | **Deferred.** |
| F9 | NIT | `store/tool-keys.ts:36`; `store/service-keys.ts:76` | A retired tool key stays in the JWKS for 30 days from its creation, not its retirement. `revokeServiceKeys` is not used (cascading deletes do the revoke). | data-model; security §10 | **Deferred.** |

Checked and conforming (LTI service):
- Endpoints, auth schemes and the error body (§0 to §1.3).
- §1.4: leading `//` fold, and at most two decodes of `:lineItemId`. D15: a raw id gives `404`, a double-encoded id is accepted, and a triple-encoded id gives `400 INVALID_LINE_ITEM_ID` with no outbound call.
- The line item URL rule (§3.4, security §8): origin, path prefix, query parameters, refused encoded separators, backslash and dot segments. It runs before any outbound call.
- Field mappings: idtoken, deep linking (including the return URL rule), scores (timestamp limit, aliases, `null` comment), memberships (no personal fields), registration (update refused unless allowed), platforms, OAuth stubs.
- Login and launch checks: run order 1+3, 2, 4 to 12. Our JWT `iat` and `exp`. Cookies.
- Platform calls: token cache, JWKS (single flight, kept for 24 h after a failed refresh).
- The SSRF guard (all ranges, check inside the lookup, one log event per attempt).
- Secrets are hashed or encrypted. The redaction list. The `/healthz` shape. The data model and retention.
- ADR-002, ADR-003, ADR-009.

## 2. Cogniate app backend

The Architect checked P1 and P2 in the code. Severity is the Architect's. "Lead decides" = a choice between a spec change and a code change.

| Id | Severity | Where | Problem | Spec | Proposal and owner |
| --- | --- | --- | --- | --- | --- |
| P1 | MAJOR | `services/cogniate-app/src/tool-pages/register.ts:115-135`; `clients/lti-client.ts:121-127` | When Moodle is slow, the register page shows `REGISTRATION_FAILED` ("try again"), never `MOODLE_TOOL_MAY_EXIST`. The app calls `complete` with the default 5 s timeout. The LTI service then calls Moodle with its own 5 s timeout. So the app always times out first and never gets `tool_may_exist`. If Moodle answers late, the LTI service still makes the platform: the connection stays `pending`, the platform stays active with no owner, and a retry gives `REGISTRATION_ALREADY_COMPLETED` (shown as `REGISTRATION_FAILED`). | app contract §6 (register failure pages); security §2.6 (orphan switched off) | **Author.** Give `complete` a longer timeout than the LTI service's call to Moodle (for example 15 s). Map status 0 or 504 on `complete` to `MOODLE_TOOL_MAY_EXIST`. |
| P2 | MAJOR | `services/cogniate-app/src/domain/score-syncs.ts:34-36`; `domain/attempts.ts:284`; `worker/score-sync.ts:69-70` | A lower grade can replace a better one. `recordSend` writes the status with no guard. If a better result supersedes row A while A's send is in flight, and that send fails, A goes back to `pending`. The LTI service gives each score a newer timestamp than the last one, so A's retry can overwrite the better grade in Moodle. The race window is the send time (up to 5 s), and it is most likely during a Moodle outage. | ADR-010 rule 5; data-model §3 | **Author.** Add `AND status = 'pending'` (or `<> 'superseded'`) to the `recordSend` update. ADR-010 rule 5 now states it: "a `superseded` row never goes back". |
| P3 | MINOR | no emitter (`content-host/server.ts:214` logs only `commit_accepted`) | The log event `outcome_changed` is never written. | app contract §12 | Author batch, or deferred (Lead). |
| P4 | MINOR | `app/connections.ts:152-154`; `app/api-errors.ts:10-37` | The app API never answers `502 INVALID_LTI_ANSWER`. Every `LtiServiceError` becomes `LTI_SERVICE_ERROR`. | app contract §1 | Author batch, or deferred. |
| P5 | MINOR | `domain/score-syncs.ts:65-66` | The Resend backstop orders by `score_given / score_maximum` on INTEGER columns, so SQLite does integer division and every score under 100 ties. It never refuses a correct Resend, but it can miss a better final attempt with no sync row. | app contract §5 (Resend) | Author: `CAST(score_given AS REAL)`. |
| P6 | MINOR | `app/server.ts:116`; `app/connections.ts:78` | `internal_error` has no `method` and no `path`. `platform_orphan_deactivate_failed` is `warn` with no `error` field; the spec says `error` level with field `error`. | app contract §12 | Author batch, or deferred. |
| P7 | MINOR | `tool-pages/launch.ts:116` | The code makes a preview for a staff role. ADR-010 rule 6 makes a preview when there is no Learner role. The two differ for "Learner + Instructor" and for "neither". Moodle 5.2 sends only one of the two, so nothing differs today. | ADR-010 rule 6 | **Lead decides.** Architect recommends: the code follows the spec (no `#Learner` → preview), so that only learners make graded attempts. Safe to defer. |
| P8 | MINOR | `packages/tracking/src/outcome.ts:75-79` | ADR-010 rule 5 did not list `failed` rows. The code also compares with `failed` rows (A-T5b-02, rule 10). | ADR-010 rule 5 | **Spec, Architect.** Fixed. |
| P12 | NIT | `tool-pages/register.ts:45,107-108` | A bad Origin on `POST /tool/register` logs two events (`csrf_rejected` and `registration_confirm_rejected`). The spec says one event per error page. | app contract §6 | Deferred. |
| P13 | NIT | `packages/package-inspector/src/inspect.ts:145-146,161,210` | Some reject reasons have no `path` (count limits, `LAUNCH_FILE_MISSING` with no SCO). | app contract §3.2 | Deferred. Set the manifest path. |
| P14 | NIT | `app/connections.ts:35`; `002_connections.sql:12`; `004_launch.sql:4-7,60` | Spec drift: the `ref` token also has an encrypted copy (needed to show `registrationUrl` again), and `handoff.expires_at` is derived, not stored. A migration comment still says `ply_…`, but the column has the hash. | security §10; data-model | **Spec, Architect.** Fixed (security §10 table, data-model HANDOFF). Leave the applied migration as it is. |

Checked and conforming (app): §1 conventions (Origin rule, error shape, `/healthz`); session cookie; §3 courses, inspector reasons, every reject code and the §3.3 check order; §4 connections (`lastError`, no adoption, `PLATFORM_IN_USE`, the tool-configuration rows except the known row 16); §5 publications, results, Resend rules; §6 tool page codes, check orders, headers, runtime token HMAC; §10 retry schedule and status mapping; §11 `.mbz` and web services; security §4, §8, §9 (all outbound calls guarded), §10 (hashed ids, encrypted WS token), §11; ADR-006 migrations and `/data`; data-model retention.

## 3. Content host, player shell, runtimes

| Id | Severity | Where | Problem | Spec | Proposal and owner |
| --- | --- | --- | --- | --- | --- |
| P9 | MINOR | `apps/player/src/scorm12/api.ts:198-213` | The SCORM API accepts `cmi.interactions.250` and more. The server then refuses every later commit (`400 INVALID_CMI`), so the finish and the score are lost. The Cogniate package writes only interaction 0, so it is not affected. A third-party SCORM package can be. | app contract §7 (≤ 250 interactions) | Deferred, with a note in the human review pack (third-party packages). Fix: refuse index ≥ 250 in the API (error 201). |
| P10 | MINOR | `domain/attempts.ts:178-183,265-266`; `apps/player/src/runtime/transport.ts:37` | A reload of `/play/{playId}` keeps the same session. The spec says one page load = one session. After a reload, only the larger `session_time` counts, so time is undercounted, and `entry` keeps its first value. | app contract §7, §8 | **Lead decides.** Architect recommends: the code follows the spec (a new session bucket on each `/state` read). Safe to defer. |
| P11 | MINOR | `packages/tracking/src/status-text.ts:21-25`; `tool-pages/play.ts:29-31` | The player status text joins this attempt's score with the newest sync of any attempt. After a lower retake it can say "score 60 sent to Moodle" while Moodle keeps 80. | app contract §6 (status API) | Author: return the synced row's score in `scoreSync` and show it. Contract §6 changes with it. |

Checked and conforming (content and runtimes): `/pkg` (MIME allowlist, `nosniff`, Range, path checks, CSP `frame-ancestors {content} {app}`); `/rt` (CSP, `404`/`410 RUNTIME_EXPIRED`, `Clear-Site-Data`, no cookies, no CORS); commit check order and `seq` ≥ 1; stale late `finish`/`unload` with the LMSFinish rule; `total_time`; transport (`fetch` keepalive plus one `sendBeacon`); the SCORM API table, 101 after `LMSFinish`; the HTML runtime (attach on `interactive`, markers, dwell and scroll); sandbox exactly `allow-scripts allow-same-origin`; the proxy drops cookies on the content host; ADR-010 score mapping.

## 4. Infra, local stack, repo layout

Information: at `63de503` the Build Runner start-up sweep is already limited to its own stack (label `org.cogniate.stack=$COMPOSE_PROJECT_NAME`, `infra/scripts/build-runner.sh:109-116`).

| Id | Severity | Where | Problem | Spec | Decision and owner |
| --- | --- | --- | --- | --- | --- |
| A1 | MINOR | `infra/scripts/lib.sh:267,295-304` | `build_runner_running` checks only `kill -0` on a pid file that survives a reboot. A reused pid can make `stack:down` kill another program, and `stack:doctor` can report OK. The runner's own lock already checks the command name. | security §10a | **Author** (infra batch). |
| A2 | MINOR | `infra/scripts/stack-doctor.sh:22-24` | The memory check rounds down to whole GiB. Docker Desktop set to 6 GB can report a little less, so the doctor's own fix still gives `FIX`. | local-stack §6 | **Author.** |
| A3 | MINOR | `infra/scripts/build-runner.sh:98-102,239-242,180-181` | A directory named `bld_<hex>.json` in `requests/` stops the runner, and it stops again at every start. The upload copy follows a symlink in the upload store. | security §10a | **Author.** Check the entry is a regular file before `mv`; copy with no-follow and check the sha256 of the copy. |
| A4 | MINOR | `.env.example:23`; `infra/compose.yaml:125-168` | `LOG_LEVEL` is offered but not passed to the services. If wired, `/healthz` lines would reach the JSON files (F3). | security §11 | **Author** (with F3). |
| A5 | MINOR | `services/lti-service/src/*`; `packages/shared/src/{html,retention}.ts`; `infra/compose.yaml:256` | The spec was out of date: ADR-008 layout and shared module table, and local-stack §3 had no `compat` profile. | ADR-008; local-stack §3 | **Spec, Architect.** Fixed: ADR-008 layout as built (LTI service `http/`, `lti/`, `platform/`, `store/`, `db/`, `cli/`; app `clients/`, `cli/`), modules `html` and `retention` with their reasons, and the `compat` profile row. |
| A6 | NIT | `packages/shared/src/http.ts:41-45,61-83` | Unused T1 helpers. `traceIdFrom` uses a looser pattern than the security §11 rule. | security §11 | **Author.** Remove them. |
| A7 | NIT | `packages/shared/src/knobs.ts:47` | The knob text says "AC-T4-09 uses 5". The spec uses 20. | tasks README §3 | **Author.** |

Checked and conforming (infra): the topology and the `PUBLIC_*` URLs; content-host cookie removal; the Moodle dev curl rule; ADR-005 TLS (CA name constraint `DNS:test`, 365 days; leaf 90 days); the profiles and `test:acceptance`; the outbound allowlists and the guard; secrets handling and `.env.example`; security §10a (host runner, read-only mounts, internal network, request and backup checks, lock, stop handling); logs and boot trace ids; the `/data` paths (ADR-006); the shared modules and root scripts (ADR-008); the knob table; `stack:doctor` and `demo:users` (local-stack §6); `.gitignore`.

## 5. Human-facing docs

| Id | Severity | Where | Problem | Spec | Decision and owner |
| --- | --- | --- | --- | --- | --- |
| D1 | MAJOR | `README.md:3`; `docs/human_review/START-HERE.md:3,25`; `docs/human_review/proven.md:27` | The compatibility claim says more than ADR-003 allows. It leaves out "the listed endpoints", "except the differences in contract §8" and the D15 note on raw line item ids. | ADR-003 "The exact claim"; Q1 | **Docs.** Use the ADR-003 sentence. Add D15 to `proven.md`. |
| D4 | MINOR | `docs/human_review/START-HERE.md:51` | "Each finished task passed QA and two independent reviews", but T1-spike and T5-spike are unreviewed. | board | **Docs.** Name both spikes as exceptions. |
| D2 | MINOR | `infra/README.md:215` | The app allowlist in the README leaves out `moodle.test`. The code and security §9 have it. | security §9 | **Author.** |
| D3 | MINOR | `infra/README.md:292-305` | The knob section has no `PICKER_TTL_SECONDS` and no `PLAY_TTL_SECONDS`, and its range rule is wrong for the string knob `BUILD_RUNNER_FAIL_AT`. | tasks README §3 | **Author.** |
| D5 | NIT | `docs/human_review/PLAN.md:29,30,56` | Stale: "Q1 to Q16", an old `proven.md` state, and a wrong video size. Now Q1 to Q18. | open-questions | **Docs.** |
| D6 | NIT | `docs/guides/moodle-admin.md:27` | The "Make a new URL" step has no QA AC. | T9 AC-T9-02 | **Docs.** Tag it "Not verified by QA". |
| D7 | NIT | `docs/human_review/proven.md:49` | "The course video plays." The export has no visible video. | architecture README §6; ADR-004 | **Docs.** |
| D8 | NIT | `infra/README.md:3` | It points to a section §10 of the architecture README that does not exist. | — | **Author.** Point to `local-stack.md` and ADR-005. |

Checked and conforming (docs): every "Not proven" item of architecture README §6 is in `proven.md`; no doc calls T8 proven; Q1 to Q17 and R1 to R5 are in `decisions-needed.md` with recommendations (Q18 is new after `2129b69`; Docs adds it); the proven claims match the T3c, T6 and T7 QA reports; Moodle 5.2.4 labels are current; every `npm run` command in the guides exists; the ADR-001 and privacy wording is correct.

## 6. Spec changes made in this check (commit `aeb0854`)

- LTI contract §1.3 (F8), §3.2 (F4), §3.5 (F6).
- ADR-008 layout and shared module table (A5). local-stack §3 `compat` profile (A5).
- open-questions Q18 (F5). Architecture README §6: "Not supported: Moodle in a subfolder (Q18)".
- ADR-010 rule 5: `failed` rows count (P8), and a `superseded` row never goes back (P2).
- security §10 `ref` token storage, data-model HANDOFF (P14).

## 7. Verdict

CHANGES_REQUESTED. Open MAJOR findings: D1 (Docs), P1 and P2 (Author). F5 is MAJOR but accepted as a limitation (Q18), so it does not block. The MINOR findings follow the Lead's routing (Author infra batch, Docs, or `deferred.md`). P7 and P10 need a Lead decision. After the fixes, the Architect checks again: D1, P1 and P2 only.

## 8. Lead decisions

From the Lead's routing messages (after `2129b69`, and with commit `aeb0854`). One line per finding.

| Id | Lead decision |
| --- | --- |
| F1 | Deferred (`deferred.md`, via Docs). |
| F2 | Deferred. |
| F3 | Author, infra batch (with A4). |
| F4 | Spec follows the code: `custom: null` becomes `{}`. Spec fixed. No code change. |
| F5 | MAJOR, accepted limitation → open question Q18. No spec or code change before the hand-over. Architecture README §6 lists it as "Not supported". |
| F6 | Spec wording. Fixed. |
| F7 | Deferred. |
| F8 | Spec wording. Fixed. |
| F9 | Deferred. |
| P1 | Fix now (Author-2, Codex fork). Spec: `complete` waits 15 s (longer than the LTI service's 5 s Moodle call), and a timeout maps to `MOODLE_TOOL_MAY_EXIST` (app contract §6, security §2.6, §9). |
| P2 | Fix now (Author-2). Spec: ADR-010 rule 5 ("a `superseded` row never goes back"). |
| P3 | Deferred. |
| P4 | Deferred. |
| P5 | Fix now with P2 (same area). |
| P6 | Deferred. |
| P7 | Accepted deferral: the spec stays (no Learner role → preview), the code follows later. Listed as a known difference. |
| P8 | Spec. Fixed (ADR-010 rule 5). |
| P9 | Deferred, with a note in the human review pack about third-party SCORM packages. |
| P10 | Accepted deferral: the spec stays (one page load = one session), the code follows later. Listed as a known difference. |
| P11 | Fix now (Author-2). Spec: the status API `scoreSync` also has `scoreGiven` and `scoreMaximum` of the synced row, and new texts when the scores differ (app contract §6). |
| P12 | Deferred. |
| P13 | Deferred. |
| P14 | Spec. Fixed (security §10, data-model). |
| A1, A2, A3, A4, A6, A7 | Author, infra batch. |
| A5 | Spec. Fixed (ADR-008, local-stack §3). |
| D1 | Docs (MAJOR). Fixed in `5187765` (claim narrowed to the ADR-003 endpoints, with the D15 note). |
| D2, D3, D8 | Author, infra batch. |
| D4, D5, D6, D7 | Docs. Fixed in `5187765`. |
| A-FX-02 | Deferred. A platform that the LTI service makes after the app gave up stays active with no owner; the residual is in security §2.6. The timeout clamp part is in the spec (security §9). |
| A-FX-03 | Deferred. A theoretical double take-over of a stale Build Runner lock (needs a killed runner plus two starts at the same moment). |

Spec changes for these decisions: app contract §6 (status API and texts for P11; register timing for P1), security §2.6 and §9 (P1), commit `5d2bf50`. QA may pause and unpause Moodle on its own project to test P1 and P2 (tasks README §2), commit `1a0d915`. From the reviews of the fixes (`reviewer-a-fixes.md`, `reviewer-b-fixes.md`): app contract §6 (connect page wait text, P11 texts without a score), §12 (`score_sync` with `send_result`), security §9 (timeout clamp), commits `bb7c785` and `3847139`.

## 9. Round 2: after fixes

Verdict after fixes: **APPROVE (conformance).**

| Finding | Fix commit | State |
| --- | --- | --- |
| D1 (MAJOR) | `5187765` | Fixed (Docs). |
| P1 (MAJOR) | `5b10196` (merge `1aeef88`); follow-ups `2676cc7` (merge `dd6dd11`) | Fixed and merged. Follow-ups B-FIX-02 (wait text, no second submit) and A-FX-02 (timeout clamp) merged. Reviewer-A and Reviewer-B: APPROVE round 2 (`d2cfa76`). |
| P2 (MAJOR), P5 | `804a139`; follow-up `2676cc7` (merge `dd6dd11`) | Fixed and merged. Follow-up B-FIX-01 (`score_sync` with `send_result`) merged. Reviewers APPROVE round 2 (`d2cfa76`). |
| P11 | `ab0119b`; follow-up `2676cc7` (merge `dd6dd11`) | Fixed and merged, including the texts without a score. Reviewers APPROVE round 2 (`d2cfa76`). |
| C-T8-01 | `655ab78` | Fixed and merged (build reserved before the request file). |
| C-T8-02, C-T8-03 | `8059c31` | Fixed and merged (atomic runner lock; lang rule and failed status for refused requests). T8 QA round 2 PASS at `8059c31` (`8c9f7d9`). |
| F5 | none | Accepted limitation, Q18. |
| T7 final QA regression | `dd6dd11` | PASS: all 15 ACs, 17 tests in 183 s; demo preparation in 8.4 s. The four refusal checks leave the stack unchanged. Evidence: [T7 QA §9](../T7/qa.md#9-final-regression-run-dd6dd11-final-code), recorded in `3ca3105`. |
| T4b1/T4b2 final QA regression | `a5d9ddc` (product code `dd6dd11`) | PASS: all 10 T4b1 ACs, all 17 T4b2 ACs, P1, both TTL passes and eight T3b registration checks. Own stack cleanup: zero containers, volumes or networks. Evidence: [T4b1 QA](../T4b1/qa.md#replacement-qa-final-regression--2026-10-19), [T4b2 QA](../T4b2/qa.md#replacement-qa-final-regression--2026-10-19). |
| T5a final QA regression | `a5d9ddc` (product code `dd6dd11`) | PASS: all 21 ACs and the separate runtime-expiry pass. Evidence: [T5a QA](../T5a/qa.md#replacement-qa-regression-2026-10-19--candidate-a5d9ddc), recorded in `7f92f73`. This predates the P2 repair. |
| T5b/T6 final QA regression | `a5d9ddc` (product code `dd6dd11`) | FAIL: T5b AC-T5-30 in-flight grade mismatch and P5 fixture precondition; T6 AC-T6-07 exact-copy drift and AC-T6-09 test timing. See section 10. Fresh T5a/T5b/T6 and then T7 are required after the repair. |

T4b tested SHA: `a5d9ddcbc95cfb61968f70372334790386f2bb4b`. Evidence root: `tests/host/artifacts/qa-cont-t4b-a5d9ddcb-2026-10-19T10-05-11-656Z/`; `summary.json` records each AC and cleanup as PASS. The P1 wait text and disabled button appeared after 0.1 s; one confirm POST led to `MOODLE_TOOL_MAY_EXIST` after 6.0 s. QA saw no new active ownerless platform during the 30-second observation after Moodle resumed. This bounded check does not resolve the deferred late-orphan case A-FX-02. T4b coverage is limited to Chromium and local Moodle 5.2.4.

Round 2 had no open BLOCKER or MAJOR finding after its fixes. The live P2 failure below reopens the final regression gate. The deferred MINOR and NIT findings in section 8 remain unchanged.

## 10. Round 3: P2 late remote write

Verdict: **CHANGES_REQUESTED pending fresh T7**. The focused repair checks and full T5a/T5b/T6 regression below PASS. Fresh T7 on the repaired code is the remaining Architect conformance gate. Final T9 QA and Docs/media reviews remain separate Lead gates.

Replacement QA reported a grade mismatch on `a5d9ddc` (product code `dd6dd11`); the Lead recorded it in board commit `8e7bada`. A paused-Moodle send of 60 was superseded by 90. The app marked 90 as `sent`, but the Moodle oracle still showed 60 after 120 seconds. The local `superseded` guard did not prevent the older remote request from writing later. The repair and its focused PASS are recorded below; this finding was not accepted as a deferral.

The Architect approved a durable, bounded confirmation policy for the current best score (ADR-010 and app contract §10). It preserves terminal `superseded` rows, 409 conflicts and teacher overrides. A delayed confirmation can repair the observed ordering, but cannot prove that an arbitrarily late Moodle write will never occur. The contract records that limit; the evidence below does not remove it.

The failed candidate evidence is preserved in `7f92f73`: [T5b QA](../T5b/qa.md#replacement-qa-regression-2026-10-19--candidate-a5d9ddc) and [T6 QA](../T6/qa.md#replacement-qa-regression-2026-10-19--candidate-a5d9ddc). The combined run used `a5d9ddcbc95cfb61968f70372334790386f2bb4b` from 10:10:28 to 10:29:45 UTC on 2026-10-19. Evidence root: `tests/host/artifacts/qa-cont-t5-a5d9ddcb-2026-10-19T10-10-28-786Z/`. Its own stack ended with zero containers, volumes and networks; no pre-existing container stopped or restarted.

| Check at the failed candidate | Evidence and remaining work |
| --- | --- |
| T5a | All 21 ACs and runtime expiry PASS. Fresh verification must cover the repaired score worker. |
| T5b | 13 of 14 ACs PASS. AC-T5-30 fails only in the in-flight P2 case; the separate stopped-Moodle case passes. The app's `superseded` and late `send_result` checks pass, but Moodle stays at 60 through the 120 s wait. The later 90 s stability observation was not reached. |
| P5 fixture | The deleted higher failed sync still appeared in the public results. QA did not call Resend, so this is no proof of P5 and no demonstrated Resend defect. The Lead-approved stop/delete/start/health-wait extension is in T5b; fresh evidence is required. |
| P11 | The sent, pending and failed lower-retake variants PASS. No live lower-score `conflict` or scoreless-attempt variant is claimed. |
| T6 | 12 of 14 ACs PASS. AC-T6-07 used stale teacher text; `3385c55` aligns the spec with the accepted Moodle flow. AC-T6-09 used an immediate focus check; QA changed it to an awaited focus assertion (`e578c51`). Neither correction is a passing rerun; the later wizard keyboard segment was not reached. |
| Repair and T7 | The bounded confirmation policy is committed in `b826eb1`; product repair is in `1ce57f2` with the current-best attempt ratio correction in `d54c607`. Fresh full T5a/T5b/T6 PASS at `d54c607d7fc6ce2d97e039bb108f52a37f2174ee` is recorded below. Fresh T7 is running on `c5683f8` (same product). Historical T7 PASS at `dd6dd11` does not clear that gate. |

This run covers Chromium and local Moodle 5.2.4 only. It does not observe a full 24 h retry window. Existing human questions, accepted limitations and MINOR/NIT deferrals remain unchanged.

Repair scope: the product diff from `dd6dd11` to `d54c607` changes only the score-sync repository, worker, migration 010 and adjacent unit tests. Native `.mbz`, the Build Runner, LTI transport, portal and infra code are unchanged. Retain the T8 PASS at its tested SHA `8059c31`; this is not a new T8 run. Fresh T7 is required for the graded flow and app startup.

Upgrade limit: migration 010 gives old rows empty send and confirmation markers and `delivery_uncertain = 0`. It cannot recover uncertainty for remote writes started before the upgrade. The Author reported a synthetic seven-row upgrade check (nine migrations to ten), preserved history/statuses and manual Resend window, unchanged migration hashes, successful reopen, and no integrity or foreign-key errors. Its local evidence is `.tmp/p2-upgrade-task_fd4aae827241/result.json` and `validate.mjs`; the Architect inspected the result and migration, but did not run that check. This is Author evidence, not independent QA or proof of recovering pre-upgrade remote writes.

Continuation review deferral: **A-T9-C01 (MINOR)** remains a known implementation difference. Repeated retryable line-item GET failures before the first score POST keep `tries = 0` and the 5 s delay, rather than advancing the backoff. Static evidence: `worker/score-sync.ts` calls `syncResult` with `Math.max(1, tries)`; `worker/line-item.ts` calls only `findLineItems` (GET). The existing retry-window limit still applies and this path sends no score POST. The Lead accepted this deferral after both phase 1 verdicts were submitted (2026-10-19); the app contract §10 retains the required increasing schedule and labels the difference. A future fix needs separate preparation-retry accounting. This disposition does not clear the pending QA or final review gates.

### Focused repair verification at d54c607

**PASS, scoped to P2/P5:** independent replacement QA ran the fresh-clone focus on `d54c607d7fc6ce2d97e039bb108f52a37f2174ee` from 10:45:38 to 10:51:48 UTC on 2026-10-19. [T5b QA repair focus](../T5b/qa.md#replacement-qa-repair-focus-2026-10-19--d54c607d) records six passing tests: two setup tests, AC-T5-30 outage order, stopped-Moodle P2, in-flight P2 with app restart, and fixture-assisted P5. No tests failed or were skipped; `summary.json` has no abort and records zero own containers, volumes and networks after cleanup. No other container stopped or restarted.

Evidence root: `tests/host/artifacts/qa-cont-p2-d54c607d-2026-10-19T10-45-38-252Z/`. The Architect read its summary, the QA report and `evidence/p2-confirmation-evidence.json`; this is reconciliation of independent QA, not another execution.

- P2: the lower 60 row stayed `superseded` after its late response, with tries 2 and `send_result: pending`. The first accepted 90 at 10:49:29.543 kept the higher row `pending`, `sentAt: null`, tries 1. QA fully stopped its own app at 10:49:30.151, before confirmation was due, and started it again. Confirmation at 10:49:35.204 set `sent`, tries 2, after 5.661 s. Moodle stayed 90 for another 90 s, with no obsolete retry or repeat confirmation. Each actual POST had one phase-labeled log. The separate stopped-Moodle case also passed its 60 s observation.
- P5: public calls created final 60/100 and 80/100 attempts on two versions with failed syncs. The approved fixture stopped only the own app, deleted exactly the higher failed sync, and restarted and health-checked the app. Both attempts and the lower sync stayed unchanged; public best stayed 80. Resend of the lower 60 returned `409 SYNC_NOT_RESENDABLE`. This remains **fixture-assisted**, not pure black-box; exact public evidence is `evidence/p5-public-evidence.json`.

This focused PASS proves the recorded post-upgrade restart path and finite observation window. It does not prove pre-upgrade remote-write recovery or universal grade ordering. The full regression below repeats these checks on the same SHA. Deterministic late-write placement, requirement transfer, confirmation-conflict and retry-window exhaustion remain separate Author unit evidence, not claims of this live focus.

### Full regression verification at d54c607

**PASS:** the independent QA reports committed in `c5683f896330debaea5e9a09f49357dc3e99e92b` verify `d54c607d7fc6ce2d97e039bb108f52a37f2174ee` in a fresh clone from 10:52:13 to 11:11:10 UTC on 2026-10-19. Evidence root: `tests/host/artifacts/qa-cont-t5-d54c607d-2026-10-19T10-52-13-189Z/`. The Architect read the three dated reports and checked `summary.json`: all 63 aggregate IDs, including all 49 required ACs, PASS; `abort` is null. The runner exited 0. Cleanup left zero own containers, volumes and networks; no pre-existing container stopped or restarted.

| Suite | Verified result |
| --- | --- |
| [T5a final QA](../T5a/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) | All 21 ACs PASS. Main run: 22 tests pass; its one deliberate TTL skip passes in the separate runtime-expiry run. |
| [T5b final QA](../T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) | All 14 ACs and 24 tests PASS, including P2, fixture-assisted P5 and sent/pending/failed P11. Conflict, Resend, teacher override, Refresh and the captured-secret log scan also pass. |
| [T6 final QA](../T6/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) | All 14 ACs and 18 tests PASS. AC-T6-07 verifies the reconciled teacher text; AC-T6-09 verifies all five axe scans, focus restoration and the later keyboard-only wizard segment. |

Total: **65 executed tests**, with no failures or flakes. The deliberate TTL skip was executed in its separate pass, so it is not a missing criterion.

The full P2 run adds an initial higher-send timeout before acceptance. The first accepted 90 at 11:04:52.856 stays pending with tries 2 and no `sentAt`; the app fully stops 541 ms later, before confirmation is due. Confirmation at 11:04:58.479 sets sent with tries 3, after 5.623 s. The 90 s observation then keeps Moodle at 90, the lower row superseded with tries 2, and no repeat confirmation. P5 again deletes exactly one higher failed sync, preserves both attempts and the lower failed sync, keeps public best 80 and returns `409 SYNC_NOT_RESENDABLE` for lower 60. P11 verifies current attempt 75 separately from best 90 in sent, pending and failed states.

Limits remain: P5 is fixture-assisted; P11 lower-score conflict and scoreless-attempt variants are not live-tested; the full 24 h window was not observed. This run covers Chromium and local Moodle 5.2.4. T6 covers 1440 px and five axe surfaces with serious/critical impact; it does not prove other viewports or every card/error state. The P2 remote-ordering and pre-upgrade recovery limits above remain unchanged.

Fresh T7 is running on `c5683f896330debaea5e9a09f49357dc3e99e92b`. A product-path diff against `d54c607` is empty. The Architect verdict remains pending that independent E2E result; final T9 QA and pack reviews will follow as separate Lead gates.

