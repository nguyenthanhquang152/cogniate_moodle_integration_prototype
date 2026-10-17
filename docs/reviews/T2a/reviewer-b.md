Verdict: APPROVE
Round: 1

# T2a review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 04f0a3c 7bfbbb1 -- . ':!docs' ':!tests'`. I read `services/lti-service/**`, `packages/shared/src/outbound.ts`, and the infra seed and bootstrap scripts. I did not review `apps/player-spike/**` (T5-spike, not a reviewed task). Spec: `tasks/T2a.md`, LTI contract §1–§7, ADR-002, ADR-006, ADR-008.

| Check | Result |
| --- | --- |
| `npm run check` in the main checkout (HEAD `c7155ca`, code = `7bfbbb1`) | Pass: 15 test files, 181 tests, about 5 s |
| Event names in the code compared with contract §5 | All match, except `internal_error` (B-T2a-03) |
| B-T1-12 (from T1) | Fixed: `demo.sh` calls `require_docker` first; `gen-env` refuses a **new** `.env` without Docker |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 4 | B-T2a-01 to B-T2a-04 |
| NIT | 2 | B-T2a-05, B-T2a-06 |

## Answers to the Lead's focus questions

- **Can a developer follow login → launch → ltik → idtoken in 15 minutes?** Yes. The reading order is `http/app.ts` (routes), then `lti/login.ts` (numbered steps 1–5), then `lti/launch.ts`, which is a straight list of `check1And3State`, `check2Cookie`, `check4Token` … `check12Target` in spec order. Then come `store/launches.ts` (`createLaunch` → ltik), `http/auth.ts` (header grammar → ltik lookup) and `lti/idtoken.ts` (claim mapping). Each function names its security or contract section. A short README with this order would make it faster (B-T2a-06).
- **Is each launch check small and separately testable?** Yes. `lti/checks.ts` has one exported function for each check (checks 1 and 3 are one atomic statement, as the design note asks). Each throws `LaunchCheckError {check, code}`.
- **Is there one place for error codes?** For protocol pages, yes (`lti/codes.ts`, typed, with status and action text). For API errors, no (B-T2a-02).
- **Unit-test quality:**
  - `checks.test.ts` has a pass case and table-driven fail cases for every check. The 60 s skew boundaries are tested (`exp = now − 59` passes, `now − 60` fails).
  - `app.test.ts` covers login, launch (replay, missing cookie with help text, OIDC error, platform switched off between login and launch, `ltik` inside `target_link_uri`), the ID token, the platforms API with tenant isolation, trace-id reuse, and a "no secret in the logs" test.
  - `outbound.test.ts` covers the DNS-rebinding order, redirects, size, timeout and the GET-only retry.
  - These tests prove the claims.
- **DB migrations:** Simple and correct: plain SQL files in name order, one transaction each, and a `schema_migration` table. One trap: B-T2a-04.
- **Config:** `loadConfig()` fails fast with a hint ("LTI_MASTER_KEY must be 64 hex characters (npm run gen-env)"). Knobs come from the T1 registry. The public URLs come from `loadPublicUrls()`. There are no URL literals.
- **Seed and bootstrap UX:** Good.
  - `seed-lti-manual.sh` prints numbered steps and ends with the launch URL to try.
  - The API key goes on stdin, never on a command line.
  - `register-platform.ts` uses the public API, so the seed tests the same path as a real client, and it is idempotent (409 → GET → PATCH).
  - `lti-bootstrap.sh --ensure-key-file --quiet` keeps the key out of the seed output.

---

## Findings

### B-T2a-01 — MINOR — One route file and an out-of-date ADR-008 layout will not scale to T3a–T3c

- **Location:** `services/lti-service/src/http/app.ts` (all routes, zod schemas, `platformView`, the platform URL rules); `src/store/accounts.ts`; ADR-008 "Layout" (`protocol/`, `api/`, `platform/`, `domain/`).
- **Problem:** The real folders are `lti/`, `http/`, `store/`, `db/` and `cli/`, which differ from ADR-008. All routes and their validation are in one 224-line `buildApp()`. T3a, T3b and T3c add about 15 more endpoints (deep linking, line items, scores, registrations, memberships) to the same function.
- **Evidence:**
  - The https rule and the issuer-origin rule (security §2.4) are inline in the `POST /api/platforms` handler (`app.ts` lines 186–193). T3b needs the same rule for dynamic registration (T3b self-check: "issuer-origin rule"), so it will make a second copy.
  - `store/accounts.ts` also holds RSA key generation, the JWKS, PEM export and private-key decryption, so a reader does not find "tool keys" under that name.
- **Suggested fix:**
  1. Keep the current folders, which are clear, and update ADR-008: `lti/` = protocol, `http/` = REST API, `store/` = repositories, `db/` = migrations, `cli/`.
  2. Split routes now into `http/routes/protocol.ts`, `http/routes/idtoken.ts` and `http/routes/platforms.ts`. Each registers itself on the app.
  3. Move the platform URL rules into a pure `lti/platform-rules.ts` with unit tests, for T2a and T3b.
  4. Move the key functions into `store/tool-keys.ts`.

