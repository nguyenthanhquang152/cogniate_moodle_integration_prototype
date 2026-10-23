# LA-ADR-08: Self-serve onboarding and connection health

Status: **Proposed** (P2 design, Architect-2 A2, 2026-10-22). Epic: E6 — **every item in this ADR is Could** (plan v1 §3). Owner: A2. Consistency owner: A1.
Inputs: [plan v1 §3 E6](../../../team/ltiaas/plan.md#e6-self-serve-onboarding-and-connection-health--could), [ADR-011 §4a, §15 D-3](../../adr/ADR-011-multi-lms.md#4a-operator-approval-grant), [LA-ADR-01 D2, D3, D7](LA-ADR-01-channel-kernel.md) (manifest `setup`, `binding.authority`, authority strategies), [LA-ADR-02 D3](LA-ADR-02-generic-lti-channel.md#d3-generic-channel-lti-generic-must), [LA-ADR-07 D2](LA-ADR-07-security-and-tenancy.md#d2-authority-rules-for-channels-must), [DataCamp pattern 6](../../../research/ltiaas/inputs-datacamp.md) ("show our values, collect their values, verify, enable"), [LA terms](../terms.md) (connection setup, verified admin launch, connection health, connection check).

## 1. Context

| # | Fact | Evidence |
| --- | --- | --- |
| F1 | Every new Canvas and Blackboard binding needs a one-time operator grant. The operator step does not scale (R-M-11). Q21 recommends D-3 "before many customers". | ADR-011 §4a, §16 R-M-11; `docs/architecture/open-questions.md:30` |
| F2 | Moodle onboarding is already self-serve: Dynamic Registration (`self`), or manual connect (`self`, R-LA-1). The new generic channel uses `self` for Dynamic Registration only when every endpoint and the audience are on the issuer origin (LA-ADR-07 rule A6; D2L never meets it, because its token host is `auth.brightspace.com`), else a staged registration with `operatorGrant`; both use `operatorGrant` for manual. | [LA-ADR-02 D3, D4](LA-ADR-02-generic-lti-channel.md#d3-generic-channel-lti-generic-must); [LA-ADR-07 D2](LA-ADR-07-security-and-tenancy.md#d2-authority-rules-for-channels-must) |
| F3 | A connection shows `status`, `lastLaunchAt` and `lastError` (the last failed registration or manual connect) only. Launch refusals that name a connection (`site_mismatch`, `lms_mismatch`, `deployment_not_approved`) are log lines only. | app contract §4 (`lastError`), §12 (`launch_rejected` reasons) |
| F4 | A Canvas admin who uses the inline key snapshot must paste a new JSON after a signing key change. Nothing records which key a connection exported. A1 adds the generic column `connection.artifact_key_kid` (migration `016`, with the other E6 tables). | app contract §4.6; `docs/guides/operator.md:209-220`; [LA data model §5a](../data-model.md#5a-cogniate-app-migration-016-e6-could) |
| F5 | Nothing checks a binding before the first real launch. A wrong client id or a JWKS URL that the LMS cannot reach shows only when a teacher or learner fails. | flows §6a, §6g, §6h |
| F6 | Self-serve paths need rate limits and an audit log first (R4 §7 item 11; plan v1 §3 E6). | [LA-ADR-06 D1, D4](LA-ADR-06-service-operability.md) |

## 2. Decision

| # | Decision | Priority |
| --- | --- | --- |
| D1 | **The operator grant stays the default** for every `operatorGrant` method. Self-serve comes only as the reserved kernel strategy `verifiedAdminLaunch`, and only after E5 Must 1 (rate limits) and Must 4 (audit) are done. | Decision now; strategy: Could |
| D2 | **Where self-serve is safe**: a per-channel table. Blackboard stays operator-only in LA. | Decision now |
| D3 | **Verified admin launch**: a signed LMS administrator Deep Linking launch makes a one-time connection code inside the LMS; the library user redeems it in the portal session. | Could |
| D4 | **Connection check**: a token probe and a JWKS fetch for one connection, on demand, with a clear result. | Could (recommended first) |
| D5 | **Connection health view**: last launch, last launch refusal, dispatch state, last errors, key state. | Could |
| D6 | **Setup verify step**: the portal shell takes it from the binding authority; the manifest keeps only `setup.connectionCheck` for D4 (LA-ADR-01 D2, D9). | Could |

Recommended build order if E6 gets capacity: D4, then D5, then D3. D4 and D5 help support at once and change no authority; D3 changes authority and needs a security review and LA-H24.

### D1. Operator grant first

- The two-phase grant redemption (app contract §4.7.1) stays as it is. Its guarantees (one live attempt, staged inactive creates, fenced refs, authority only from a committed approval) stay the reference model.
- `verifiedAdminLaunch` is a **third authority strategy in the kernel** ([LA-ADR-01 D3](LA-ADR-01-channel-kernel.md#d3-capability-model) reserves the name). A channel turns it on per registration method in its manifest. A channel never implements it ([LA-ADR-07 D2 rule A1](LA-ADR-07-security-and-tenancy.md#d2-authority-rules-for-channels-must)).
- A connection whose method has `verifiedAdminLaunch` can still use a grant: the portal offers both paths ("I have an approval code" or "Confirm from {LMS}"). The operator can always suspend and release (ADR-011 §4b).

### D2. Where self-serve is safe

Self-serve is safe only when a **signed** platform message proves both: (1) the person controls the LMS installation (an administrator role signed by the platform), and (2) the platform values match the connection (the signed Deep Linking return URL is on the connection's site origin, check 13).

| Channel | Today | Self-serve in LA | Reason |
| --- | --- | --- | --- |
| `moodle` | `self` (DR, manual) | already self-serve | DR proves control (A2 rule); manual is residual R-LA-1 (LA-H23) |
| `canvas` | `operatorGrant` | Could: `verifiedAdminLaunch` for `initial` and `add_deployment` | Canvas account administrators launch with an institution administrator role (UNVERIFIED: one CANVAS-HOSTED row); the Deep Linking return URL is on the site origin (check 13) |
| `blackboard` | `operatorGrant` | **No** (operator only in LA) | Shared platform: one Developer Portal application for every school (ADR-011 D4); the admin role in a Learn tool launch is UNVERIFIED; the operator also tracks the Developer Portal limit of 6 site registrations per group (R2 §9 item 13) |
| `lti-generic` | DR `self` only when every endpoint and the audience are on the issuer origin, else staged with a grant (LA-ADR-07 rule A6); manual `operatorGrant` | DR on the issuer origin: already self-serve. Manual: Could, `verifiedAdminLaunch`, only when rule A6 holds (D3 rule 6) | Same proof as Canvas; endpoints come from typed values, so the proof must also bind them (D3 rule 6) |
| `brightspace` | DR (Should) and manual: the D2L token host is off the issuer origin, so both need an operator grant (rule A6) | **No** in LA: the off-origin token endpoint and audience need an operator approval | D2L admin role facts UNVERIFIED (R2 §5.4); rule A6 |

### D3. Verified admin launch (Could)

```mermaid
sequenceDiagram
  autonumber
  actor CU as Cogniate library user
  actor LA as LMS administrator
  participant APP as Cogniate app
  participant LTI as LTI service
  CU->>APP: new connection (site URL; channel values), method with verifiedAdminLaunch
  APP-->>CU: pending + setup values ("show")
  CU->>APP: PUT …/platform {client id, deployment id, endpoints if admin-value} (no grant code)
  APP->>LTI: staged create, ACTIVE at the LTI service, binding ref c (no approval in the app)
  LA->>LA: install the tool in the LMS
  LA->>LTI: Deep Linking launch as administrator (all checks 1..14 pass)
  LTI-->>APP: 303 /tool/deep-link?ltik=…
  APP->>APP: routing finds no approval, but the connection waits for a verified admin launch
  APP-->>LA: page "Confirm this LMS for Cogniate": shows a one-time connection code
  LA->>CU: gives the code (inside the institution)
  CU->>APP: POST …/verify {code} (portal session of the library)
  APP->>APP: checks; commit approval (same phase-2 rules as a grant); audit event
  APP-->>CU: registered
```

Rules:

| # | Rule |
| --- | --- |
| 1 | **Start.** `PUT …/platform` without `grantCode` on a method with `verifiedAdminLaunch` makes the staged LTI record **active** (login and launch must pass) with a new binding ref, but only when rule 6 holds; else the record stays inactive and only a grant can bind it. The app writes no approval. So the record has **no** app authority: no picker, no attempt, no service key use, no grade (app contract §6.1 rule unchanged). The connection gets the sub-state `awaiting_admin_launch` (DTO addition `verification: { kind: "adminLaunch", since }`). |
| 2 | **Proof launch.** Only an `LtiDeepLinkingRequest` counts. Its signed roles must contain `http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator` or `…/system/person#Administrator` (a context role is not enough: a teacher must not bind the school). Its platform and deployment must be exactly the connection's staged target. `platform.siteUrl` (and `serviceUrl`) must equal the connection values (the app contract §6.1 site check), and check 13 has already put the signed return URL on the site origin. |
| 3 | **Code.** The page shows a code of 16 base32 characters (80 bits) in 4 groups. It lives 30 minutes, is single use, and only its SHA-256 is stored, with the platform, deployment, connection, launch trace id and the SHA-256 of the admin's `sub`. A new proof launch replaces an older unused code. The page has no form and no button (framed in the LMS; CSP as the picker page). |
| 4 | **Redeem.** `POST /app-api/connections/:id/verify {code}` in a portal session of the connection's library (same `Origin` rule, security §6). It runs phase 1 and phase 2 of the grant engine with the code in the place of the grant: one live attempt, the lease, the connection still in its start state, a conditional re-activation that rotates the ref; then phase 2 commits the approval. Errors (new app codes, [app API delta §3.7](../contracts/cogniate-app-api-delta.md#37-connection-health-and-self-serve-verification-e6-could)): a connection of another library `404`; a connection that is not `awaiting_admin_launch` `409 CONNECTION_NOT_PENDING`; a wrong, used or expired code `422 VERIFICATION_CODE_INVALID` (one text for all three, no hint); after 5 wrong codes on one connection `429 RATE_LIMITED` for 1 hour (`Retry-After`); a live attempt on the connection `409 GRANT_IN_USE` (the grant engine's check 6, app contract §4.7.1). |
| 5 | **Audit and notice.** One app audit event (table of [LA data model §5](../data-model.md#5-cogniate-app-migration-015-e5-app-part-e6)) with action `binding.verified_admin_launch`, actor type `user` and the portal user id, and in `details` the platform, deployment, the admin `sub` hash, the launch trace id and the code hash prefix (8 characters). The evidence channel is `verified-admin-launch` ([LA-ADR-07 D5](LA-ADR-07-security-and-tenancy.md#d5-grant-evidence-must-fields-policy-q22)). Operators see these events in the audit read; they can suspend and release as for a grant. |
| 6 | **Admin-value channels (A-LAD-01).** The launch proves only the issuer host, and a library user can control that host. So a verified admin launch is possible only when [LA-ADR-07 rule A6](LA-ADR-07-security-and-tenancy.md#d2-authority-rules-for-channels-must) holds for the staged values: the auth, token and JWKS endpoints are on the issuer origin, and the client assertion audience is empty or equal to the token URL (or each value is a fixed value of a named profile). Then the active record of rule 1 is allowed by the LTI service (contract delta §4.6.1 rule 7), and a token request reaches only the issuer origin. If any value is off the issuer origin, rule 1 does not apply: the record stays staged (inactive), the code page says "This connection needs a Cogniate operator approval" and offers no code, and only an operator grant can bind it. |
| 7 | **Clean-up.** An `awaiting_admin_launch` connection that the library disconnects, or that waits more than 7 days, is fenced out like a cancelled attempt (the LTI record switches off with a new ref). |

Acceptance points (Could):

| Id | Observable result |
| --- | --- |
| AP-08-01 | Canvas simulator: a Deep Linking launch with an institution administrator role on an `awaiting_admin_launch` connection shows a code page; a launch with only `membership#Instructor` shows today's `deployment_not_approved` page and no code. |
| AP-08-02 | Redeeming the code in the library's session makes the connection `registered`; the next teacher Deep Linking launch reaches the picker. A redemption by another library's session gives `404`. |
| AP-08-03 | A second use of the code, a code after 30 minutes, and the 6th wrong code behave as rule 4. |
| AP-08-04 | Before redemption, a learner launch of the staged record gets `UNKNOWN_PLATFORM` (`deployment_not_approved`) and no attempt. |
| AP-08-05 | One audit event per redemption, with no code value and no raw `sub`. |

### D4. Connection check (Could, recommended first)

| Rule | Detail |
| --- | --- |
| App API | `POST /app-api/connections/:id/check` (portal session, library scope; [app API delta §3.7](../contracts/cogniate-app-api-delta.md#37-connection-health-and-self-serve-verification-e6-could)). Guard: manifest `setup.connectionCheck` true, else `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "setup.connectionCheck"`. Allowed when the connection has an **active** platform record that its authority strategy has bound (status `registered` or `connected`), else `409 CONNECTION_NOT_READY`. A staged record (an `awaiting_admin_launch` connection, or one that waits for a grant) is never checked, because its token endpoint is not yet proven (A-LAD-01). Answer `200 { result: "ok" \| "failed", checkedAt, details }`: `result` is `ok` only when `jwks.ok` and `token.ok`; `details` is the LTI answer below without `checkedAt`. |
| LTI API | `POST /api/platforms/:id/check` (Bearer, `admin` scope; our path; [contract delta §2.6](../contracts/lti-service-api-delta.md)). Optional body `{ deploymentId }`. |
| Work | The LTI service runs the check only for an active platform and deployment (contract delta §2.6), so the client assertion goes only to a token endpoint on the issuer origin of a `self` binding, or to one that an operator grant bound (LA-ADR-07 rule A6). (1) Fetch the platform JWKS with the guarded client: `ok` with the key count, or the outbound failure reason. (2) Request one access token at the token endpoint with one granted AGS scope (`lineitem.readonly` when granted, else `score`) and our client assertion: `ok`, or the platform answer class (`invalid_client`, `invalid_scope`, `http_<status>`, the outbound reason). The token is not cached and not returned. No call reads course or user data. Build rules (BD-A2-98): a platform whose `grantedScopes` hold neither `lineitem.readonly` nor `score` makes no token request and answers `token.detail: no_granted_scope` (our decision, not the platform's `invalid_scope`). A JWKS body that is not a JSON key set with at least one key gives `jwks.detail: invalid_jwks`. With no `deploymentId`, the first active deployment is checked; an unknown `deploymentId` gives `404 UNKNOWN_DEPLOYMENT`, and a known inactive one, or no active deployment, gives `403 DEPLOYMENT_NOT_ACTIVE`. A staged record is refused before any call: `409 CONNECTION_NOT_READY` in the app, `403 PLATFORM_NOT_ACTIVE` in the LTI service. |
| Answer | `200 { "checkedAt", "jwks": { "ok", "keys"?, "detail"? }, "token": { "ok", "scope"?, "detail"? }, "platform": { "active", "deploymentActive" }, "limits": "shared-application" \| null }`. For a shared platform, `limits = "shared-application"`: the token proves the vendor application, not the school (ADR-011 R-M-14). |
| Limits | One check per connection per minute (`429 RATE_LIMITED`); the LTI side is in the `admin` class. |
| Logs | `connection_check {connection_id, platform_id, jwks, token_result}` (app) and `platform_check {platform_id, jwks, token_result}` (LTI service); the audit details key is `tokenResult`. The value is the answer's `token` object `{ ok, scope?, detail? }`. A log or audit field is never named `token`: the shared redaction (`packages/shared/src/logger.ts`) replaces any field named or ending with `token`, and that rule does not change (BD-A2-99). No token value. |
| Portal | One "Check connection" panel on the connection page, only for a `registered` or `connected` connection of a channel with `setup.connectionCheck` (BD-A2-98: a check needs an active platform, so a button in the wizard's verify step could only answer `CONNECTION_NOT_READY`). Texts: "Cogniate can reach {LMS}." / "{LMS} refused our client id. Check the Client ID in {LMS}." / "Cogniate cannot reach the {LMS} key set." / "{LMS} gave Cogniate no grade scope. Allow the grade (AGS) scopes for the Cogniate tool in {LMS}." (`no_granted_scope`) / "{LMS} did not give Cogniate an access token." with the detail code (another token failure). |

Acceptance points (Could): AP-08-06: on the simulator, a check of a correct Canvas connection gives `jwks.ok` and `token.ok`; with the simulator token endpoint set to answer `invalid_client`, `token.ok` is false with `detail: invalid_client`, and the connection status does not change. AP-08-07: a second check within 60 s gives `429`.

### D5. Connection health view (Could)

`GET /app-api/connections/:id/health` (portal session, library scope):

```json
{
  "status": "connected",
  "lastLaunchAt": "2026-11-02T08:15:00.000Z",
  "lastLaunchRefusal": { "reason": "site_mismatch", "at": "2026-11-01T10:00:00.000Z" },
  "dispatch": { "pending": 2, "oldestPendingAt": "…", "lastSentAt": "…", "failedLast24h": 1, "lastError": { "code": "PLATFORM_REJECTED_REQUEST", "at": "…" } },
  "keys": { "activeKid": "…", "nextKid": null, "artifactKeyKid": "…", "artifactKeyCurrent": true },
  "lastCheck": { "at": "…", "jwks": true, "token": true },
  "events": [ { "kind": "launch_refused", "code": "site_mismatch", "at": "…" } ]
}
```

| Field | Source |
| --- | --- |
| `status`, `lastLaunchAt` | the connection row (today) |
| `lastLaunchRefusal`, `events` | new app table `connection_event` (migration `016`, [LA data model §5a](../data-model.md#5a-cogniate-app-migration-016-e6-could)): one row per launch or Deep Linking refusal that names this connection (`kind` `launch_refused` or `deep_link_refused`, `code` `site_mismatch`, `lms_mismatch`, `deployment_not_approved`), per connection check (`check`), and per disconnect or suspend. At most 100 rows per connection; 30 days (LA-H4). `lastLaunchRefusal.reason` is the `code` of the newest refusal row. |
| `dispatch` | the dispatch outbox rows of the connection's placements ([LA-ADR-03](LA-ADR-03-learning-record-core.md)) |
| `keys.activeKid`, `nextKid` | the public tool JWKS (`GET /lti/keys/{account}`: active first, then next, [LA-ADR-06 D7](LA-ADR-06-service-operability.md#d7-signing-key-lifecycle-and-a-t0-16-must)) |
| `keys.artifactKeyKid` | `connection.artifact_key_kid` (migration `016`, A1): the `kid` of the last setup artifact export with an inline key; `null` when the connection uses the key URL. `artifactKeyCurrent` = it equals `activeKid`. |
| `lastCheck` | the last D4 result of this connection |

Rules: library scope only; ids, codes and public key ids only (no learner data, no token); one database read per source; no outbound call (the JWKS read is cached 60 s). The portal shows a warning when `artifactKeyCurrent` is false ("Paste a new {LMS} key JSON") and when `oldestPendingAt` is older than 1 hour.

Build notes (BD-A2-100; LA-E6-02, lane P, ratified):

- `keys.nextKid` is `null` in LA. The public JWKS has no key status, and after a rotation its second key is a retired one, so the next kid cannot be derived. It needs a source with status (for example a signing-key field on a tenant account read), which LA does not build.
- `keys.artifactKeyCurrent` is `null` when `artifactKeyKid` is `null` or the active kid cannot be read; else `artifactKeyKid === activeKid`. The portal warns only on `false`.
- A `check` event has `code` `ok`, or the failed parts in the order `jwks`, then `token`, each as `<part>:<detail>` with a contract delta §2.6 detail value, joined by one space (for example `jwks:invalid_jwks token:invalid_client`). `lastCheck {at, jwks, token}` comes from the newest `check` row: a part that is not in the failed list is `true`.
- `dispatch.lastError.code` is the `CODE` of the stored `"<status> <CODE>: <text>"` when it matches `[A-Z][A-Z0-9_]*`, else `null`; never the free text. `lastError` is the newest row of the connection's placements with a `last_error`; `at` is its `updated_at`.
- `events` are the kept rows (at most 100, 30 days), newest first.
- Disconnect and suspend events are not written in LA: no task owns their call sites (K files). This is a deferral (Lead: `deferred.md`).
- Portal: on every connection page, a collapsed "Connection health" section, with the two warnings outside it when they apply.
- Stale key action (BD-A2-101): the stale-key help must name an action that the page offers. The Canvas configuration route already serves the key JSON for any connection status, inline or as a key URL, and records the exported key id. So the Canvas portal shows the existing key JSON panel (`CanvasConfiguration`) for a **registered** Canvas connection too, collapsed under "Key JSON". The help text is: "{LMS} still has an old Cogniate key in its developer key. Open Key JSON on this page. Choose the key URL (it never needs a new paste), or download the JSON again. Then paste it into the Cogniate developer key in {LMS}." After a new export, `artifactKeyKid` is the active kid (inline) or `null` (key URL), so the warning goes. No API or contract change. There is no `role="alert"`, and the labels do not repeat the overview texts, so the M2 and T6 selectors do not change.

Operator use: before a signing key activation, the operator lists the connections whose `artifactKeyKid` is not the **next** kid ([operability §6.1](../operability.md)). The operator reads the next kid from `GET /operator/v1/accounts/<id>/signing-keys` (status `next`), because the health answer has no `nextKid` in LA (BD-A2-100). Operator command (Could): `app:connections health --stale-artifact-key --next-kid <kid>` (read only; app container shell).

Acceptance points (Could):

| Id | Observable result |
| --- | --- |
| AP-08-08 | After a `site_mismatch` launch of a connection, its `health.lastLaunchRefusal.reason` is `site_mismatch` and `events[0].code` is `site_mismatch`. |
| AP-08-09 | After a Canvas JSON export with `jwk=inline`, `keys.artifactKeyKid` equals `keys.activeKid` and `artifactKeyCurrent` is true; after a signing key activation (with `force` on the simulator), `artifactKeyCurrent` is false. With `jwk=url`, `artifactKeyKid` is `null`. |
| AP-08-10 | `GET …/health` of another library's connection gives `404`. |

### D6. Manifest setup verify step (Could)

The manifest has **no** `setup.verify` field: the portal shell takes the verify step from the binding authority ([LA-ADR-01 D2, D9](LA-ADR-01-channel-kernel.md#d2-channel-manifest); B-LAD-20): `self` → first launch, `operatorGrant` → the grant code field, `verifiedAdminLaunch` → the admin launch instructions with the code field. Only the optional flag `setup.connectionCheck` stays in the manifest; it adds the "Check connection" button. Baseline manifests have no `connectionCheck`, and their authorities are today's, so E1 shows no change. When D3 is built, `verifiedAdminLaunch` also becomes a valid value of `registration[].authority` (today reserved in the manifest type) and of `connection.binding_authority` (the `013` CHECK already allows it, [LA data model §2](../data-model.md#2-cogniate-app-migration-013-e1-channel-kernel)). A manifest that names `verifiedAdminLaunch` while D3 is not built stops the registry load (LA-ADR-07 AP-07-08).

Proposed values when E6 is built: `canvas` and `lti-generic` get `connectionCheck: true`; the `canvas` methods (also for the `add_deployment` grant purpose) and the `lti-generic` manual method get `verifiedAdminLaunch` only after LA-H24; `blackboard` keeps `operatorGrant` (D2).

## 3. Alternatives considered

| Alternative | Why not |
| --- | --- |
| Self-serve by typed ids only | Ids are public; it is the squatting risk of ADR-011 R-M-03. |
| The portal shows the code and the LMS admin types it into the tool page | It works, but the code then exists before any proof, and a page with a form inside the LMS frame needs CSRF and framing care. The chosen direction makes the code only after the signed proof, and the redemption happens in the portal session, which already has the library scope and `Origin` checks. |
| Accept any context staff role as proof | A teacher could bind a whole school to a library. |
| Self-serve for Blackboard now | One shared application for every school; the proof facts are unverified; the operator also manages the Developer Portal limits. |
| Health from log files | Logs are not queryable per connection and have no retention per tenant. A small event table is cheaper and testable. |
| A connection check that reads a roster or line items | It would read course data without a teacher; the token probe proves the registration without data. |

## 4. Consequences

- Support can see why a connection fails without a log search (D4, D5).
- The signing-key rotation procedure can name the Canvas installs that need a new JSON before activation.
- With D3, Canvas and the generic channel can onboard without an operator, while every binding still has a signed proof, an audit event and the operator's suspend and release path.

## 5. Migration and compatibility

All additions. New app routes: `POST /app-api/connections/:id/check`, `GET /app-api/connections/:id/health`, `POST /app-api/connections/:id/verify` (A1 records them in the [app API delta](../contracts/cogniate-app-api-delta.md)). New LTI route `POST /api/platforms/:id/check` ([contract delta](../contracts/lti-service-api-delta.md)). New app tables `connection_event` and `admin_launch_code`, and the column `connection.artifact_key_kid` (all in migration `016`, [LA data model §5a](../data-model.md#5a-cogniate-app-migration-016-e6-could)). No change for M1 connections: their manifests keep today's verify values.

## 6. Test impact

Ownership follows plan LD-5. Every point is Could: QA tests it only if E6 is in scope.

| Level | Owner | Tests |
| --- | --- | --- |
| Author unit | Author | Code rules: 80-bit code, 30-minute life, single use, a newer code replaces an older one, 5 tries then the 1-hour block (D3 rules 3, 4), with a controlled clock; the role rule of D3 rule 2; the admin-value proof of D3 rule 6; the health field mapping (D5); migration tests of `015` (`artifact_key_kid`) and `016`. |
| K0 | QA | The `setup.connectionCheck` value and the `binding.authority` map of every registered channel equal the fixture (D6). |
| SIM-lane acceptance | QA | AP-08-01 to AP-08-10 on the Canvas simulator. |
| Simulator modules | QA-E2E | Sign an institution administrator role in a Deep Linking launch; make the token endpoint answer `invalid_client` on demand. |
| Live | QA-E2E | One CANVAS-HOSTED row: the roles of a Canvas account administrator's Deep Linking launch (D2 table). |

## 7. Open questions

| Id | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| Q21 | Priority of D-3 against the other follow-ups | E6 Could in LA; D4 and D5 first | Product |
| LA-H24 | Is a verified admin launch enough proof without an operator, for Canvas and the generic channel? | Yes, with the D2 limits; operators keep suspend and release; Blackboard stays operator-only | Product + Security |
| Q22 | Evidence policy, also for `verified-admin-launch` events | As LA-ADR-07 D5 | Product + Legal |
| LA-H23 | Moodle manual connect authority | Keep `self` for the pilot; `verifiedAdminLaunch` when D3 exists | Product + Security |
| LA-H4 | Retention of `connection_event` rows | 30 days | Product + DPO |

LA-H21 to LA-H24 are in plan v1.2 §6.2.
