# Review response: T0 round 2

Inputs: `docs/reviews/T0/reviewer-a.md` (2 BLOCKER, 6 MAJOR), `reviewer-b.md` (5 MAJOR), `qa.md` (12 MAJOR), and the Lead's ten decisions. "Done" = changed as asked. "Done, changed" = resolved in another way (reason given). "Deferred" = not done now.

## Findings

| Id | Sev. | Resolution |
| --- | --- | --- |
| A-T0-01 | BLOCKER | Done. `/pkg/*` sends `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}`: security §5, app contract §7, ADR-004. AC-T5-01 asserts it; AC-T5-04 (`CogniateSCORM.available`) and AC-T5-09 (runtime reads `body[data-lesson-id]`) prove the package script runs. T5-spike S1 checks it first. |
| A-T0-02 | BLOCKER | Done. Tool pages send `Referrer-Policy: same-origin` (security §5, §6); the strict `Origin` rule stays. AC-T4-08 (real click works), AC-T4-22 (`evil.test`, `null`, no `Origin` → 403, no state change). |
| A-T0-03 | MAJOR | Done, changed in item 2. (1) Publication only from the signed `launch.target`; (3) single-use handoff (`HANDOFF` table, `HANDOFF_USED`); (4) picker POST re-check; unique resource-link key (connection, deployment, context, resource link). Item 2 changed: a **signed** target that names another publication of the same connection rebinds the row (`resource_link_rebound`) instead of "not available", because only a teacher can change a signed target (by "Select content" again), and blocking would break that normal action. Other connection or withdrawn → error page. Files: security §4, data-model §2, app contract §6, flows §6c. ACs: AC-T4-23, -24, -25, -26, -27. |
| A-T0-04 | MAJOR | Done (account in the login URL). All protocol URLs carry the tool account: `/lti/login/{id}`, `/lti/launch/{id}` (security §2.1, contract §2, ADR-009). Another account may register the same pair, but it is never used for the first account's launches. AC-T2-18. |
| A-T0-05 | MAJOR | Done. `operation` and `existingPlatformId` in `GET /api/registrations/:id`; `updatePlatformId` required for an update, else `409 REGISTRATION_UPDATE_NOT_ALLOWED` with nothing sent to Moodle; the app allows an update only for its own connection; `connection.lti_platform_id` unique. Security §2.5, contract §3.8, app §6, ADR-009. ACs: AC-T3-25, AC-T3-26, AC-T4-30. |
| A-T0-06 | MAJOR | Done. Every JWT we sign: `iat = now − 30 s`, `exp = now + 300 s` (security §2.3, contract §4). Our 60 s acceptance skew is recorded as a deliberate difference from spec §10 (security §2.2 "Clock rule"). AC-T3-08; fake-clock unit test in T3a. |
| A-T0-07 | MAJOR | Done. Per-page `frame-ancestors`, `form-action`, `Referrer-Policy`, no `X-Frame-Options` on framed pages (security §5). Embedded launches get `/play/{playId}/embedded` with "Open in a new window" (security §4, app §6). AC-T4-21, AC-T4-31. |
| A-T0-08 | MAJOR | Done. Platform JWKS through the guarded client + `createLocalJWKSet` (ADR-002, security §2.4, contract §4). Auth, token and JWKS URLs must be on the issuer origin (`PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`). AC-T2-29, AC-T2-21 (JWKS fetch logged), AC-T4-10 (app side). |
| A-T0-09 | MINOR | Done. Best value over pending, sent and conflict rows; only lower pending rows are superseded; 409 → `conflict`; 24 h retries; Resend; portal shows the best outcome. ADR-010 rules 5, 8–10, data-model §3, app §5, §10. AC-T5-30, AC-T5-31, AC-T5-32, AC-T6-14. |
| A-T0-10 | MINOR | Done. Attempts keep their course version; a new version only for new attempts (ADR-004, ADR-010 rule 11, data-model §2). AC-T5-24. |
| A-T0-11 | MINOR | Done. Picker is single select (flows §6b, app §6). AC-T4-15. |
| A-T0-12 | MINOR | Done. OIDC `error` posts → `PLATFORM_ERROR`, state used up; help text chosen by message type after the signature check (security §2.2). AC-T2-28, AC-T2-10. |
| A-T0-13 | MINOR | Done. ADR-003 rows corrected (`/message` path, registrations "paths are ours"); differences table D1–D12 in contract §8; exact narrow claim in ADR-003 and `rea-evaluation.md`. |
| A-T0-14 | MINOR | Done. ADR-001 "Clean-room process" table (who may read what), provenance note in the LTI contract, ADR-002 (Author does not read `ltijs`), Q1. |
| A-T0-15 | MINOR | Done. Moodle `LMSFinish` rule (checked in `scorm_12.js` `StoreData`), `201` for unknown elements, session time once per session: app contract §7, §8, ADR-010 rule 3. AC-T5-05, AC-T5-21, AC-T5-22. |
| A-T0-16 | MINOR | Done except one. Re-launch after pass AC-T5-20; withdrawn AC-T4-27; HTML fail AC-T5-27; embed AC-T4-31; teacher override AC-T5-31. **Deferred:** the key-rotation AC, because rotation is optional now (B-T0-07, Lead decision 5). |
| A-T0-17 | NIT | Done. Contract §3.1 example uses placeholders; AC-T2-04 says QA does not assert other `platform.*` values. |
| A-T0-18 | NIT | Done. Inner package iframe gets the same `allow`; `allow-modals` on (security §7, ADR-004). AC-T5-03, T5-spike S6. |
| B-T0-01 | MAJOR | Done (Lead decision 2). Option C kept; dev CA + leaf by `gen-env`, static certs in Caddy, kept by reset (ADR-005, local-stack §2); four `PUBLIC_*_URL` values everywhere, no literals (contracts, ADR-009, T1 LC-T1-02); fallback table F1–F3 with the ACs that change, Lead decides (local-stack §4). |
| B-T0-02 | MAJOR | Done (Lead decision 3). `npm run demo`, `demo:browser` in T1; `demo:prepare` in T7 (AC-T7-15); command table in `infra/README.md` (T1); AC-T9-01 (≤ 10 min for a new person) in the new Docs task T9. |
| B-T0-03 | MAJOR | Done (Lead decision 4). New files T5-spike, T3a, T3b, T3c, T4a, T4b, T5a, T5b; old T3, T4, T5 removed; task DAG with critical path in README §7; T7 bug-fix time-box. |
| B-T0-04 | MAJOR | Done (Lead decision 7). "Log events" tables (LTI contract §5, app contract §12); one `outbound_request` or `outbound_blocked` per outbound call (security §9); `evil.test` sink and `qa-platform.test` (local-stack §3, T2); QA rules (tasks README §2). ACs now use only defined events. |
| B-T0-05 | MAJOR | Done (Lead decision 6). T3c AC-T3-27 runs the MIT `ltiaas` SDK 0.0.4 as a test-only black box in a container (license and PyPI package checked: MIT, `requests` + `pydantic`); fallback option 2; narrow claim; Q1 item (b). |
| B-T0-06 | MINOR | Done (Lead decision 2). CA before containers, kept on reset; the app reads the API key at each use (app §1); AC-T1-13. |
| B-T0-07 | MINOR | Done (Lead decision 5). Course shell → T8; compat-only endpoints → T3c; access tokens and score clock in memory (ADR-006); no ltik in play session; one active signing key; publication `available`/`withdrawn`, connection without `expired`; "Download SCORM package" → T6 (AC-T6-11). |
| B-T0-08 | MINOR | Done. App tool pages renamed to `/tool/*`; `/lti/*` only on the LTI service. |
| B-T0-09 | MINOR | Done. Glossary adds tool account, registration session, course shell, content picker, and a "Moodle label" column; only "HTML runtime" is used. |
| B-T0-10 | MINOR | Done. README is an overview with a "what the plan proves" table and the DAG; detail moved to `flows.md`, `security.md`, `data-model.md`, `local-stack.md`; NOTE for information, WARNING only for data risks. |
| B-T0-11 | MINOR | Done. Every HTML error page shows code, trace id and an action line (security §2.2, app §6; AC-T2-30, AC-T4-32); `X-Trace-Id` propagation (security §11); `launch_check_failed {check, code}`; Resend (AC-T5-32, AC-T6-14). |
| B-T0-12 | MINOR | Done (Lead decision 8). One knob table (tasks README §3) with the T1 `stack:restart` mechanism; AC-T7-13 proves knobs are off. |
| B-T0-13 | MINOR | Done. Wizard steps as data (`moodle-steps.json`, AC-T6-12); T7 follows them and checks the labels (AC-T7-14). |
| B-T0-14 | MINOR | Done (Lead decision 9). `COURSE_FIXTURES_DIR` + `fixtures:check` (T1, tasks README §5). Q15 stays open for humans. |
| B-T0-15 | MINOR | Done. `npm run dev:web` (`vite build --watch`, served by the app) in ADR-008 and T5a. |
| B-T0-16 | MINOR | Done. ADR-008 folders per service, ESLint import fence for `content-host`, `shared` limited to four modules. |
| B-T0-17 | NIT | Done. T2 references contract §1.2. |
| B-T0-18 | NIT | Done, changed. One rule everywhere: `iat = now − 30 s`, `exp = now + 300 s`, so the AC checks `exp − iat = 330 ± 1` (A-T0-06 needs the offset). |
| B-T0-19 | NIT | Done. AC-T1-02, AC-T7-01, AC-T8-02 say "images already pulled". |
| B-T0-20 | NIT | Done. Tool name `Cogniate (<library name>)`, ASCII. |
| Q-T0-01 | MAJOR | Done. Charter §3a (Lead) and T1 H1 (`COMPOSE_PROJECT_NAME`, `PUBLIC_PORT`, `STACK_SUBNET`, all state in the checkout); local-stack §2. |
| Q-T0-02 | MAJOR | Done. T1 H2 `seed.json`; later keys: `lti.apiKeyFiles`, `ltiSeed` (T2), `portal.users` (T4a). |
| Q-T0-03 | MAJOR | Done. Knob mechanism (T1 H3) and 20 s values with the "first call < 10 s, 401 at TTL + 3 s" procedure (tasks README §3; AC-T2-07, AC-T4-09, AC-T4-20, AC-T5-15). |
| Q-T0-04 | MAJOR | Done. T1 H4 `cogniate_qa_oracle`; QA rules allow it; Moodle ACs poll it, screenshots stay the evidence. |
| Q-T0-05 | MAJOR | Done. `ResultRow.scoreSyncs` (every row), `attempts`, `best`, preview rows with `preview: true` (app §5, T5a H5). |
| Q-T0-06 | MAJOR | Done. Check → error code map (security §2.2); negative ACs AC-T2-20 to AC-T2-27; `qa-platform.test` in the `acceptance` profile (T2, H6). |
| Q-T0-07 | MAJOR | Done. The URL rule also compares every query parameter of the claim URL (`type_id`): security §8, contract §3.4. AC-T3-23 (same course, other tool, with and without `type_id`); AC-T3-17 adds a user not in the course. |
| Q-T0-08 | MAJOR | Done. AC-T4-22 (tool-page `Origin`), AC-T4-28 and AC-T6-13 (XSS), AC-T4-29 (tenant matrix, unknown `playId`). |
| Q-T0-09 | MAJOR | Done. T1 H7 log files mounted read-only in `e2e`; event names fixed in the contracts. |
| Q-T0-10 | MAJOR | Done. Charter (Lead) and T1 H8; ADR-008: root checks exclude `tests/**`. |
| Q-T0-11 | MAJOR | Done. AC-T1-11 names every `.env*`, `infra/.certs/`, `infra/.secrets/`, `infra/.logs/`, `**/.data/`, `.tmp/`. SPIKE-NOTES §0 has no secrets now (checked). **Open item for the Author:** `infra/.logs/` is not git-ignored in the current tree (`git check-ignore` = not ignored). |
| Q-T0-12 | MAJOR | Done. T7 Scenario B step 5 reopens Thanh's picker after B3; AC-T7-08. |
| Q-T0-13 | MINOR | Done. "Images already pulled" in AC-T1-02, AC-T7-01, AC-T8-02; pull time recorded separately. |
| Q-T0-14 | MINOR | Done. QA oracle for roles and enrolments; AC-T1-12 checks unchanged token values. |
| Q-T0-15 | MINOR | Done. AC-T2-06 names every code; AC-T2-19 (303 headers, `405`). |
| Q-T0-16 | MINOR | Done. Token cache in memory; AC-T3-22 oracle "at most one miss, the second post is a hit". |
| Q-T0-17 | MINOR | Done. `content_items` deep-equal plus only the default `url` (contract §3.2); `exp − iat = 330 ± 1`; role forms short name and URI (contract §3.7, AC-T3-20). |
| Q-T0-18 | MINOR | Done. H9 in T2; AC-T3-19 runs last and re-seeds. |
| Q-T0-19 | MINOR | Done. Report rules (app §3) and exact values, verified with Python `zipfile`: SCORM 7 files, 12,723,159 bytes; HTML 7 files, 12,103,306 bytes; hosts as QA said. AC-T4-03, AC-T4-04. |
| Q-T0-20 | MINOR | Done. AC-T4-05 has all 15 reject codes and the nested path. |
| Q-T0-21 | MINOR | Done. `lastSeq` in RuntimeState (H10), "`seq` > last accepted", check order, commit after `finish` never lowers (app §7). AC-T5-12 rewritten. |
| Q-T0-22 | MINOR | Done. AC-T5-06 uses the blank SCO. |
| Q-T0-23 | MINOR | Done. AC-T5-14 procedure: start Moodle before 30 s after the first try. |
| Q-T0-24 | MINOR | Done. AC-T6-02 pill `rgb(166, 103, 228)`; AC-T6-06 `role="progressbar"` + CDP throttling; route list in T6. |
| Q-T0-25 | MINOR | Done. AC-T7-11: `retries: 0`. |
| Q-T0-26 | MINOR | Done. T8 knobs (H12), AC-T8-03 network oracle, AC-T8-04 "other modules allowed", AC-T8-06 uses the QA oracle. |
| Q-T0-27 | MINOR | Done. QA rules block non-`*.test` hosts; T5a design note; T5-spike S7. |
| Q-T0-28 | MINOR | Done. AC-T5-28 (first answer stands), AC-T5-29 (dwell), AC-T5-23 (better result raises the grade). |
| Q-T0-29 | MINOR | Done. Optional H11 snapshot and restore in T4b; T7 risk note on the choice page. |
| Q-T0-30 | MINOR | Done. AC-T5-01 uses raw paths; oracle "400 or 404, body is not the file". |
| Q-T0-31 | NIT | No change (QA keeps the layered repeats, as QA suggested). |
| Q-T0-32 | NIT | Done. AC-T5-10 compares every file. |

