# LA-ADR-02: Generic LTI 1.3 channel and the first new named LMS (D2L Brightspace)

Status: Proposed (A1, milestone LA P2, 2026-10-22). Epic: E2 (Must; one Could). Terms: [terms](../terms.md). Inputs: [plan v1.1 §3 E2](../../../team/ltiaas/plan.md), [R2](../../../research/ltiaas/R2-lms-landscape.md) (§3 two platform kinds, §4.3 rules stricter than the specs, §5 answers, §5.4 D2L facts), [R1 §3 gap 4](../../../research/ltiaas/R1-spec-coverage.md), [R3 §3](../../../research/ltiaas/R3-extensibility-audit.md), [LA-ADR-01](LA-ADR-01-channel-kernel.md).

## Context

- 14 of 18 LMSs launch LTI 1.3 tools (R2 §Summary 1). Most of them will never get a named channel. They need a generic LTI 1.3 channel.
- Platforms come in two kinds (R2 §3). **Kind A** has a per-tenant issuer (Moodle, D2L, Sakai, Open edX, Absorb, self-hosted Canvas). **Kind B** has one vendor issuer for all customers (Canvas cloud, Blackboard, Schoology, itslearning). For kind B, the issuer and client id do not prove which school sends a launch, so ADR-011 reserves these issuers (`services/lti-service/src/profiles/index.ts:78-89`).
- Two code rules are stricter than the 1EdTech specs and block kind A platforms other than Moodle (R2 §4.3):
  1. Every endpoint must be on the issuer origin (`services/lti-service/src/lti/platform-rules.ts:23-36`; app side `services/cogniate-app/src/app/connections.ts:141-149`). D2L puts its token endpoint on `auth.brightspace.com`.
  2. Dynamic Registration needs the configuration issuer equal to the configuration URL origin, every endpoint on that origin (`services/lti-service/src/lti/registration.ts:54-69`), and a Moodle-style registration token: a JWT with `scope` `reg` or `reg-update` (`services/lti-service/src/http/routes/registration.ts:93-110`, `registration.ts:85-93`).
- The client assertion `aud` is a boolean choice today (`services/lti-service/src/platform/token-client.ts:37`). D2L needs a separate audience value (R2 §5.4).
- The plan asks for: a generic channel on the `standard` profile path (manual and DR), generic DR fixes, profile data additions, removal of the two strict rules, D2L Brightspace on the simulator, a generic provider in the simulator, and (Could) the DR management flow (plan v1.1 §3 E2).

## Decision

### D1. Two channels in E2

| Channel id | Kind | Purpose | Priority |
| --- | --- | --- | --- |
| `lti-generic` | A only | Any kind A LTI 1.3 platform that has no named channel (Sakai, Open edX, Absorb, …) | Must |
| `brightspace` | A | D2L Brightspace, the first new named LMS (R2 §5.3; LA-H6) | Must (manual); Should (Dynamic Registration) |

