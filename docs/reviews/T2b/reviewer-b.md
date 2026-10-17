Verdict: APPROVE
Round: 1

# T2b review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 433cf5e 162d4d4 -- . ':!docs' ':!tests'` (40 files). Spec: `tasks/T2b.md`, including the T2a side items, and local-stack §3.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD `cd2ebed`, contains `162d4d4`) | Pass: 22 test files, 306 tests |
| Profile probe: `/tmp` export of `162d4d4`, fake `docker` first in `PATH` (records calls, no real Docker, no stack touched) | A, D correct; B, C show a trap (B-T2b-01) |
| lti-service `ApiError` use | 13 typed `new ApiError('<CODE>')` in `http/app.ts`, 0 in the old numeric style; `auth.ts` imports the shared type |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T2b-01, B-T2b-02 |
| NIT | 1 | B-T2b-03 |

## My T2a items

| Id | Status | Evidence |
| --- | --- | --- |
| B-T2a-02 (typed API codes) | **Resolved for lti-service** | `packages/shared/src/errors.ts`: `API_ERRORS` (`as const satisfies`), `ApiErrorCode`, and an `ApiError(code, description?, {status?})` that refuses a status not in the table. All lti-service handlers use it. For the app side, see B-T2b-02. |
| B-T2a-03 (`launch_check_failed.detail`) | **Resolved** | Fixed snake_case reasons for each check (`state_missing`, `cookie_mismatch`, `alg=<safeWord>`, `iss_mismatch`, `azp_missing`, `kid_unknown`, `jwks_fetch_failed`, `jwks_unavailable`, …). `safeWord()` reduces a token value to `[A-Za-z0-9_.-]{1,40}` or `other`. Contract §5 documents `detail` and `platform_active`. |
| B-T2a-04 (migration checksum) | **Resolved for lti-service** | `packages/shared/src/migrations.ts` (`openSqlite`, `applyMigrations`, `transaction`, `MigrationChangedError`). `lti-service/src/db/index.ts` is now a thin call. Tests cover order, SHA-256 stored, changed file, removed file, the one-time upgrade of an old bookkeeping table, rollback of a failing migration. cogniate-app moves in T3a (B-T4a-01). |
| B-T2a-01 (split `http/app.ts`) | Scheduled (T3a) | — |

## Lead's focus questions

- **Profile switching UX and failure modes:**
  - The rule is clear and written in `lib.sh`: only `stack-up.sh` changes the profile, and the value is saved in `.tmp/stack-profile.<project>`. Every other command uses the saved value.
  - `stack:up` prints `(profile: acceptance)`, and `print_urls` adds "Profile: acceptance … Back to default: npm run stack:up".
  - A wrong value stops with "STACK_PROFILE must be default or acceptance, got 'acceptence'" (probe D).
  - `test:acceptance` restores the default in an `EXIT` trap, also after a failure or Ctrl+C, and it removes its named e2e container.
  - `stack:down` and `stack:reset` handle both profiles, and reset deletes the saved profile.
  - The two traps are in B-T2b-01.
- **`infra/qa-hosts/` layout:** Good. There is one dependency-free file `qa-hosts.mjs` with two documented modes (`--mode=sink|static`). The log lines have the same format as the services (with a boot trace id). Health runs on plain HTTP `:8080` and is never logged as a hit. Path resolution for the static host stays inside the root. Compose gives each host its own alias and the `qa.crt` leaf, so the T1 proxy and leaf do not change.
- **Readability of the profile logic:** Good. `saved_profile` and `apply_profile` are small. `stack-up.sh` recreates the QA hosts only when `qa.crt` changed. The comments explain the "why" (for example that `docker compose run` without a TTY does not stop its container on SIGINT).
- **Shared modules API:** `migrations` is clear and general. `errors` is shaped for one service (B-T2b-02).
- **Tests for the fallback and the migration runner:** Good.
  - `jwks.test.ts` has one fake-clock test for each branch of the 24 h rule (refresh fails → cached keys at most once per minute; 24 h without a good fetch → `jwks_unavailable`; first fetch fails; unknown kid → `kid_unknown`; bad signature).
  - The constants have names (`JWKS_REFRESH_MS`, `JWKS_MAX_AGE_MS`, `JWKS_ATTEMPT_MIN_MS`).
  - `KeyFailure` is a closed type.
  - The migration tests are listed above.

---

## Findings

### B-T2b-01 — MINOR — `npm run demo` keeps a saved `acceptance` profile, and an exported `STACK_PROFILE` makes the "back to default" hint fail

