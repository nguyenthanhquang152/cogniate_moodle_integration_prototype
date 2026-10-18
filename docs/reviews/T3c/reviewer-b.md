Verdict: APPROVE
Round: 2

# T3c review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff dc068e9^1 dc068e9 -- . ':!docs' ':!tests'` (merge of the T3c branch by Author-2 / Codex; 19 files). Spec: `tasks/T3c.md`, LTI contract §3.2, §3.5, §3.7, §3.9, §3.10, §8, ADR-001, ADR-003, `services/lti-service/src/http/routes/README.md`.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD contains `dc068e9`) | Pass: 45 test files, 614 tests |
| `tests/compat/` in the repo | Not present yet (QA owns it). See B-T3c-01. |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | B-T3c-01 |
| NIT | 1 | B-T3c-02 |

## Lead's focus questions

- **Does `compat.ts` follow the routes README?** Yes.
  - `registerCompatRoutes(app, ctx: RouteContext)`, zod schemas (`LineItemBody`, `MembershipsQuerySchema`), `invalid()` from `http/validation.ts`, and only typed `ApiError` codes from `api-errors.ts`.
  - Protocol work stays in `lti/` (`deepLinkingForm`, `deepLinkingResponse`), platform calls in `platform/` (`ags.ts` writes, new `nrps.ts`), and SQL in `store/` (`deletePlatform`).
  - The README already named `compat.ts`.
- **Consistency with the T3a and T3b code:** Good, and it improves the old code.
  - The new `http/service-context.ts` (`platformOf`, `agsContext`, `signedDeepLink`, `claimObject`) is now shared by `services.ts` and `compat.ts`, so `services.ts` lost its private copies.
  - `/api/deeplinking/message` and `/form` reuse the one signed-response path.
  - The AGS writes keep the T3a order of every call: line item URL rule, then scope (`lineitem`, never `lineitem.readonly`), then token, then one request.
  - `nrps.ts` follows the `ags.ts` pattern: URL rule before the token, zod parse of the platform answer, Link-header paging, and error mapping that does not echo roster data.
- **Readability and test quality:** Good. The endpoints are short. `compat.test.ts` (249 lines, 14 tests) covers:
  - both deep-link aliases (escaped attributes; resource launch, service auth and bad content rejected);
  - create, update and delete with ltik **and** service key (exact method, body, scope);
  - empty optional metadata from the platform;
  - scope refused before any outbound call;
  - body rules;
  - foreign, missing-query and encoded-separator URLs without outbound calls;
  - NRPS mapping (`user_id` → `userId`, personal fields stripped, short and URI role filters);
  - `url` replacing filters;
  - stable error shapes;
  - an account-scoped platform delete with its cascade ("recreation does not revive keys");
  - inactive platforms and the auth scheme of each route;
  - the OAuth stubs.

  The test names say the rule.
- **Compat runner UX:** The image pins and checks `ltiaas==0.0.4` and its MIT license at build time, which is good. But the first-run failures give raw Docker or pip output (B-T3c-01).

---

## Findings

### B-T3c-01 — MINOR — `npm run test:compat` gives raw Docker or pip errors for its two likely first-run failures

- **Location:** `infra/scripts/compat-run.sh`; `infra/compose.yaml` service `compat` (bind `${COMPAT_TESTS_DIR:-../tests/compat}` with `create_host_path: false`, and `./.secrets:/run/secrets:ro`); `infra/compat/Dockerfile` (`pip install ltiaas==0.0.4` at build time; the script always passes `--build`).
- **Problem:** A developer or QA engineer who runs `npm run test:compat` sees:
  - **No runner script:** today `tests/compat/` does not exist, so compose stops with Docker's "bind source path does not exist …". The script does not say that QA owns `tests/compat/run.py`, or that `COMPAT_TESTS_DIR` can point elsewhere.
  - **SDK install fails** (offline, PyPI down, a corporate proxy): the error appears inside the image build as raw pip output, at every run, because the script always builds.
  - **CA trust fails:** `REQUESTS_CA_BUNDLE=/certs/root.crt` is set and `require_env` checks that `root.crt` exists. A wrong or stale CA would then appear only as a Python `SSLError` traceback from QA's script.
