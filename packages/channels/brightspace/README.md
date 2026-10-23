# Channel `brightspace`

D2L Brightspace, the first new named LMS (LA-ADR-02 D4). The manifest is `manifest.ts`, the LTI profile is `lti-profiles.ts`. There is no `app.ts` and no portal module: the profile has `endpoints: admin`, so the kernel admin-value setup adapter of the app serves the channel (LA-ADR-01 D5), and the manifest wizard shows it with the field defaults below.

## Facts and sources

Status: **confirmed** = from a vendor source; **design** = an LA decision; **UNVERIFIED** = not yet seen on a real platform.

| Fact | Value | Source | Status |
| --- | --- | --- | --- |
| Text name and label | `Brightspace`; `D2L Brightspace` | LA-ADR-02 D4 | design |
| LTI profile | `brightspace`: `endpoints: admin`, `issuerKind: per-tenant`, `endpointOrigins: any-https`, client assertion `aud` from `{platformValue}` (the stored audience, else the token URL), sharing `exclusive`, `privacyFloor: allowlist` | LA-ADR-02 D4 | design |
| Issuer | the site URL (`https://{school}.brightspace.com` or a custom domain); the admin copies it from the D2L registration page | R2 §5.4 (R2 table row 6) | confirmed in shape |
| Authentication endpoint default | `{siteUrl}/d2l/lti/authenticate` | R2 §5.4; A1 BD-A1-80 | third-party and D2L sources; the value on the D2L page wins |
| JWKS URL default | `{siteUrl}/d2l/.well-known/jwks` | R2 §5.4; A1 BD-A1-80 | third-party and D2L sources; the value on the D2L page wins |
| Token URL default | `https://auth.brightspace.com/core/connect/token` (another host than the issuer) | R2 §5.4; A1 BD-A1-80 | third-party and D2L sources; the value on the D2L page wins |
| Token audience default | `https://api.brightspace.com/auth/token` (not the token URL) | R2 §5.4; A1 BD-A1-80 | third-party and D2L sources; the value on the D2L page wins |
| Defaults are never trusted alone | the portal pre-fills them; the operator grant binds every value, and a value off the issuer host needs `--confirm-foreign-hosts` | LA-ADR-02 D6; LA-ADR-01 D2 (`FieldSpec.default`) | design |
| Guarded product family | `desire2learn` at the `registration` level: new Dynamic Registrations of the family must use this channel; existing `lti-generic` connections of a D2L site keep working | LA-ADR-02 D1, D4; LA-ADR-01 D6 | **UNVERIFIED**; the first real launch confirms it (R2-2) |
| Deployments | many per registration (UUIDs), so `deployments.multiple` | R2 §5.4 | confirmed |
| Registration | `manual` with authority `operatorGrant` (Must). `dynamic` (LA-E2-06, Should) starts with authority `self`, but every D2L registration is staged: the D2L token host is off the issuer origin (I-SELF fails). The LTI service makes the platform inactive; `app:grant issue --accept-staged --confirm-foreign-hosts` and the redemption activate it, and the connection authority becomes `operatorGrant` | LA-ADR-02 D2a, D4, D5 item 10, D6 | design |
| Dynamic Registration rules | profile trait `dynamicRegistration: { issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' }`: the configuration URL must start with the issuer followed by `/`; the registration token is used only as a Bearer token | LA-ADR-02 D2, D5 items 1 and 3 | design; D2L token format **UNVERIFIED** |
| Admin path for Dynamic Registration | Manage Extensibility › LTI Advantage › Register Tool, "Dynamic" ("Standard" is manual) | R2 table 2.1 (D2L Dynamic Registration since 20.21.4) | confirmed in shape |
| Launch | `launch.windowHint: true` (the hint is sent only when the platform accepts `window`); `launch.topLevelContinue: false` | LA-ADR-02 D4 | D2L opens a link in a frame by default; "Open as External Resource" is per link |
| Platform storage frame | none (`platformStorage` stays `null`) | LA-E2-05 scope | **UNVERIFIED**: the frame name needs a live check |
| Score rules | AGS final scores only (ADR-010); a user that cannot get a grade answers `422`, mapped to `rejected` | LA-ADR-02 D4 | third-party |
| Scopes | the four AGS scopes `lineitem`, `lineitem.readonly`, `result.readonly`, `score`; no NRPS scope | A2 LA-ADR-05 D4 | design |
| Strict manual body | `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, optional `tokenAudience`, `grantCode`; the issuer origin must equal `siteUrl` | app API delta §3.4 | design |
| Tool configuration rows | `tool_name`, `domain` (host of `PUBLIC_LTI_URL`), `redirect_urls`, `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions`, `roles`, `privacy`, in the order of the D2L "Register Tool" form (`setup.toolRows`, A1 BD-A1-78) | app API delta §3.3 | labels **UNVERIFIED** until a live check (R2-2, LA-H3) |
| Admin steps | Manage Extensibility › LTI Advantage › Register Tool (Standard), then a deployment, then links | R2 table 2.1 | confirmed in shape |

## Live status

No live platform was tested. QA uses the D2L simulator provider (LA-E7-02): issuer `https://brightspace.sim.test`, token host `auth.brightspace.sim.test`, an audience that is not the token URL, UUID deployments. For Dynamic Registration, the simulator (LA-E7-05) proves only our side of the flow; the D2L registration token format and the D2L configuration values stay UNVERIFIED until a live check.