- **Location:** `infra/scripts/lib.sh` (`apply_profile` exports `STACK_PROFILE`; `REQUESTED_PROFILE="${REQUESTED_PROFILE-${STACK_PROFILE-}}"`); `infra/scripts/stack-up.sh` (`profile="${REQUESTED_PROFILE:-default}"`); `infra/scripts/demo.sh` (sources `lib.sh`, then runs `stack-up.sh`); `print_urls` hint.
- **Problem:** `stack-up.sh` cannot tell a user's request from a value that a parent script exported. So:
  - (a) A script that sources `lib.sh` and then calls `stack-up.sh` keeps the saved profile instead of going back to `default`.
  - (b) If `STACK_PROFILE=acceptance` is exported in the developer's shell, the printed fix "Back to default: npm run stack:up" does not work.
- **Evidence (probe with a fake `docker`):**
  - A. Saved `acceptance`, plain `bash infra/scripts/stack-up.sh` → `(profile: default)`, saved `default`. Correct.
  - B. Saved `acceptance`, `bash infra/scripts/demo.sh` → `compose up` with `COMPOSE_PROFILES=acceptance`, `(profile: acceptance)`, saved `acceptance`. So a demo after a killed acceptance run stays in acceptance mode, which is the case that T0 B-T0-23 described. A T7 `e2e:reset` built like `demo.sh` would fail AC-T7-13 (`profile: "default"`) for a reason that is hard to see.
  - C. `STACK_PROFILE=acceptance` in the shell, then "npm run stack:up" as the hint says → still `(profile: acceptance)`.
- **Suggested fix:**
  1. In `lib.sh`, keep the effective profile in an internal variable that is **not** exported (for example `ACTIVE_PROFILE`). Export only `COMPOSE_PROFILES` and `ACCEPTANCE_ALLOWLIST_EXTRA`. Then `stack-up.sh` sees only a real request in `STACK_PROFILE`.
  2. `demo.sh` (and later `e2e:reset`) calls `STACK_PROFILE=default stack-up.sh`, as the `test:acceptance` cleanup already does.
  3. If `STACK_PROFILE` comes from the shell, `stack-up.sh` says so: "STACK_PROFILE=acceptance is set in your shell. To go back: unset STACK_PROFILE; npm run stack:up."

### B-T2b-02 — MINOR — The shared `errors` module holds the LTI service's codes, so cogniate-app cannot use it in T3a as planned

- **Location:** `packages/shared/src/errors.ts` ("the one typed list of LTI service API codes"; `ApiError(code: ApiErrorCode, description?, {status?})` with no `extra`); `services/cogniate-app/src/app/errors.ts` (own `ApiError` with `extra`); `tasks/T3a.md` design note B-T4a-01 ("move … `ApiError` (`errors`)").
- **Problem:** T3a is to move cogniate-app onto the shared `ApiError`. But the shared type accepts only LTI contract §1.3 codes, and it cannot carry `details` fields. cogniate-app needs its own codes (`ORIGIN_NOT_ALLOWED`, `NOT_SIGNED_IN`, `PACKAGE_REJECTED`, `MASTERY_SCORE_NOT_ALLOWED`, …) and `extra` (`reasons`, `action`, `field`). T3a would have to mix two contracts' codes in one list, or drop the details.
- **Evidence:**
  - `API_ERRORS` lists only LTI codes.
  - `ApiError.body()` calls `apiErrorBody(status, code, description)` without `extra`.
  - cogniate-app imports no `ApiError` from `@cogniate/shared` today.
  - `errors.test.ts` compares the table with a hand-copied list ("Update both together"), so it cannot notice a change in the contract file.
- **Suggested fix:** Keep the mechanism in shared, and keep each code table in its service. For example, `defineApiErrors(table)` returns a typed `ApiError` class (with an optional `extra`) for that table. The tables go in `lti-service/src/http/api-codes.ts` (contract §1.3) and `cogniate-app/src/app/api-codes.ts` (app contract §1). Optionally, the unit test reads the §1.3 table from `docs/architecture/contracts/lti-service-api.md`, so it fails when the contract changes.

### B-T2b-03 — NIT — Small consistency points

- **Location and fix:**
  - `services/lti-service/src/http/app.ts` line 131 logs `login_rejected {code, detail}`, but contract §5 lists only `code`. Add `detail` (safe reason) to the contract row.
  - `infra/compose.yaml`: `QA_PLATFORM_DIR` is relative to `infra/` (the compose project folder), not to the repo root. A QA engineer who sets `QA_PLATFORM_DIR=tests/fixtures/x` gets an empty mount. Resolve it to an absolute path in `lib.sh` (relative to the repo root), or write "relative to `infra/`" in `infra/README.md`.