A kind B platform always needs a named channel with a reserved issuer. The generic channel refuses a reserved issuer (`ISSUER_RESERVED`, unchanged rule) and every guarded product family of another channel (generic check 14, [LA-ADR-01 D6](LA-ADR-01-channel-kernel.md#decision)).

### D2. Profile traits added in E2

These traits are data in each profile. The LTI driver reads them and never branches on a profile id. `standard` keeps today's values, so Moodle does not change.

| Trait | Values | `standard` (Moodle) | Canvas, Blackboard | `lti-generic` | `brightspace` | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| `endpoints` (E1) | `admin` \| `fixed` | `admin` | `fixed` | `admin` | `admin` with defaults (D4) | Must |
| `issuerKind` | `per-tenant` \| `fixed` | `per-tenant` | Canvas cloud, Blackboard: `fixed`; self-hosted: `per-tenant` | `per-tenant` | `per-tenant` | Must |
| `endpointOrigins` | `issuer` (auth, token, JWKS on the issuer origin) \| `any-https` (each URL passes site rules 1–4 and the guarded client) | `issuer` | n/a (fixed) | `any-https` | `any-https` | Must |
| `clientAssertionAud` (replaces `clientAssertionAudArray`) | `{ value: '{tokenEndpoint}' \| '{platformValue}', form: 'string' \| 'array' }` | `{tokenEndpoint}`, `string` | Blackboard: `{tokenEndpoint}`, `array` (same JWT as today); Canvas: `{tokenEndpoint}`, `string` | `{platformValue}` (default the token URL) | `{platformValue}` | Must |
| `assertionDeploymentId` | boolean: add the `deployment_id` claim to the client assertion (R1 gap 14) | false | false | false | false (true only after a live check) | Must (the trait); default off |
| `dynamicRegistration` | `null` \| `{ issuerRule: 'origin' \| 'path-prefix' \| 'profile', registrationToken: 'moodle-scope-jwt' \| 'opaque-bearer' }`. `profile` = the configuration issuer must equal the profile issuer (Canvas DR, A2) | `{ path-prefix, moodle-scope-jwt }` | `null`; Canvas DR (D-1, Should) is A2's [LA-ADR-05](LA-ADR-05-lti-advantage-completeness.md) and uses `issuerRule: profile` | `{ path-prefix, opaque-bearer }` | `{ path-prefix, opaque-bearer }` | Must |
| `privacyFloor` (E1) | `allowlist` \| `none` | `none` | `allowlist` | `allowlist` | `allowlist` | Must |
| `platformStorage` | `null` \| `{ targetFrame: 'from-login' \| <frame name>, origin: 'authOrigin' \| <fixed origin> }`; A2 defines the behaviour ([LA-ADR-05 D1](LA-ADR-05-lti-advantage-completeness.md)) | `null` | A2 sets the Canvas value; Blackboard waits for a live check (R2-1) | `null` | `null` until verified (R2 §2.2: frame name UNVERIFIED) | A2 (E3 Must) |

`{platformValue}` means: the stored platform field `clientAssertionAud`; when it is empty, the token URL. A platform record gets the new optional field `clientAssertionAud` (admin value, or `authorization_server` from DR, D5). `GET /api/providers` shows the traits `endpoints`, `issuerKind` and `endpointOrigins` for each profile; the app reads `endpoints` to choose the values that a grant binds (D6).

The `standard` DR rule changes from `origin` to `path-prefix`. This is an intended E2 change for Moodle: it fixes Dynamic Registration for Moodle in a subfolder (Q18, part (a)). Moodle at the host root behaves as before. The web services and course shell paths of Q18 stay unsupported.

### D3. Generic channel `lti-generic` (Must)

**Manifest (summary).**

| Field | Value |
| --- | --- |
| `names.text` / `names.label` | `your LMS` / `Other LTI 1.3 platform` |
| `card` | title "LTI 1.3", text "Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage." |
| `registration` | `dynamic` → authority `self`, profile `lti-generic`; `manual` → authority `operatorGrant`, profile `lti-generic` |
| capabilities | `registration.dynamic`, `deployments.multiple`, `records.reporters: ['lti-ags']`, `records.readBack`, `launch.windowHint`; no `siteApi.token`, no `publish.createCourse`, no `setup.artifacts`, no `export.packages` |
| `lti.guardedFamilies` | none |

**Why manual needs an operator grant.** Client ids and deployment ids are not secrets (ADR-011 §1). With `endpointOrigins: any-https`, a typed JWKS URL is not tied to the issuer host. A library that types another school's issuer and client id, with its own JWKS URL, could forge launches. With a forged AGS claim it could make the tool send that school's real platform access token to a foreign host. So every manual `lti-generic` binding uses `operatorGrant`, and the grant binds **all** admin values (D6). Dynamic Registration is `self`: the configuration comes from the issuer's own path, so the issuer host vouches for the endpoints, and the platform administrator starts the registration inside the LMS.

Moodle (`standard`) manual connect stays `self` with `endpointOrigins: issuer` (no behaviour change; ADR-011 D-12 note). A2's [LA-ADR-07](LA-ADR-07-security-and-tenancy.md) owns any later change of that rule.

**Create and bind.**

| Step | Rule |
| --- | --- |
| Create | `POST /app-api/connections { lms: 'lti-generic', method, name, siteUrl }`. `siteUrl` is an https origin; site rules 1–4 apply (ADR-011 §6), so an IP literal, `localhost` or one of our hosts is refused. |
| Dynamic | Same flow as Moodle (flows §6a-1), with the generic DR fixes of D5 and texts from the manifest. |
| Manual show | The tool configuration rows of the generic adapter: login URL, redirect URI, JWKS URL, target link URI, Deep Linking URL, the scope set, "Privacy: do not send name or e-mail". |
| Manual collect | Strict body: `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, optional `tokenAudience`, `grantCode`. The issuer may have a path; its origin must equal `siteUrl`. |
| Verify | The two-phase grant redemption (app contract §4.7.1), target kind `exclusive_platform` with the admin values. Every value must equal the grant (D6). |
| Enable | `registered`; the first valid launch sets `connected`. |

### D4. D2L Brightspace channel `brightspace` (Must manual; Should DR)

Facts and their status come from R2 §5.4. Each fact keeps its source note in `packages/channels/brightspace/README.md`.

| Item | Value | Status (R2 §5.4) |
| --- | --- | --- |
| Profile | `brightspace`: `endpoints: admin`, `issuerKind: per-tenant`, `endpointOrigins: any-https`, `clientAssertionAud: {platformValue}`, sharing `exclusive`, `privacyFloor: allowlist` | design |
| Issuer | the site URL (`https://{school}.brightspace.com` or a custom domain); the admin copies it from the D2L registration page | confirmed in shape |
| Defaults that the portal pre-fills (never trusted alone) | auth `{siteUrl}/d2l/lti/authenticate`; JWKS `{siteUrl}/d2l/.well-known/jwks`; token `https://auth.brightspace.com/core/connect/token`; audience `https://api.brightspace.com/auth/token` | third-party and D2L sources; the admin value from the D2L page wins |
| Guarded family | `desire2learn` | **UNVERIFIED**; the first real launch confirms it (R2-2) |
| Deployments | many per registration (UUIDs) → `deployments.multiple` | confirmed |
| Registration | `manual` → `operatorGrant` (Must); `dynamic` → `self` with `opaque-bearer` (Should: token format UNVERIFIED; the simulator proves only our side) | — |
| Launch | `launch.windowHint: true` (the hint is sent only when the platform accepts `window`); `launch.topLevelContinue: false` | D2L default is iframe; "Open as External Resource" is per link |
| Score rules | AGS final scores only (ADR-010); a non-gradable user answers `422` → `rejected` (existing mapping) | third-party |
| Admin steps | Manage Extensibility › LTI Advantage › Register Tool (Standard), then a deployment, then links | R2 table 2.1 |

The D2L adapter has no extension route and no portal module: the manifest wizard of [LA-ADR-01 D9](LA-ADR-01-channel-kernel.md#decision) renders it.

### D5. Generic Dynamic Registration fixes (Must)

| # | Fix | Rule after E2 | Today |
| --- | --- | --- | --- |
| 1 | Issuer with a path (Q18) | `issuerRule: path-prefix`: the configuration URL must start with the issuer followed by `/`; the issuer may have a path; the site origin is the issuer origin | issuer = configuration URL origin (`registration.ts:62`) |
| 2 | Endpoint origins | the configuration endpoints follow the profile `endpointOrigins`; with `any-https` each URL passes site rules 1–4 and the guarded client | every endpoint on the issuer origin (`registration.ts:66-68`) |
| 3 | Registration token | `moodle-scope-jwt` (Moodle: unchanged checks and the "update" refusal of security §2.5) or `opaque-bearer` (used only as the Bearer token of the registration request; operation is always `new`) | Moodle JWT only (`http/routes/registration.ts:93-110`) |
| 4 | Token audience | `authorization_server` of the configuration, when present, becomes the platform `clientAssertionAud` | ignored (R1 DR row) |
| 5 | Capability checks | refuse with a clear page when: the configuration family is guarded by a channel that is not the connection's channel (`PROVIDER_PROFILE_MISMATCH`, "This is a {LMS} site. Connect it as {LMS}."); `LtiDeepLinkingRequest` is not in `messages_supported`; a scope of the channel scope set is not in `scopes_supported` | Canvas and Blackboard families only (`http/routes/registration.ts:129-134`) |
| 6 | Profile at complete | `POST /api/registrations/:id/complete` gets `profile` from the app (the connection's `lti_profile`). The LTI service applies that profile's traits and creates the platform with it | always `standard` |
| 7 | Granted scopes | the registration response `scope` is stored on the platform (`grantedScopes`); token requests ask only for granted scopes | not stored |
| 8 | Neutral texts | DR pages use `{LMS}` from the connection's channel; Moodle texts stay byte for byte | Moodle words in core (R3 S67) |
| 9 (Could) | DR management | store `registration_client_uri` and the registration access token; support the spec read and update flow | not built (R1 gap 12) |

At the start page the LTI service does not know the connection's channel yet. It applies the loosest rule of any DR profile (`path-prefix`, either token format). `complete` then applies the exact rules of the chosen profile, before it sends anything to the platform. A2 records the wire changes (`complete.profile`, platform `clientAssertionAud`, `grantedScopes`) in [lti-service-api-delta](../contracts/lti-service-api-delta.md).

### D6. Operator grant for admin-value profiles (Must)

- The grant of an admin-value binding binds the M1 values (library, connection, channel, profile, site URL, client id, deployment id, purpose) **and** the bound values: `issuer`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, `tokenAudience` (data model: `binding_grant.bound_values`, migration `013`).
- `app:grant issue` gets the flags `--issuer`, `--auth-url`, `--token-url`, `--jwks-url`, `--token-audience`. They are required when the connection's profile has `endpoints: admin`, and refused otherwise. The CLI prints them before the code (ADR-011 §4a "Issue").
- Redemption compares every bound value after canonical form (origins) or exact text (URLs). A difference gives `422 GRANT_MISMATCH` (unchanged code, app contract §4.7.1).
- The LTI service checks the values again against the profile traits at create (`PLATFORM_URL_NOT_IN_PROFILE`, `INVALID_SITE_URL`).

### D7. Simulator needs (Must)

- **No simulator profile** is needed for `lti-generic` or `brightspace`. Both are admin-value profiles, so QA registers sim hosts as admin values. The D2L defaults are checked as constants in a no-Docker test (as AC-M1-01 does for the fixed Canvas and Blackboard values).
- QA adds two simulator modules (`tests/sim/`, QA-owned): a **generic provider** (issuer with a path, token on a second host, an opaque DR token, many deployments) and a **D2L provider** (token host `auth.brightspace.sim.test`, an audience that differs from the token URL, family `desire2learn`, many UUID deployments).
- One host manifest makes the compose aliases, the certificate SANs and the `acceptance` outbound allowlist from the simulator modules (plan E7; QA owns the generator). After E7, a new simulator LMS needs no infra edit.

### D8. Add-channel gate base

Plan §4 measure 1 measures "a new LTI LMS changes 0 core files" on the E2 branch against the E1-done SHA. E2 itself has planned core work (D2, D5, D6: LTI driver and grant changes). So the gate must measure the **D2L task only** (`packages/channels/brightspace/**` plus QA's simulator module and tests), against the SHA where E1 and the E2 kernel tasks (D2, D3, D5, D6) are done. The breakdown orders E2 so: E2-K (traits, DR fixes, grant bound values, `lti-generic`) first, then E2-N (`brightspace`). This is recorded as an open consistency item for the Lead ([README §8](../README.md#8-open-consistency-items)).

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Put the generic channel on the literal `standard` profile | The LTI service could not tell Moodle from other LMSs in texts and DR rules; Moodle would get relaxed endpoint rules. A separate profile id on the same admin-value code path is cleaner. |
| `self` authority for manual generic connections | Typed ids and a typed JWKS URL do not prove ownership (D3). It would allow launch forgery and token leaks for kind A platforms. |
| `self` for manual generic connections only when every endpoint is on the issuer origin | Two authorities for one method, chosen by the typed values: hard to explain and to test. The operator path is the DataCamp-style support-led setup; A2's E6 may add a verified admin launch later. |
| Fixed D2L endpoints in the profile (like Canvas) | D2L shows the values per registration; third-party sources can be wrong (R2 §5.4 design rule). |
| Schoology as the first named LMS | Kind B with a shared client id: a Blackboard twin that proves little new (R2 §5.3). |
| A simulator profile copy for D2L | Not needed for admin-value profiles; it would add a reserved sim issuer for no gain. |

## Consequences

- Any kind A LTI 1.3 platform can connect through `lti-generic`: by DR without an operator, or manually with an operator grant.
- D2L is one channel folder plus data. It proves plan measure 1 once E2-K is done (D8).
- Moodle DR in a subfolder starts to work (intended change, Q18 part (a)); other Moodle behaviour does not change.
- The grant table gets one JSON column for bound values (migration `013`, added in E1 so that E2 has no schema change).
- A live D2L row needs the D2L Partner program (LA-H3). Until then the claim is "implemented and tested against the signed simulator".

## Migration and compatibility

- New profiles need no LTI service migration: `platform.profile` has no CHECK (`services/lti-service/src/db/migrations/004_provider_profiles.sql:4`). The new platform fields `client_assertion_aud` and `granted_scopes` need one additive LTI service migration in E2-K ([data-model §4](../data-model.md#4-lti-service-changes)).
- App: only `013` (E1). The connection DTO and `GET /app-api/lms-providers` list the new channels as new entries ([app API delta](../contracts/cogniate-app-api-delta.md)).
- The closed-list assertions of M1 and M2 were rewritten in E0 (LD-1), so the new profiles and cards do not break them.

## Test impact

- No Docker (Author unit tests; QA K0 where it is a channel contract): trait table per profile (constants); `clientAssertionAud` JWT shapes for all profiles (Blackboard array unchanged, golden); DR rule table (D5) per profile; grant bound-value comparison; D2L defaults as constants.
- K1 (simulator): generic provider and D2L provider through the conformance kit ports K-LAUNCH, K-DL, K-AGS, K-REG (manual and DR).
- Regression: Moodle DR at the host root unchanged (T3b, T7); new check: Moodle DR with an issuer path.
- The add-channel gate on the E2-N diff (D8).

## Open questions

| Id | Question | Default until decided |
| --- | --- | --- |
| LA-H6 | Confirm D2L Brightspace as the first new named LMS | Design and build D2L (R2 recommendation) |
| LA-H3 | D2L Partner program access for a live row | Simulator only; claim "tested against the signed simulator" |
| — (R2-2) | D2L product family `desire2learn` and DR token format | Guard `desire2learn`; DR Should; confirm at the first live launch |
