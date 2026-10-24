Verdict: APPROVE
Round: 2

# A2 conformance check: LA design against the final product

- **Checked:** product SHA `8fadb828`. The worktree product paths (`services/`, `packages/`, `apps/`, `infra/`) are equal to it (`git diff 8fadb828 HEAD` is empty).
- **Date:** 2026-10-24.
- **Scope:** LA-ADR-05 to LA-ADR-08, the LTI service contract delta, `operability.md`, `security-delta.md` and the A2 task specs, read against BD-A2-01 to BD-A2-111.
- **Method:** code reading with `file:line` evidence. I ran no tests; the QA gates hold the runtime proof.
- **Path short forms:** `L/` = `services/lti-service/src/`, `A/` = `services/cogniate-app/src/`, `S/` = `packages/shared/src/`, `C/` = `packages/channels/`.

**Status values:**

| Status | Meaning |
| --- | --- |
| **Built** | As designed. |
| **Built (BD)** | Built with a recorded change. |
| **Deviation** | The code differs from the design. BD-A2-111 now records it, and the docs follow the code. |
| **Not built** | Cut by a human decision, deferred, or by design. |

## 1. Design items

| Design item | Status | Evidence | Note |
| --- | --- | --- | --- |
| **LA-ADR-05: LTI Advantage completeness** | | | |
| D1 trigger and trait values (Canvas, `lti-generic`; others `null`) | Built | `L/lti/login.ts:77`; `L/profiles/storage.ts:4-15`; `C/canvas/lti-profiles.ts:12` | Moodle, Blackboard and `brightspace` keep the `302`. |
| D1 login page (headers, JSON block, 1.5 s) | Built (BD-A2-35, -41) | `L/lti/storage-pages.ts:14-16,49-71` | No form and no button. |
| D1 storage check and its page CSP | Built (BD-A2-44, -103, -104) | `L/lti/launch.ts:98-120,184-197`; `L/lti/storage-pages.ts:89-93,136-147` | `form-action 'self' <T>`; the guard fails closed. |
| D1 rule 8 check order | Deviation | `L/lti/launch.ts:102-109` | The status gate runs before the `Origin` check. Rule 8 text fixed. |
| D2 launch without a context (service and app) | Built | `L/lti/service-keys.ts:21-24`; `A/tool-pages/launch.ts:128-149` | LA-IC-05. |
| D3 Deep Linking: cancel, multi-select, `accept_lineitem`, shaped token, per-type fields | Built (BD-A2-87) | `L/lti/deep-linking.ts:45-89`; `A/tool-pages/picker.ts:51-263`; `L/lti/idtoken.ts:61` | LA-IC-12. |
| D4 NRPS kept, four scopes in every channel | Built | `L/lti/registration.ts:19-25`; `C/*/manifest.ts`; `C/canvas/app/configuration.ts:24` | LA-IC-04. |
| D4 Blackboard "membership service off" | Deviation | `C/blackboard/manifest.ts:60`; `C/blackboard/app.ts:22` | Kept "on" in LA: needs an LA-IC (frozen row 8) and BLACKBOARD-LIVE. LG. |
| D5 ungraded placements | Not built | LA-E3-08, LA-E3-14, LA-E4-08 (LA-H22) | Only the capability exists. |
| D6 Canvas DR: trait, flow, staged platform, manifest | Built (BD-A2-89, -93..95) | `L/lti/registration.ts:151-193`; `L/http/routes/registration.ts:200-204,371-412`; `C/canvas/manifest.ts:20-25` | LA-IC-14. The registration-endpoint origin rule is now in the D6 text. |
| D6 Portal row | Built (BD-A2-90, -106) | `C/canvas/portal/CanvasCreate.tsx:15-74`; `canvas-steps.json:33` | — |
| D6 hosted token endpoints (`tokenEndpoints`) | Not built | D6 "Dependency" row | Waits for the CANVAS-HOSTED live row. |
| D7 claim policy: stored value | Built (BD-A2-26) | `L/accounts/validation.ts:5-8`; `L/store/accounts.ts:31` | Stored, but no launch reads it. |
| D7 claim policy: effect at launch | Not built | LA-E3-10 (LA-H4); LA-IC-08 | Only the profile floor applies (`L/lti/launch.ts:184`). |
| D7 privacy floor, fail closed | Built (BD-A2-21) | `L/profiles/schema.ts:116`; `L/lti/launch.ts:184` | — |
| D8 new-window hint, D9 AGS extras, D10 small gaps | Built (BD-A2-73) | `A/tool-pages/picker.ts:80,124`; `L/platform/ags.ts:95-157`; `L/platform/nrps.ts:35-37`; `L/lti/checks.ts:124-130` | LA-IC-13. |
| **LA-ADR-06: service operability** | | | |
| D1 rate limits: algorithm, order, `auth_failure`, 429, `Retry-After`, soft classes | Built (BD-A2-16..19, -30) | `L/http/rate-limit.ts:14-90,167-184`; `L/http/app.ts:103-178`; `L/http/retry-after.ts:4-11` | — |
| D1 default table | Built (BD-A2-108) | `L/http/rate-limit.ts:14-35` | `admin` 1,200/600. |
| D1 settings precedence, per-account `limits` | Deviation | `L/http/rate-limit.ts:144-160`; `L/accounts/validation.ts:9` | Only 4 classes take effect per account; the others are stored and ignored. |
| D1 trusted proxy refresh | Deviation | `L/http/rate-limit.ts:257` | Retries after 5 s when a lookup fails (A-LA-E5-03-01). |
| D1 registration session cap | Built (BD-A2-20, -72) | `L/http/routes/registration.ts:197-239`; `L/store/registrations.ts:44-58` | — |
| D2 account status, `409 ACCOUNT_CLOSED`, `auto_rotate` | Built (BD-A2-12, -65) | `L/lti/account-status.ts:14-18`; `L/http/auth.ts:82-89`; `L/store/accounts.ts:91-110` | — |
| D2 purge job and tombstone | Built (BD-A2-66, -67) | `L/store/job-account-purge.ts:40-62` | — |
| D2 purge audit key | Deviation | `L/store/job-account-purge.ts:54`; `L/jobs/account-purge.test.ts:66` | Built as `details.deleted`. Docs aligned. |
| D3 operator listener, `OPERATOR-AUTH-V1`, operator keys, seed, CLIs | Built (BD-A2-02, -04, -34) | `L/config.ts:39-68`; `L/http/operator/index.ts:100-152`; `L/store/operator-keys.ts:10-124`; `L/cli/*` | — |
| D4 audit: append-only, one event per request, T0–T5, job-end rows | Built (BD-A2-01, -29, -42, -60) | `L/store/audit.ts:76-175`; `S/migrations.ts:26-134`; migrations `007`, `008` | No raw transaction in product code. |
| D4 operator read | Built | `L/http/operator/audit.ts:10-55` | With the `traceId` filter. |
| D4 tenant read `GET /api/audit` | Not built | no route | No task had it in scope (my gap). |
| D4 rule 4: app audit table | Built (BD-A2-45) | `A/domain/migrations/015_audit_event.sql` | — |
| D4 rule 4: app audit retention | Not built | no app job | No LA risk (a row cannot reach 400 days). Follow-up. |
| D5 API keys: scopes, two active, expiry, revoke, `revokeOthers`, `last_used_at` | Built (BD-A2-09, -10, -33) | `L/http/auth.ts:88-92`; `L/store/api-keys.ts:54-125`; `L/http/operator/api-keys.ts:27-57` | — |
| D6 key provider: envelopes, AAD, ring, readiness, re-wrap | Built (BD-A2-36..43, -50, -77, -80) | `S/key-provider.ts:84-246`; `L/keys/key-config.ts:53-70`; `L/store/key-rewrap.ts:52-163` | — |
| D6 app "Scope in LA" | Built (BD-A2-88, -91, -97) | `A/app/sealing.ts:20-136`; `A/cli/keys.ts:40-76` | — |
| D7 signing keys: states, first key, JWKS, lead time, transitions, rotation and cleanup jobs | Built (BD-A2-05..07, -12, -13, -23, -24, -65, -68) | `L/store/tool-keys.ts:24-205`; `L/http/operator/signing-keys.ts:13-75`; `L/store/job-signing-key-rotation.ts:17-105` | — |
| D7 CLI rotation | Deviation | `L/cli/bootstrap.ts:49-59` | Three operator calls, not one transaction. Safe on re-run. |
| D8 service-key revoke, epoch, write scope | Built (BD-A2-47, -76) | `L/http/routes/service-key-admin.ts:13-43`; `L/store/service-keys.ts:40-123`; `L/http/auth.ts:107-146` | — |
| D9 `Idempotency-Key` | Built (BD-A2-51, -56..58, -71, -75, -83) | `L/http/idempotency.ts:26-133`; `L/store/idempotency.ts:6-80` | — |
| D10 log tenant ids, path template | Built (BD-A2-61, -108) | `L/http/app.ts:89-97`; `L/http/routes/protocol.ts:29-53` | — |
| D10 `api_auth_failed` tenant id | Deviation | `L/http/operator/index.ts:146` | Not built: authentication runs before the account is resolved. |
| D10 metrics and readiness | Built (BD-A2-52, -54, -60, -88) | `L/http/metrics.ts:24-309`; `A/app/metrics.ts:67-221` | — |
| D10 metric `lti_signing_key_age_seconds` | Deviation | `L/store/observability.ts:21` | Counts from `created_at`. Follow-up (alert rules are LG). |
| D11 runner, E5 jobs, on-demand runs | Built (BD-A2-32, -50, -69, -70, -82, -107) | `S/jobs.ts:24-518`; `L/jobs/index.ts:24-43`; `L/http/operator/jobs.ts:10-36` | — |
| D11 stop order | Built (BD-A2-31, -109) | `L/main.ts:37-48,99-127`; `A/main.ts:89`; `A/kernel/records/shutdown.ts:5-46` | QA reran the M1-37 rows on the fix: PASS. |
| D12 production refusals, secret files | Built (BD-A2-77..80, -91) | `L/config.ts:33-62`; `S/config.ts:71-107`; `A/config.ts:61` | Messages match operability §2. |
| D12 bad numeric settings | Deviation | `L/store/tool-keys.ts:125`; `L/main.ts:137` | Exit 1 with a stack trace, not a `config_refused` line. |
| D12 `production` on the compose stack | Not built | BD-A2-105; `deferred.md` "LA-E5-22 note (K)" | LG host setup. |
| D13 additive migrations, F5 lint, async `LtiStore` port | Built (BD-A2-13, -96) | `L/db/migrations/009–021`; `infra/scripts/fitness/rules/sql-portability.mjs:18-41`; `L/store/port.ts:24-86` | Two dead LTI `X''` baseline entries: follow-up. |
| **LA-ADR-07 and security delta: security and tenancy** | | | |
| D1 tenant layers, `ChannelSql`, import fence | Built | `A/kernel/port-context.ts:35-101`; `S/channel.ts:1-8`; `eslint.config.js:130-233` | LA-E5-13 QA PASS. |
| D2 A1–A6, I-SELF | Built (BD-A2-84, -93, -95) | `L/lti/platform-rules.ts:54-119`; `L/http/routes/platforms.ts:123-134`; `packages/channel-kernel/src/registry.ts:198-207` | — |
| D2 A5: fixed hosts for `standard` admin creates | Deviation | `L/http/routes/platforms.ts:127-131` | Reserved issuers are refused, but endpoint hosts are not compared. Safe; wording narrowed. |
| T1 read-only root file system | Not built | — | LG. T1 text fixed. |
| T18 privacy floor freeze | Built | `L/profiles/schema.ts:28,116-117` | — |
| D3 connection secrets port | Not built (by design) | — | Shape only (LB/LF). |
| D4 operator CLI policy and refusal table | Built (BD-A2-45, -59, -62, -64) | `A/app/operator-policy.ts:26-89`; `A/cli/grant.ts:20-44`; `A/cli/audit.ts:11-65` | — |
| D5 evidence; revoke without evidence | Built (BD-A2-63) | `A/app/operator-policy.ts:3-88`; `A/app/operator.ts:130-288` | Evidence flags on revoke are ignored. Text fixed. |
| Security delta §5 page headers, §6 CSRF | Built (BD-A2-87, -103, -104) | `L/lti/storage-pages.ts:54-147`; `A/tool-pages/picker.ts:87-262`; `L/http/operator/index.ts:102` | The admin code page and `/verify` are not built (LA-E6-03). |
| Security delta §8 isolation, §10 secrets and `e2e` tmpfs | Built (BD-A2-91) | `infra/compose.yaml:472-479`; `infra/scripts/compose-e2e-secrets.test.mjs:39-53` | — |
| **LA-ADR-08: onboarding and connection health** | | | |
| D1, D2 grant default, per-channel table | Built | `C/*/manifest.ts` | The verified-admin rows are not built (LA-H24). |
| D3 verified admin launch | Not built | LA-E6-03, LA-E6-07 (LA-H24) | — |
| D4 connection check | Built (BD-A2-98, -99) | `L/http/routes/platform-check.ts:38-143`; `A/app/connection-check.ts:43-78` | — |
| D5 health view, stale-key panel | Built (BD-A2-100..102) | `A/app/connection-health.ts:42-105`; `C/canvas/portal/CanvasKeyJson.tsx:10-47` | — |
| D5 refusal and disconnect rows | Not built | LA-E6-06 (deferred) | `lastLaunchRefusal` stays `null`; AP-08-08 is not met. |
| D6 verify step from the authority | Built | `apps/portal/src/channels/verification.tsx:6-14` | — |
| **Contract delta** | | | |
| §1.3 codes, §1.4 classes, §1.5 status, §1.6 headers | Built | `L/api-errors.ts:50-59`; `L/http/key-errors.ts:5-13`; `L/lti/codes.ts:46-53` | Table now also lists `OPERATOR_KEY_IN_USE` and the `PLATFORM_URL_NOT_IN_PROFILE` page. |
| §1.3 `NOT_READY` | Deviation | `L/http/operator/jobs.ts:25`; `L/http/operator/key-provider.ts:14`; `L/http/metrics.ts:307` | Re-wrap and jobs routes only. Row fixed. |
| §2 protocol, §3 operator routes (23 of 23), §4.1–§4.7, §4.9, §5, §7 | Built | `L/http/operator/index.ts:82-115`; `L/http/routes/*.ts` | — |
| §4.8 tenant reads | Not built | no route | Rows marked "not built in LA". |
| §6 log events | Built | per-row `file:line` in the check notes | Seven LA events added to the table; `job_run` is `warn` for a failed run. |
| **Operability** | | | |
| §2 settings, secret files, compose note | Built (BD-A2-105) | `L/config.ts`; `A/config.ts`; `infra/compose.yaml:126-219` | `AUDIT_RETENTION_DAYS` is LTI only; the `TRUSTED_PROXY_CIDRS` default is empty (compose sets `proxy`). |
| §4.2 metric names (20 of 20), §4.4 readiness, §5 alert series | Built | `L/http/metrics.ts:43-293` | `SharedPlatformQuota`, `BackupMissing` and `CertificateExpiry` use logs or outside tools. |
| §6–§8a routes and CLIs | Built | `L/http/operator/*.ts`; `L/cli/*`; `A/package.json` | Three stale "until …" notes removed. |

