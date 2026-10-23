# Channel `lti-generic`

Any kind A LTI 1.3 platform that has no named channel, for example Sakai, Open edX or Absorb (LA-ADR-02 D1). The manifest is `manifest.ts`, the LTI profile is `lti-profiles.ts`. There is no `app.ts`: the profile has `endpoints: admin`, so the kernel admin-value setup adapter of the app serves the channel (LA-ADR-01 D5).

## Facts and sources

| Fact | Value | Source |
| --- | --- | --- |
| Text name and label | `LMS` (the templates add "your" or "this": "your {LMS}", "this {LMS} site"); `Other LTI 1.3 platform` | LA-ADR-02 D3; A1 BD-A1-111 |
| LTI profile | `lti-generic`: `endpoints: admin`, `issuerKind: per-tenant`, `endpointOrigins: any-https`, client assertion `aud` from `{platformValue}` (the stored token audience, else the token URL), Dynamic Registration `path-prefix` with an opaque bearer token, `privacyFloor: allowlist` | LA-ADR-02 D2 |
| Platform storage | `{ targetFrame: 'from-login', origin: 'authOrigin' }` | A2 LA-ADR-05 D1 rule 1a |
| Registration | `dynamic` with authority `self` (only under I-SELF; else staged with a grant); `manual` with authority `operatorGrant` (the grant binds every admin value) | LA-ADR-02 D2a, D3, D5 item 10, D6 |
| Create | `siteUrl` is an https origin that passes site rules 1–4 | app API delta §3.1 |
| Manual body | `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, optional `tokenAudience`, `grantCode`; the issuer may have a path, its origin must equal `siteUrl`; `issuer` defaults to the site URL | app API delta §3.4; LA-ADR-01 D2 (`FieldSpec.default`) |
| Tool configuration rows | `tool_name`, `login_url`, `redirect_uri`, `target_link_uri`, `jwks_url`, `deep_linking_url`, `scopes`, `privacy` | app API delta §3.3 |
| Capabilities | Dynamic Registration, several deployments, `window` hint, AGS reporter with read-back, several Deep Linking items; the four AGS scopes and no NRPS scope | LA-ADR-02 D3; A2 LA-ADR-05 D3b, D4 |
| Guarded product family | none | LA-ADR-02 D1 |

## Live status

No live platform was tested. QA uses the generic simulator provider (LA-ADR-02 D7): issuer with a path, token on a second host, an opaque registration token, many deployments.
