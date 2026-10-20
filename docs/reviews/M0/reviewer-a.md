Verdict: CHANGES_REQUESTED
Round: 1

# M0 design review: Reviewer-A (correctness and security)

| Item | Value |
| --- | --- |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh, dedicated instance (same instance as preflight `ctx_8546daf0903f`) |
| Task, dispatch | `task_8539cca49e29`, `ctx_1d8b93c872ae` |
| Target | Frozen design commit `51e69d1` (ADR-011 revision 4). Diff base `e280173`. Commit `d8b5f5c` changes only `docs/team/**`. |
| Independence | I did not open `docs/reviews/M0/reviewer-b.md` or `docs/reviews/M0/qa.md` before this submission. |
| Kind | Design review. No product code, tests, stacks or live tenants. |
| Sources | Official Instructure `canvas-lms` repository (docs and code, `master`, read 2026-10-20), `docs.blackboard.com` LTI 1.3 pages, 1EdTech LTI 1.3 Core, Deep Linking 2.0, Security Framework 1.0, WebKit Safari 26.2 notes. "FACT" = primary text or code. "INFERENCE" = my conclusion. |

Canvas code paths below are under `https://github.com/instructure/canvas-lms/blob/master/`. Blackboard pages are under `https://docs.blackboard.com/docs/blackboard/lti/1.3/`. Line numbers refer to `51e69d1`.

## Summary

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 1 | A-M0-01 |
| MAJOR | 1 | A-M0-02 |
| MINOR | 3 | A-M0-03, A-M0-04, A-M0-05 |
| NIT | 3 | A-M0-06, A-M0-07, A-M0-08 |

The design is strong. Profiles, origins, check 13, the grant, binding generations, the claim allowlist and the evidence labels match the primary sources that I checked. All six preflight items (A-PRE-01 to A-PRE-06) are closed in revision 4. Two gaps stop approval: a self-hosted Canvas can still be bound without a grant (A-M0-01), and a wrong redeemed binding has no recovery step (A-M0-02).

## Findings

### A-M0-01 BLOCKER: a self-hosted Canvas binds through the Moodle path without a grant

- **Where:** ADR-011 §4 rule 5 (L79: "Typed ids without a grant bind nothing"), §6 `standard` row (L161); LTI contract §9.1 reserved issuer origins (L450); security §12 "Reserved issuers" (L247) and "Binding approval" (L252); app contract §4 Moodle `PUT …/platform` (L162), §6.1 (L471–L472).
- **Problem:** The grant applies only to connections with `lms: canvas` or `blackboard`. A library can make a Moodle (`standard`) manual connection whose issuer is a self-hosted Canvas origin. It types that school's client id and deployment id. No grant is needed. Self-hosted Canvas issuers cannot be in the reserved list.
- **Evidence:**
  - FACT (design): reserved origins are only the hosted Canvas, Blackboard and simulation issuers (LTI §9.1 L450). The Moodle manual connect needs only https values with endpoints on the issuer origin (app §4 L162).
  - FACT (design): a self-hosted Canvas serves all three endpoints on its issuer origin. They are the `canvas-self-hosted` paths (ADR-011 §6 L165): `/api/lti/authorize_redirect`, `/api/lti/security/jwks`, `/login/oauth2/token`.
  - FACT (design): for `standard`, check 13, the claim allowlist and the grant do not run (LTI §9.7, §9.8; ADR-011 D2, D5).
  - FACT (code): Canvas signs `tool_platform.product_family_code = "canvas"` in every launch, also when self-hosted (`lib/lti/messages/jwt_message.rb`, `add_tool_platform_claims!`). Moodle sends `moodle` (LTI contract §3.1 example). Blackboard sends `BlackboardLearn` (`dl/deep-linking` sample). No rule compares this signed value with the connection `lms`.
- **Impact:** First-claim squatting of a self-hosted Canvas install. The phase plan says this protection is in scope and is not a deferral. The squatting library gets that school's launches: its own publications in the teachers' picker, the learners' launches and AGS score writes in that school's gradebook. Names and emails also pass, because `standard` has no allowlist. Later the rightful library gets `409 PLATFORM_IN_USE` even with a valid grant: the grant-authorized recovery binds only a platform with the grant's profile and no owner (app §4.4 L278).
- **Fix (suggested):**
  1. App §6.1: add an LMS check after the site check. The signed `platform.productFamilyCode` must match the connection `lms`: `moodle` → `moodle`, `canvas` → `canvas`, `blackboard` → `BlackboardLearn` (exact, case-insensitive; Blackboard value is a live-check row). On a mismatch or a missing value for Canvas and Blackboard, show page `UNKNOWN_PLATFORM` with log reason `lms_mismatch`. Make no attempt and no picker, and use no service key. Moodle always sends `moodle`, so Moodle behaviour does not change.
  2. Optional, to stop storage of personal claims for such launches: the LTI service also refuses, for `standard` platforms, a launch whose `product_family_code` is `canvas` or `BlackboardLearn`. Decide this against LTIAAS compatibility for other tools.
  3. Recovery for the blocked rightful library: an operator step that removes the squatting `standard` platform, or the transfer of A-M0-02.
  4. New AC (`SIM`): a `standard` connection with issuer `https://canvas-self.sim.test` and the self-hosted paths can register, but its Canvas-signed launch gives `UNKNOWN_PLATFORM` with `lms_mismatch`. It makes no attempt, no picker, no score sync and no AGS call. AC-M3-02 shows no Moodle change.