## AC moves and renumbering

| Old | New place |
| --- | --- |
| AC-T3-01 to -05 | T3b |
| AC-T3-06 to -08, -10 to -14, -16 to -18, -22 | T3a (AC-T3-07 now uses `/api/deeplinking`) |
| AC-T3-09, -15, -19, -20, -21 | T3c (AC-T3-09 now covers `/form` and `/message`) |
| AC-T4-01 to -06 | T4a |
| AC-T4-07 to -10, -12, -14 to -21 | T4b |
| AC-T4-11, AC-T4-13 | T8 as AC-T8-08, AC-T8-09 |
| AC-T5-01 to -08, -12, -13, -15 to -17 | T5a |
| AC-T5-09 to -11, -14, -18, -19 | T5b |
| AC-T6-07 checkbox part | T8 as AC-T8-10 |
| AC-T8-01 | T6 as AC-T6-11 |
| AC-T2-17 | merged into AC-T2-29 |

New ids: AC-T2-18 to -31; AC-T3-23 to -27; AC-T4-22 to -32; AC-T5-20 to -24, -27 to -32; AC-T6-11 to -14; AC-T7-13 to -15; AC-T8-08 to -10; AC-T9-01 to -04.

## Rejected

None. A-T0-03 item 2 and B-T0-18 are resolved in a changed way (reasons above).

