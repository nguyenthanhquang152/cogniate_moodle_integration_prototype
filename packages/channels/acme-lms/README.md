# Channel `acme-lms`

Acme LMS, a kind A LMS that speaks standard LTI 1.3 (OIDC login, `id_token` launch, Deep Linking 2.0, AGS, NRPS). It has no Dynamic Registration. The manifest is `manifest.ts`, the LTI profile is `lti-profiles.ts`. There is no `app.ts` and no portal module: the profile has `endpoints: admin`, so the kernel admin-value setup adapter of the app serves the channel (LA-ADR-01 D5), and the manifest wizard shows it with the field defaults below.

No real Acme site exists. Every Acme fact below is a design value that the simulator provider `acme-lms-sim` implements. A real Acme site must confirm each fact before the channel is used with a customer.

## Facts and sources

Status: **confirmed** = from a vendor source; **design** = an LA decision; **UNVERIFIED** = not yet seen on a real platform.

| Fact | Value | Source | Status |
| --- | --- | --- | --- |
| Kind | A: the issuer is the site URL of one customer; the customer admin makes the Client ID per registration | add-a-channel guide §0.2; R2 §3 | design |
| Text name and label | `Acme LMS`; `Acme LMS` | this channel | design |
| LTI profile | `acme-lms`: `endpoints: admin`, `issuerKind: per-tenant`, `endpointOrigins: any-https`, client assertion `aud` from `{platformValue}` (the stored audience, else the token URL), sharing `exclusive`, `privacyFloor: allowlist`, `dynamicRegistration: null` | LA-ADR-02 D4 (the `brightspace` form) | design |
| Issuer | the site URL (an origin, no path); the admin copies it from the Acme tool page | this channel | **UNVERIFIED** (simulated only) |
| Authentication endpoint default | `{siteUrl}/lti/auth` | this channel | **UNVERIFIED** (simulated only); the value on the Acme page wins |
| Token URL default | `{siteUrl}/lti/token` (on the issuer host) | this channel | **UNVERIFIED** (simulated only); the value on the Acme page wins |
| JWKS URL default | `{siteUrl}/lti/jwks.json` | this channel | **UNVERIFIED** (simulated only); the value on the Acme page wins |
| Token audience | no default: the client assertion `aud` is the token URL when the admin gives no audience | LA-ADR-02 D2 (`clientAssertionAud`) | design |
| Defaults are never trusted alone | the portal pre-fills them; the operator grant binds every value | LA-ADR-02 D6; LA-ADR-01 D2 (`FieldSpec.default`) | design |
| Guarded product family | `acme` at the `registration` level: new Dynamic Registrations of the family must use this channel; existing `lti-generic` connections of an Acme site keep working; a launch of the family on a Moodle `standard` platform is refused | LA-ADR-02 D1; LA-ADR-01 D6 | **UNVERIFIED**; the first real launch confirms it |
| Deployments | many per registration (string ids), so `deployments.multiple` | this channel | **UNVERIFIED** (simulated only) |
| Registration | `manual` with authority `operatorGrant` only. Acme LMS has no Dynamic Registration, so the manifest has no `dynamic` method and the profile has `dynamicRegistration: null` | LA-ADR-02 D6; load check 6 | design |
| Launch | `launch.windowHint: true` (the hint is sent only when the platform accepts `window`); `launch.topLevelContinue: false`; Acme opens a link in a frame by default | this channel | **UNVERIFIED** (simulated only) |
| Platform storage frame | none (`platformStorage` stays `null`) | this channel | **UNVERIFIED**: the frame name needs a live check |
| Deep Linking | Deep Linking 2.0; several items in one answer (`content.multiple: true`, as `lti-generic`); the `data` value in the settings claim; no `sub` in the response | A2 LA-ADR-05 D3b | design |
| Score rules | AGS final scores only (ADR-010) | ADR-010 | design |
| Scopes | the four AGS scopes `lineitem`, `lineitem.readonly`, `result.readonly`, `score`; no NRPS scope | A2 LA-ADR-05 D4 | design |
| Strict manual body | `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, optional `tokenAudience`, `grantCode`; the issuer origin must equal `siteUrl` | app API delta §3.4 | design |
| Tool configuration rows | the generic 8 rows of `lti-generic` (no `setup.toolRows`): `tool_name`, `login_url`, `redirect_uri`, `target_link_uri`, `jwks_url`, `deep_linking_url`, `scopes`, `privacy` | app API delta §3.3 | design; the Acme form field names are **UNVERIFIED** |
| Admin steps | Site administration › Integrations › LTI 1.3 tools › Add tool, then a deployment, then links | this channel | **UNVERIFIED** (simulated only) |

## Live status

No live platform exists. QA uses the Acme simulator provider `acme-lms-sim` (`tests/sim/acme-lms/index.mjs`): issuer `https://acme-lms.sim.test`, every endpoint on the issuer host, the token audience is the token URL, two string deployments. The kit fixture is `tests/ltiaas/kit/channels/acme-lms.json`. The K1 kit run on the simulator is pending QA.
