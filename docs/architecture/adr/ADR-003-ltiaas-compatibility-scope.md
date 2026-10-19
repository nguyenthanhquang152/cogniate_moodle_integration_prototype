# ADR-003: LTIAAS compatibility scope for the prototype

Status: Accepted (round 2). Date: 2026-10-16.

## Context

The LTI service must be API-compatible with the public LTIAAS API (inputs §3). "Compatible" needs a meaning that QA can test and that humans can repeat safely. Our source is the public API reference in `.research_cache/ltiaas_docs/` (read only by the Architect, ADR-001). It has gaps.

## Decision

### Endpoint scope

| Endpoint | Auth | Scope | Task |
| --- | --- | --- | --- |
| `GET /api/idtoken` (`raw=true`) | LTIK-AUTH-V2 | In | T2a |
| `POST /api/deeplinking` | LTIK-AUTH-V2 | In | T3a |
| `POST /api/deeplinking/form` | LTIK-AUTH-V2 | In | T3c |
| `POST /api/deeplinking/message` | LTIK-AUTH-V2 | Alias of `/api/deeplinking` (no public doc has this path; the alias does no harm) | T3c |
| `GET /api/lineitems`, `GET /api/lineitems/:id`, `GET` and `POST /api/lineitems/:id/scores` | LTIK-AUTH-V2, SERVICE-AUTH-V1 | In | T3a |
| `POST /api/lineitems`, `PUT` and `DELETE /api/lineitems/:id` | LTIK-AUTH-V2, SERVICE-AUTH-V1 | In | T3c |
| `GET /api/memberships` | LTIK-AUTH-V2, SERVICE-AUTH-V1 | In (the app does not use it) | T3c |
| `GET /api/registrations/:id`, `POST /api/registrations/:id/complete` | Bearer | In. **Paths are ours** (the public page shows only the parameter). | T3b |
| `GET`, `POST /api/platforms`, `GET`, `PATCH /api/platforms/:id` | Bearer | In. **Paths are ours.** Fields follow the public Platform object. | T2a |
| `DELETE /api/platforms/:id` | Bearer | In. Path is ours. | T3c |
| OAuth2 access token and refresh | Bearer | Stub `501` | T3c |
| Dashboard, account subdomains, billing | — | Out | — |

Protocol endpoints (`/lti/login/{id}`, `/lti/launch/{id}`, `/lti/keys/{id}`, `/lti/register/{id}`) are ours. LTIAAS documents only `/lti/launch` as the content item URL. We keep that path and add the tool account id, because one host serves several accounts.

### Promises

| # | Promise |
| --- | --- |
| P1 | Same paths (relative to the base URL), methods, auth schemes and header grammar for the "In" endpoints, except the "paths are ours" rows. |
| P2 | Same request field names and types. Unknown request fields are ignored. |
| P3 | Same response field names and types. We may add fields. We do not remove or rename. |
| P4 | Same error body. Where the public docs show a `details.message` code, we use it. `description` is not stable. |
| P5 | Status codes as in the contract. |
| P6 | `ltik` and `serviceKey` are opaque. ltik: 24 h. Service key: no expiry. |
| P7 | Tested with Moodle 5.2 only. |

The exact claim, for all documents and for the product team:

> The LTI service implements the listed endpoints with the paths, header schemes and field names of the public LTIAAS API reference, except the differences in contract §8. An independent client (the MIT `ltiaas` Python SDK, used as a test-only black box) passes our compatibility test for `idtoken`, deep linking, scores and memberships (AC-T3-27), with line item ids passed to the SDK URL-encoded once (the SDK encodes them again; the service accepts this double-encoded form, contract §1.4; raw ids stay `404`, D15).

Do not say "a copy of LTIAAS" or "works with any LTIAAS tool".

### Differences

The full table is in [contract §8](../contracts/lti-service-api.md): account selection, API key format, token formats, our paths for registrations and platforms, `privacyLevel` default `anonymous` (public docs: `public`), `JWK_SET` only, `publicKey` meaning, `resourceLink` omitted for deep linking, additions, OAuth stubs, Moodle-only testing.

### Choices where the public docs are unclear

| Topic | Choice |
| --- | --- |
| Presentation target key (`documentTarget` in the guide, `document_target` in the reference) | Return both. |
| `launch.type` (reference lists only `LtiResourceLinkRequest`) | Also `LtiDeepLinkingRequest`. |
| `PUT /api/lineitems/:id` status (reference: `201`) | `201`. |
| Score `timestamp` (not in the request; AGS requires it; Moodle returns 409 for an older or equal second) | The service sets it, ≥ last + 1 s. An optional `timestamp` in the body is accepted. |
| Service key scope ("one launch context, usually an activity") | One key per (platform, deployment, context, resource link). |
| Invalid API key on Bearer endpoints (example shows `INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`) | Use that code. |
| Invalid service key (not documented) | `INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`. |
| Scores GET paging | `next`, `prev`, `first`, `last` (from the `Link` header). |

## Consequences

- QA tests every promise black-box (T2a, T2b, T3a, T3b, T3c), plus the independent-client test.
- LTIAAS-only features (OAuth for Canvas, dashboard) are not there.
- If LTIAAS changes its public API, we do not follow automatically. A human decides (Q1).