## Round 3

Inputs: the `## Round 2` sections of the three reviews (commit dadd9de) and the Lead's round-3 decisions.

| Id | Sev. | Resolution |
| --- | --- | --- |
| A-T0-19 | MINOR | Done. Security §9: the IP check runs in the lookup of the connection (undici `connect.lookup`, no second lookup); blocked IPv4 and IPv6 ranges listed (CGNAT, link-local and metadata, multicast, NAT64, IPv4-mapped); one allowlist per service. T2a self-check adds the fake-resolver test (public IP first, private IP second). |
| A-T0-20 | MINOR | Done. Error pages have no form and no action, so they use `frame-ancestors https:; form-action 'none'` (security §2.2, §5); strict values stay for pages with actions. AC-T3-28 (error page visible in Moodle's registration frame), AC-T4-33 (unknown `ref` page in the frame), AC-T4-21 (launch error page headers). |
| A-T0-21 | MINOR | Done. Chosen rule: continue an in-progress attempt only if its course version belongs to the course of the resource link's current publication; otherwise a new attempt on that publication's current version; the old attempt stays and shows under its own course (security §4, data-model §2, flows §6c). AC-T4-25 has the in-progress case. |
| A-T0-22 | NIT | Done. Only `documentTarget = iframe` gets the embedded page; `frame` and `window` open the player (security §4, app §6, flows §6c, AC-T4-31). |
| A-T0-23 | NIT | Done. Score clock floor at start = start time + 2 s (LTI contract §3.6, ADR-006). |
| B-T0-21 | MAJOR | Done (Lead decision). T2 → T2a (core, all 12 checks unit-tested, 17 ACs) and T2b (negative matrix + `acceptance` profile with `qa-platform.test`, sink, second leaf; 13 ACs, right after T2a). T4b → T4b1 (connect + publish, 9 ACs) and T4b2 (picker, launch, tool-page security, 17 ACs). "Depends on" lists only technical dependencies (T2a: T1; T3b: T2a, T2b). DAG in README §7, list in tasks README §1. AC ids unchanged. |
| B-T0-22 | MINOR | Done. ADR-008 lists the real `packages/shared` modules (`config`, `knobs`, `logger`, `server`, `errors`, `outbound`, `crypto`) with the rule "a new module needs a reason in the done report", and the reach-check scripts in the root-script list. |
| B-T0-23 | MINOR | Done. `/healthz` and `service_started` show `profile` and the active allowlist (both contracts, local-stack §3); the `test:acceptance` steps (start, run, restore, interrupted case) in local-stack §3; AC-T7-13 also checks `profile: "default"`. |
| B-T0-24 | MINOR | Done, as Q-T0-39. |
| B-T0-25 | NIT | Done: curl wording (round-2 Lead fix), ADR-002 task names, boot trace id, `service_started` fields aligned with the T1 code plus `profile`, `BUILD_RUNNER_FAIL_AT` string-knob note. The `http_request` health-check exception is now done too (after round 3, Lead decision B-T1-04): `GET /healthz` is not written to the JSON log files; stdout may keep it at `debug` (T1 H7, LTI contract §5, app contract §12, security §11). |
| Q-T0-33 | MINOR | Already done in the round-2 Lead fix (T1 H7: every event has `trace_id`, boot trace id for lifecycle events). |
| Q-T0-34 | MINOR | Done. AC-T1-11 greps only secret values (secret `.env` entries, passwords and tokens in `infra/.secrets/`, `infra/.certs/*.key`). Wording only. |
| Q-T0-35 | MINOR | Done. AC-T2-21 has the ≥ 61 s precondition and a second post within 60 s with no new fetch (T2b). |
| Q-T0-36 | MINOR | Done. `qa-platform.test` logs `qa_platform_hit {method, path}`; AC-T2-30 compares the hit count on the JWKS path with the `outbound_request` count (T2b, local-stack §3). |
| Q-T0-37 | MINOR | Done. H14 in T2a: `test:acceptance -- <args>` forwards arguments and the caller's `QA_*` env; knob-test procedure in tasks README §3. |
| Q-T0-38 | MINOR | Done. Start command `STACK_PROFILE=acceptance npm run stack:up` and `profile` in `/healthz` (T2b, local-stack §3, tasks README §4). |
| Q-T0-39 | MAJOR | Done. Checked in Moodle 5.2.4: `save_grade_item` stores our `timestamp` as the grade time, and `update_raw_grade` does not change an overridden final grade. Recipes: `conflict` = score with `timestamp` now + 10 min, `stack:restart -- lti-service`, then complete (AC-T5-31); `failed` = unenrol, then complete → 400 (AC-T5-32, with Resend after re-enrolment); teacher override = `sent` + `gradebookDiffers` (new AC-T5-33). App contract §5, §10 and ADR-010 rule 8 corrected. AC-T6-14 uses the three rows. |
| Q-T0-40 | MINOR | Done. AC-T9-01 is marked "human check"; the Lead names the person or accepts a QA run; qa.md says which part a human did. |
| Q-T0-41 | NIT | Done. Error pages carry `data-error-code` and `data-trace-id` (security §2.2; AC-T2-30, AC-T4-32, AC-T4-33). |
| Q-T0-42 | NIT | Done. URL mapping, MIME type and run-time JWKS files of `qa-platform.test` in local-stack §3. |

Round-3 AC changes:

| Change | ACs |
| --- | --- |
| T2 split | T2a: AC-T2-01 to -08, -12 to -16, -18, -19, -29, -31. T2b: AC-T2-09 to -11, -20 to -28, -30. |
| T4b split | T4b1: AC-T4-07 to -10, -12, -14, -30, and new AC-T4-33, AC-T4-34. T4b2: AC-T4-15 to -29, -31, -32. |
| New | AC-T3-28 (T3b), AC-T4-33, AC-T4-34 (T4b1), AC-T5-33 (T5b). |
| Changed meaning | AC-T5-31 (now the `conflict` recipe; the teacher override moved to AC-T5-33), AC-T5-32 (now the `failed` recipe + Resend), AC-T4-21, AC-T4-22, AC-T4-28, AC-T4-29 (register-page parts moved to AC-T4-33, AC-T4-34), AC-T4-25 (in-progress case), AC-T4-31 (`frame` opens directly), AC-T2-21, AC-T2-30, AC-T7-13. |

Rejected: none.

## After round 3: T5-spike facts (commit 07e8a45)

The T5-spike (`apps/player-spike/SPIKE-NOTES.md`) verified the player design in Chromium. Changes, with AC ids kept:

| Topic | Change | Files and ACs |
| --- | --- | --- |
| SCORM API object | Our own SCORM 1.2 subset; `scorm-again` only as an optional test oracle (it gives `401` for unknown elements and accepts calls after `LMSFinish`). | ADR-004, ADR-008, app contract §8, T5a scope |
| Sandbox | Runtime iframe `sandbox="allow-scripts allow-same-origin"` (`allow-same-origin` is required). `allow-forms`, `allow-popups`, `allow-modals` dropped for these exports. This supersedes the `allow-modals` part of A-T0-18. | security §7, ADR-004, AC-T5-03 |
| Permissions | `allow="autoplay; fullscreen"` on the runtime iframe only; the same-origin inner iframe needs none (supersedes the inner-iframe part of A-T0-18). No `Permissions-Policy` on the shell. | security §7, ADR-004, AC-T5-03 |
| Transport | `fetch` keepalive for `commit` and `finish`, one `sendBeacon` on `pagehide`, no `postMessage` for state; server orders by `seq`; `total_time` uses the largest `session_time` per session. | app contract §7, ADR-004, AC-T5-22, new AC-T5-34, AC-T5-35, log event `commit_accepted` |
| After `LMSFinish` | Keep `101`; no re-initialize (Moodle's rule makes the package send a second `finish`). | app contract §8, ADR-004, AC-T5-34 |
| HTML runtime | Attach when the child document is parsed, not on `load` (a hanging external host blocks `load`). | app contract §9, ADR-004, flows §6d, T5b, new AC-T5-36 |
| Not proven | Video playback, Firefox and Safari, a real window close by a person, mobile browsers. | README §6 |
| Code location | `apps/player-spike/` is reference only; production code in `apps/player/`. | ADR-004, ADR-008, T5a |

## Later spec changes (from task reviews)

| Source | Change |
| --- | --- |
| T2a review | T2b gets side items A-T2a-01, A-T2a-02 (new AC-T2-32: JWKS refresh failure), B-T2a-02, B-T2a-03 (`detail` in `launch_check_failed`), B-T2a-04 (migration checksum, ADR-006). B-T2a-01 goes to T3a design notes. Q-T2a-01: `cmids` example fixed. |
| QA T4b2 suite | AC-T4-25 split: T4b2 keeps the rebind launch; the in-progress attempt part moves to new AC-T5-37 (T5a). AC-T4-18, AC-T4-21, AC-T4-32 state the two-pass setup order (host `seed:lti-activity` between passes). New log event `deep_link_rejected {reason}` (app contract §12) for the AC-T4-20 `403` page, named in AC-T4-32. |
| T4a build (Author and QA questions) | `latestVersion` shape fixed; `masteryScore` with SCORM → `400 MASTERY_SCORE_NOT_ALLOWED` (added to AC-T4-03); `<base href>` counts as a resource host; store path `/data/packages` (AC-T4-05, ADR-006); one migration rule for both services with a shared runner (ADR-006, ADR-008 `migrations`); async `build` in `startService` (ADR-008); `/tool/deep-link` check order (`not_deep_linking` before `role_not_allowed`, AC-T4-20, AC-T4-32); error pages mark the action line with `data-error-action` (security §2.2, T2b side item). |
| T4a review round 1 | B-T4a-03: `internal_error` event in app contract §12. A-T4a-01: identifier rules (app contract §3.3, security §7) with reject code `INVALID_PACKAGE_IDENTIFIER`, new AC-T4-35. B-T4a-02: `details.action` on reject errors (app contract §3.2). B-T4a-01: shared infra code move in T3a design notes (ADR-008 `migrations` also holds the transaction helper). |
| T3a review | A-T3a-01: the line item URL rule rejects encoded slash, backslash, dot, double encoding and dot segments in the raw path (security §8, contract §3.4); new AC-T3-29 in T3b. Score `timestamp` limit now + 15 min (contract §3.6), new AC-T3-30. Not 60 s: the AC-T5-31 conflict recipe needs now + 10 min. |
| T4b1 build | App codes `CONNECTION_NOT_PENDING` (409), `LTI_SERVICE_ERROR` (502); tool pages `REGISTRATION_FAILED`, `MOODLE_TOOL_MAY_EXIST` (connection stays `pending`, ref not used up); a `new` registration with a known client id updates that platform and logs `operation: update` (LTI contract §3.8); `outbound` supports PATCH (ADR-008); T6 wizard help line. |
| T4b1 review | A-T4b1-01: platform ownership rules (security §2.6, app contract §4): no adoption (`409 PLATFORM_IN_USE`), orphans switched off (`platform_orphan_deactivated`), foreign platforms untouched; new AC-T4-36. A-T4b1-02: the app refuses every "update" (security §2.5, ADR-009, flows §6a-1, app contract §6, T6); re-connect = delete the tool in Moodle, disconnect, connect again; the LTI service keeps `updatePlatformId` as an API feature (AC-T3-26 stays). |
| T4b1 round 2 | Connection `lastError {code, ltiCode, traceId, at}` (app contract §4, T6); log event `platform_orphan_deactivate_failed`; `502 INVALID_LTI_ANSWER` for an LTI answer that fails the app's schema; no startup orphan scan (security §2.6). Rule for a "new" registration that returns an existing unowned platform: waiting for Reviewer-A. |
| T4b1 edge (Reviewer-A) | "New" registration returning an existing unowned platform: accepted as residual risk R1 (security §2.6, open-questions "Residual risks"); no rule. A-T4b1-03 (keep a deactivated orphan inactive in that fallback) is an Author item for the next batch. |
| T4b2 build | Page codes `INVALID_LTIK`, `PICKER_NOT_FOUND`, `PICKER_USED`, `PICKER_EXPIRED`, `PLAY_NOT_FOUND`, `LTI_SERVICE_ERROR` page; `deep_link_rejected {reason: unknown_platform}`; deep-linking ltik on `/tool/launch` → `invalid_ltik`; `scoreSync.status: null` before a sync; runtime token = HMAC of the play id, hash stored (app contract §6, security §10). `stats.activities` counting cancelled picks is intended (Moodle gives no signal); the portal label becomes "Selected in Moodle" (app contract §5, flows §6e, data-model, AC-T7-03). |
