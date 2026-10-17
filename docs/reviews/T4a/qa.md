Verdict: FAIL
Round: 1

# T4a QA verification

| Item | Value |
| --- | --- |
| SHA | `69425c8e02af721fd514265fb46b2c6c0f4cd137` (T4a code `3ec5222`, QA tests `69425c8`) |
| Spec | `tasks/T4a.md` at `2254792` (the Architect's T4a decisions). New since the SHA: AC-T4-03 adds the `masteryScore` rule, and AC-T4-05 names `/data/packages`. |
| Tests used | `69425c8` plus the QA-side changes of this round (section 3). Changed files: `E/tests-diff-vs-sha.txt` (4 files, no new files). |
| Date | 2026-10-17 |
| Runner | `COMPOSE_PROJECT_NAME=qa-t4a-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<repo>/docs/raw/data/courses node tests/host/run-t4a.mjs --sha 69425c8… --replace-tests` |
| Clean environment | New clone `~/cogniate-qa-runs/qa-t4a-r1-69425c8e-2026-10-17T01-41-51-882Z`. Preflight: no project `qa-t4a-r1`, no QA volumes or networks, port and subnet free. The two course zips were copied from `COURSE_FIXTURES_DIR` into the clone, and their SHA-256 values were checked. |
| Isolation | The QA stack ran next to the Author's stack (`cogniate-stack`, 5 containers). None of them stopped or restarted. After each run: 0 QA containers, 0 volumes, 0 networks. |
| Tools | macOS host: Node 24.21.0, Docker 29.8.2, Compose 5.5.1. e2e image: Playwright 1.56.0, Node 22.20. |
| Evidence root | `E` = `tests/host/artifacts/qa-t4a-r1-69425c8e-2026-10-17T01-41-51-882Z/` (run 2, git-ignored, local). Run 1: `tests/host/artifacts/qa-t4a-r1-69425c8e-2026-10-17T01-40-04-916Z/`. |

There were two runs at the same SHA:

- **Run 1** used the AC text of the SHA. All ACs passed (0 failed).
- **Run 2** added the new AC-T4-03 part (`2254792`). It failed (Q-T4a-01). All other results were the same as in run 1.

The runner does these steps:

1. Pass A: all T4a tests except AC-T4-05.
2. QA counts the folders in `/data/packages` (read-only `docker exec`).
3. The rejects pass runs AC-T4-05 only.
4. QA counts the folders again, and runs `find / -name evil.html -o -name abs.html` in the container.

## 1. Results per acceptance criterion

`A` = `E/container-passA/vitest-results.json`, `R` = `E/container-rejects/vitest-results.json`.

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T4-01 | PASS | Thanh (`seed.json` `portal.users`) signs in: 204 and `__Host-cog_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`. `/app-api/me` shows Thanh and "Thanh's Library". Wrong password: 401 `INVALID_CREDENTIALS`. `/me` without the cookie: 401 `NOT_SIGNED_IN`. | `A` |
| AC-T4-02 | PASS | `POST /app-api/courses` with `Origin` = the content URL, `Origin: null`, and no `Origin`: 403 each (`ORIGIN_NOT_ALLOWED` where an `Origin` is sent). No course is made. | `A` |
| AC-T4-03 | **FAIL** | (1) The SCORM zip gives 201 with all the report values: `format=scorm12`, `entryPath=index.html`, `fileCount=7`, `totalBytes=12723159`, schema `1.2`, mastery 70, 1 SCO, `externalHosts` = the S3 host only, and `questionIds` = `["01M2M36Y89M9KPPZENF1ZW4AWJ"]`. **PASS.** (2) New text (`2254792`): the same SCORM upload with `masteryScore=50` gave **201** and stored a second version (`version: 2`). The AC wants 400 `MASTERY_SCORE_NOT_ALLOWED` and no new version. **FAIL** (Q-T4a-01). | `A` |
| AC-T4-04 | PASS | The HTML zip gives 201: `format=html`, `fileCount=7`, `totalBytes=12103306`, pages `index` and `lesson-ai-web-sprint`, menu `index`, the question id, `trackingProfile.masteryScore=70`, and `externalHosts` = exactly the S3 host and `fonts.gstatic.com`. | `A` |
| AC-T4-05 | PASS | All 16 crafted zips give 422 `PACKAGE_REJECTED` with the AC's code: `PATH_TRAVERSAL` ×2, `ABSOLUTE_PATH`, `SYMLINK_ENTRY`, `ZIP_BOMB`, `MANIFEST_DTD_FORBIDDEN`, `MANIFEST_INVALID_XML`, `SCORM_VERSION_UNSUPPORTED`, `MULTI_SCO_UNSUPPORTED`, `LAUNCH_FILE_MISSING`, `NO_ENTRY_PAGE`, `ZIP_INVALID`, `DUPLICATE_ENTRY`, `INVALID_ENTRY_NAME`, `ZIP_TOO_MANY_ENTRIES`, `ZIP_TOO_LARGE`. The course has no version after them. Folders in `/data/packages`: 5 before and 5 after (run 1: 3 and 3). `find` found no `evil.html` or `abs.html`. | `R`, `E/cmd/09-package-store-count.log`, `E/cmd/11-package-store-count.log`, `E/cmd/12-find-evil-files.log` |
| AC-T4-06 | PASS | The QA Library B user gets 404 `NOT_FOUND` for Thanh's course, 404 for its version, and 404 for an upload to it. B's course list does not show the course. Thanh's course still has exactly one version. | `A` |

### The Author's notes for this round

| Note | QA result |
| --- | --- |
| Package store = `/data/packages` | Used. AC-T4-05 now names this path (`2254792`). |
| `seed.json` `portal.users.<email>` = `{email, password, id, name, role, library}` | Agrees. The QA reader finds portal users by their shape (`email` + `password`). |
| Size limits are decimal (200 MB = 200,000,000 bytes) | No disagreement. The "201 MB" zip is 201 MiB (210,763,776 bytes), which is above the limit in both units. A boundary test is not in the AC (section 4). |
| The `Origin` rule also applies to `POST`/`DELETE /app-api/session` | No disagreement. QA sends `Origin = PUBLIC_APP_URL` on every write, so sign-in worked. A negative test for the session is not in the AC (section 4). |
| Bad CRC-32, encrypted entries and unknown compression → `ZIP_INVALID` | Not in the AC (section 4). The AC's `ZIP_INVALID` case (a text file) passes. |

## 2. Findings

Counts: 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.

### Q-T4a-01 — MAJOR — `masteryScore` with a SCORM package is accepted (owner: Author, round 2)

- **AC:** AC-T4-03 (text of `2254792`), contract `cogniate-app-api.md` §3 `POST /app-api/courses/:courseId/versions`.
- **Steps:** Thanh makes a course and uploads the SCORM zip (201, version 1). Then Thanh uploads the same zip with the multipart field `masteryScore=50`.
- **Expected:** 400 `MASTERY_SCORE_NOT_ALLOWED` ("SCORM packages use the mastery score of their manifest"), and no new version is stored.
- **Actual:** 201. A new version is stored: `{"id":"ver_PJars…","version":2,"format":"scorm12",…}`.
- **Evidence:** `A` (test "AC-T4-03 the same SCORM upload with masteryScore=50 …"), `E/cmd/08-test-acceptance-passA.log`.
- **Note:** The Lead said that the build at this SHA does not have this rule yet. It is a round-2 fix.

## 3. QA-side changes in this round

1. **Package store path** (`tests/host/run-t4a.mjs`): the runner uses `/data/packages` and counts folders with `find -mindepth 1 -maxdepth 1 -type d`. It runs `test -d` first. Without that check, a `ls` that fails inside a pipe still exits 0 and counts 0 before and after, which is a false "same count".
2. **Seed readers** (`tests/acceptance/lib/seed.ts`, `tests/host/lib.mjs`): they skip the `portal` subtree. A 32-hex library id there could look like a Moodle WS token.
3. **New AC-T4-03 test** for the `2254792` text (`tests/acceptance/T4a/session-uploads.test.ts`).

No new SHA is necessary for this round, because `--replace-tests` copied the working-copy tests. The Lead can commit `tests/**`.

## 4. Not covered

These are Author notes or contract rules that are not in an AC. QA did not test them:

- the exact decimal limit (for example 200,000,001 bytes → `ZIP_TOO_LARGE`, 199,999,999 bytes → accepted);
- the `Origin` rule on `POST`/`DELETE /app-api/session`;
- `ZIP_INVALID` for a bad CRC-32, encrypted entries or an unknown compression method;
- `masteryScore` outside 0–100 → 400 `INVALID_REQUEST`;
- `<base href>` in the `externalHosts` rule (the two fixtures pass with the AC values).