## 2. Product changes

**Required for LA: none.**

Recommended follow-ups (for `deferred.md`; LG unless the Lead wants them sooner):

1. **S1**, `services/lti-service/src/store/observability.ts:21`: make `lti_signing_key_age_seconds` count from `activated_at` for active keys and from `published_at` for next keys. Add a unit test with a key that waited its publish lead.
2. **R / A1:** add an app `audit-retention` job with `AUDIT_RETENTION_DAYS`, and a unit test like AP-06-32.
3. **Fitness owner**, `infra/scripts/fitness/rules/sql-portability.mjs:35-41`: delete the two dead LTI `X''` baseline entries.
4. **S1**, `services/lti-service/src/accounts/validation.ts:9`: refuse non-account classes in per-account `limits`, or document them as ignored in the API answer.
5. **S1 / S2:** give bad numeric start settings a `config_refused` line, as in D12.
6. **Blackboard, A1 + Docs:** "membership service off" in the portal step, tool row 8 and the guide. This needs an LA-IC and a BLACKBOARD-LIVE check.
7. **Optional hardening, S1:** compare the endpoint hosts of a `standard` admin create with the fixed hosts.

## 3. Doc drift fixed, and the Docs draft

**Fixed in my files (BD-A2-111):**

- **LA-ADR-05:** D1 rule 8 order; D4 Blackboard row; the D6 configuration URL and registration endpoint rules.
- **LA-ADR-06:**
  - D1 proxy refresh and per-account `limits`;
  - D2 purge key `details.deleted`;
  - D4 tenant read not built;
  - D7 CLI rotation and the start-refusal wording;
  - D10 `api_auth_failed`;
  - D13 "five uses";
  - AP-06-10 `account.status`.
