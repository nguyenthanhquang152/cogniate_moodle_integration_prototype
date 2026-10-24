Verdict: APPROVE
Round: 2

# LA-E1-08 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff e29f574^1 e29f574` (lane K commits `7136cf0` to `a13db18`, merged as `e29f574`). Spec: `docs/architecture/ltiaas/tasks/LA-E1-08.md`. Design: LA-ADR-01 D3 (guards), D5 (P5–P7, `PortContext`, `ChannelSql`, rules table), D8; BD-A1-37, -40, -42, -45, -47, -52; BD-A2-39, -46; security-delta §8. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 1 MAJOR, 1 MINOR, 2 NIT.**

The ports are now in one typed file, `kernel/ports.ts`, and the three Moodle and Canvas extensions read like small examples. A newcomer can copy `packages/channels/moodle/app/web-services.ts`: it declares method, path, capability and the frozen legacy name, and uses `ctx.sql` with `:library_id`, `ctx.seal` and `ctx.outbound`. It answers errors as values (`{ error: {…} }`). The kernel keeps the risky parts:
- `ChannelSql` binds the library and refuses unscoped statements;
- the build queue validates ids, folders, status files and symlinks, and adds the build controls itself;
- the publication DTO accepts only the frozen field names.

F5 `channel-sql-tables` checks channel SQL against the manifest `storage` list, and its error names the table. My MAJOR is one design rule of this task that the code does not follow: the P5 context has no `toolUrls`, so the Canvas route builds the LTI protocol paths itself.

## How I checked