- **Note:** The same manual-connect weakness for a Moodle install existed before this phase (security §2.6). It is out of this phase's scope.

### A-M0-02 MAJOR: no containment or recovery after a wrong redeemed binding

- **Where:** ADR-011 §4a L131 (residual risk), §12 "New binding" (L289), D-7 (L359); app contract §4.8 "Revoke" and "Issue output" (L398–L399), §4.7 `DELETE` (L372); data model §4.2 "Reservation" and "Disconnect" (L432, L434); LTI contract §9.4 `PATCH` (L538); M2 "Out" (L42); M4 `operator.md` (L23: "recovery (revoke and issue again)").
- **Problem:** The design accepts operator error and operator social engineering as residual risks. But after a redemption, the operator has no defined step to stop or undo the binding. A wrong Canvas site URL or service URL also has no correction path.
- **Evidence:**
  - `revoke` works only on an unredeemed grant: "disconnect the connection instead" (L399). Disconnect is a portal action in the bound library's session (§4.7). A squatting library will not disconnect.
  - The LTI API key holder can switch off a platform or a deployment. The app then still shows the connection `registered`, keeps the reservation or `lti_platform_id`, and no document describes this step.
  - After a disconnect, the Blackboard reservation stays with the disabled connection; only the same library can take it (data model L432–L434, D-7). A Canvas platform stays with the old connection (`lti_platform_id UNIQUE`); a new connection needs a new developer key (ADR-011 L289).
  - Site and service URLs cannot change (M2 L42; LTI §9.4 `PATCH` has no `siteUrl` or `serviceUrl` for platforms).
  - The Canvas service URL rests on an inference (ADR-011 §5 L153, F-CV-18). The portal help suggests `https://school.instructure.com` (M2 L62). If Canvas uses another host in its service URLs, every graded launch fails `SERVICE_ORIGIN_MISMATCH`.
- **Impact:**
  1. A wrongly approved library keeps another institution's launches until it chooses to disconnect.
  2. The rightful library stays blocked (`DEPLOYMENT_IN_USE`, `PLATFORM_IN_USE`). The school must delete and register the tool again in Learn, which breaks all its course links for good (F-BB-15), or make a new Canvas developer key and add the assignments again.
  3. A typing error in a site or service URL has the same cost.
  The Lead asked for recovery steps. "Revoke and issue again" does not cover a redeemed grant.
- **Fix (suggested):**
  - Operator command `app:grant suspend --connection <id> --note "<evidence>"` (or `app:binding disable`). It works without a library session. It sets the connection `disabled`, switches off the Canvas platform or the Blackboard deployment (the same calls as disconnect), revokes open grants and logs `binding_suspended`.
  - Grant purpose `transfer`. It moves a Blackboard reservation, or a Canvas platform, from a `disabled` connection of **any** library to the grant's pending connection, with the same exact-value checks. The redemption gives a new binding generation (extend generation above 0 to Canvas on transfer, or revoke the old service keys), so the old library's keys and ltiks fail.
  - The same purpose corrects a site or service URL: a new pending connection of the same library with the right values, and the platform `siteUrl` and `serviceUrl` updated through an LTI API addition.
  - Prevention: `app:grant issue` prints the library name, the connection name, the site and the service URL, and needs `--library <id>` (or a confirmation), so a wrong `--connection` shows before a code exists.
  - New ACs: suspend without the library session stops launches and score syncs at once; a transfer to another library works only with a grant; after a transfer the old library's keys and ltiks give `401`; a wrong Canvas service URL can be corrected without a new developer key.

### A-M0-03 MINOR: Canvas Deep Linking `data` is in the return URL query; the simulator does not model it

