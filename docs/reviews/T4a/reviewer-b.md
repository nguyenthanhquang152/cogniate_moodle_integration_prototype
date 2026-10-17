Verdict: APPROVE
Round: 1

# T4a review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff c3746bb 3ec5222 -- . ':!docs' ':!tests'` (50 files). I read `packages/package-inspector/**`, `services/cogniate-app/src/**`, `packages/shared/src/crypto.ts`, the ESLint fence, and the seed changes. Spec: `tasks/T4a.md`, app contract §1–§3 and §12, ADR-006, ADR-008.

| Check | Result |
| --- | --- |
| `npm run check` (main checkout, code = `3ec5222`) | Pass: 20 test files, 249 tests, about 5 s |
| Import fence probe: a temporary file in `content-host/` that imports `../domain/db.ts` and `../app/errors.ts` | Two ESLint errors with the ADR-008 message. Probe file deleted, tree clean. |
| Reject codes and tests | Each of the 15 codes has 2–9 package-level test hits and ≥ 1 app-level hit (`grep` count) |
| Events in the app code compared with contract §12 | `csrf_rejected`, `package_accepted`, `package_rejected` and `http_request` match. `internal_error` is not in §12 (B-T4a-03). |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T4a-01, B-T4a-02 |
| NIT | 2 | B-T4a-03, B-T4a-04 |

## Answers to the Lead's focus questions

- **Is the inspector easy to read and extend?** Yes. Each rule has one place:
  - `names.ts`: one entry name (order written in the header).
  - `zip.ts` `scanEntries`: central-directory rules (encryption, method, symlink, ratio, duplicates, total size).
  - `manifest.ts`: SCORM rules.
  - `inspect.ts` `profile`: detection, pages, questions, hosts. The order of the steps is in the function comment.
  - `extract.ts`: runs the entry checks again, writes with `wx` and checks the CRC, so it is safe alone.
  - To add a rule, a developer adds one code to `REJECT_CODES` and one check in the right file.
- **Are the reject codes in one typed list?** Yes: `REJECT_CODES` → `RejectCode`. The user text is not in that list (B-T4a-02).
- **Folder layout and import fence:** `app/`, `domain/`, `content-host/` and `cli/` match ADR-008 (`tool-pages/` and `worker/` come later). The fence works (probe above), and its message names the rule.
- **Unit-test quality:**
  - `inspect.test.ts` has one test for each reject code, often with several variants (for example `PATH_TRAVERSAL` for `../evil.html` and `a/../../evil.html`, `DUPLICATE_ENTRY` after case folding, NFC, and file-vs-folder).
  - It also has "lists every bad entry", detection and profile on the real fixtures (copied to a temp folder), and extraction failures (bad CRC, bad deflate, an existing folder).
  - `app.test.ts` repeats the 15 codes through HTTP, checks that the package store does not change, and covers the over-limit upload on a real socket.
  - These tests prove the claims.
- **Error messages that a Cogniate user can act on:** Partly. The `detail` texts are correct but technical, and none says what to do (B-T4a-02).
- **Seed and portal-user UX:**
  - The portal users come from `.env` (`PORTAL_*` passwords). Their passwords go on stdin.
  - `seed-portal.ts` is idempotent: it finds the library by name and the user by email, and rehashes only on a change.
  - The last seed line names the users and where the passwords are.
  - One readability point: B-T4a-04.
- **Consistency with lti-service:** The patterns are the same in spirit (`loadConfig()`, `ApiError`, the trace-id hook, `http_request` with route patterns, plain SQL migrations). But they are copied, not shared, and the copies already differ (B-T4a-01).

---

## Findings

### B-T4a-01 — MINOR — The two services copy the same infrastructure code, and the copies already differ