- **LA-ADR-07:** T1, T15, A5, the D2 `brightspace` wording, the D5 revoke sentence, AP-07-02.
- **LA-ADR-08:** the D5 refusal-row deferral; §6 migration `016`.
- **Contract delta:**
  - §1.1;
  - §1.3: `NOT_READY`, `OPERATOR_KEY_IN_USE`, the `PLATFORM_URL_NOT_IN_PROFILE` page;
  - §2.2 storage-check CSP;
  - §2.6: `invalid_token_response`, the 429 details, `token_result`;
  - §4.8;
  - §5 purge key;
  - §6: seven events and the `job_run` level;
  - §8: D27 wording, D31, new D36.
- **Operability:**
  - §2: `TRUSTED_PROXY_CIDRS`, `SIGNING_KEY_PUBLISH_LEAD_S`, `AUDIT_RETENTION_DAYS`, the compose note;
  - §4.2: JWKS series built, the age gauge note;
  - §6.1 step 7; §6.3 step 6; §8a purge key.
- **Security delta:** §2.4 reserved-host scope and the `brightspace` wording.
- **LA-E5-20:** notes.
- **Base contract `docs/architecture/contracts/lti-service-api.md` §8:**
  - rows D22–D36 copied from the delta;
  - new §8.1 with the deliberate 1EdTech deviations (S-11, S-10, C-06, DR-03, NR-09, S-08).
  - This is the copy that LA-E8-05 expects.

