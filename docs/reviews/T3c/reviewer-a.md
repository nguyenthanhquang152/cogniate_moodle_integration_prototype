Verdict: APPROVE
Round: 1

# T3c review: Reviewer-A (correctness and security)

Scope: `git diff dc068e9^1 dc068e9 -- . ':!docs' ':!tests'` (19 files; built by Author-2, Codex). Spec: `tasks/T3c.md`, LTI contract §0 (T3c rows), §3.2 (`/form`, `/message`), §3.4, §3.5 (write rows), §3.7, §3.9 (DELETE), §3.10, §8; security §2, §8, §9; ADR-001, ADR-003.

Method:
- I read every changed file: `compat.ts`, `service-context.ts`, `nrps.ts`, the `ags.ts` write path, `deep-linking.ts`, platform DELETE and the store, the `services.ts` refactor, the compat Dockerfile, the compose profile and `compat-run.sh`.
- I read the 13 unit test names and their key assertions in `compat.test.ts`.
- I checked the FK cascade in the LTI service migrations and the `foreign_keys` pragma.
- I checked the registration update path after a platform delete.
- I listed the file names (not the contents) in `infra/.secrets`.
- Live: the Author's running LTI service predates the merge (all new routes give `404 "Unknown route"`), so I made no live checks of T3c. QA must run the ACs on a rebuilt stack.
- I did not read `reviewer-b.md`.

## What is right (checked, no finding)

- **Line-item writes (AGS).** `createLineItem`, `updateLineItem` and `deleteLineItem` first run `checkedUrl` (the §3.4 rule: claim origin, path prefix, every claim query parameter such as `type_id`, and refusal of `%2F`, `%5C`, `%2E`, `%25`, backslash and dot segments). They then run `needScope(lineitem)`, which needs the exact `lineitem` scope, so `lineitem.readonly` alone gives `403 SERVICE_NOT_AVAILABLE`.
  - Both checks run before the token request and before any outbound call (tests: "reject readonly or missing scopes before any outbound attempt" and "reject foreign, missing-query and encoded-separator URLs without outbound calls").
  - `POST` goes only to the claim's `lineitems` URL, after the same rule.
  - The body is checked: label 1–255 characters, `scoreMaximum > 0`, ISO dates, capped strings.
  - Each call is one guarded outbound request, so there is one `outbound_*` event for each attempt.
- **NRPS memberships.**
  - **Privacy:** only `userId`, `roles` and `status` leave the client. `name`, `email`, `given_name` and `picture`, and unknown `context` keys, are removed (Zod strips unknown keys). The test feeds them in and checks that they are absent.
  - **SSRF:** `isAllowedServiceUrl(q.url ?? base, base)` (the same §3.4 rule) runs on the raw value before the platform token request, so `url` on `https://evil.test` gives `400 INVALID_URL_PARAMETER` with no outbound call. A `url` replaces the other filters.
  - **Filters:** `role` (short name or URI) is passed unchanged and URL-encoded. `limit` is 1–999999.
  - **Errors:** platform errors use `platformResponseError(res, false)`, so a roster error never echoes the platform body. A launch without an NRPS claim gives `403`.
- **Platform DELETE.**
  - It is scoped by account in SQL (`DELETE FROM platform WHERE tool_account_id = ? AND id = ?`), so account A cannot delete account B's platform and gets `404 UNREGISTERED_PLATFORM`.
  - `PRAGMA foreign_keys = ON` is set in the shared opener, and `deployment`, `oidc_state`, `launch` and `service_key` have `ON DELETE CASCADE`. Old ltiks and service keys therefore stop working: auth finds no row, and `platformOf` also refuses a missing platform.
  - The test checks the scope, the cascade, and that a new platform with the same values does not revive old keys.
  - An open registration "update" session that names the deleted platform is refused (`REGISTRATION_UPDATE_NOT_ALLOWED`, `getPlatform(...) !== null`).
  - Platform access tokens are only in memory, keyed by platform id, and are never used again.