### B-T2a-02 — MINOR — API error codes are untyped strings in several files

- **Location:** `src/http/errors.ts` (`ApiError(status, code: string, description)`); `src/http/auth.ts` (`DESCRIPTIONS`); `src/http/app.ts` (literals such as `'UNREGISTERED_PLATFORM'`, `'PLATFORM_ALREADY_EXISTS'`, `'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'`).
- **Problem:** A typo in an API code compiles and passes lint, but it breaks contract §1.3 without any warning. The protocol codes are better: `ProtocolErrorCode` with `PROTOCOL_ERRORS` in `lti/codes.ts`.
- **Evidence:** The status and the description of each API code are written at each `throw` site. T3a adds about 10 codes (`SERVICE_NOT_AVAILABLE`, `INVALID_LINE_ITEM_ID`, `PLATFORM_CONFLICT`, …).
- **Suggested fix:** Add `http/api-codes.ts` with `type ApiErrorCode` and `API_ERRORS: Record<ApiErrorCode, { status, description }>`, taken from contract §1.3. `ApiError` then takes an `ApiErrorCode` (an optional description override is fine). Add one unit test that lists the contract §1.3 codes and compares them with the keys.

### B-T2a-03 — MINOR — A failed launch does not log *why* it failed, and two log values are outside the contract

- **Location:** `src/http/app.ts` (`launch_check_failed {check, code}`); `src/lti/checks.ts` (the `detail` text of each `fail()`); `src/lti/jwks.ts` and `check6Signature` (every error → `INVALID_SIGNATURE`); `src/lti/launch.ts` line 79 (`check: 'platform_active'`); `src/http/app.ts` line 100 (`internal_error`).
- **Problem:** A human with only the log cannot tell a wrong Moodle clock from an expired token, or an unreachable JWKS from a tampered token.
- **Evidence:**
  - Each check knows the reason (`expired`, `issued in the future`, `exp or iat missing`, `iss does not match`, `azp does not match` …), but this `detail` is dropped and only `{check, code}` is logged.
  - `check6Signature` catches every error from `keys.verify`: JWKS non-200, network error, no `keys` array, no matching key after the refetch, or a bad signature. All of these become the same `INVALID_SIGNATURE`. The `outbound_request` or `outbound_blocked` event with the same trace id helps, but only if the reader knows to look for it.
  - Contract §5 allows `check` = 1–12 or `oidc_error`. The code also logs `platform_active`, and it logs an `internal_error` event that is not in the §5 table.
- **Suggested fix:**
  1. Add a fixed `reason` field (a closed snake_case set for each check, never token data) to `launch_check_failed` and to contract §5. Examples: check 7 `expired` / `iat_in_future` / `missing_exp_iat`; check 6 `jwks_fetch_failed` / `jwks_invalid` / `no_matching_key` / `bad_signature`; check 5 `iss_mismatch` / `aud_mismatch` / `azp_mismatch`.
  2. Use fixed reasons instead of the free `detail` text. Today the `alg` detail contains a value from the token.
  3. Add `platform_active` (or `reason: platform_inactive` under check 1) and the `internal_error {error}` event to contract §5.

### B-T2a-04 — MINOR — An edited migration file is skipped without a warning

- **Location:** `src/db/index.ts` `openDb()` (`schema_migration (name, applied_at)`); ADR-006.
- **Problem:** The runner records only the file name. If a developer edits `001_init.sql` after it ran (a common shortcut during T3a, which adds tables), existing dev databases keep the old schema and fresh ones get the new one. The failure appears later as "no such column" in an unrelated request.
- **Evidence:** `if (done.has(name)) continue;`. No hash is stored, and no test re-opens an existing database.
- **Suggested fix:**
  1. Store the SHA-256 of each applied file. At start, if the hash of an applied file changed, stop with: "Migration 001_init.sql changed after it was applied. Add a new file (002_…sql), or run npm run stack:reset."
  2. Add a unit test: open, apply, edit, open again → the error.
  3. Write the rule "never edit an applied migration" in ADR-006.

### B-T2a-05 — NIT — The same "unknown tool account" gives two different codes

- **Location:** `src/lti/login.ts` line 20 (`UNKNOWN_TOOL_ACCOUNT`, 404); `src/lti/launch.ts` line 60 (`INVALID_STATE`, check `1`, "unknown tool account").
- **Problem:** The same condition gives different codes on the login and launch pages, so a support person sees two names for one problem.
- **Suggested fix:** Use `UNKNOWN_TOOL_ACCOUNT` on launch too. Or keep `INVALID_STATE` (no state can exist for an unknown account) and write that choice in security §2.2.

### B-T2a-06 — NIT — No short "how to read this service" note

- **Location:** `services/lti-service/` (no README).
- **Problem:** The team is new to LTI. The code is easy to read, but nothing tells a newcomer where to start, or which file holds which contract or security section.
- **Suggested fix:** Add a README of about 15 lines in STE. It gives the reading order of the summary above, the folder roles (B-T2a-01), the two CLIs, and links to contract §2, §3, §5 and security §2.2. Optional: one Mermaid sequence diagram (login → launch → ltik → `/api/idtoken`).