- Scratch clone of `e29f574` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/cogniate-app packages/channels packages/channel-kernel eslint.config.test.ts`: **42 files, 1028 passed, 2 skipped**. `npm run typecheck`: exit 0. `eslint services/cogniate-app/src packages/channels`: exit 0.
- `node infra/scripts/fitness/rules.mjs`: `F5 PASS: 5 rules … 0 hits`. A probe `ctx.sql.get('SELECT title FROM course WHERE library_id = :library_id')` as `packages/channels/moodle/app/probe.ts` gives one hit: "SQL names storage outside the moodle manifest or cannot be checked: no such table: course".

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `kernel/{extensions,port-context}.ts`, `packages/channels/{canvas,moodle}/app/**`; `app.ts` and `manifest.ts` of both; `legacy-wire.ts`; `app/{server,publications,courses}.ts`, `domain/publications.ts`, `testkit.ts`; the six core files removed (`clients/moodle-ws.ts` moved 1:1 to `moodle/app/web-service-client.ts`); new `channel-sql-tables.mjs`. RQ-2 lines in S1 infra (`build-runner.sh`, `build-runner/queue.mjs`, `lib.sh` queue mode `0700`) are named in the dispatch. Also `eslint.config.js` (K's), `sql-portability.mjs`, the F1 baseline and `kernel/setup{,/deps}.ts` (K's). No R file, no `services/lti-service/**`, no `apps/**`. OK. |
| Ownership | K in B2, plus the RQ-2 lines. OK. |
| No behaviour change outside the spec | The frozen texts and `details.capability` values live in `legacy-wire.ts` (`EXTENSION_GUARDS`, `PACKAGE_EXPORT_WIRE`, `PUBLICATION_OPTION`), and the moved routes keep their paths. |
| No LMS name in core | The F1 baseline loses the removed files. The Moodle-only wire names are in `legacy-wire.ts` (the allowed exception). |
| UNIT ACs | AC-03 (`port-context.test.ts`: unscoped `get`/`all`/`run` refused, also when the name is only in a comment or a value; library and connection bound even if params try to replace them). AC-05 (`extensions.test.ts`: a hook field outside the frozen list is refused; defaults for channels without a hook). AC-06 (`extensions.test.ts`: the frozen paths are mounted in the authenticated scope). Each tests a new module, so it fails on the old tree. |

## Findings

### B-LA-E1-08-01 — MAJOR — The P5 context has no `toolUrls`, so the Canvas route holds the LTI protocol paths

- **File:** `services/cogniate-app/src/kernel/ports.ts:169-187` (`PortContext`: `urls`, `libraryName`, `toolAccountId`, `publicToolKeys`, but no `toolUrls`); `packages/channels/canvas/app/configuration.ts:9-13` (`` `${ctx.urls.lti}/lti/login/${ctx.toolAccountId}` ``, `/lti/launch/`, `/lti/keys/`).
- **Problem:** The spec says "The P5 `PortContext` also carries `toolUrls` (BD-A1-40)", and LA-ADR-01 D5 row "Setup helpers" says "A channel file holds no tool account id and no protocol path". The Canvas route builds the three protocol URLs from the base origin plus fixed paths. So the LTI service's path layout now also lives in a channel file, outside the kernel. A change of these paths (for example the account resolver of LA-ADR-06 D2, path mode versus host mode) must find every channel copy. A2's F5 rule "no `'/lti/launch/'` literal outside the account resolver" (README §4 F5, starting with the E5 D2 task) will refuse this file when it lands. The three channel `app.ts` files already carry their own `toolUrls()` copies from LA-E1-07, so the pattern is spreading.
- **Evidence:** `git grep toolUrls e29f574 -- services/cogniate-app/src` finds no context member; each channel defines its own (`packages/channels/{moodle,canvas,blackboard}/app.ts`).
- **Suggested fix:** Add `toolUrls: { login, launch, keys, register, ltiOrigin }` to `PortContext` (and, by BD-A1-40, to the P2 contexts), built once in `createPortContext` from `urls` and `toolAccountId`. Use `ctx.toolUrls` in `configuration.ts`. Remove the three channel `toolUrls()` copies in the same change, or in an LA-E1-07 follow-up through the Lead. Add one test that the Canvas JSON equals the golden with the URLs coming from the context.

### B-LA-E1-08-02 — MINOR — A newcomer has no "how to add an extension" guide, and `extensions.ts` has a stale header

- **File:** `services/cogniate-app/src/kernel/extensions.ts:1-2` (the header still describes only "POST /app-api/connections/:id/deployments … the common redemption engine"), `:85` (path rule); `services/cogniate-app/src/kernel/ports.ts:1`.
- **Problem:**
  - The file now holds the guard, the extension mount, the publication-field filter and the exporter routes, but its first comment describes one deployment route.
  - The rules a channel author must follow live only in the LA-ADR-01 D5 rules table:
    - a path is a frozen legacy path or `x/<name>`;
    - only frozen guards go into `legacy-wire.ts`, and a new guard answers `details.capability = <capability id>`;
    - every SQL statement has `:library_id`;
    - every table and column must be in the manifest `storage` list;
    - errors are returned as `{ error }`, not thrown.
  - The mount also accepts any bare path matching `[a-z][a-z0-9-]*` (`:85`), so a new channel can claim a path like `/connections/:id/reports` that a future core route needs. D5 says new paths use `x/<name>`.
- **Suggested fix:**
  - Rewrite the `extensions.ts` header (one line per job).
  - Add a 6–8 line "Adding an extension" comment at the top of `ports.ts` with the rules above and pointers to `moodle/app/web-services.ts` as the example.
  - Accept a bare path only when it is a key of the frozen `EXTENSION_GUARDS`. Otherwise require `x/<name>`, with one test row.

### B-LA-E1-08-03 — NIT — Kernel refusals are plain `Error`s, so the runtime log shows only `Error`

- **File:** `services/cogniate-app/src/kernel/port-context.ts:26` (`channel_sql_unscoped`), `:32` (`channel_sql_invalid_parameter`, a `TypeError`), `:106`, `:114`, `:185` (`build_artifact_invalid`, `build_queue_folder_invalid`); `kernel/extensions.ts:25`, `:85`.
- **Problem:** The log rule records only an error's class name, never its message. A channel author whose statement misses `:library_id` sees `500` and `internal_error {error: "Error"}` in the stack. The rule name is visible only in unit tests.
- **Suggested fix:** One small error class per rule (`ChannelSqlUnscopedError`, `BuildQueueError`, `ChannelDtoFieldError`), so the class in the log names the rule. Keep the messages.

### B-LA-E1-08-04 — NIT — The P7 build queue is shaped for `.mbz` only

- **File:** `services/cogniate-app/src/kernel/port-context.ts:95-104` (`BuildStatus` steps `start, course, scorm, backup, copy, done`, the `holdFile` path); `packages/channel-kernel/src/legacy-wire.ts:52` (`EXPORT_BUILD_SCOPE_SQL` reads `mbz_build`), used for every queue ownership check.
- **Problem:** `PackageExporter` is the backlog port for more exporters (LA-ADR-01 D9, LE). But the kernel's queue checks build ownership against `mbz_build`, and parses status with the `.mbz` steps. So a second exporter cannot use `ctx.buildQueue` without a kernel change. That is fine for LA, but neither `ports.ts` nor D9 says it.
- **Suggested fix:** One comment line at `BuildQueue` in `ports.ts` ("LA: the queue serves the `.mbz` exporter only; a second exporter needs a kernel change of the ownership table and status steps"), and the same known limit in the D9 row through A1.

## Not checked

- K1-SIM and MOODLE ACs (QA); the F1 counts of AC-09 (K0).
- Lens-A depth of the queue file checks and of the SQL binding beyond the unit cases.

## Round 2

Verdict: APPROVE
Round: 2

Reviewer: Codex, Reviewer-B. The round 1 record above is unchanged apart from the file's current verdict header. Reviewed `ebc5e7d`, `1225080`, `5b4b39c` and the P5 context fix `b6ec001`, as merged in `6270d43`. Source and test candidate: `6270d43`. Applied the task spec, LA-ADR-01 D3/D5/D8, BD-A1-40/42/45/47/52, and plan §6.1. No Reviewer-A file was opened.

**Open counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.** No new finding ID. The path part of B-LA-E1-08-02 remains, and B-LA-E1-08-04 has only its A1 documentation follow-up.

### Round 1 findings

| Finding | Result and evidence |
| --- | --- |
| B-LA-E1-08-01 — MAJOR | **Closed.** `PortContext.toolUrls` is built by `createPortContext` through the common kernel helper. The Canvas artifact uses the injected login, launch, keys and origin values, plus the injected account id. No protocol path remains in that channel route. The injected URLs deliberately differ from `ctx.urls.lti`; restoring the old construction fails its regression test. |
| B-LA-E1-08-02 — MINOR | **Partly closed.** The header now describes all four kernel jobs. The short extension guide covers path rules, guard names, scoped SQL, storage declarations, errors as values and the web-services example. Ordinary new bare paths are refused. One body-flag key is still accepted as a frozen route; see the residual below. |
| B-LA-E1-08-03 — NIT | **Closed.** Named errors distinguish unscoped SQL, invalid parameters, build queue faults, DTO fields and extension paths. Tests assert the error names and messages. The runtime can identify the rule without logging statement text or secrets. |
| B-LA-E1-08-04 — NIT | **Code note closed; A1 follow-up remains.** `kernel/ports.ts:404` explicitly says the queue serves `.mbz` only and a second exporter needs ownership-table and status-step changes. The architecture note requested in round 1 is still absent. No general queue redesign is required for LA. |

### Residual B-LA-E1-08-02 — MINOR — The route allow-list includes a publication body flag

- **File:** `services/cogniate-app/src/kernel/extensions.ts:95`; `services/cogniate-app/src/kernel/extensions.test.ts:27`; `services/cogniate-app/src/kernel/ports.ts:7`.
- **Problem:** `EXTENSION_GUARDS` is not a list of frozen P5 paths. It also contains `createMoodleCourse`, the P6 body flag, so the new path check accepts a bare route that the baseline never had.
- **Evidence:** `packages/channel-kernel/src/legacy-wire.ts:37` declares the body flag; `:45` puts its guard in the same map as the two P5 paths. The new table test expands every map key as allowed and passes for `GET /connections/:id/createMoodleCourse`. Thus the test repeats the allow-list mistake. No product channel currently mounts this route, so this is safe to defer.
- **Suggested fix:** Define the actual frozen extension paths separately, or distinguish path guards from body-option guards. Use that path list in the mount and guide. Test the two frozen P5 paths explicitly, reject `createMoodleCourse`, and keep `x/<name>` for new routes. Round 1's suggestion to use every `EXTENSION_GUARDS` key was too broad; this narrows that same finding.

### Residual B-LA-E1-08-04 — NIT — Architecture note remains with A1

- **File:** `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md:350` (Build queue rule); `services/cogniate-app/src/kernel/ports.ts:404` (completed code note).
- **Problem:** The public code documents the single-exporter limit, but the corresponding architecture follow-up from round 1 is not recorded yet.
- **Evidence:** Queue ownership still uses `EXPORT_BUILD_SCOPE_SQL` over `mbz_build`, and status validation still names the `.mbz` steps. The new code comment states both limits correctly.
- **Suggested fix:** A1 adds the same known limit to its architecture guidance, including the requested D9 follow-up. This is not a lane K implementation blocker.

### Checks and evidence

- Used a private `git clone --no-hardlinks` at `6270d43`, with copied dependencies. No Docker, stack or host runner ran. No product or test file changed in the integration worktree.
- Focused app, channel, kernel and import-fence suite: **50 files, 1,130 passed, 2 skipped**. The skips are the missing HTML and SCORM archive upload fixtures. K0: **3 files, 121 passed, no skips**. Root typecheck and lint of the reviewed areas passed.
- SQL fitness tests: **9 passed**. They cover forbidden and permitted storage for `SELECT`, `REPLACE` and `VALUES`, both under `app/` and in root `app.ts`. Restoring the old SQL detection and path scope caused **5 failures**. F5: **6 rules, 0 hits**. F1: **PASS, 20 files with hits, 74 hits**.
- Private negative controls: old Canvas URL construction caused **1 context test failure**. Restoring the old bare-path rule and raw Canvas title caused **8 failures**: three forbidden bare routes, the map's body-flag row, and four non-ASCII title cases. All temporary mutations were restored; the private clone's tracked tree is clean.
- Queue status now accepts `step: ''` from the runner's early stop trap and exposes `step: null`. The test also keeps refusals for unknown fields, invalid steps, oversized files and symlinks. The Canvas title uses the shared ASCII formatter in both JWK modes, with accented, whitespace and non-ASCII-only examples.
- UNIT AC-03 tests scope refusal and library/connection rebinding for reads and writes. AC-05 tests forbidden DTO additions, frozen fields and defaults. AC-06 pins the six legacy route/method pairs, including download, in the authenticated scope. These tests remain executable and passed; the relevant contrary behaviors produce assertion failures.
- The reviewed commits stay within lane K's B2 files and the shared P5 context work. They change no `tests/**`, `docs/**`, R-owned file, LTI-service file or portal file. The six removed core files remain absent. No additional LMS-name branch was added in core.

### Verification boundary

K1-SIM AC-01/02/07 and MOODLE-LIVE AC-08 remain QA work pending the permitted stack window. This review does not claim golden-output or live-runner verification.