- **Deep linking `/message` and `/form`.** Both reuse the T3a signed response (`signedDeepLink`), so the claims, the 1–20 items, `accept_types`, the default `url`, `iat − 30 s` and `exp + 300 s` do not change. Only a deep-linking ltik is accepted, never service auth. `/form` HTML-escapes the `action` and the `JWT` value, and the script is fixed. For the value of `action`, see A-T3c-01.
- **OAuth stubs.** They need a Bearer API key, then answer `501 NOT_IMPLEMENTED` with the error shape and the trace id.
- **Refactor.** `platformOf`, `agsContext` and the deep-link signing moved to `service-context.ts` without a logic change. Account scope (`getPlatform(db, account.id, …)`) and `PLATFORM_NOT_ACTIVE` still apply to every service route.
- **Compat container.**
  - `python:3.12-slim` with `ltiaas==0.0.4`. The build fails unless the installed version is 0.0.4 and the metadata license is MIT.
  - `REQUESTS_CA_BUNDLE` points to the name-constrained dev CA (`DNS:test`).
  - `tests/compat` is mounted read-only with `create_host_path: false`.
  - No secret is baked into the image: keys come from read-only runtime mounts, and `QA_*` values are passed by name, not on the command line.
  - The product imports no SDK code (ADR-001).

## Codex's three questions

1. **Membership privacy.** Keep "never". The code is stricter than contract §3.7 ("only when the platform sends them"), and that is right: the prototype registers with `privacyLevel: anonymous`, and the app needs no personal data. The Architect should change §3.7 to "never", and add a §8 difference row, because LTIAAS returns the fields when the platform sends them.
2. **Empty AGS metadata.** Accepting `""` or `null` for the optional fields (`resourceId`, `tag`, `startDateTime`, `endDateTime`) on `PUT` is right. Moodle returns them empty, so a GET-modify-PUT round trip must pass. The values are capped, and they go only to the line item URL that passed the claim check.
3. **OAuth auth.** Keep the Bearer check before `501`: every `/api` route needs auth, and an unauthenticated stub adds surface for nothing. The Architect should write "Bearer; `401` without it" in §3.10, and AC-T3-21 should send the API key.

## Findings

### A-T3c-01: MINOR: `/form` (and `target`) uses the platform's `deep_link_return_url` without a URL check, so a `javascript:` URL can run in the tool's page

- Location: `services/lti-service/src/lti/deep-linking.ts` (`target: settings.deep_link_return_url`; `deepLinkingForm`); `lti/checks.ts` check 11 only needs a non-empty string.
- Problem: the auto-submitting form uses the platform-sent `deep_link_return_url` as its `action`. HTML escaping does not change `javascript:alert(document.domain)`, so a tool that inserts the `/form` HTML (the LTIAAS way of using it) runs that script in its own origin when the form submits itself.
- Evidence:
  - No rule checks this URL. Security §2.4 covers only the auth, token and JWKS URLs.
  - A registered platform signs its own id tokens, so any admin of a connected platform controls this claim.
  - The Cogniate app is not affected: it uses `/api/deeplinking`, checks that `target` is on the issuer origin (`RETURN_URL_MISMATCH`), and sends CSP `form-action {return origin}`.
- Impact: compatible third-party tools get an XSS that one platform's admin can start against the tool's other users. That is outside the normal trust given to a platform.
- Fix: require `deep_link_return_url` to be an https URL on the platform issuer origin. Moodle puts `contentitem_return.php` under wwwroot, which is the issuer origin. Do this in check 11, or in `deepLinkingResponse` before signing. Add the rule to security §2.4. Add a unit test for `javascript:…`, `http:` and another https origin.

### A-T3c-02: NIT: the compat container gets every dev secret and runs unpinned third-party dependencies

- Location: `infra/compose.yaml` service `compat` (`./.secrets:/run/secrets:ro`); `infra/compat/Dockerfile` (`pip install ltiaas==0.0.4` without hashes or pinned dependencies).
- Problem: the runner needs only `lti-api-key.cogniate` and `seed.json`, but it also gets `lti-api-key.qa-second` and `app/`. Its dependency set (for example `requests`) is resolved at build time from PyPI, and the container has internet access.
- Impact: small (local dev keys only). But it is the one container that runs code that we did not write.
- Fix: mount only the two files. Pin the full dependency set with hashes (`pip install --require-hashes -r requirements.txt`). Optionally put the container on a network that reaches only the proxy.

## Counts

0 BLOCKER, 0 MAJOR, 1 MINOR (A-T3c-01), 1 NIT (A-T3c-02).