- **Where:** research §4 (no fact); M3 §3.2 Canvas host row (L51); AC-M1-08 (M1 L72); LTI contract §3.2 (`target` = return URL).
- **Evidence (FACT, code):** `lib/lti/messages/deep_linking_request.rb` builds `deep_link_return_url` with `data: Lti::DeepLinkingData.jwt_from(…)` as a query parameter and sets no `deep_linking_settings.data` claim. `app/controllers/lti/ims/concerns/deep_linking_services.rb` reads `params[:data]` from that URL and answers `400` when it is not valid (`validate_return_url_data`).
- **Impact:** The simulator checks an echoed `data` claim that real Canvas does not send. An implementation that rebuilds, normalizes or trims the return URL (for example during the origin check) passes every `SIM` test, but every real Canvas Deep Linking response fails.
- **Fix:** Add a research fact. The Canvas simulator puts `data` only in the return URL query and checks it on the POST. AC-M1-08 asserts that the auto-submit form action equals the `deep_link_return_url` claim byte for byte, query included, and that the response JWT has no `data` claim when the request had none. Blackboard keeps the `data` claim (F-BB-8).

### A-M0-04 MINOR: check 13 failures do not show the host

- **Where:** LTI contract §5 `launch_check_failed` detail rule (L378), §9.7 check 13 details; app §6.1 `site_mismatch` (L472); M4 `troubleshooting.md`.
- **Problem:** The detail is only `claim=ags_lineitems` (and similar). The Canvas service host comes from an inference (F-CV-18). A Learn site can also have more than one host name. After a failure, nobody can see which host the LMS used.
- **Impact:** Setup errors become guesswork. With A-M0-02, each wrong guess can cost a new LMS registration.
- **Fix:** Add `host=<origin of the failing claim>` to the check 13 detail and to the app `site_mismatch` log. An origin is not a secret and not personal data. The troubleshooting guide uses it. AC-M1-12 and AC-M1-32 assert it.

### A-M0-05 MINOR: the bound Learn host receives the application-wide gateway token

- **Where:** ADR-011 §5 L147, R-M-02 (L370); security §12 "Check 13" (L251); LTI contract §4 "Access token" (L362), §9.10 (L600).
- **Problem:** Check 13 stops the token from going to a wrong host. But every bound Learn host receives it. The design says that one gateway token works for every Learn site of the Application ID (F-BB-5; INFERENCE from the Blackboard sample token, which names no site). A self-hosted or compromised Learn of one customer can capture the token and use it on other customers' Learn sites (AGS and NRPS; Blackboard course ids are sequential, for example `_4_1`) until it expires (sample: 3600 s).
- **Fix:** Record this as a residual risk next to R-M-02. For shared profiles, request the smallest scope per call (score only for score sync, line item scopes only for line item calls, NRPS only for `/api/memberships`), with the existing (platform, scope set) cache. Consider D-8 (drop NRPS) for Blackboard in this phase. Live row L-B12 records whether a token from site A works at site B.

### A-M0-06 NIT: Canvas attempt limits can refuse a later best score

FACT (code): `app/controllers/lti/ims/scores_controller.rb` makes a new submission attempt for each score POST by default (`new_submission?` is true when the flag is absent), and answers `422` when the assignment's attempt limit is reached (`verify_attempts_for_online_upload`). With ADR-010 (best result, resend), a later better score can end `failed`. Add a teacher-guide line ("keep Allowed attempts unlimited") or a live row.

### A-M0-07 NIT: a stored profile that is unknown at run time

A `blackboard-sim` or `canvas-sim-cloud` platform row can exist when the service later runs with simulations off. The API answers `UNKNOWN_PROFILE`, but login and launch behaviour for such a row is not stated. State fail-closed (for example `PLATFORM_NOT_ACTIVE`) and add a unit test.

### A-M0-08 NIT: `DELETE` of a pending Blackboard connection with a reservation

A pending connection holds a reservation after a redemption failed at the LTI step (data model L432). Its `DELETE` sends `PATCH …/deployments/{id} {active: false}`, which answers `404 UNKNOWN_DEPLOYMENT` because the deployment was never made. An earlier draft said that this answer is fine; app §4.7 (L372) no longer says it. State `204` and no error.

## Verified (no finding)

