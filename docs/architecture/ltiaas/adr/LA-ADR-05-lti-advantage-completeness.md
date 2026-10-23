# LA-ADR-05: LTI Advantage completeness

Status: **Proposed** (P2 design, Architect-2 A2, 2026-10-22). Epic: E3 (plan v1 §3). Owner: A2. Consistency owner: A1.
Inputs: [plan v1 §3 E3](../../../team/ltiaas/plan.md#e3-lti-advantage-completeness--must-and-should), [R1 spec coverage](../../../research/ltiaas/R1-spec-coverage.md) (row ids `PS-01`, `DL-08`, … below are R1 ids), [ADR-011 §15](../../adr/ADR-011-multi-lms.md#15-out-of-scope-and-follow-ups) (follow-ups D-1 … D-12), [LA-ADR-01](LA-ADR-01-channel-kernel.md) (capability ids), [LA terms](../terms.md), [R2 LMS landscape](../../../research/ltiaas/R2-lms-landscape.md) (§2.2 storage and Deep Linking rows, §5.2 profile fields, §9).
Related: [LTI service API delta](../contracts/lti-service-api-delta.md), [security delta](../security-delta.md), [LA-ADR-07](LA-ADR-07-security-and-tenancy.md).

## 1. Context

| # | Fact | Evidence |
| --- | --- | --- |
| F1 | The OIDC state is bound to the browser only by a partitioned `SameSite=None` cookie. Login always answers `302`. The launch refuses a POST without the cookie (check 2). Safari and strict settings can block the cookie (Q16, R4, R-M-07). Platform storage per LMS (R2 §2.2): Canvas yes (`lti_storage_target` at login, frame `post_message_forwarding`, target origin = the OIDC auth host); Blackboard yes (frame `lti_storage_frame`), but Learn does not send `lti_storage_target`; Sakai yes (`_parent`); Schoology yes; D2L yes (frame name UNVERIFIED); Moodle and Open edX no. | `services/lti-service/src/lti/login.ts:61-76`; `services/lti-service/src/lti/launch.ts:79-87`; `services/lti-service/src/lti/checks.ts:79-83`; `docs/architecture/security.md:117`, `:121`; `docs/architecture/open-questions.md:24`; R1 PS-01..PS-08 |
| F2 | The LTI service accepts a launch without a `context` claim, but the app refuses it (`not_resource_link`). A service key needs a context. | `services/cogniate-app/src/tool-pages/launch.ts:149`; `services/lti-service/src/lti/service-keys.ts:19`; R1 C-11 |
| F3 | The service signs Deep Linking responses with 1 to 20 items. It refuses an empty list, so a tool cannot "cancel". It does not check `accept_lineitem`. The shaped token has no `acceptLineItem` or `acceptMediaTypes`. | `services/lti-service/src/lti/deep-linking.ts:44-62`; `services/lti-service/src/lti/idtoken.ts:59-62`; R1 DL-03, DL-08, DL-13 |
| F4 | The app picker is single select (radio) and always sends one graded `ltiResourceLink`. Moodle always sends `accept_multiple = true`; when more than one item returns, Moodle hides the activity form, so the teacher cannot set "Receive a grade" (A-T0-11). | `services/cogniate-app/src/tool-pages/picker.ts:63-72`, `:100-127`; `docs/reviews/T0/reviewer-a.md:226-233`; `docs/architecture/tasks/T3a.md:40` |
| F5 | The service asks for the NRPS scope at Dynamic Registration, and the Canvas JSON and the Moodle manual rows ask for NRPS too. The Cogniate app never calls `/api/memberships`. | `services/lti-service/src/lti/registration.ts:14-20`; `services/cogniate-app/src/app/canvas-configuration.ts:40-46`; `services/cogniate-app/src/providers/moodle.ts:22`; R1 NR-10, DR-08 |
| F6 | Claim removal exists only as the LMS-named profile flag `minimizeClaims` (Canvas and Blackboard). Moodle launches keep every claim. A1 turns the flag into the profile trait `privacyFloor` with no behaviour change. | `services/lti-service/src/lti/claims.ts:9-48`; `services/lti-service/src/lti/launch.ts:115`; `services/lti-service/src/profiles/standard.ts:12`; [LA-ADR-01 D6](LA-ADR-01-channel-kernel.md#d6-lti-profiles-in-the-lti-service) |
| F7 | The `window` hint goes only to Canvas and Blackboard. Canvas Dynamic Registration and ungraded Canvas module items (`link_selection`) are not offered. | `services/cogniate-app/src/tool-pages/picker.ts:149-150`; `docs/architecture/adr/ADR-011-multi-lms.md:265`, `:281`, `:426-436` |
| F8 | AGS extension members, `submission` times and `scoringUserId` are dropped both ways. | R1 AGS-10, AGS-12, AGS-19, AGS-20 |

## 2. Decision

| # | Decision | Follow-up / R1 | Priority |
| --- | --- | --- | --- |
| D1 | **Platform storage launch**: for a profile with the trait `platformStorage` and a storage target, the login also stores the state in the platform storage (`lti.put_data`). At launch, if the state cookie is missing, a **storage check** (`lti.get_data`) replaces check 2. Cookie first; the storage path is only the fallback. | D-4; PS-01..PS-06; Q16 | **Must** |
| D2 | **Launch without context**: the app accepts a valid resource link launch without a `context` claim. The placement key uses an empty context id. A missing `sub` is still refused. | C-11, C-06 | **Must** |
| D3 | **Deep Linking completeness**: an empty response ("Cancel"); multi-select only when capability `content.multiple` is true **and** `acceptMultiple` is true; `accept_lineitem` is enforced; `acceptLineItem` and `acceptMediaTypes` in the shaped token. Per-type required fields are Should. | DL-03, DL-08, DL-09, DL-13, DL-16 | **Must** (D3a–D3d); Should (D3e) |
| D4 | **NRPS**: keep the NRPS service in the service API (LTIAAS shape, certification). Stop asking for the NRPS scope in every Cogniate channel (`registration.scopes`). | D-8; NR-10, DR-08 | **Must** (decision and change) |
| D5 | **Ungraded placements**: capability `content.ungraded`; an item without `lineItem`; no dispatch for an ungraded placement; Canvas `link_selection`. After the E4 record model. | D-11; DL-17 | Should |
| D6 | **Canvas Dynamic Registration**: the Dynamic Registration flow with the issuer and endpoints from the Canvas profile; the binding authority stays `operatorGrant`. | D-1; DR-17 | Should |
| D7 | **Claim policy** per tool account on top of the profile `privacyFloor`. Covers Moodle claim minimization. | D-9; C-14, C-15, NR-09 | Should (needs LA-H4) |
| D8 | **New-window launch**: Canvas and Blackboard keep `launch.windowHint`. Moodle: defer to backlog. | D-10; DL-15 | Should (decision); Moodle part: backlog |
| D9 | **AGS extras**: pass `submission`, `scoringUserId` and URL-keyed extension members through. | AGS-10, AGS-12, AGS-19, AGS-20 | Should |
| D10 | **Small spec gaps**: explicit `scoreGiven: null`, NRPS `service_versions`, trusted extra audiences. | AGS-15, NR-01, S-08 | Could |

ADR-011 follow-ups (§15) and where LA decides them:

| Id | Follow-up | LA decision | Where |
| --- | --- | --- | --- |
| D-1 | Canvas Dynamic Registration | Do (Should); authority stays `operatorGrant` | D6 |
| D-2 | More than one page origin per Canvas connection | Not in A2's brief; no change in LA | plan v1 / A1 |
| D-3 | Self-service ownership proof | Do as `verifiedAdminLaunch` (Could), after E5 rate limits and audit | [LA-ADR-08 D1–D3](LA-ADR-08-onboarding-and-connection-health.md) |
| D-4 | Platform storage | Do (Must) | D1 |
| D-5 | Canvas inherited keys | Not in A2's brief; no change in LA | plan v1 / A1 |
| D-6 | One host per tool account | Keep path mode in LA; host mode is a resolver mode for LG hosting (LA-H7) | [LA-ADR-06 D2](LA-ADR-06-service-operability.md#d2-tenant-model-must) |
| D-7 | Reconnect a disabled connection | Not in A2's brief; no change in LA | plan v1 / A1 |
| D-8 | Drop the NRPS scope | Do (Must): keep the endpoint, drop the scope in every Cogniate channel | D4 |
| D-9 | Claim allowlist for Moodle | Do (Should) as the claim policy of the `cogniate` account | D7 |
| D-10 | New window in Blackboard and Moodle | Blackboard: already through `launch.windowHint`; Moodle: defer to the backlog (reason in D8) | D8 |
| D-11 | Ungraded items | Do (Should), after E4 and LA-H22 | D5 |
| D-12 | Reserved ids or quarantine after a release | Defer to the backlog: the operator order of ADR-011 §4b stays; LA-ADR-07 R-LA-1 and the verified admin launch reduce the same class of race | [LA-ADR-07 D2](LA-ADR-07-security-and-tenancy.md#d2-authority-rules-for-channels-must) |
| A-T0-16 | Signing-key rotation test | Do (Must) with the signing-key lifecycle | [LA-ADR-06 D7](LA-ADR-06-service-operability.md#d7-signing-key-lifecycle-and-a-t0-16-must) |

Kernel fit ([LA-ADR-01](LA-ADR-01-channel-kernel.md)): D1, D2, D3 (service part), D4 (service part), D7, D9 and D10 are in the **LTI 1.3 driver** and name no channel. The channel-specific values are capabilities from the manifests: `content.multiple`, `content.ungraded`, `launch.windowHint`, `registration.scopes` (A1's catalog, [LA-ADR-01 D3](LA-ADR-01-channel-kernel.md#d3-capability-model)), and the profile trait `privacyFloor`. D2 and D5 need the placement model of [LA-ADR-03](LA-ADR-03-learning-record-core.md).

### D1. Platform storage launch (Must, D-4)

Specs (public 1EdTech drafts, 2022; text paraphrased): LTI Client Side postMessages 0.1, LTI postMessage Storage 0.1, LTI OIDC Login with LTI Client Side postMessages 0.1 (R1 §1 `[CSPM]`, `[PMS]`, `[CSOIDC]`). In short: the platform sends `lti_storage_target` at login; the tool stores its state in the platform's window with `lti.put_data` before it redirects to the platform, and reads it back with `lti.get_data` on the launch page.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (LMS frame)
  participant L as LTI service
  participant P as Platform auth endpoint
  participant S as Platform storage frame (lti_storage_target)
  B->>L: GET|POST /lti/login/{account} (... lti_storage_target=T)
  L->>L: login checks as today; state record + storage target T + storage origin O
  L-->>B: 200 login page (state cookie set as today)
  B->>S: postMessage lti.put_data {key cog_state_<d>, value state} to origin O
  S-->>B: lti.put_data.response (or no answer in 1.5 s)
  B->>P: navigate to the auth URL (same query as today's 302)
  P->>L: form_post id_token, state
  alt state cookie present
    L->>L: check 2 as today, checks 4..14
    L-->>B: 303 to the tool with ltik (unchanged)
  else cookie missing and the state record has T
    L->>L: checks 4..14 first; store a storage check (120 s), no ltik yet
    L-->>B: 200 storage-check page
    B->>S: postMessage lti.get_data {key cog_state_<d>} to origin O
    S-->>B: lti.get_data.response {value}
    B->>L: POST /lti/launch/{account}/storage-check {check, value}
    L->>L: SHA-256(value) = state hash (constant time); single use
    L-->>B: 303 to the tool with ltik
  end
```

Rules:

| # | Rule |
| --- | --- |
| 1 | **Trigger (profile data).** The profile trait `platformStorage` ([LA-ADR-02 D2](LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2), shape from R2 §5.2 item 3; this ADR owns its behaviour and its E3 values): `null`, or `{ targetFrame: 'from-login' \| <frame name>, origin: 'authOrigin' \| <fixed https origin> }`. The login uses the page only when the trait is not `null` **and** a target T exists: `from-login` takes T from the login parameter `lti_storage_target` (query or form body; at most 64 characters, `[A-Za-z0-9_-]` or `_parent`); a frame name is T itself (for an LMS that does not send the parameter). Else the login answers `302` byte for byte as today. |
| 1a | **Trait values.** E1 and E2: `null` for every profile ([LA-ADR-02 D2](LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2); no behaviour change). E3 (this ADR; it replaces the E2 `null` of the Canvas profiles and of `lti-generic`): every Canvas profile `{ from-login, authOrigin }` (R2 §2.2); `lti-generic` `{ from-login, authOrigin }` (the spec behaviour: a platform that sends a target gets the storage path; one that sends none keeps the `302`); `standard` stays `null` (Moodle sends no target, R2 §2.2); Blackboard stays `null` until a BLACKBOARD-LIVE check of `lti_storage_frame` (R2 §9 item 7); `brightspace` stays `null` until its frame name is verified (R2 §2.2). |
| 2 | **Storage origin.** O = the origin of the platform `authenticationEndpoint` when the trait says `authOrigin` (the OIDC auth origin; `[PMS]` targets it, R1 PS-05; Canvas: `https://sso.canvaslms.com`, R2 §2.2), else the fixed origin of the trait. The target window is `window.parent` for `_parent`, else `window.parent.frames[T]`. A top-level page (`window.parent === window`) skips the storage step at once, because its cookie is first party. |
| 3 | **Login page.** `200`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'none'; base-uri 'none'`. It sets the same state cookie as today. **Encoding (A-LAD-09):** the page puts the auth URL, the state, the target and O into one `<script type="application/json">` block (JSON, with `<`, `>`, `&`, U+2028 and U+2029 written as `\u` escapes, because `login_hint` and `lti_message_hint` come from the request); the nonce script reads that block with `JSON.parse`, and no request value enters HTML or script text in another way. The script sends `{subject: "lti.put_data", message_id, key: "cog_state_<d>", value: state}`, where `<d>` is the first hex digit of the state hash. So the tool uses at most 16 keys and about 1 KB of the platform storage, below the limit of 500 keys and 4,096 bytes per tool (R1 PS-07); a newer login in the same browser with the same digit overwrites the key, and the older launch then fails with `storage_mismatch` (rare: two open logins in one browser within 120 s). It waits at most 1.5 s for `lti.put_data.response` with the same `message_id` from origin O, then navigates to the auth URL. The auth URL is the same as the `Location` of today's `302`. The page has no form and no button. |
| 4 | **State record.** New columns `oidc_state.storage_target` and `oidc_state.storage_origin` (null for a `302` login). |
| 5 | **Launch, cookie present.** Unchanged (check 2, then 4 to 14). |
| 6 | **Launch, cookie missing, no storage target.** Unchanged: `STATE_COOKIE_MISSING` page with today's help texts (security §2.2). |
| 7 | **Launch, cookie missing, storage target set.** Checks 1 and 3 as today (the state is used up). Then checks 4 to 14 and the claim policy, in today's order. Then a row in the new table `storage_check` (`check_hash` PK = SHA-256 of a new 32-byte value, `tool_account_id`, `state_hash`, the prepared launch: platform, deployment, message type, kept claims, origins, generation; `expires_at` = now + 120 s; `used_at`). No ltik exists yet. Answer: `200` storage-check page, CSP `default-src 'none'; script-src 'nonce-…'; frame-ancestors https:; form-action 'self'; base-uri 'none'`, `Referrer-Policy: same-origin` (so that its form POST carries our `Origin`; `no-referrer` would send `Origin: null`). Its script asks `lti.get_data` for the same key at origin O (1.5 s), then posts a hidden form (`check`, `value`) to `POST /lti/launch/{account}/storage-check`. On no answer it posts with an empty `value`. |
| 8 | **Storage check.** `POST /lti/launch/{account}/storage-check`: first, the request `Origin` must be the origin of `PUBLIC_LTI_URL` (A-LAD-09); else `400 INVALID_STATE` (detail `storage_origin`), and the check row stays unused. Then: the row exists for this account, is unused and not expired (else `INVALID_STATE`, detail `storage_check_unknown_used_or_expired`); it is marked used in the same statement (like `consumeState`, `services/lti-service/src/store/states.ts:28-38`). `SHA-256(value)` equals `state_hash` (constant-time compare). Else: an empty value gives `STATE_COOKIE_MISSING` with the storage help text ("Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site."), a different value gives `INVALID_STATE` (detail `storage_mismatch`). On success: store the launch, make the ltik, `303` to the tool, exactly as the cookie path (log `launch_accepted` with `binding: "storage"`). No cookie fallback here (BD-A2-44): the storage path runs only because the launch found no state cookie (rule 7), and a launch with a matching cookie never reads platform storage (rule 5). So a parallel login that overwrites a `cog_state_<d>` slot cannot break a cookie launch. A cookie-less launch whose slot was overwritten fails with `storage_mismatch` and no ltik, and the learner opens the activity again. The endpoint stays free of ambient credentials (security delta §6). |
| 9 | **Messages.** Both scripts accept a reply only when `event.origin` is O, `subject` is the matching `.response` and `message_id` matches. A reply with `error` counts as no answer. They never send to `*`. |
| 10 | **Rate limit.** Login, launch and storage check share the `protocol` class ([LA-ADR-06 D1](LA-ADR-06-service-operability.md#d1-rate-limits-must)). |
| 11 | **Retention.** `storage_check` rows: 10 minutes, by the `retention` job. |

Security property (security delta §2): the storage check binds the OIDC flow to the browser that ran the login: the value lives in the platform's client-side storage for our tool origin, and the platform keys the storage by the sender origin (a platform duty, `[PMS]`). It is a little weaker than the cookie: the server trusts a posted value, so a person who starts a login (and knows its state) could carry the check to a second browser. The `Origin` rule of rule 8 stops another site from making a victim's browser post it. What stays is the same class of risk as the accepted residual R2 (session fixation before first use, `docs/architecture/open-questions.md:42`): it needs the person to control both browsers or to trick the victim into one framed page.

What does not change: tool pages after the launch use no cookies (security §3); the app needs no change for D1. Q16 stays open for Moodle 5.2, because Moodle sends no storage target.

Acceptance points (the breakdown turns them into criteria):

| Id | Observable result |
| --- | --- |
| AP-05-01 | A login without `lti_storage_target` on a `from-login` profile, and any login on a profile with `platformStorage: null`, gives the same `302`, `Location` and `Set-Cookie` as before LA (M1 and T2 regression). |
| AP-05-02 | A login with `lti_storage_target=post_message_forwarding` gives `200` with the CSP of rule 3, the state cookie, and a page whose auth URL equals the `Location` that a `302` login would give (same parameters). |
| AP-05-03 | On the simulator, a framed Canvas-simulator learner launch **with the state cookie removed from the framed launch request** completes through the storage check and reaches `/play/…` (K2, QA-E2E). The LTI log has `launch_accepted {binding: "storage"}`. Setup: a route rule that drops the `__Host-lti_state_*` cookie from the launch `POST`, or a browser setting that also blocks partitioned cookies; qa.md records which one. Reason: the state cookie is `Partitioned` (security §3), and Chromium keeps a partitioned cookie in a frame even when third-party cookies are blocked, so "block third-party cookies" alone never reaches the storage path. Safari stays a live row (Q16). |
| AP-05-04 | A storage check with a wrong value gives the `INVALID_STATE` page (`storage_mismatch`), no `303` and no ltik; a second use of the same check gives `INVALID_STATE`; a check after 120 s gives `INVALID_STATE` (the 120 s rule: Author unit test with a controlled clock, or one real 121 s wait). |
| AP-05-05 | A storage check with an empty value gives `STATE_COOKIE_MISSING` with the storage help text. |
| AP-05-06 | A reply from another origin, or with another `message_id`, is ignored (K2 page test with a fake forwarding frame). |
| AP-05-07 | Signature, nonce, deployment and target checks run before the storage check page: a bad signature on the storage path gives the `INVALID_SIGNATURE` error page, not the storage-check page. |
| AP-05-32 | (A-LAD-09) A storage check POST with `Origin: https://evil.test` or `Origin: null` gives `400 INVALID_STATE` (`storage_origin`); a POST of the same check from the storage-check page then still passes (the row was not used up). |

Simulator need (QA-E2E, R5 §2.2 gap "no LTI platform storage"): the login sends `lti_storage_target`; the auth host serves a forwarding frame that implements `lti.put_data` and `lti.get_data` keyed by the sender origin.

### D2. Launch without context (Must)

| Part | Rule |
| --- | --- |
| LTI service | Unchanged acceptance (no context is valid, LTI Core §5.4.1). New: a service key is also issued when the launch has no context (and, as today, has an AGS or NRPS claim and a resource link, `services/lti-service/src/lti/service-keys.ts:14-19`): the key scope is (platform, deployment, `""`, resource link id). `launch.context` stays absent in `GET /api/idtoken`. |
| App `/tool/launch` | A `LtiResourceLinkRequest` without `context` passes. It still needs a resource link, a known connection and a publication in the signed target. The placement key is (connection, deployment, context id `""`, resource link id). This is spec-safe: a resource link id is unique within its deployment (LTI Core §5.3.5). The placement row is part of [LA-ADR-03](LA-ADR-03-learning-record-core.md) (A1); D2 needs only an empty context id to be valid there. |
| Texts | The results page shows the course name "—" for an empty context. The player is unchanged. |
| Grading | Unchanged rules (ADR-010; ADR-011 §10): graded only with a learner role and no staff role, and only with a line item. Without an AGS claim, the placement is still graded (`placement.graded = 1`, [LA-ADR-03 D2](LA-ADR-03-learning-record-core.md#d2-placement-must)), so a final outcome makes today's row: one learning record and one dispatch that ends `failed` with "No gradebook column" (ADR-010 rule 1). Only D5 (Should) changes this, and only on a channel with `content.ungraded` true. |
| `/tool/deep-link` | Already works without a context (`services/cogniate-app/src/tool-pages/launch.ts:212-218`); no change. |
| Missing `sub` | Still refused (check 11, `MISSING_CLAIM`). This is a documented deviation: LTI Core allows an anonymous launch without `sub`, and the 1EdTech certification lists a missing user as a bad payload (R1 C-06). E8 writes it in the deviation list. |

Acceptance points:

| Id | Observable result |
| --- | --- |
| AP-05-08 | A simulator learner launch with no `context` claim, an AGS claim with `lineitem` and a published course opens `/play/…`. `GET /api/idtoken` has `services.serviceKey`. A final outcome makes one dispatch to that `lineitem`, and the score reaches the simulator. |
| AP-05-09 | The same launch without an AGS claim (and without an NRPS claim) opens the player; `GET /api/idtoken` has no `services.serviceKey`. A final outcome gives today's result: one dispatch row (reporter `lti-ags`) that ends `failed` with `lastError` "No gradebook column: the activity has no AGS line item." (`services/cogniate-app/src/worker/score-sync.ts:26`), and no score POST reaches the simulator (ADR-010 rule 1; the same as a launch with a context). This holds until D5 ships; after D5, on a channel with `content.ungraded` true, AP-05-23 replaces it. |
| AP-05-10 | Two launches without context and with the same resource link id in one deployment use one placement; the same id in another deployment uses another placement. |
| AP-05-11 | A launch without `sub` still fails with `MISSING_CLAIM` (unchanged). |

### D3. Deep Linking completeness (Must, except D3e)

| Id | Part | Rule |
| --- | --- | --- |
| D3a | Cancel (service) | `contentItems: []` is valid. The service signs a response whose `content_items` claim is `[]` (DL 2.0 §4.5.6). `accept_multiple: false` allows 0 or 1 item. The 20-item maximum stays. |
| D3a | Cancel (app) | The picker page has a "Cancel" button (also on the "No course is published" page). `POST /tool/picker/{pickerId}/cancel` has the same checks as the picker POST (exists, unused, unexpired, `Origin` = `PUBLIC_APP_URL`). It calls `POST /api/deeplinking` with `contentItems: []` and `options.message = "No course was added."`, posts the JWT to the return URL like a pick, and marks the picker used. It makes no pick row. |
| D3b | Multi-select (app) | The picker shows checkboxes only when the channel capability `content.multiple` is true **and** `launch.deepLinkingSettings.acceptMultiple` is `true`. Else it shows today's radio list. The POST takes 1 to 20 publication ids; each must belong to the connection and be `available`. Items keep the list order. Each item has today's shape (`picker.ts:63-72`), with its own `lineItem` (D3c). **Pick records (A-LAD-10):** today a picker session keeps one `publication_id` (`services/cogniate-app/src/domain/migrations/004_launch.sql:37`). The picker POST writes one row per picked publication into the new app table `picker_pick` ([LA data model §5b](../data-model.md#5b-cogniate-app-picker-picks-e3), A1), in the transaction that marks the picker used; a single pick also writes `picker_session.publication_id` as today. The "Selected in {LMS}" stats (`stats.activities`) and the picker retention exception read `picker_pick`. Baseline values (E1, no behaviour change): `content.multiple` false for Moodle (A-T0-11), Canvas and Blackboard. E3 values: `lti-generic` true; Blackboard after a BLACKBOARD-LIVE check of Learn's `accept_multiple`; the E2 LMS per R2. |
| D3c | `accept_lineitem` | Service: if `deep_linking_settings.accept_lineitem` is `false`, an item with `lineItem` gives `400 INVALID_CONTENT_ITEM` ("the platform does not accept line items"). App: with `acceptLineItem === false` and `content.ungraded` false, the picker shows the page `PLACEMENT_NOT_GRADED` ("This {LMS} placement does not take graded items. Use {LMS}'s graded placement to add a Cogniate course.") and makes no Deep Linking call. With `content.ungraded` true, see D5. |
| D3d | Shaped token | `launch.deepLinkingSettings` gets `acceptLineItem` and `acceptMediaTypes` (additions; `services/lti-service/src/lti/idtoken.ts:59-62`). |
| D3e | Per-type fields (Should) | Service: `link` and `image` need an https `url`; `file` needs an https `url`; `html` needs a string `html`. Else `400 INVALID_CONTENT_ITEM` with the item index. `ltiResourceLink` is unchanged. |

Unverified: how Moodle 5.2 shows an empty `content_items` list. If Moodle shows a message instead of closing the dialog, the Moodle teacher guide says "close the dialog"; the button stays (DL 2.0 says a tool SHOULD return also when nothing is chosen). QA adds one MOODLE-LIVE row.

Acceptance points:

| Id | Observable result |
| --- | --- |
| AP-05-12 | `POST /api/deeplinking {contentItems: []}` on a Deep Linking launch gives `200`; the JWT has `content_items: []`. The same with `accept_multiple: false` gives `200`. |
| AP-05-13 | With `accept_lineitem: false`, an item with `lineItem` gives `400 INVALID_CONTENT_ITEM`; the same item without `lineItem` gives `200`. |
| AP-05-14 | `GET /api/idtoken` of a Deep Linking launch whose settings have `accept_lineitem` and `accept_media_types` shows `acceptLineItem` and `acceptMediaTypes`. |
| AP-05-15 | On a channel with `content.multiple` true and `accept_multiple: true`, the picker shows checkboxes. Three picked publications give one JWT with three `ltiResourceLink` items in list order, each with its own `lineItem.resourceId`. 21 ids give the `400` page `PUBLICATION_NOT_AVAILABLE`. |
| AP-05-16 | A Moodle connection (Moodle sends `accept_multiple: true`) still shows the radio list and sends one item (T7 unchanged). |
| AP-05-17 | Cancel posts a JWT with `content_items: []` to the return URL; the picker is used; no pick row; a cancel POST with another `Origin` gives `403` and changes nothing. |
| AP-05-18 | With `acceptLineItem: false` on a channel with `content.ungraded` false, the picker shows `PLACEMENT_NOT_GRADED` and calls no Deep Linking endpoint. |

Build notes (BD-A2-87; LA-E3-05, lane L2, ratified):

- `PLACEMENT_NOT_GRADED` is a `/tool/*` error page with status `403`, like `NOT_DEEP_LINKING` and `ROLE_NOT_ALLOWED`. The app logs `picker_rejected {reason: "placement_not_graded"}`.
- The picker GET and the picker POST both read `acceptMultiple` and `acceptLineItem` from `GET /api/idtoken` (the shaped token, D3d). The page never trusts a form field for them.
- The POST re-checks and refuses with `PLACEMENT_NOT_GRADED` too, with no Deep Linking call.
- A multi-select POST with a duplicate publication id gives `400 PUBLICATION_NOT_AVAILABLE` (the same code as 21 ids): the page never sends duplicates, so a duplicate is a broken or forged request.
- Items go in the picker list order, not the click order (D3b "Items keep the list order").

Simulator need: multi-item, empty and ungraded Deep Linking as scenario data (R5 §2.4, about 0.5 day); `accept_lineitem` and `accept_media_types` in the settings claim.

### D4. NRPS: keep the service, drop the scope (Must, D-8)

Decision (Lead input in plan v1 §3 E3):

1. The LTI service keeps `GET /api/memberships` and the NRPS client unchanged. Reasons: LTIAAS API shape (ADR-003, AC-T3-27 uses memberships), and the certification reference tool (plan E7, LA-H9) must call NRPS.
2. Every Cogniate channel stops asking for the NRPS scope. The capability `registration.scopes` of `moodle`, `canvas`, `blackboard`, `lti-generic` and the E2 LMS lists the four AGS scopes only: `lineitem`, `lineitem.readonly`, `result.readonly`, `score`. Least privilege and privacy: Cogniate needs no roster (R1 NR-10).
3. Where the scope set is used:

| Place | Today | After D4 | Owner |
| --- | --- | --- | --- |
| Dynamic Registration request `scope` | fixed five scopes (`services/lti-service/src/lti/registration.ts:14-20`) | `POST /api/registrations/:id/complete` gets the optional field `scopes`; the app sends the channel's `registration.scopes`; without it the service keeps the five scopes (other tool accounts unchanged) | LTI service (A2), app (A1) |
| Canvas developer key JSON `scopes` | five scopes (`services/cogniate-app/src/app/canvas-configuration.ts:40-46`) | the channel's `registration.scopes` | Canvas channel folder (A1) |
| Moodle manual row 13 `nrps` | "Use this service to retrieve members' information as per privacy settings" (`services/cogniate-app/src/providers/moodle.ts:22`) | "Do not use this service" (the Moodle 5.2.4 option label; QA confirms the exact text) | Moodle channel folder (A1) |
| Blackboard admin guide | "grade and membership services on" (ADR-011 §7) | "grade service on; membership service off" | Docs (E8) |

4. Timing: E3, after the E1 regression proof. The changed assertions (app contract §4.1 row 13, §4.6 `scopes`, the DR request scope) are the reviewed test-change list of LA-IC-04 (plan LD-9).
5. Existing installations need no action. The LMS may still send an NRPS claim; the service still stores it in the service key; nothing calls it.

Acceptance points:

| Id | Observable result |
| --- | --- |
| AP-05-19 | The Canvas JSON `scopes` has exactly the four AGS scopes. |
| AP-05-20 | Moodle tool configuration row 13 has the value "Do not use this service"; the other 15 rows are unchanged. |
| AP-05-21 | A Dynamic Registration of a Cogniate Moodle connection sends `scope` with the four AGS scopes only (seen at `qa-platform.test` or in the Moodle tool record). A `complete` call without `scopes` still sends the five scopes. |
| AP-05-22 | `GET /api/memberships` still answers for a launch with an NRPS claim (AC-T3-27 unchanged). |

### D5. Ungraded placements (Should, D-11)

Depends on the E4 learning-record model ([LA-ADR-03](LA-ADR-03-learning-record-core.md)) and a product decision (LA-H22 below; Q21 says "D-11 after a product decision on ungraded completion").

| Rule | Detail |
| --- | --- |
| Capability | `content.ungraded` (A1 catalog). Proposed values: Canvas true (adds the `link_selection` placement to the developer key JSON, message type `LtiDeepLinkingRequest`); `lti-generic` true; Moodle false ("Receive a grade" is Moodle's completion path); Blackboard false until a live check. |
| Content item | On a channel with `content.ungraded` true, the picker sends `ltiResourceLink` items without `lineItem` when the launch has `acceptLineItem === false`, or when the signed target of the Deep Linking launch (`launch.target`, contract §3.1) has the query parameter `cogniate_placement=ungraded`. The Canvas channel sets this parameter on the `target_link_uri` of its `link_selection` placement in the developer key JSON (channel data, no core branch); whether Canvas also sends `accept_lineitem: false` there is UNVERIFIED. Without `lineItem` the LMS makes no line item (Canvas: an item with `lineItem` makes an assignment, R2 §2.2 row 3), so its launches carry no AGS `lineitem` claim. |
| Placement (only when the connection's channel has `content.ungraded` true) | A launch without an AGS `lineitem` claim sets `placement.graded = 0` when the placement is new. A launch with an AGS `lineitem` claim sets `graded = 1` (the teacher added grading in the LMS). A later launch without the claim does not set `0` again. On every other channel `graded` stays `1` (today's rule). The column and the reporter rule `appliesTo` are A1's ([LA-ADR-03 D2, D5](LA-ADR-03-learning-record-core.md#d2-placement-must)). Known limit: a platform that has a line item for the link but leaves out the `lineitem` claim (the claim is optional in AGS 2.0) gets an ungraded placement. The Canvas and generic simulators send the claim for graded links; for hosted Canvas this is UNVERIFIED (one CANVAS-HOSTED row with D5). The generic channel README states the limit. |
| Records | A final outcome on an ungraded placement makes a learning record but no dispatch. The results row shows "Not graded in {LMS}" and offers no Resend. This removes the misleading `failed` row of B-PF-03 (ADR-011 §8) for ungraded placements (LA-IC-07). |
| Graded placement without a line item | Unchanged in LA: the `local_failure` outcome "No gradebook column" and a `failed` dispatch ([LA-ADR-03 D2](LA-ADR-03-learning-record-core.md#d2-placement-must); AP-05-09). This covers every Moodle placement without "Receive a grade": the failed row tells the teacher to turn grading on, so Moodle keeps it. |

Acceptance points (Should):

| Id | Observable result |
| --- | --- |
| AP-05-23 | A Canvas-simulator `link_selection` pick sends an item without `lineItem`. A learner launch of that link (no AGS `lineitem` claim) and a final outcome make one learning record, no dispatch row, and a results row "Not graded in Canvas" without Resend. |
| AP-05-24 | A later launch of the same placement with an AGS `lineitem` claim, then a better final outcome, makes one dispatch that reaches the simulator. |
| AP-05-28 | On a Moodle-shaped simulator connection (`content.ungraded` false), a launch without an AGS claim still gives AP-05-09 (a `failed` "No gradebook column" row). |

### D6. Canvas Dynamic Registration (Should, D-1)

R2 facts (R2 §4.2 row "Canvas Dynamic Registration"): Canvas Dynamic Registration is live (Developer Keys › LTI Registration, and Canvas Apps › "Install a New App", root admin only). Canvas registration extensions are `https://canvas.instructure.com/lti/privacy_level`, `…/lti/tool_id` and `…/lti/vendor`. The Dynamic Registration `token_endpoint` may be on the `sso` host (UNVERIFIED for hosted Canvas). The registration token is not the Moodle JWT with `scope` (R2 §4.3; format UNVERIFIED, so the driver treats it as an opaque Bearer token, Dynamic Registration 1.0 §3.3).

| Rule | Detail |
| --- | --- |
| Flow | The Dynamic Registration flow of the LTI 1.3 driver with the Canvas profiles' trait `dynamicRegistration: { issuerRule: 'profile', registrationToken: 'opaque-bearer' }` ([LA-ADR-02 D2](LA-ADR-02-generic-lti-channel.md#d2-profile-traits-added-in-e2); E2 keeps `null` for Canvas, D6 sets this value). `profile` means: the configuration issuer must **equal** the profile issuer (not the configuration URL origin), and every endpoint must equal the filled profile value (auth and JWKS fixed; token `{serviceUrl}/login/oauth2/token`). Any other value refuses the registration; nothing is stored. |
| Dependency (Should) | R2 says the hosted Canvas DR `token_endpoint` may be on the `sso` host (UNVERIFIED). If a CANVAS-HOSTED row confirms it, the trait needs one more optional field: a list of allowed token endpoints (`tokenEndpoints`, values from the live row). This is a trait-shape change of LA-ADR-02 D2 (A1 owns it); the breakdown adds it to the D6 task only after the live row. Until then the simulator proves the strict rule. |
| Configuration URL | https, fetched with the guarded client. The start page knows no connection yet, so before the fetch it checks the Canvas site rules 1–5 (BD-A2-89). The connection binding is proven later by the grant: `complete` derives the values from the configuration (site origin = the configuration URL origin; service origin = the token endpoint origin, which passes the same site rules; token endpoint = `{service origin}/login/oauth2/token`; auth and JWKS = the fixed values; issuer = the profile issuer, self-hosted: the site origin). It stores them on the always-staged platform, and the grant's adoption rule (A1) activates it only when issuer, `siteUrl` and `serviceUrl` equal the connection's granted values. A configuration URL on a fixed Canvas host (`sso.canvaslms.com` and its beta and test twins) is refused at `complete` (nothing stored, nothing sent): the school's site cannot be proven from it, so this case waits for the CANVAS-HOSTED live row, as in the "Dependency" row. Pre-fetch floor (BD-A2-93): with any registry, the start route refuses before any fetch a configuration URL that is not https, fails site rules 1–3, or is on a reserved host (a fixed host of any loaded profile); every other https URL is fetched under the union start rule of LA-ADR-02 D5. |
| Request | The Canvas folder adds the three Canvas extension members as channel data: privacy level `anonymous`, tool id `cogniate`, vendor name. The scopes are `registration.scopes` (D4). |
| Authority | The registration creates the Canvas platform **inactive**, with a binding ref of the connection. Launch and grade authority still need the operator grant (`binding.authority` of the Canvas `dynamic` method is `operatorGrant`), or a verified admin launch if [LA-ADR-08](LA-ADR-08-onboarding-and-connection-health.md) D3 is built. D6 removes the JSON paste and the typed client id; it does not remove the ownership proof. |
| Manifest | Canvas `registration` gets a `dynamic` method with authority `operatorGrant`. Capability `registration.dynamic` becomes true for Canvas. |
| Portal | (BD-A2-90.) The Canvas wizard offers the method choice at create (developer key, the default, or Dynamic Registration), shows the registration URL instead of the developer key JSON for `dynamic`, and pre-fills the binding form's Client ID and Deployment ID from the staged platform. The manual path does not change. Task LA-E3-16 (lane P), in the same cut group as LA-E3-09 and LA-E3-15: D6 is not "API only". |

Acceptance points (Should):

| Id | Observable result |
| --- | --- |
| AP-05-29 | Canvas simulator: a Dynamic Registration of a `pending` Canvas connection with the profile issuer and the filled profile endpoints creates one **inactive** platform with the connection's binding ref; the registration request has the three Canvas extension members and the four AGS scopes; before the grant, the LTI service refuses a learner login to that platform with `PLATFORM_NOT_ACTIVE` (the platform is inactive, so the app sees no launch; Q-LAD-24); after `app:grant issue` and redemption, the launch passes. |
| AP-05-30 | A configuration whose issuer is not the profile issuer, or with one endpoint that differs from the filled profile value, gives the refusal page; no platform row, no registration request at the simulator. |

Test: the simulator needs Dynamic Registration with an opaque token (R5 §2.4: 1.5–3 days). Live: CANVAS-HOSTED rows need LA-H3.

### D7. Claim policy per tool account (Should, D-9)

| Rule | Detail |
| --- | --- |
| Field | `tool_account.claim_policy` (JSON, [LA-ADR-06 D2](LA-ADR-06-service-operability.md#d2-tenant-model-must)): `{ "mode": "allowlist" \| "passthrough", "keep": { "names": bool, "email": bool, "custom": bool, "lis": bool } }`. Set only through the operator API. |
| Effect | `passthrough`: keep every claim (today's `standard` behaviour). `allowlist`: keep the ADR-011 §9 allowlist plus the groups that `keep` turns on (`names` = `name`, `given_name`, `family_name`, `middle_name`, `picture`; `email` = `email`; `custom` = `lti/claim/custom`; `lis` = `lti/claim/lis`). |
| Privacy floor | The profile trait `privacyFloor: 'allowlist'` (A1 D6; every Canvas and Blackboard profile) always applies the allowlist with every `keep` group off. A claim policy can remove more claims, never fewer. Fail closed (BD-A2-21): a claim stays only when the floor and the account policy both allow it explicitly; an unknown or missing value of either layer minimizes, except the documented account default (row "Defaults": `null` = `passthrough` for existing accounts). `none` is allowed only for the frozen profile list of LA-ADR-07 T18 (today `standard`). |
| Defaults | Existing accounts (`cogniate`, `qa-second`): `null` = `passthrough`, so E1 changes nothing. E3 step: the operator sets `cogniate` to `allowlist` with every `keep` off. This is the D-9 change for Moodle. New accounts: `allowlist` with every `keep` off (privacy by default, LA-H4). |
| `null` rule | (BD-A2-26; B-LA-E5-04-02.) `null` is a stored legacy marker, not an input. It exists only on rows from before the `claim_policy` column (the migration default) and means `passthrough`. The operator API never accepts `null`: `POST /operator/v1/accounts` without `claimPolicy` stores the new-account default (`allowlist`, every `keep` off), and `claimPolicy: null` in `POST` or `PATCH` gives `400 INVALID_REQUEST` (field `claimPolicy`). To keep every claim, an operator writes `{"mode": "passthrough", …}` explicitly. `GET` shows a legacy row as `null`, with this meaning. With the floor (BD-A2-21), the account layer reads: a valid stored object gives its mode; stored `null` gives `passthrough` (the one documented exception); any other stored value gives `allowlist` (fail closed). Rows that a test volume stored with `null` through the API before this rule stay `passthrough`; pilot volumes have none. |
| Outputs | `GET /api/idtoken` (also `raw=true`) shows only kept claims; `launch.custom` is `{}` when `custom` is removed. `launch_claims_minimized {platform_id, claims}` for every profile when it removes a claim. |
| NRPS fields | Unchanged: `/api/memberships` never returns personal fields (contract §8 D13). A per-account opt-in is a follow-up of LA-H4. |

Acceptance points (Should): AP-05-25: with `cogniate` on `allowlist`, a Moodle launch that carries `custom`, `lis`, `name` and `email` stores none of them; `raw=true` shows none; the log lists them; T7 passes. AP-05-26: `qa-second` on `passthrough` keeps them for a `standard` launch. AP-05-27: a Canvas-profile launch of a `passthrough` account still removes them (floor).

### D8. New-window launch (D-10)

- Canvas and Blackboard: unchanged. `launch.windowHint` is true in their manifests ([LA-ADR-01 D8](LA-ADR-01-channel-kernel.md#d8-moodle-canvas-and-blackboard-extras-as-capabilities)); the content item gets `window: { targetName: "_blank" }` when the platform accepts `window` (app contract §6.1).
- Moodle: **defer to the backlog.** Reasons: the Moodle tool configuration already sets "Default launch container: New window" (app contract §4.1 row 11), so learners already get a new window; the effect of a `window` member on Moodle 5.2 activity creation is not verified; A-T0-11 shows that Moodle's Deep Linking form handling is easy to break. Re-open it only with a MOODLE-LIVE check that shows the form and "Receive a grade" unchanged.
- Generic channel and the E2 LMS: `launch.windowHint` true, so an LMS that honours the hint opens a new window (D2L: "Open as External Resource", R2 §2.2).
- R2 §9 item 9 proposes a profile flag `documentTargetTrusted` for LMSs that always send `iframe`. The kernel capability `launch.topLevelContinue` ([LA-ADR-01 D3](LA-ADR-01-channel-kernel.md#d3-capability-model)) already covers it; no new flag.

### D9. AGS extras (Should)

`POST /api/lineitems/:id/scores` accepts optional `submission` (`startedAt`, `submittedAt`, ISO 8601), `scoringUserId` (string) and extension members whose key is an absolute https URL (at most 8 keys, each value at most 4 KB of JSON). The service sends them to the platform unchanged. Score `GET` returns `scoringUserId` and URL-keyed members of each result. Line items keep URL-keyed members both ways. Reason: Canvas uses URL-keyed score extensions for submissions (R1 `[CV-SC]`), and other tools need submission times. Whether the AGS reporter uses them is an E4 decision (A1).

Acceptance point (Should) AP-05-31: a score POST with `submission.submittedAt`, `scoringUserId` and one member `https://canvas.instructure.com/lti/submission` reaches the simulator with the three values unchanged; a member whose key is not an absolute https URL is dropped, as today (`services/lti-service/src/platform/ags.ts:96`); a ninth URL-keyed member, or one value above 4 KB, gives `400 INVALID_REQUEST`.

### D10. Small spec gaps (Could)

| R1 row | Decision |
| --- | --- |
| AGS-15 | `scoreGiven: null` in a score POST means "no score" (as absent). Today it gives `400`. |
| NR-01 | `/api/memberships` checks that the claim's `service_versions` contains `2.0`; else `403 SERVICE_NOT_AVAILABLE`. A claim without `service_versions` passes (Moodle compatibility). |
| S-08 | A platform field `trustedAudiences` (default empty). A launch whose `aud` has a value other than the client id and the trusted list fails check 5. Default empty = refuse extra audiences: a behaviour change for a platform that sends extra audiences. No known platform does it (Moodle sends one value), so the risk is low. Security owner: [LA-ADR-07](LA-ADR-07-security-and-tenancy.md). |

Not in LA (with the reason): NRPS `differences` and the member `message` section (NR-05, NR-07: no roster user after D4); `lti_msg` on the return URL (C-13: cosmetic); custom content item types (DL-18); the `lti1p1` claim (C-21: LD); Dynamic Registration fixes (A1, LA-ADR-02); the certification reference tool (QA, E7, LA-H9).

## 3. Alternatives considered

| Alternative | Why not |
| --- | --- |
| D1: a proxy redirect (a first-party top-level hop) | It breaks Deep Linking in the LMS dialog, which must stay in the frame (security §3 note), and research §5.3 refused it. |
| D1: a "reduced binding" mode with no cookie and no storage (Q16 option b) | It drops the browser binding of the OIDC state. Platform storage gives the same binding without the cookie. |
| D1: the storage path for every login | Moodle sends no target. A page instead of `302` for every login adds a step and changes the M1 and T2 baselines with no gain. |
| D1: compare the state on the storage-check page in the browser | The browser could then skip the check. The server compares, and only the hash of the state is stored. |
| D3: multi-select whenever `accept_multiple` is true | Moodle always sends true and then hides the activity form (A-T0-11). |
| D4: drop the NRPS endpoint too | It breaks the LTIAAS-shaped API (AC-T3-27) and certification. |
| D7: keep `minimizeClaims` as an LMS-named profile flag and turn it on for `standard` | It changes every tool account that uses `standard`, also LTIAAS-style tenants that need custom parameters (R1 C-14). Privacy is a tenant choice above a profile floor. |
| D8: send the `window` hint to Moodle now | Moodle already opens a new window through its admin setting; an unverified change risks the Deep Linking form. |

## 4. Consequences

- Teachers and learners in Canvas (and any LMS with platform storage) can launch in frames without third-party cookies.
- The certification suite's valid launches without a context pass the app ([R1 §4](../../../research/ltiaas/R1-spec-coverage.md#4-certification-readiness)); the reference tool (E7) covers the rest.
- Teachers can cancel the picker, and channels whose LMS handles several items can add several courses at once.
- Cogniate stops asking for roster access.
- New LTI service tables and columns: `storage_check`; `oidc_state.storage_target`, `oidc_state.storage_origin`. New tool account field `claim_policy` (shared with LA-ADR-06).
- New app routes: `POST /tool/picker/{pickerId}/cancel`; new page codes `PLACEMENT_NOT_GRADED`.

## 5. Migration and compatibility

| Item | Rule |
| --- | --- |
| Moodle | Unchanged in E1. E3 changes for Moodle: the NRPS scope and row 13 (D4), and the claim policy when the operator sets `cogniate` to `allowlist` (D7). Both change frozen assertions only through the reviewed test-change lists of LA-IC-04 and LA-IC-08 (plan LD-9). Login stays `302` (no storage target). |
| Canvas | E3: login page instead of `302` when Canvas sends `lti_storage_target` (D1); the JSON `scopes` (D4); `link_selection` only with D5. |
| LTIAAS shape | Additions only: `acceptLineItem`, `acceptMediaTypes`, `complete.scopes`, score `submission`, `scoringUserId`, URL-keyed members, empty `contentItems`. New contract §8 rows: [contract delta §8](../contracts/lti-service-api-delta.md). |
| Data | Additive migrations. `storage_check` is new; old state rows have `storage_target = null` (the cookie path). |

**Intended behaviour changes.** Each change has an id of [LA-ADR-04 D8](LA-ADR-04-refactor-and-migration.md#d8-intended-behaviour-changes-ids-la-ic-nn). This table gives the exact expected values; LA-ADR-04 D8 lists the same ids.

| Id | Decision | Expected values after the change | Golden or frozen test touched |
| --- | --- | --- | --- |
| LA-IC-04 | D4 | Canvas JSON `scopes` = the four AGS scopes, in the order `lineitem`, `lineitem.readonly`, `result.readonly`, `score`; Moodle tool row 13 `nrps` = "Do not use this service"; a DR request from the Cogniate app sends `scope` with the four AGS scopes, space-separated, same order | Canvas JSON (both `jwk` forms); Moodle tool rows; M1 Canvas JSON rows; T4b1 and T7 row-13 checks |
| LA-IC-05 | D2 | A resource link launch without `context` opens `/play/…` (was the `not_resource_link` page); `services.serviceKey` is present when the launch has an AGS or NRPS claim | the `not_resource_link` page for that case only |
| LA-IC-06 | D1 | Profiles with `platformStorage` and a target: login `200` page (was `302`); the same `Set-Cookie`. All other logins: `302`, byte for byte | none for `platformStorage: null` (every baseline profile until E3; `standard` always) |
| LA-IC-07 | D5 | Ungraded placements (channels with `content.ungraded` only): a record, no dispatch, "Not graded in {LMS}". The Canvas JSON gets one more placement, `link_selection` (message type `LtiDeepLinkingRequest`, `target_link_uri` with `cogniate_placement=ungraded`) | B-PF-03 checks for ungraded placements only; Canvas JSON golden and the M1 Canvas JSON rows |
| LA-IC-08 | D7 | `cogniate` on `allowlist` with every `keep` group off: Moodle launches keep only the ADR-011 §9 allowlist; `launch.custom` = `{}`; `launch_claims_minimized` appears for Moodle launches | stored Moodle claims; `GET /api/idtoken` (`raw=true`) of Moodle launches; tests that read Moodle `custom`, `lis`, name or e-mail |
| LA-IC-12 | D3 | The picker page and the "No course is published" page get one more button, "Cancel" (`POST /tool/picker/{pickerId}/cancel`); `POST /api/deeplinking {contentItems: []}` gives `200` (was `400 INVALID_CONTENT_ITEM`); an item with `lineItem` gives `400 INVALID_CONTENT_ITEM` when the launch has `accept_lineitem: false` (was `200`); `GET /api/idtoken` of a Deep Linking launch adds `acceptLineItem` and `acceptMediaTypes` when the platform sends them | picker page HTML (golden tool pages); tests that click the only button of the picker page; a test that expects `400` for an empty list (QA scan); whole-object checks of `deepLinkingSettings` |
| LA-IC-13 (Could) | D10 | `scoreGiven: null` accepted as absent (was `400`); an NRPS claim whose `service_versions` lacks `2.0` gives `403 SERVICE_NOT_AVAILABLE`; a launch with an `aud` value that is not the client id and not in `trustedAudiences` fails check 5 | tests that expect `400` for `scoreGiven: null` (QA scan) |
| LA-IC-14 (Should) | D6 | Canvas gets the `dynamic` method (authority `operatorGrant`): the Canvas legacy flag `dynamicRegistration` becomes `true`; a Canvas `POST /app-api/connections {method: "dynamic"}` is accepted (was `422 CAPABILITY_NOT_SUPPORTED`); `GET /app-api/lms-providers` lists Canvas `methods` `["manual", "dynamic"]` | K0 legacy projection golden of Canvas; `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218`, `:241`, `:257` (Q-LAD-16) |

Under plan LD-9, each id changes frozen assertions only through its own reviewed test-change list (QA makes it at the task that ships the change; both reviewers approve). For Moodle these are LA-IC-04, LA-IC-08 and LA-IC-12, after the E1 regression proof (D4 item 4).

## 6. Test impact

Ownership follows plan LD-5: K0 is the QA contract suite over the public kernel and registry entry points (no Docker); kernel and service internals are Author unit tests (Reviewer-B checks them); points that need a running service are K1 or SIM-lane acceptance by QA (`tests/ltiaas/**`); QA-E2E owns K2 and the simulator modules.

| Level | Owner | Tests |
| --- | --- | --- |
| Author unit | Author | Login page build (rule 3 CSP; the auth URL equals the `302` `Location`; the JSON block escapes `<`, `>`, `&`, U+2028, U+2029 for a hostile `login_hint`; the storage key digit rule); storage check compare, single use and the 120 s life with a controlled clock; target parameter grammar; content item rules (empty list, `accept_lineitem`, per type); the claim policy matrix with the privacy floor (D7); the scope set in the DR request; placement `graded` rule (D5); migration tests for `oidc_state.storage_target`, `storage_origin`, `storage_check`, `tool_account.claim_policy`. |
| K0 | QA | Per registered channel, from the registry, with the fixture value of each stage (E1 baseline = today's behaviour; E3 = this ADR): `registration.scopes` (E1: today's five scopes; E3: the four AGS scopes, D4); `content.multiple` (false for `moodle`, `canvas`, `blackboard` in E1; D3b); `content.ungraded` and `launch.windowHint` (D5, D8); profile traits `platformStorage` (E1: `null` everywhere; E3: rule 1a) and `privacyFloor` (D7). |
| K1 and SIM-lane acceptance | QA | K1-LAUNCH L7 = AP-05-08 to AP-05-11; L10 = AP-05-01, -02, -04, -05, -07, -32; L5 = AP-05-25 to AP-05-27 (Should); K1-DL = AP-05-12 to AP-05-15, -17, -18; K1-NRPS = AP-05-19, AP-05-21 (simulator part), AP-05-22. Should items: AP-05-23, -24, -28 (D5), AP-05-29, -30 (D6), AP-05-31 (D9). |
| K2 | QA-E2E | U4 = AP-05-03, AP-05-06 (a framed launch with the state cookie removed from the launch request). U4 is a **Must** case: it is the only end-to-end proof of F3.1 (B-LAD-07). README F7.7 makes K2 U1–U4 Must; other K2 checks (F7.9) are Could (Q-LAD-26). |
| Simulator modules | QA-E2E | `lti_storage_target` at login and a forwarding frame on the auth host with `lti.put_data` and `lti.get_data` keyed by the sender origin; Deep Linking scenario options (several items, an empty list, `accept_lineitem`, `accept_media_types`, an ungraded `link_selection` placement); opaque-token Dynamic Registration for Canvas (D6, Should). The no-context launch exists today (scenario `omit`). |
| Moodle lane | QA (acceptance), QA-E2E (T7) | AP-05-16 (radio list, T7 unchanged); Cancel in Moodle 5.2 (one MOODLE-LIVE row); AP-05-20; the Moodle part of AP-05-21. |
| Regression | QA (M1), QA-E2E (M2, T7) | M1, M2, T7 after the E3 change list (LA-IC-04, -08, -12). |

## 7. Open questions

| Id | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| Q16 | Teacher Deep Linking in Safari on Moodle 5.2 (no platform storage in Moodle) | Keep the pilot browser advice for Moodle. Ask Moodle HQ for platform storage support (Q16 option c). D1 solves it for platforms that support storage. | Product + Security |
| LA-H4 | Which personal claims a channel may receive; defaults of the claim policy | `allowlist` with every `keep` group off for new accounts; `cogniate` on `allowlist` from E3 | Product + DPO |
| LA-H22 | Offer ungraded items (Canvas module items), with the completion shown only in the Cogniate portal? (Q21 ties D-11 to this decision.) | Yes for Canvas `link_selection` and the generic channel; no for Moodle | Product |
| — (engineering, live checks) | Facts that R2 leaves UNVERIFIED: the D2L storage frame name; the hosted Canvas DR token endpoint host and registration token format; Blackboard `lti_storage_frame` without a login parameter; Learn's `accept_multiple` | The simulator follows the specs and R2; each fact gets one live row when LA-H3 gives a site | QA (live rows) |
| — (engineering) | How Moodle 5.2 shows an empty Deep Linking response | One MOODLE-LIVE row in E3 | QA |

LA-H21 to LA-H24 are in plan v1.2 §6.2.
