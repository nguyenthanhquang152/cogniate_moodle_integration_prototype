# ADR-002: Own LTI 1.3 implementation on `jose`, not `ltijs`

Status: Accepted (round 2). Date: 2026-10-16.

## Context

The LTI service needs the tool side of LTI 1.3 Advantage: OIDC login, `id_token` validation, JWKS, Deep Linking response, OAuth2 client credentials with `private_key_jwt`, AGS, NRPS, Dynamic Registration, and the LTIAAS-shaped REST API.

Facts (npm registry, 2026-10-16):

| Library | Version | License | Last change | Runtime dependencies |
| --- | --- | --- | --- | --- |
| `ltijs` | 7.0.7 | Apache-2.0 | 2026-10-06 | `express` 5, `mongoose` 9, `ioredis`, `jsonwebtoken`, `helmet`, `cors`, `zod` … Node ≥ 24 |
| `ltijs-sequelize` (SQL plugin) | 2.4.4 | — | 2022-05-08 (stale) | — |
| `jose` | 6.2.12 | MIT | 2026-09-05 | none |

## Options

| | A. `ltijs` | B. Own code on `jose` |
| --- | --- | --- |
| Effort | Lower for the protocol | About 1,500–2,500 lines of TypeScript plus tests |
| Storage | Needs MongoDB (or a stale plugin) | Our choice (SQLite, ADR-006) |
| Fit with the LTIAAS API | We still build the REST layer and map objects | One data model |
| Security checks | Inside the library | Each check is our code with a unit test (security §2.2) |
| Cookies, redirects, page headers | Library defaults (helmet defaults break framed tool pages) | Exactly as ADR-005 and security §5 need |
| Clean-room story | The library is by the LTIAAS author | Built from the 1EdTech specs |

## Decision

Option B.

- `jose` does: JWS verify and sign, local JWK sets (`createLocalJWKSet`), key generation, JWK export.
- `jose` does **not** fetch anything. The platform JWKS is fetched by our guarded HTTP client (security §2.4, §9).
- Our code does the message rules, claim checks, state and nonce, ltik, service keys, token client, AGS and NRPS calls, dynamic registration, LTIAAS shaping.
- RS256 only.

## Consequences

- More code. The T2 and T3 specs list each check as an acceptance criterion, and Reviewer-A maps them to the specs.
- No MongoDB.
- 1EdTech certification is a later production item.
- The Author does not read the `ltijs` source (clean-room process, ADR-001).