**Corrections for the Docs draft `docs/guides/ltiaas/spec-deviations.md` (Docs lane):**

- **§1:**
  - Use the R1 id `S-08` for the row "LA-AUD", as base §8.1 does.
  - DR-03 can add that a Canvas DR is always staged.
- **§2 D25:** the operator listener is loopback, except in the `acceptance` QA profile, which binds the stack network.
- **§2 D27:** "`active`, then `next`, then `retired`" reads as an order. Say "the key set holds `next`, `active` and `retired` keys (lifecycle `next` → `active` → `retired` → `removed`)".
- **§2 D35:** the fixed-host refusal applies to the `any-https` profiles and Dynamic Registration, not to a `standard` admin create (BD-A2-111).
- **§2:** add row D36, platform `trustedAudiences`.
- **§2 D31:** correct as written. My delta was the stale side and is now fixed.
- **Header:** the copy into base §8 is done, so the draft can drop "the Architect copies …" once its pending gate rows close.

## Round 2 (final SHA 4f10c5fd)

**Verdict: APPROVE.** Docs only, no Docker.

- **What changed:** `4f10c5fd` merges the Blackboard and Canvas final result (main `78971b03`; LA-H27 (a)) into LA. Its first parent is `86bdc24c`, so `git diff 4f10c5fd^1 4f10c5fd` is exactly what the merge added.
- **What I checked:** that diff, in my lens: operability, security, storage and the LTI service contract.
- **What I did not check:** the player tracker change (`apps/player/src/html/tracker.ts`). It is outside my lens (A1, ADR-004).