- **Location:** `services/cogniate-app/src/domain/db.ts` vs `services/lti-service/src/db/index.ts`; `cogniate-app/src/app/errors.ts` vs `lti-service/src/http/errors.ts`; `packages/shared/src/crypto.ts` vs `lti-service/src/crypto.ts`; `cogniate-app/src/app/session.ts` `readCookie` vs `lti-service/src/lti/checks.ts` `readCookie`; `cogniate-app/src/main.ts` (`startService` + Fastify `app.server`) vs `lti-service/src/main.ts` (own start and stop). ADR-008 `packages/shared` module list.
- **Problem:** A team that learns "one style" now has two copies of the migration runner, `transaction()`, `ApiError` / `apiErrorBody`, the crypto helpers and `readCookie`, and two ways to start a service. A fix in one copy does not reach the other.
- **Evidence:**
  - The app migration runner stores a SHA-256 and stops on a changed file (good, ADR-006). The lti-service runner does not (B-T2a-04 is still open there).
  - The app `ApiError` has an `extra` field, and the lti-service one does not.
  - `packages/shared/src/crypto.ts` (new in T4a) has five of the six functions of `lti-service/src/crypto.ts`, but lti-service still imports its own copy (0 imports of the shared module).
  - ADR-008 already lists a shared `errors` module, but neither service uses it.
- **Suggested fix (cheapest now, with two services; do it in T2b or T3a, which already carry B-T2a-01..04):**
  1. lti-service imports `@cogniate/shared` crypto, and keeps only `newApiKey` locally.
  2. Move `openDb` (with the checksum rule), `transaction` and `MigrationChangedError` to a shared `db` module that takes the migrations folder as an argument. Add `db` to the ADR-008 module list.
  3. Move `ApiError` and `apiErrorBody` (with `extra`) to the shared `errors` module, and `readCookie` to `server`.
  4. Use one start pattern for Fastify services, for example `startService` with a Fastify `build`, as cogniate-app does now.

### B-T4a-02 — MINOR — Reject reasons say what is wrong, but not what the user should do

- **Location:** `packages/package-inspector/src/codes.ts` (`REJECT_CODES` holds names only); the `detail` strings in `names.ts`, `zip.ts`, `manifest.ts`, `inspect.ts`; `tasks/T6.md` AC-T6-06 ("reject reasons in plain words").
- **Problem:** A Cogniate course creator who sees a 422 reason cannot act on most of them. T6 must invent its own plain text for each code, which makes a second text list.
- **Evidence:**
  - Examples of the current `detail` texts: "The entry uses compression method 12. Only stored (0) and deflate (8) are supported.", "The SCO href is not a file in the zip.", "The manifest has no resource with adlcp:scormtype=\"sco\".", "The zip data cannot be read.", "The entry name has a \"..\" segment."
  - lti-service already solved this kind of problem with one table: `PROTOCOL_ERRORS` in `lti/codes.ts` (status + action line for each code).
- **Suggested fix:** Make `codes.ts` the one place for the user text: `REJECT_INFO: Record<RejectCode, { title: string; action: string }>`. Examples:
  - `PATH_TRAVERSAL` → title "The package has an unsafe file path", action "Export the course again from Cogniate. Do not add files by hand."
  - `SCORM_VERSION_UNSUPPORTED` → "Export as SCORM 1.2".
  - `ZIP_TOO_LARGE` → "Make the course smaller than 200 MB".

  Return `action` as an additive field in each reason (contract §3.2 allows additive fields). T6 shows `title`, `path` and `action`. A unit test checks that every code has an entry.

### B-T4a-03 — NIT — `internal_error` is not in the app contract's event table

- **Location:** `services/cogniate-app/src/app/server.ts` (`log.error('internal_error', …)`); app contract §12.
- **Problem:** This is the same gap as B-T2a-03 for lti-service: the event exists in the code but not in the table that QA and humans read.
- **Suggested fix:** Add `internal_error {error}` (level `error`) to both contracts' event tables.

### B-T4a-04 — NIT — The portal-user JSON in `seed.sh` is built with a `printf` trick

- **Location:** `infra/scripts/seed.sh` step 6 (`printf '…"library":"Thanh%ss Library","password":"%s"…' "'" …`).
- **Problem:** The apostrophe goes in as a separate `%s` argument, and the passwords go into a JSON string without escaping. The comment explains it, but a maintainer can break it easily. A future password with `"` or `\` would also make invalid JSON.
- **Suggested fix:** Build the JSON with `node -e` from `process.env` (as `seed-lti-manual.sh` step 3 does), and pipe it to `seed-portal.ts`.