- **Evidence:** `compat-run.sh` runs `require_env`, `require_running proxy`, `require_own_project` and then `dc … run --build compat` with no other check. By contrast, `qa-suite.sh` checks `tests/package.json` and `tests/package-lock.json` first and prints what to do.
- **Suggested fix:**
  1. Check first: "`${COMPAT_TESTS_DIR:-tests/compat}`/run.py is missing. QA owns tests/compat/run.py (T3c AC-T3-27). Ask QA, or set COMPAT_TESTS_DIR."
  2. Before the build, print "Building the compat image (pip install ltiaas==0.0.4 from PyPI) …". If the build fails, print "The SDK could not be installed. Check the network and PyPI access. T3c fallback: a small QA client (tasks/T3c.md)."
  3. In the runner's README line, say that a TLS error means "run npm run gen-env and npm run stack:up again" (the CA and leaf must match).
  4. Mount only the two files that the runner needs (`lti-api-key.cogniate`, `seed.json`) instead of all of `infra/.secrets/`, which also holds the app key and the `qa-second` key.

### B-T3c-02 — NIT — Small consistency points

- **Location and fix:**
  - `services/lti-service/src/http/routes/compat.ts` has a one-line header. The other route files list their endpoints and contract sections (for example `services.ts`). List them: `/api/deeplinking/form` and `/message` (§3.2), line item POST, PUT and DELETE (§3.5), `/api/memberships` (§3.7), OAuth stubs (§3.10).
  - `compat.ts` `parseItem` ends with `as unknown as LineItemInput`. Let the zod schema output that type (or use `satisfies`), so the compiler checks the fields.
  - `platformResponseError(res, false)` in `platform/nrps.ts` passes a bare boolean. Use a named option, for example `{ echoMessage: false }`, so the call says what it does.
  - `DELETE /api/platforms/:id` is a destructive admin action, but it logs no event except `http_request`. Log `platform_deleted {platform_id}` and add it to contract §5, so support can see who removed a platform and when.

---

## Round 2

Round 2 verdict: **APPROVE**.

Input: `git diff 963cb5e^1 963cb5e -- . ':!docs' ':!tests'` (15 files, Author-2 / Codex).

| Id | Status | Evidence |
| --- | --- | --- |
| B-T3c-01 | **Resolved** | `compat-run.sh` checks first and prints one line for each case. Missing runner: "QA has not written tests/compat/run.py yet; ask QA or set COMPAT_TESTS_DIR …" (it resolves a relative `COMPAT_TESTS_DIR` the way compose does). Missing key: "run npm run seed first". Failed image build: "the SDK could not be installed; check Docker and PyPI access, or ask QA for the T3c fallback client". The new `infra/compat/entrypoint.py` checks `/healthz` with the stack CA before QA's script runs: an `SSLError` prints "the CA does not match the stack certificate; run npm run gen-env and npm run stack:up again", with no traceback and no credential. Compose mounts only `root.crt` and `lti-api-key.cogniate` (`create_host_path: false`); `seed.json` is no longer mounted. `requirements.txt` pins the full dependency set (binary wheels only, `pip check`). |
| B-T3c-02 | **Resolved** | The `compat.ts` header lists the endpoints with contract §3.2, §3.5, §3.7 and §3.10. The `as unknown as` cast is gone. `platformResponseError(res, { echoMessage: false })`. `DELETE /api/platforms/:id` logs `platform_deleted {platform_id}`. |

Rest (NIT, safe to defer): when the image build fails, the script prints the one-line message but deletes the captured build log (`trap 'rm -f "$build_log" …'`), so the pip error is lost. Print the last 20 lines of `$build_log` before the message, or keep the file and print its path.