| Check | Result | Evidence | Note |
| --- | --- | --- | --- |
| 1. ADR-012 after the merge: §17 "G-1 result 2" intact | Pass | `docs/architecture/adr/ADR-012-sqlite-volume-storage.md:821-845` | My BD-A2-113 text is byte-equal to the text before the merge. The B/C hunks are elsewhere: the Status line (`:3`), one history line, and the dated clarification `:871`. |
| 1. B/C Status line vs §17 | Fixed (doc) | `ADR-012…md:3` | The B/C line (written 2026-10-23) said the lock-orphan guarantee holds "only" for Docker CLI 29.9.1 / Compose 5.6.0. That contradicted G-1 result 2. I added the second measured set (29.9.2 / 5.6.1, BD-A2-113) to its "Limits". No other word changed. |
| 1. G-1 and identity rules for the re-gate | Pass, with one condition | `ADR-012…md:841-845`; `tests/host/storage-docker.mjs:173-177` | The in-tree `BOUND_IDENTITY` is still 29.9.1 / 5.6.0. The move to 29.9.2 / 5.6.1 is a reviewed test change (BD-A1-120; LD-9 addendum r6/r8) applied in the QA clone. Condition: the re-gate's run boundary must use the addendum value. If it does not, `compareIdentity` blocks the run (fail closed); it can never pass wrongly. |
| 1. ADR-012 dated clarification (QA kill mode) vs the storage rules | Pass | `ADR-012…md:871-878` | The kill happens before the unchanged guarded `stack:restart`, which takes the lock and runs the preflight. It creates no container and changes no mount. The compat-marker refusal still applies. Same class as the existing harness row "compose stop and start". |
| 2. `tests/host/m1-control.mjs` kill mode | Pass | `tests/host/m1-control.mjs:31-54`; selftest `tests/host/m1-control.selftest.mjs:284-338` | The marker refusal (`:31`) runs before the new branch (`:34`). Only `mode: 'kill'` for `cogniate-app` is accepted (`:35`); anything else is "Unknown M1 host action". The guarded restart runs only after a `0` exit of the kill (`:39-45`). No storage, identity (G1-IDENTITY) or lock check is removed or weakened. |
| 2. `docs/architecture/tasks/M1.md` AC-M1-37 clarification | Pass; one doc note | `docs/architecture/tasks/M1.md:327-335` | No case id, assertion, deadline or row count changes (the frozen M1 tests change only the `host('m1-restart', …)` argument). The M1 ledger rule LD-24 is not touched: B/C does not change `tests/host/m1-migration.mjs`. Note: the "why" text (`:332`) gives the B/C product stop ("up to 2 s"). In LA, `cogniate-app` does not use `closeOnSignal` (`services/cogniate-app/src/main.ts:81` `handleSignals: false`). It stops by BD-A2-109: in-flight HTTP is cut at 3 s (`services/cogniate-app/src/kernel/records/shutdown.ts:8`), and the process lives on only while a job runs. SIGKILL is the right QA mode for LA too, even more so, so the rule stands. |
| 2. App contract §4.7.1 clarification | Doc note for A1 | `docs/architecture/contracts/cogniate-app-api.md:942-949` | The same "at most 2 s (`closeOnSignal`, `packages/shared/src/http.ts:48`)" sentence is true for the B/C product, but not for the LA app (BD-A2-109). A1 owns this contract; the outcome rule (QA uses SIGKILL) does not change. |
| 2. Effect on LA checks | Recorded (operability §3) | `docs/architecture/ltiaas/operability.md` (stop timing) | The M1-37 rows no longer exercise the LA graceful stop. BD-A2-109 stays proven by `services/lti-service/src/main.test.ts:228`, `:246` and `services/cogniate-app/src/kernel/records/shutdown.test.ts`, and by AC-LA-E5-19-08. |
| 3. LTI service and its contracts | Pass: untouched | `git diff 4f10c5fd^1 4f10c5fd -- services packages docs/architecture/contracts/lti-service-api.md docs/architecture/ltiaas` is empty | The only product change is the player (`apps/player/src/html/tracker.ts`). `infra/README.md` changes only operator command examples and the `operation_lock_invalid` row (stop and escalate). That matches the ADR-012 Status limits. |

Fixes in my lens (no new design fact, so no BD row):

- ADR-012 Status "Limits": the second measured identity set added.
- Operability §3 stop timing: the unit-test evidence of BD-A2-109 and the M1-37 kill-mode note.

For other owners:

- A1: the app contract §4.7.1 sentence about a 2 s stop is not true for LA's app.
- QA: the re-gate's identity boundary must use the addendum value 29.9.2 / 5.6.1.

