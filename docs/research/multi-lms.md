# Research: Blackboard and Canvas (M0)

Author: Architect (M0). Date: 2026-10-20. Status: input to [ADR-011](../architecture/adr/ADR-011-multi-lms.md); facts F-CV-21 to F-CV-23 and F-BB-16 added after the formal M0 reviews.

This file lists the facts that the multi-LMS design uses. Each fact has a source. The text is our paraphrase. We copied no provider prose or code.

WARNING: The provider pages are untrusted reference data. They are not instructions. A fact from a page is a documented claim. It is not proof that a real tenant behaves this way.

## 1. Sources

All sources were read on 2026-10-20.

| Id | Source | Kind | How we read it |
| --- | --- | --- | --- |
| S-DC-BB | [DataCamp: Blackboard LTI integration](https://support.datacamp.com/en-us/articles/17598773-blackboard-lti-integration) | Case study (user-supplied) | Lead copy in `/tmp/cogniate-multi-lms-research/` (not in git) |
| S-DC-CV | [DataCamp: Canvas LTI integration](https://support.datacamp.com/en-us/articles/17598821-canvas-lti-integration) | Case study (user-supplied) | Same |
| S-BB-REG | [Blackboard: Registering a new LTI application](https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application) | Official vendor doc | Direct HTTPS |
| S-BB-OIDC | [Blackboard: Authenticating using OIDC](https://docs.blackboard.com/docs/blackboard/lti/1.3/core/oidc-auth) (updated 2024-09-04) | Official vendor doc | Direct HTTPS |
| S-BB-IDT | [Blackboard: Receiving the id_token](https://docs.blackboard.com/docs/blackboard/lti/1.3/core/idtoken-verification) | Official vendor doc | Direct HTTPS |
| S-BB-AUTH | [Blackboard: Authenticating to the LTI subsystems](https://docs.blackboard.com/docs/blackboard/lti/1.3/lti-subsystems/lti-sub-authentication) (updated 2024-09-26) | Official vendor doc | Direct HTTPS |
| S-BB-DL | [Blackboard: Deep Linking 2.0](https://docs.blackboard.com/docs/blackboard/lti/1.3/dl/deep-linking), [return token](https://docs.blackboard.com/docs/blackboard/lti/1.3/dl/dl-return-token), [content types](https://docs.blackboard.com/docs/blackboard/lti/1.3/dl/dl-types) (updated 2024-09-25) | Official vendor doc | Direct HTTPS |
| S-BB-BP | [Blackboard: Best practices](https://docs.blackboard.com/docs/blackboard/lti/1.3/best-practices) (updated 2024-09-04) | Official vendor doc | Direct HTTPS |
| S-BB-PY | [Blackboard: PyLTI1.3 tutorial](https://docs.blackboard.com/docs/blackboard/lti/1.3/tutorials/pylti13) | Official vendor doc | Direct HTTPS |
| S-CV-LAUNCH | [Canvas: LTI launch overview](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_launch_overview) | Official vendor doc | The published host refused connections from our network. We read the same file in Instructure's official repository: [`doc/api/lti_launch_overview.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_launch_overview.md) |
| S-CV-KEY | [Canvas: Manually configuring LTI Advantage tools](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config) | Official vendor doc | Repository file [`doc/api/lti_dev_key_config.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_dev_key_config.md) |
| S-CV-DL | Canvas: Deep Linking, assignment selection and link selection placements | Official vendor doc | Repository files [`content_item.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/content_item.md), [`assignment_selection_placement.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/assignment_selection_placement.md), [`link_selection_placement.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/link_selection_placement.md) |
| S-CV-OAUTH | Canvas: OAuth2 and LTI Advantage service access | Official vendor doc | Repository files [`oauth.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/oauth.md), [`oauth_endpoints.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/oauth_endpoints.md) |
| S-CV-DR | Canvas: Registering an LTI tool (Dynamic Registration) | Official vendor doc | Repository file [`registration.md`](https://github.com/instructure/canvas-lms/blob/master/doc/api/registration.md) |
| S-CV-CODE | Canvas source code (master, read 2026-10-20): [`lib/lti/messages/jwt_message.rb`](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/jwt_message.rb), [`lib/lti/messages/deep_linking_request.rb`](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/deep_linking_request.rb), [`lib/lti/ims/advantage_access_token_request_helper.rb`](https://github.com/instructure/canvas-lms/blob/master/lib/lti/ims/advantage_access_token_request_helper.rb), [`app/controllers/lti/ims/scores_controller.rb`](https://github.com/instructure/canvas-lms/blob/master/app/controllers/lti/ims/scores_controller.rb), [`app/models/lti/lti_advantage_adapter.rb`](https://github.com/instructure/canvas-lms/blob/master/app/models/lti/lti_advantage_adapter.rb) | Official vendor code | Read for behaviour that the docs do not state; Reviewer-A also cited `lib/lti/substitutions_helper.rb` and the assignment edit UI. Code on `master` can differ from a tenant's release. |
| S-LTI | [1EdTech LTI 1.3 Core](https://www.imsglobal.org/spec/lti/v1p3) | Standard | Direct HTTPS |
| S-SEC | [1EdTech Security Framework 1.0](https://www.imsglobal.org/spec/security/v1p0) | Standard | Direct HTTPS |
| S-DL | [1EdTech Deep Linking 2.0](https://www.imsglobal.org/spec/lti-dl/v2p0) | Standard | Direct HTTPS |
| S-WK | [WebKit: features for Safari 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) (2025-12-12) | Browser vendor release notes | Direct HTTPS |
| S-AGS, S-NRPS, S-CS | [AGS 2.0](https://www.imsglobal.org/spec/lti-ags/v2p0), [NRPS 2.0](https://www.imsglobal.org/spec/lti-nrps/v2p0), [LTI OIDC login with client-side postMessages](https://www.imsglobal.org/spec/lti-cs-oidc/v0p1) | Standards | Used as in T0; the Canvas and Blackboard pages link to them |

## 2. Standards facts that drive the design

| Id | Fact | Source |
| --- | --- | --- |
| F-STD-1 | A tool must accept many deployments under one `client_id`. A platform makes one immutable `deployment_id` for each deployment. Tools often use the deployment as the customer account key. | S-LTI §3.1.3, §3.1.3.1 |
| F-STD-2 | `deployment_id` is unique only inside one issuer. It is at most 255 ASCII characters. | S-LTI §5.3.3 |
| F-STD-3 | One issuer can host many platform instances (multi-tenancy). `tool_platform.guid` names the instance. | S-LTI §5.4.2 |
| F-STD-4 | If the login request has `lti_deployment_id`, it must equal the `deployment_id` claim of the launch that follows. | S-LTI §4.1.2 |
| F-STD-5 | Role values are URIs; vendors should use the full URIs. Simple context role names (for example `Instructor`) are deprecated, and implementations may recognize them. Context roles (`membership#…`), institution roles (`institution/person#…`) and system roles (`system/person#…`) are separate vocabularies. A sub-role should come with its principal role. | S-LTI Appendix A.2 |
| F-STD-6 | A Deep Linking content item can carry `window` (with `targetName`) or `iframe` as presentation hints. | S-DL §3.1, §3.2 |
| F-STD-7 | When cookies are not possible, the client-side postMessage storage (`lti_storage_target`) is the standard fallback. | S-CS |
| F-STD-8 | Every message between platform and tool carries the `deployment_id` and the `client_id`. So these ids are not secrets: launch tokens pass through the user's browser. | S-LTI §3.1.3 |

## 3. Blackboard facts

| Id | Fact | Source |
| --- | --- | --- |
| F-BB-1 | The tool vendor registers the tool once in the Blackboard Developer Portal. Institutions do not register it there. | S-BB-REG, S-BB-BP |
| F-BB-2 | The Application ID is the OIDC `client_id`. The same id goes to every institution. Each Learn deployment gets its own Deployment ID. Issuer, client id and deployment id together identify one institution agreement. | S-BB-REG, S-BB-BP |
| F-BB-3 | The issuer is always `https://blackboard.com`. | S-BB-REG, S-BB-DL |
| F-BB-4 | OIDC auth endpoint: `https://developer.blackboard.com/api/v1/gateway/oidcauth`. Token endpoint: `https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken`. Platform JWKS: `https://developer.blackboard.com/api/v1/management/applications/{application id}/jwks.json`. | S-BB-PY, S-BB-AUTH |
| F-BB-5 | The client assertion uses `sub` = Application ID and `aud` = the token endpoint. The page shows `aud` as an array of strings. One bearer token works for AGS and NRPS. | S-BB-AUTH |
| F-BB-6 | AGS and NRPS URLs are on the Learn instance host (for example `https://<school>.blackboard.com/learn/api/v1/lti/...`), not on the issuer host. | S-BB-AUTH, S-BB-DL |
| F-BB-7 | The Deep Linking return URL is on the Learn host (for example `/webapps/blackboard/controller/lti/v2/deeplinking`). The DL request in the sample accepts `ltiResourceLink` and `link`, many items, and `iframe` and `window` targets. | S-BB-DL |
| F-BB-8 | Learn requires these claims in the Deep Linking response: `iss` (Application ID), `aud` (`https://blackboard.com`), `sub`, `iat`, `exp`, `deployment_id`, `message_type`, `version`, `data` (unchanged) and `content_items`. | S-BB-DL return token |
| F-BB-9 | Learn sends `iss`, `login_hint`, `target_link_uri`, `lti_message_hint`, `lti_deployment_id`, `client_id` and `lti_storage_target` to the login URL. The docs say Learn always sends the deployment id and the client id. | S-BB-OIDC |
| F-BB-10 | The Developer Portal entry needs: domain (FQDN), login initiation URL, tool redirect URL (one is recommended), tool JWKS URL, signing algorithm (RS256 or RS512), custom parameters, and placements. Two applications cannot share one FQDN. | S-BB-REG |
| F-BB-11 | Placement types include Deep Linking (option "Allow student access") and Course Content (option "Can be graded"). The vendor defines placements in the Developer Portal. The placement target link URI is for routing only. | S-BB-REG |
| F-BB-12 | A Learn admin registers the tool in Admin > LTI Tool Providers with the Application ID. After the second submit, Learn shows the Deployment ID. | S-BB-REG |
| F-BB-13 | Learn verifies a Deep Linking response and a client assertion with the tool JWKS URL. So Learn must reach that URL. | S-BB-DL, S-BB-AUTH |
| F-BB-14 | The sample launch carries `name`, `given_name`, `family_name`, `email`, a `lis` claim, `tool_platform.url` (the Learn host) and a vendor claim `https://blackboard.com/lti/claim/one_time_session_token`. | S-BB-DL |
| F-BB-15 | Deleting a registered tool or placement in Learn breaks all its course links for good. | S-BB-REG |
| F-BB-16 | The sample launch signs `tool_platform.product_family_code = "BlackboardLearn"`. Only this sample shows the value; the live matrix records the real value (L-B18). | S-BB-DL |

## 4. Canvas facts

| Id | Fact | Source |
| --- | --- | --- |
| F-CV-1 | All Instructure-hosted Canvas instances use one issuer per environment: `https://canvas.instructure.com` (production), `https://canvas.beta.instructure.com` (beta), `https://canvas.test.instructure.com` (test). | S-CV-LAUNCH |
| F-CV-2 | Self-hosted Canvas must change its issuer to its own host. The default is `https://canvas.instructure.com`. | S-CV-LAUNCH |
| F-CV-3 | OIDC auth endpoint per environment: `https://sso.canvaslms.com/api/lti/authorize_redirect` (beta: `sso.beta.canvaslms.com`, test: `sso.test.canvaslms.com`). The old host `canvas.instructure.com` still works for now. | S-CV-LAUNCH |
| F-CV-4 | Platform JWKS per environment: `https://sso.canvaslms.com/api/lti/security/jwks` (beta and test hosts as above). One key set serves all accounts. | S-CV-KEY |
| F-CV-5 | The client credentials token endpoint is `https://<canvas domain>/login/oauth2/token`. The client assertion has `sub` = the developer key id and `aud` = that token URL (the docs also allow the OIDC auth host as `aud`). The code accepts a token whose `aud` is the token URL of the AGS request host, or a global grant host. | S-CV-OAUTH, S-CV-CODE |
| F-CV-6 | Login initiation carries `iss`, `login_hint`, `target_link_uri`, `client_id`, a deployment id, `canvas_region` and `canvas_environment`. With platform storage support it also carries `lti_storage_target`. The docs table names the deployment parameter `deployment_id`; the code sends `lti_deployment_id`. | S-CV-LAUNCH, S-CV-CODE |
| F-CV-7 | The developer key JSON has `title`, `description`, `oidc_initiation_url`, `target_link_uri`, `scopes`, `extensions` (with `domain`, `tool_id`, `platform`, `privacy_level`, `settings.placements`), `public_jwk` or `public_jwk_url`, and `custom_fields`. Privacy levels: `anonymous`, `name_only`, `email_only`, `public`. | S-CV-KEY |
| F-CV-8 | The developer key can hold an inline `public_jwk` instead of `public_jwk_url`. | S-CV-KEY |
| F-CV-9 | `assignment_selection` with `LtiDeepLinkingRequest` creates an assignment. Only one LTI link returns at a time. A `lineItem` with `scoreMaximum` sets the points. `title` or `lineItem.label` sets the name. | S-CV-DL |
| F-CV-10 | `link_selection` with `LtiDeepLinkingRequest` creates a module item. Only `assignment_selection`, `course_assignments_menu` and `module_index_menu_modal` make assignments from line items. | S-CV-DL |
| F-CV-11 | The docs list for `ltiResourceLink` omits `window`, but the code honours `window.targetName: "_blank"`: the assignment opens in a new tab. `assignment_selection` accepts the targets `iframe` and `window`. | S-CV-DL, S-CV-CODE (and the assignment edit UI, per Reviewer-A) |
| F-CV-12 | Canvas enforces domain and URL matching for returned LTI links. The JSON `domain` field sets the domain. | S-CV-DL |
| F-CV-13 | The tool resource page opens in an iframe unless the tool or link is set otherwise. Safari blocks third-party cookies there; platform storage is the fallback. | S-CV-LAUNCH |
| F-CV-14 | A developer key can have many deployments. The deployment id shows after the admin installs the tool by client id. | S-CV-KEY |
| F-CV-15 | Canvas supports 1EdTech Dynamic Registration through a registration URL. Its OpenID configuration `issuer` is the global issuer. | S-CV-DR |
| F-CV-16 | Canvas can add the scope `https://canvas.instructure.com/lti/public_jwk/scope/update` for key rotation by API. It is optional. | S-CV-KEY |
| F-CV-17 | Canvas always sends `launch_presentation.document_target = "iframe"`, also for a link that opens in a new tab. | S-CV-CODE |
| F-CV-18 | Canvas builds AGS and NRPS URLs (and line item ids) on the root account's environment-specific domain, but the Deep Linking return URL on the host of the browser request. So one launch can carry two hosts. INFERENCE: on hosted Canvas the environment-specific domain is the root account's primary domain for that environment (its resolver is in closed code). | S-CV-CODE |
| F-CV-19 | A score with a timestamp older than the stored result gets `400`. A user who is not a student in the course, and some other score errors, get `422`. | S-CV-CODE |
| F-CV-20 | Canvas Student View (test student) launches with `membership#Learner` and `http://purl.imsglobal.org/vocab/lti/system/person#TestUser`; Canvas keeps test-student grades. | S-CV-CODE (per Reviewer-A, `lib/lti/substitutions_helper.rb`) |
| F-CV-21 | Canvas puts the Deep Linking `data` value in the **query of `deep_link_return_url`** (a signed `data` parameter), not in a `deep_linking_settings.data` claim. On the return POST, Canvas reads `data` from that URL and refuses a missing or wrong value. So the tool must post to the return URL exactly as received. | S-CV-CODE (`deep_linking_request.rb` `deep_link_params`; per Reviewer-A also `deep_linking_services.rb`) |
| F-CV-22 | Canvas signs `tool_platform.product_family_code = "canvas"` in every launch, also on a self-hosted instance (the value is in the code, not in configuration). | S-CV-CODE (`jwt_message.rb`) |
| F-CV-23 | By default each score POST makes a new submission attempt, and Canvas answers `422` when the assignment's attempt limit is reached. | S-CV-CODE (per Reviewer-A, `scores_controller.rb`) |

## 4a. Browser facts

| Id | Fact | Source |
| --- | --- | --- |
| F-WK-1 | Safari 26.2 supports partitioned cookies (CHIPS) again; they are opt-in with `Partitioned; SameSite=None; Secure`. Safari 18.4 had them, 18.5 removed them. Safari still blocks cross-site cookies that are not partitioned. So Safari behaviour in an LMS frame depends on the version and the settings. | S-WK |

## 5. The two case studies

The cases show how one vendor guides admins, teachers and learners. They are not a specification.

### 5.1 What the cases confirm

| Item | Blackboard case | Canvas case | Matches the official docs |
| --- | --- | --- | --- |
| Registration | Admin enters the vendor client id in "Register LTI 1.3 Tool", compares the shown values, sends back the Deployment ID. | Admin makes an LTI developer key, installs the app by client id, sends back client id, deployment id and the Canvas URL. | Yes (F-BB-12, F-CV-14) |
| Teacher flow | Ultra: Course Content, then "+", then Content Market. Original: Build Content. A picker opens in an iframe. | New assignment, submission type "External Tool", then the tool. The picker runs in an iframe. | Yes (F-BB-11, F-CV-9) |
| Learner flow | Launch opens the vendor site. | Teacher selects "Load in New Tab". | Canvas honours a `window` hint from the tool (F-CV-11), but it still sends `document_target = iframe` (F-CV-17). |
| Grades | AGS on completion. | AGS on completion. | Yes |
| Dynamic registration | Not used. | Not used. | Canvas supports it (F-CV-15). |

### 5.2 Case-specific choices that we do not copy

| DataCamp choice | Our decision | Why |
| --- | --- | --- |
| Just-in-time product accounts for learners | Not adopted. Learners stay pseudonymous LTI `sub` values. | Spec §7.5 and Q3: no learner accounts in Cogniate. |
| Canvas privacy level `public`; names and emails shared | Not adopted. Our Canvas JSON sets `anonymous`. The LTI service removes personal claims from Canvas and Blackboard launches. | Q3 default `anonymous`. A platform admin can still turn on more fields, so the service enforces it too. |
| Completion always sends 100/100 | Not adopted. ADR-010 stays: final outcomes only, real score, best result. | ADR-010 and Q4. |
| Collect the Canvas client secret | Not adopted. The API refuses a secret field. | LTI 1.3 service access uses a signed client assertion (F-CV-5). No secret is needed. |
| Canvas module items (`link_selection`) next to assignments | Not adopted in this phase. Only `assignment_selection`. | Module items have no grade column (F-CV-10); our grade policy needs one (ADR-011 §8, D-11). The Canvas case also uses assignments only. |
| Extra Blackboard redirect URL `…/blackboard/proxy` | Not adopted. See §5.3. | Not required by the standards or the Blackboard docs. |
| Scope `public_jwk/scope/update` | Not requested. | Optional (F-CV-16). We publish a JWKS URL instead. |
| Placement size 1000 × 1300 | Not copied. | Product layout choice. |
| DataCamp client id, hosts and endpoints | Never used in our configuration, tests or docs. | Charter §7 and the phase plan. |

### 5.3 Is a Blackboard redirect proxy necessary?

No. The facts:

1. Blackboard recommends one tool redirect URL and calls the tool a router behind it (F-BB-10).
2. The OIDC flow is the standard third-party login. The tool keeps its state in a cookie or, without cookies, in platform storage (F-BB-9, F-STD-7).
3. Our state cookie is `SameSite=None; Secure; HttpOnly; Partitioned` (security §3). The cross-site form POST from Learn carries it in a top-level window. In an iframe, the cookie is partitioned under the Learn site, and Chromium sends it back in the same partition (tested for Moodle). Safari 26.2 supports partitioned cookies again (F-WK-1); older versions and strict settings can still block it.
4. A proxy hop would add a second redirect target. That is one more place for an open redirect or a token relay.

So we register exactly one redirect URI, `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}`, for every LMS. Browsers that block the partitioned cookie stay a documented, version-dependent limit (R4, follow-up D-4: platform storage).

## 6. Consequences for our design (summary)

| Topic | Consequence | Where |
| --- | --- | --- |
| Shared issuers | Canvas cloud and Blackboard put many customers under one issuer. The issuer alone never selects a tenant. | ADR-011 §3 |
| Blackboard tenancy | One shared registration (one client id for all schools). Tenants are deployments. | ADR-011 §4 |
| Binding approval | Ids are not secrets (F-STD-8). Every new Canvas or Blackboard binding needs a one-time operator approval grant (Lead decision). | ADR-011 §4a |
| Canvas tenancy | One developer key per school (client id per school). Inherited global keys are a bounded unsupported case. | ADR-011 §4 |
| Origins | The LMS site origin (pages, return URLs) differs from the issuer and from the auth, JWKS and token hosts. Canvas can also put its services on another host than its pages (F-CV-18). | ADR-011 §5 |
| Trust | Endpoints come from fixed, reviewed provider profiles. | ADR-011 §6 |
| Live checks | Blackboard must reach our JWKS URL (F-BB-13), so a live Blackboard check needs a public HTTPS host. Canvas can use an inline key (F-CV-8), so a local stack can work with a real Canvas, if a tenant exists. | ADR-011 §13, [M3 live matrix](../architecture/tasks/M3.md#5-live-check-matrix) |
