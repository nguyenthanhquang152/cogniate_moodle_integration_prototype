# Cogniate app API: LA delta

Status: v1 (A1, milestone LA P2, 2026-10-22). Base: [`../../contracts/cogniate-app-api.md`](../../contracts/cogniate-app-api.md) (M1 state). Design: [LA-ADR-01](../adr/LA-ADR-01-channel-kernel.md) (kernel), [LA-ADR-02](../adr/LA-ADR-02-generic-lti-channel.md) (new channels), [LA-ADR-03](../adr/LA-ADR-03-learning-record-core.md) (records), [LA-ADR-04](../adr/LA-ADR-04-refactor-and-migration.md) (compatibility). A2's app-side items (picker cancel, launch without context) come from [LA-ADR-05](../adr/LA-ADR-05-lti-advantage-completeness.md); the LTI service changes are in [lti-service-api-delta](lti-service-api-delta.md).

## 0. Rules

1. **Additive only.** No path, request field, response field, error code or log event of the base contract is removed or renamed. A request without the new fields behaves as in the base contract.
2. **Frozen names** stay byte for byte ([LA-ADR-04 D2](../adr/LA-ADR-04-refactor-and-migration.md#decision)), also when they name an LMS.
3. **Open channel set.** Wherever the base contract lists `moodle`, `canvas`, `blackboard` as the only values of `lms`, the value set is now "every channel id of the registry". After E2 the registry has `moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`.
4. **Texts.** Every text that names an LMS uses the manifest text name (`{LMS}`). Moodle texts stay byte for byte.

## 1. Connection DTO (base §4, §4.2)

New fields on every connection answer:

| Field | Type | Rule |
| --- | --- | --- |
| `channel` | string | the channel id (`connection.channel`) |
| `channelName` | string | the manifest text name, for example `Moodle`, `your LMS` |
| `channelCapabilities` | object | the capability set of the connection: keys are capability ids ([LA-ADR-01 D3](../adr/LA-ADR-01-channel-kernel.md#d3-capability-model)), values are booleans, strings, lists or the method → authority map |
| `bindingAuthority` | string | the stored `connection.binding_authority`: `self`, `operatorGrant` or `verifiedAdminLaunch`. The portal verify step reads it ([LA-ADR-01 D9](../adr/LA-ADR-01-channel-kernel.md#decision)); a staged Dynamic Registration shows `operatorGrant` although the method map says `self` (BD-A1-24) |

Changed meaning (values unchanged for the baseline channels):

| Field | Rule after LA |
| --- | --- |
| `lms` | equals `channel` (an open set). It is never the stored behaviour class. |
| `capabilities` | the six legacy flags, computed by the legacy projection ([LA-ADR-01 D3](../adr/LA-ADR-01-channel-kernel.md#d3-capability-model)). Same objects as M1 for the baseline channels. |
| `profile` | default per channel from the manifest method (`lti-generic` → `lti-generic`, `brightspace` → `brightspace`) |

Example (`lti-generic`, registered by an operator grant):

```json
{
  "id": "con_...", "name": "School Sakai", "siteUrl": "https://lms.school.edu", "method": "manual", "status": "registered",
  "lms": "lti-generic", "channel": "lti-generic", "channelName": "your LMS", "bindingAuthority": "operatorGrant", "profile": "lti-generic", "serviceUrl": "https://lms.school.edu",
  "capabilities": { "dynamicRegistration": true, "operatorApproval": true, "webServices": false, "courseShell": false, "addDeployment": true, "canvasConfiguration": false },
  "channelCapabilities": {
    "registration.dynamic": true, "binding.authority": { "dynamic": "self", "manual": "operatorGrant" },
    "deployments.multiple": true, "launch.windowHint": true, "records.reporters": ["lti-ags"], "records.readBack": true,
    "registration.scopes": ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem", "…"]
  },
  "platform": { "id": "plt_...", "issuer": "https://lms.school.edu/sakai", "clientId": "…", "deploymentIds": ["…"], "productFamilyCode": "sakai", "siteUrl": "https://lms.school.edu", "serviceUrl": "https://lms.school.edu" },
  "registrationUrl": null, "registrationUrlExpiresAt": null, "createdAt": "...", "lastLaunchAt": null, "lastError": null, "webServices": null
}
```

## 2. `GET /app-api/lms-providers` (base §4.3)

- One entry per channel of the registry, in registry order ([LA-ADR-01 D4](../adr/LA-ADR-01-channel-kernel.md#decision)). The three baseline entries keep every field and value.
- A `simulation-only` channel is listed only when the LTI service reports simulations on.
- New fields per entry: `channel` (= `lms`), `channelName`, `family` (`lti13`), `channelCapabilities` (channel level), `registration`: `[{ method, authority, profiles }]`.
- A profile row of `GET /api/providers` whose `channel` is not in the app registry is ignored (log `channel_profile_unknown {profile}`, once per process). One unknown profile never breaks the answer (today it does: `services/cogniate-app/src/clients/lti-client.ts:55`, R3 S32).

## 3. Connections (base §4, §4.2, §4.4, §4.7.2)

### 3.1 `POST /app-api/connections`

| Rule | Error |
| --- | --- |
| `lms` (or its new alias `channel`) is a channel id of the registry. If both are sent, they must be equal. | `400 INVALID_REQUEST`, `details.field = "lms"` (or `"channel"`) |
| `method` is a method of the channel manifest | `dynamic` without `registration.dynamic`: `422 CAPABILITY_NOT_SUPPORTED`, `details.capability = "dynamicRegistration"` (frozen value) |
| `profile` is a profile of that method | `400 INVALID_REQUEST`, `details.field = "profile"` |
| Admin-value channels other than Moodle (`lti-generic`, `brightspace`): `siteUrl` passes site rules 1–4 | `422 INVALID_SITE_URL`, `details.rule`, `details.field` |
| Moodle | unchanged (base §4) |
| Canvas, Blackboard | unchanged (base §4.2) |

The insert writes `channel`, `binding_authority` (from the method) and the frozen `lms` value ([data model §2](../data-model.md#2-cogniate-app-migration-013-e1-channel-kernel)).

### 3.2 `POST /app-api/connections/:id/registration-url`

Allowed for a `pending` connection with `method: dynamic` of any channel with `registration.dynamic` (base: Moodle only). Other cases: `409 CONNECTION_NOT_PENDING` (unchanged code).

### 3.3 `GET /app-api/connections/:id/tool-configuration`

The rows come from the channel adapter. Moodle, Canvas and Blackboard rows are unchanged (base §4.1, §4.5), except A2's intended D-8 change of Moodle row 13 ([LA-ADR-05 D4](../adr/LA-ADR-05-lti-advantage-completeness.md)).

New channels (`key` stable; `label` is human text):

| Channel | Rows (in order) |
| --- | --- |
| `lti-generic` | `tool_name`, `login_url` (`{PUBLIC_LTI_URL}/lti/login/cogniate`), `redirect_uri` and `target_link_uri` (`{PUBLIC_LTI_URL}/lti/launch/cogniate`), `jwks_url` (`{PUBLIC_LTI_URL}/lti/keys/cogniate`), `deep_linking_url` (same as the redirect URI), `scopes` (the channel scope set), `privacy` ("Do not send the learner's name or e-mail.") |
| `brightspace` | `tool_name`, `domain` (host of `PUBLIC_LTI_URL`), `redirect_urls`, `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions` ("Assignment and Grade Services, Deep Linking"), `roles` ("Send institution role"), `privacy` ("Do not send name or e-mail."). The labels follow the D2L "Register Tool" form; they are UNVERIFIED until a live check (R2-2, LA-H3). |

### 3.4 `PUT /app-api/connections/:id/platform`

| Channel | Strict body | LTI step |
| --- | --- | --- |
| Moodle, Canvas, Blackboard | unchanged (base §4, §4.4), except: Moodle now refuses an unknown body key with `422 INVALID_PLATFORM_VALUES` and the key in `details.fields`, as Canvas and Blackboard do (LA-IC-17) | unchanged |
| `lti-generic`, `brightspace` (manual, `operatorGrant`) | `{ issuer, clientId, deploymentId, authenticationEndpoint, accessTokenEndpoint, jwksUrl, tokenAudience?, grantCode }`. `issuer` may have a path; its origin must equal `siteUrl`. | the two-phase redemption (base §4.7.1); S1 `POST /api/platforms { profile, url: issuer, clientId, name, authenticationEndpoint, accesstokenEndpoint, authConfig: { method: "JWK_SET", key: jwksUrl }, clientAssertionAud: tokenAudience, deploymentIds: [deploymentId], active: false, bindingRef }` |
| `lti-generic`, `brightspace` after a **staged** Dynamic Registration (the configuration broke I-SELF, [LA-ADR-02 D5](../adr/LA-ADR-02-generic-lti-channel.md#decision) item 10) | `{ clientId, deploymentId, grantCode }`; the portal pre-fills both ids from the staged platform. The admin values come from the staged platform and must equal the grant's bound values. | the two-phase redemption adopts the staged inactive platform (adoption rule A3) and activates it; no S1 create |

New and changed answers:

| Case | Answer |
| --- | --- |
| A bound value differs from the grant (`bound_values`) | `422 GRANT_MISMATCH` (base check 5, extended); `details.fields` names each differing field, so the portal can show it (Reviewer-B B-LAD-15) |
| The LTI service answers `PLATFORM_URL_NOT_IN_PROFILE` or `INVALID_SITE_URL` | `422 INVALID_PLATFORM_VALUES` with the field name, or `422 INVALID_SITE_URL` |
| A finalized repeat (same `clientId`, `deploymentId` and bound values) | `200`, nothing changes (base rule) |

### 3.5 `POST /app-api/connections/:id/deployments`

Guard: capability `deployments.multiple` (Canvas, `lti-generic`, `brightspace`), else `409 CAPABILITY_NOT_SUPPORTED`, `details.capability = "addDeployment"` (frozen value). The rules of base §4.7.2 apply to every channel with the capability.

### 3.6 Extension routes

| Path | Channel | Guard |
| --- | --- | --- |
| `GET …/canvas-configuration` (frozen) | canvas | `setup.artifacts` contains `developer-key-json`; else `409 CAPABILITY_NOT_SUPPORTED`, `canvasConfiguration` |
| `PUT …/web-services` (frozen) | moodle | `siteApi.token`; else `409 CAPABILITY_NOT_SUPPORTED`, `webServices` |
| `POST /app-api/publications` with `createMoodleCourse` (frozen) | moodle | `publish.createCourse`; else `409 CAPABILITY_NOT_SUPPORTED`, `courseShell` |
| `…/mbz`, `…/download?kind=mbz` (frozen) | moodle | `export.packages` contains `mbz` (course-version feature, unchanged) |
| `/app-api/connections/:id/x/:extensionId` (reserved pattern) | a new channel | the capability that the channel declares for the route; no LA channel uses it |

### 3.7 Connection health and self-serve verification (E6, Could)

Design and full rules: A2 [LA-ADR-08](../adr/LA-ADR-08-onboarding-and-connection-health.md). Built only if E6 is in scope.

| Method and path | Request | Success / errors |
| --- | --- | --- |
| `POST /app-api/connections/:id/check` | — | `200 { result, checkedAt, details }` after a token probe and a JWKS fetch through the LTI service (`POST /api/platforms/:id/check`, [lti-service-api-delta](lti-service-api-delta.md)); guard: `setup.connectionCheck` |
| `GET /app-api/connections/:id/health` | — | `200` health view: last launch, last launch refusal, dispatch state, last errors, key state (`keys.artifactKeyKid`, `artifactKeyCurrent`) |
| `POST /app-api/connections/:id/verify` | `{ code }` | the verified admin launch redemption (authority `verifiedAdminLaunch`); same phase 1 and phase 2 rules as a grant; errors as A2 lists |

## 4. Portal routes (base §4.2)

The app serves the portal for `/integrations/:channelId/connect` and `/integrations/:channelId/:connectionId` when `channelId` is in the registry. The three baseline route pairs are the same URLs. An unknown channel id keeps today's behaviour for unknown paths. A route whose channel is not the connection's channel shows the portal "not found" view (base rule).

## 5. Tool pages (base §6, §6.1)

| Topic | Rule after LA |
| --- | --- |
| Launch routing | by the stored `binding_authority` ([LA-ADR-01 D7](../adr/LA-ADR-01-channel-kernel.md#decision)); log reasons unchanged (`deployment_not_approved`, `unknown_platform`) |
| LMS check | the profile's channel must equal the connection's channel; a signed family guarded at the `launch` level must belong to the connection's channel (Canvas and Blackboard, as M1); a `registration`-level guard refuses a launch only on a platform of a `MANUAL_SELF_LEGACY_CHANNELS` channel (Moodle `standard`; A-LAD-19), else it only logs `family_guard_mismatch` ([LA-ADR-01 D6](../adr/LA-ADR-01-channel-kernel.md#decision)); log reason `lms_mismatch` (frozen) with `connection_lms` (the channel id) and `family` |
| Content item `window` | when `launch.windowHint` is true and the platform accepts `window` (base: every non-Moodle LMS) |
| Embedded page script | when `launch.topLevelContinue` is true (base: Canvas) |
| `/tool/register` | for every channel with `registration.dynamic`; if the configuration family is guarded by another channel (any level): page `PROVIDER_PROFILE_MISMATCH` ("This is a {LMS} site. Connect it as {LMS} in the Cogniate portal."); `complete` sends the connection's `lti_profile` and the channel scope set. If `complete` stages the platform (I-SELF broken), the page says "Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code." and the connection stays `pending` with authority `operatorGrant` |
| Launch without context | A2 [LA-ADR-05 D2](../adr/LA-ADR-05-lti-advantage-completeness.md): allowed; placement key with context id `""` |
| Picker cancel, multi-select | A2 [LA-ADR-05 D3](../adr/LA-ADR-05-lti-advantage-completeness.md): `POST /tool/picker/{pickerId}/cancel`; checkboxes only with `content.multiple` |
| Texts | `{LMS}` from the manifest; the generic channel reads "your LMS" (for example "Open the activity again in your LMS.") |

### 5a. App-edge limit for the handoff pages (Should; Reviewer-A A-LAD-22)

A2's abuse control for random ltiks ([LA-ADR-06 D1](../adr/LA-ADR-06-service-operability.md), alert `LtikFailureSpike` in [operability](../operability.md)) needs a limit in the app:

| Item | Rule |
| --- | --- |
| Routes | `GET /tool/launch`, `GET /tool/deep-link` |
| Key | the client address that the proxy forwards (only the proxy is trusted; IPv6 counts as its /64, as A2's classes) |
| Limit | a token bucket per address with the values of the LTI service `protocol` class: 600 per minute, burst 200 ([LA-ADR-06 D1](../adr/LA-ADR-06-service-operability.md): a school behind one NAT address starts a class of several hundred learners in one minute; Reviewer-A A-LAD-25). Setting `APP_RATE_LIMITS`, read at start; the `acceptance` compose may raise it |
| Order | checked first: before the `handoff` row is written and before any LTI service call |
| Answer | `429` error page `RATE_LIMITED` ("Too many launches from your network. Wait one minute, then open the activity again in {LMS}.") with `Retry-After`; log `rate_limited {class: "tool_handoff", retry_after_s}` at most once per minute per address |
| Test | Author unit test of the bucket. Acceptance points: (1) 300 valid launches from one address, sent at an even rate within one minute, all pass (no `429`); (2) 400 random ltiks from one address within 10 s give `429` after the bucket is empty (at most 300 pass), and a valid launch from the same address after `Retry-After` works (QA has one client address, TEST-STRATEGY §9.2 item 14). QA records the `/tool/launch` peak rate of the frozen suites at E0 (TEST-STRATEGY §9.2 item 14) |

The 60 s cache of `GET /api/providers` that LA-ADR-06 D1 names is **Could**, not built in LA: the `admin` limit of 600 per minute already covers the provider list, and a cache could show a stale `ready` value to the frozen M1 and M2 checks right after an operator changes the shared platform. A2 changes its sentence (README §8 OC-12).

## 6. Publications, results and records (base §5, §10)

- JSON shapes do not change. `resourceLinkId` is the placement id (same value). `scoreSyncs`, `lastScoreSync`, Resend and the play status read `record_dispatch` rows of reporter `lti-ags` ([LA-ADR-03 D4](../adr/LA-ADR-03-learning-record-core.md#decision)).
- `POST /app-api/publications/:id/results/refresh` needs `records.readBack`; else `409 CAPABILITY_NOT_SUPPORTED`, `details.capability = "records.readBack"` (new value; no LA channel hits it).
- A score `409` gives `lastError` "… ({LMS} has a grade with a newer time)"; the Moodle text is unchanged.
- A2 adds "Not graded in {LMS}" rows for ungraded placements ([LA-ADR-05 D5](../adr/LA-ADR-05-lti-advantage-completeness.md), Should).

## 7. Operator CLI (base §4.8, §4.9)

| Command | Change |
| --- | --- |
| `app:grant issue` | Allowed for every connection whose authority is `operatorGrant` (base: `canvas`, `blackboard`). `--purpose add_deployment` needs `deployments.multiple`. New flags for admin-value profiles: `--issuer`, `--auth-url`, `--token-url`, `--jwks-url`, `--token-audience` (required for `endpoints: admin` when no staged platform exists; refused otherwise). For a connection with a staged Dynamic Registration, `--accept-staged` takes the bound values from the staged platform; the CLI prints them first, and the operator checks them against the evidence instead of typing them ([LA-ADR-02 D6](../adr/LA-ADR-02-generic-lti-channel.md#decision)). A bound value whose host is not the issuer host is marked, and the issue then also needs `--confirm-foreign-hosts`; without it, exit 1 and nothing stored (Reviewer-A A-LAD-23). New flags `--operator <name>` (the audit actor), `--evidence-channel` (`institution-email`, `support-call`, `lms-admin-ticket`, `other`) and `--evidence-ref` (1–200 characters). With `STACK_PROFILE=production` in the CLI process all three are required (the operator name must be in `OPERATORS` or `OPERATORS_FILE`); else exit 1, nothing stored, no audit event. In the default and acceptance profiles they are optional, so the M1 commands do not change (A2 [LA-ADR-07 D4, D5](../adr/LA-ADR-07-security-and-tenancy.md)). |
| `app:grant revoke`, `list` | unchanged; `list` also prints the bound values |
| `app:binding suspend`, `release` | unchanged rules; the record kind comes from the stored `target_kind`; `--operator`, `--evidence-channel`, `--evidence-ref` with the same profile rule as `app:grant issue` |
| `app:audit list` (new, read-only) | `npm run app:audit -w services/cogniate-app -- list [--connection <id>] [--action <a>] [--since <ISO>] [--limit <n ≤ 500>]`: one JSON line per app audit event, newest first, never the note text; it writes no event (A2 LA-ADR-07 D4) |
| Every write command | one `audit_event` row, also for a refused run on a known grant or connection; `details` holds `evidence_channel`, `evidence_ref`, `note_present` ([data model §5](../data-model.md#5-cogniate-app-migration-015-e5-app-part-e6)) |

Refused-event codes (A2 BD-A2-64; A1 BD-A1-67; LA-E5-12). A write command that refuses after it has resolved its grant or connection writes one `audit_event` with `result: refused` and one of these stable `code` values. An unknown target, a usage error, an LTI outage or an operator-policy refusal writes no event. The printed CLI lines do not change. A new code needs a new row here.

| Code | Command | Cause |
| --- | --- | --- |
| `ttl_invalid` | `app:grant issue` | `--ttl-seconds` is not 60 to 604800 |
| `note_invalid` | `app:grant issue`; `app:binding suspend`, `release` | `--note` is empty or longer than 500 characters |
| `id_invalid` | `app:grant issue` | `--client-id` or `--deployment-id` is not 1 to 255 printable ASCII characters |
| `library_mismatch` | `app:grant issue` | `--library` is not the library of the connection |
| `authority_not_operator_grant` | `app:grant issue` | the connection's binding authority is not `operatorGrant` |
| `connection_not_pending` | `app:grant issue` | an `initial` grant for a connection that is not `pending` |
| `add_deployment_not_allowed` | `app:grant issue` | an `add_deployment` grant for a connection that is not registered or connected, or whose channel has no `deployments.multiple` |
| `site_mismatch` | `app:grant issue` | `--site` is not the site URL of the connection |
| `service_url_not_allowed` | `app:grant issue` | `--service-url` (other than the site URL) for a profile without a service URL |
| `service_url_mismatch` | `app:grant issue` | `--service-url` is not the service URL of the connection |
| `client_id_mismatch` | `app:grant issue` | `--client-id` is not the client id of the connection's platform (`add_deployment`) or of the shared platform |
| `snapshot_missing` | `app:grant issue` | the connection has no provider snapshot |
| `profile_changed` | `app:grant issue` | the connection's profile changed after the connection was made |
| `platform_inactive` | `app:grant issue` | the shared platform of a shared profile is missing or inactive |
| `platform_changed` | `app:grant issue` | the profile is no longer shared, or its shared platform changed |
| `deployment_fixed` | `app:grant issue` | the connection already holds a reservation for another deployment |
| `grant_redeemed` | `app:grant revoke` | the grant was already redeemed |
| `binding_active` | `app:binding release` | the connection is not disabled (run `suspend` first) |
| `redemption_running` | `app:binding release` | a redemption may still run (retry later) |

The app CLIs stay shell commands in LA; they do not become clients of an operator API (Reviewer-A A-LAD-17). Plan E5 Must 3 covers the LTI service CLIs only, and the self-asserted app operator name stays residual R-LA-2 (Lead decision, plan OC-9).

## 8. Log events (base §12)

| Event | Level | Fields | New or changed |
| --- | --- | --- | --- |
| `channel_registry_invalid` | error | `channel`, `reason` | new; the service does not start |
| `channel_profile_unknown` | warn | `profile` | new |
| `job_run` | info | `job`, `ms`, `result` (`ok`, `failed`, `skipped_lease`), `counts` | new ([LA-ADR-03 D7](../adr/LA-ADR-03-learning-record-core.md#decision)) |
| `score_sync` | info | unchanged fields; written for reporter `lti-ags` | unchanged name |
| `record_dispatch` | info | `dispatch_id`, `reporter`, `status`, `tries`, `phase` | new; for reporters other than `lti-ags` (none in LA) |
| `dispatch_throttled` | warn | `dispatch_id`, `partition`, `retry_at` | new (`429` handling) |
| `launch_rejected`, `deep_link_rejected` | warn | `connection_lms` holds the channel id | values widen; names unchanged |
| `http_request` | info (`debug` for `/healthz`) | `trace_id`, `method`, `path`, `status`, `ms` | changed (BD-A1-62, same rule as the LTI service, A2 BD-A2-61): `path` is the matched route template with no ids filled in and no query, or `<unmatched>` when no route matches; never the raw path, also not after `redactPath`. Both listeners: `app/server.ts` and `content-host/server.ts` |

## 8a. App metrics (Should, with E5 metrics)

For the runbook signals of A2's [operability §4.3](../operability.md). Same rules as the LTI service metrics ([LA-ADR-06 D10](../adr/LA-ADR-06-service-operability.md)).

| Item | Rule |
| --- | --- |
| Endpoint | `GET /metrics` (OpenMetrics text) and `GET /readyz` on an app operator listener, default `127.0.0.1:4210`. The proxy does not route it. Same bind rule as the LTI operator listener ([LA-ADR-06](../adr/LA-ADR-06-service-operability.md) D3): only the `acceptance` compose profile binds it on the stack network (`http://cogniate-app:4210`), so the `e2e` container can read it. No session and no tenant data in values. |
| `app_dispatch_rows` | gauge; labels `reporter`, `status` |
| `app_dispatch_oldest_pending_seconds` | gauge; label `reporter` |
| `app_dispatch_sends_total` | counter; labels `reporter`, `outcome` (`accepted`, `conflict`, `rejected`, `retryable`, `throttled`, `local_failure`) |
| `app_launch_refusals_total` | counter; labels `reason` (`deployment_not_approved`, `site_mismatch`, `lms_mismatch`, `unknown_platform`, …), `channel` |
| `app_grant_redemptions_total` | counter; label `result` (`committed`, `cancelled`, `failed`) |
| `app_grant_compensation_failures_total` | counter |
| `app_job_runs_total`, `app_job_last_success_timestamp_seconds` | as the LTI service job metrics; label `job` (`record-dispatch`, `retention`) |

Label values are data (channel ids, reasons), not code branches, so they do not break the LMS-name rule.

## 9. Errors

No new error code in the app API from A1. Values that widen: `details.field` may be `channel`; `details.capability` may be a capability id for a new guard (§3.6, §6). A2's new page code `PLACEMENT_NOT_GRADED` is in [LA-ADR-05](../adr/LA-ADR-05-lti-advantage-completeness.md).