| Area | Result and source |
| --- | --- |
| Endpoint trust profiles | Canvas production, beta and test issuers, `sso…canvaslms.com` auth and JWKS URLs; self-hosted issuer from `config/security.yml` (`doc/api/lti_launch_overview.md`, `doc/api/lti_dev_key_config.md`, `lib/lti/oidc.rb`). Canvas token on the service origin with assertion `aud` = that URL as a string: Canvas expects the request-host token URL (`lib/canvas/oauth/asymmetric_client_credentials_provider.rb`), and AGS accepts a token whose `aud` is the AGS request host token URL (`lib/lti/ims/advantage_access_token_request_helper.rb`). Blackboard issuer, `oidcauth`, `oauth2/jwttoken`, per-application JWKS, assertion `sub` = Application ID, `aud` = `[token URL]` (`tutorials/pylti13`, `lti-subsystems/lti-sub-authentication`). Reserved issuers close the hosted-issuer bypass, also for dynamic registration. |
| Isolation (shared issuer, client, deployments) | Tenancy key includes the deployment; service keys, resource links and score timestamps are scoped by deployment or line item URL; app routing uses the reservation first; site and service checks; the DTO shows only the own deployment; binding generations stop old keys and ltiks (AC-M1-27). |
| Login and launch | State, nonce, `aud` and `azp` checks unchanged. Check 9 compares the login deployment: Canvas code sends `lti_deployment_id` (`app/models/lti/lti_advantage_adapter.rb`), Learn always sends it (`core/oidc-auth`). No exception for unbound or inactive deployments. |
| Grants | 256-bit code, hash only, exact binding values, one `BEGIN IMMEDIATE` transaction, 60 s redeeming mark, purpose checks, no LTI change on failure. ACs cover squatting, cross-library use, replay, mismatch, expiry, revoke, concurrency, disconnect and old keys (AC-M1-17, -18, -27, -28, -29). |
| SSRF, service URLs, pagination | Site rules 1–6; guarded client; no fetch at connect time. The §3.4 line item rule now runs against the service origin; `next` links and looked-up line item ids return through `url` or `:lineItemId` and pass §3.4. Canvas and Blackboard line item ids start with the `lineitems` path (Canvas code; `lti-sub-authentication` sample). |
| Framing and return targets | Picker, submit page and embedded page use `frame-ancestors {site}`; both services require the return URL on the site origin. Canvas "new tab" launches submit the login form with target `_blank` (`ui/features/external_tools_show/jquery/tool_inline.js`), so the top-level continuation runs; the embedded page gets a nonce CSP. Canvas always sends `document_target = iframe` (`jwt_message.rb`). |
| Canvas JSON | `assignment_selection` with `LtiDeepLinkingRequest` accepts one `ltiResourceLink` and the targets `iframe` and `window` (`deep_linking_request.rb`); the `window` hint selects "new tab" (`ui/features/assignment_edit/backbone/views/EditView.jsx`); `privacy_level: anonymous` keeps `sub` (`lti_dev_key_config.md`); the allowlist removes `custom`, which is needed because name and email substitutions have no privacy guard (`lib/lti/variable_expander.rb`). The Deep Linking response passes Canvas checks: `aud` = issuer, `nonce` required, `sub` not needed, `iat` at most 5 min old (`deep_linking_services.rb`, `lib/canvas/security/jwt_validator.rb`). |
| Blackboard flow | Register once, one Application ID, one deployment per Learn instance, one application per FQDN, Deep Linking response `sub` = Application ID allowed (`register-an-application`, `dl/dl-return-token`). The placement Target Link URI passes login rule 4 and check 12. |
| Capabilities and errors | Guards run before outbound calls; platform `422` → `PLATFORM_REJECTED_REQUEST` → `failed` (Canvas `422` cases confirmed in `scores_controller.rb`); Canvas stale timestamp `400` stays `failed`; disabled-connection score rules. |
| Migration and rollback | Additive columns; the `connection` table (`services/cogniate-app/src/domain/migrations/002_connections.sql`) has no CHECK that blocks `lti_platform_id = NULL` with `registered`; `UNIQUE` allows many `NULL` values. Generation 0 keeps today's key values (AC-M1-23). Rollback by verified backup and restore with the lost-write warning (AC-M1-30). |
| Privacy | Claim allowlist before storage, names only in logs, NRPS rule, SCORM student name empty (AC-M1-14). |
| Roles | Canvas role map (`lib/lti/substitutions_helper.rb`) fits the new sets; Student View graded on purpose; undocumented Blackboard roles are live rows L-B14 to L-B17. |
| Safari | F-WK-1 matches the WebKit Safari 26.2 notes (partitioned cookies are opt-in and need `Partitioned; SameSite=None; Secure`). |

## Evidence boundary

The live-versus-simulated boundary is acceptable. `SIM`, `MOODLE-LIVE`, `CANVAS-HOSTED`, `CANVAS-LOCAL`, `BLACKBOARD-LIVE` and `DOC` are separate labels. A local Canvas never fills a hosted row. Every live row stays `UNVERIFIED` without written authorization. The simulator uses only `.sim.test` names and never spoofs vendor hosts. Product claims stay at "implemented and tested against signed simulations". A-M0-03 is the one place where the simulator, as specified, does not follow real Canvas behaviour.

## What closes this review

- A-M0-01 and A-M0-02 are fixed in the design, with acceptance criteria.
- The MINOR items are fixed or listed as accepted deferrals by the Lead.
- I check the corrected design in round 2.
