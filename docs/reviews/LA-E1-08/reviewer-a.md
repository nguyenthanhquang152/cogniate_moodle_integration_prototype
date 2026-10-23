Verdict: APPROVE
Round: 2

# LA-E1-08 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff e29f574^1 e29f574` (lane K, Codex; RQ-2 lines in S1 infra: `infra/build-runner/queue.mjs`, `infra/scripts/build-runner.sh`, `infra/scripts/lib.sh`). The kernel, `app/**` and channel `app/**` files at `HEAD` are the same as at `e29f574`. Later commits changed only the channel `portal/**` files and the Moodle manifest.
- References: `docs/architecture/ltiaas/tasks/LA-E1-08.md`; LA-ADR-01 D5; security-delta §8; A1 BD-A1-37, -40, -42, -45, -47, -52; A2 BD-A2-39, -46; app contract §4.6, §11; `docs/architecture/flows.md:50`.
- I ran on the host (no Docker):
  - Vitest on `services/cogniate-app/src/{kernel,app}` and `packages/channels`: 22 files, 320 tests pass (2 skipped).
  - ESLint on `packages/channels` and the app kernel: clean.
  - F1 and F5: both pass on the tree.
  - Four F5 stdin probes of `channel-sql-tables`.
  - A comparison, side by side, of each moved route with the removed file: `canvas-configuration.ts`, `canvas-deployments.ts`, `web-services.ts`, `mbz.ts`, `domain/mbz-builds.ts` and the course-shell part of `publications.ts`.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 1 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Tenant isolation of the build queue (BD-A2-39 (1), BD-A1-47) | Correct. Before any file access, `submit`, `status` and the kernel download check the build id against `mbz_build` of the call's library (`EXPORT_BUILD_SCOPE_SQL`). Another library's id gives `404 NOT_FOUND`, and `pending` gives `false`. The kernel streams only after its own check (`openExportArtifact`), even when an exporter returns another id. The request file gets `buildId`, `libraryId`, `hold` and `failAt` from the kernel after the channel values are spread, so a channel cannot set or read them (test). `runner()` holds no tenant data. |
| No path or symlink escape (BD-A2-39 (2), (4)) | Correct. Build ids match `^[A-Za-z0-9_-]{1,64}$`. Only three fixed subfolders are used, each checked with `lstat` (a directory, not a link). Files open with `O_NOFOLLOW` (status and artifact also with `O_NONBLOCK` and an `isFile` check). The request is written to an `O_EXCL` `0600` temp file and then renamed. The download has a fixed extension and media type per exporter, `attachment`, and the global `nosniff` header. The runner and `lib.sh` create the queue folders `0700`, and the runner refuses unknown request fields and checks `libraryId`. |
| Untrusted status input (BD-A2-39 (3)) | Correct. Status files are capped at 64 KiB and parsed with a strict schema. I checked the schema against every key and step the runner writes (`build-runner.sh` and `queue.mjs status`). The runner's reasons are cut to 200 characters. For one edge case, see A-LA-E1-08-03. |
| Channel SQL (AC-03, BD-A1-42, -52) | `ChannelSql` refuses a statement without a `:library_id` parameter (comments and quoted text do not count). It always binds `library_id` and `connection_id` itself, ignores caller values for them, and accepts only scalar or byte parameters. The Moodle storage list names each shared column, and the three exact `rowid` statements are allowed once each, at their new path only. F5 gaps: A-LA-E1-08-02. |
| Public keys only (BD-A2-39 keys) | Correct. `publicToolKeys` copies only `kty`, `kid`, `alg`, `use`, `n` and `e`. It needs `kty: "RSA"` and string members, refuses a non-base64url `n` or `e`, and keeps no cache across calls or libraries (test with private members `d` and `p`). |
| Frozen paths, fields and errors (AC-02, AC-05, AC-06) | Equal to the removed code in my comparison: the Canvas deployments route (same guard, order and texts), web services (same status, code and text for each error; the same three-field answer), `.mbz` POST and GET (same texts, limit, stale rules, `downloadUrl`), `download?kind=mbz|original` (same `INVALID_REQUEST` text and 404 texts), and the publish option `createMoodleCourse` (same `Invalid field: …` paths, the `courseShell` guard before readiness, and the same shell texts). The publication DTO keeps `moodleCourse`, `shellStatus`, `shellError` in the old key order, and they are `null` for channels without a hook. The guard texts and capability names come from `legacy-wire.ts`. The Canvas `title` is the exception: A-LA-E1-08-01. |
| Library binding of hook SQL | The course-shell writes and reads scope `publication` through `connection.library_id = :library_id AND connection.id = :connection_id`. The web-services update and read scope `connection` by both keys. The `mbz_build` statements scope by `library_id`. |
| Lint and imports | `no-eval`, `no-implied-eval` and `no-new-func` are on for channel files (BD-A1-37). `ports.ts` imports types only from `@cogniate/channel-kernel` and `@cogniate/shared`. |
| UNIT ACs fail on the old behaviour | Yes. AC-03, AC-05 and AC-06 need `createChannelSql`, `publicationExtensionFields` and the kernel mount. The changed old tests only gain fields (`libraryId` in the request) and keep their assertions. |
| "Must not edit", F1 and ownership (AC-09) | Respected. No R file, `services/lti-service/**` or `apps/**` file changed. The six core files are removed (`clients/moodle-ws.ts` moved unchanged), and the five F1 entries drop. `eslint.config.js` is a K file. The infra lines are the named RQ-2 commits. |

## Findings

- **A-LA-E1-08-01 (MAJOR): the Canvas developer key `title` no longer uses the ASCII tool name, so a library name with accents or extra spaces changes a frozen field.**
  - Where: `packages/channels/canvas/app/configuration.ts:21` (`` title: `Cogniate (${ctx.libraryName})` ``). Before: `title: toolName(library.name)` (`services/cogniate-app/src/app/canvas-configuration.ts:36` at `e29f574^1`).
  - Problem:
    - `toolName` turns the name into ASCII: NFKD, combining marks removed, characters outside printable ASCII removed, spaces collapsed, trimmed, and `Library` when nothing is left. `docs/architecture/flows.md:50` says the tool name is "`Cogniate (<library name>)`, ASCII only".
    - Example: "Thư viện  A" gave `Cogniate (Thu vien A)` and now gives `Cogniate (Thư viện  A)`. A name with only non-ASCII characters gave `Cogniate (Library)` and now gives `Cogniate (…)` with those characters.
    - The Canvas key then has another name than the tool everywhere else (`toolName` in `kernel/setup/common.ts` and each channel `app.ts`).
    - AC-01 does not catch it, because the golden library is "Thanh's Library" (ASCII). No unit test covers a non-ASCII name. The product team works in Vietnamese, so this is a likely real case.
  - Suggested fix: `title: toolName(ctx.libraryName)`, with the `toolName` that `packages/channels/canvas/app.ts:84` already exports (or a `toolName` value on the P5 context, next to `toolUrls`). Add a unit test with a name that has accents, double spaces and only non-ASCII characters.
- **A-LA-E1-08-02 (MINOR): F5 `channel-sql-tables` does not check `REPLACE` statements or SQL outside `packages/channels/<id>/app/`.**
  - Where: `infra/scripts/fitness/rules/channel-sql-tables.mjs:35-38` (`startsSql` knows only `SELECT|UPDATE|INSERT|DELETE|WITH`) and `:60` (the path must be under `…/app/`).
  - Problem: probes with `rules.mjs --stdin`:

    | Probe | Path | Result |
    | --- | --- | --- |
    | `SELECT id FROM attempt WHERE library_id = :library_id` | `moodle/app/probe.ts` | refused (correct) |
    | `REPLACE INTO attempt (id, library_id) VALUES (:id, :library_id)` | `moodle/app/probe.ts` | `F5 PASS` |
    | `SELECT * FROM attempt WHERE library_id = :library_id` | `moodle/app.ts` | `F5 PASS` |

    - `REPLACE INTO` is SQLite's short form of `INSERT OR REPLACE`.
    - A channel's `app.ts` defines its routes and hooks, and those get `ctx.sql`.
    - The runtime check only asks that `:library_id` appears, so F5 is the only automatic table and column check. AC-04 (a probe under `app/`) still passes.
  - Suggested fix:
    - Check every literal that SQLite can prepare, or add `REPLACE` (and `VALUES`) to `startsSql`.
    - Widen the path to `packages/channels/<id>/(app\.ts|app/**)`, or to every non-test file of a channel except `portal/**`.
    - Add the two probes above as negative cases.
- **A-LA-E1-08-03 (NIT): the strict status schema refuses `step: ""`, which the runner's stop trap can write.**
  - Where: `services/cogniate-app/src/kernel/port-context.ts:97` (the `step` enum). The writer is `infra/scripts/build-runner.sh:174`: `step=$CUR_STEP`, and `CUR_STEP` is `""` until the first build sets `start` (`:166`, `:223`).
  - Problem: when the runner stops between taking its first request and the first status line, the file says `failed` with `step: ""`. The parse fails, so the app treats the build as having no status. It shows "waiting" or fails the build only after 10 min. The old code showed the stop reason at once.
  - Suggested fix: accept `""` for `step` and store it as `null` (or let the runner leave out an empty `step`).

## Notes (no finding)

- `ChannelSql` cannot check that `:library_id` really limits the rows. A statement such as `… WHERE :library_id IS NOT NULL` passes the runtime check and F5, so the library predicate depends on review (D5 accepts this). Every statement in this diff uses `library_id = :library_id` or the `connection` join.
- The kernel ties build ids to `mbz_build` (`EXPORT_BUILD_SCOPE_SQL` in `legacy-wire.ts`). A second exporter needs its own binding. This is fine for LA, which has one exporter.
- Inline Canvas JSON: an unexpected error from `getToolKeys` now gives `502 LTI_SERVICE_ERROR` instead of `500`. One malformed retired key in the JWKS also makes the inline form fail. Both are on the safe side.
- AC-01, AC-02, AC-07 and AC-08 are K1-SIM or MOODLE-LIVE and wait for QA. The unit tests and the comparisons above cover their logic.


## Round 2

Verdict: APPROVE
Round: 2

Reviewer: Reviewer-A (Codex GPT-6-Astra xhigh). Date: 2026-10-23.
Scope: `ebc5e7d`, `1225080`, `5b4b39c` and the P5 context change in `b6ec001`, as merged by `6270d43`. References: the task spec, LA-ADR-01 D5 P5–P7, BD-A1-37/40/42/45/47/52, BD-A2-39/46 and plan §6.1. I did not open Reviewer-B's files.

**Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** All three Round 1 findings are closed. No new finding.

### Round 1 closure

| Finding | Result |
| --- | --- |
| A-LA-E1-08-01 | Closed by `1225080`. The developer key title calls the shared pure `toolName`. Six tests cover URL and inline keys with Vietnamese accents, repeated spaces, only non-ASCII characters and the golden ASCII name. Restoring the raw title fails four assertions. |
| A-LA-E1-08-02 | Closed by `5b4b39c`. F5 now scans `REPLACE` and `VALUES`, and scans both `app.ts` and `app/**`. Nine rule tests pass. Removing the replacement-SQL support fails four tests; restoring the old path filter fails three. |
| A-LA-E1-08-03 | Closed by `ebc5e7d`. A failed status with `step: ''` is accepted and normalized to `null`, so the runner stop reason is visible. Restoring the old enum fails the status test. The strict schema still rejects unknown fields and invalid steps. |

### Correctness and safety checks

- **P5 URLs:** Canvas configuration reads `ctx.toolUrls` and `ctx.toolAccountId`; it builds no protocol account path. Its domain comes from the supplied `ltiOrigin`. The injected-URL test and exact URL/inline document tests pass. Public-key filtering and per-call key reads are unchanged.
- **Extension paths:** startup accepts only own keys of `EXTENSION_GUARDS` or `x/<name>` with the restricted name grammar. Core bare paths, prototype names, traversal, encoded traversal, queries, fragments, extra segments, route parameters, wildcards and backslashes are refused. Eleven extra path probes pass. Restoring the former arbitrary-bare-path rule fails four shipped tests.
- **Connection isolation:** the kernel loads the connection with the authenticated library before capability checks or the handler. It selects the handler from that connection's channel and creates its context with the checked id. A private request probe used two connections in one library and a third in another library: the foreign connection returned 404 without invoking the handler; each own request retained its path connection even when body, query and SQL parameter values named the foreign one. The shipped Canvas tests also check ownership before query parsing or key reads. Current Moodle SQL scopes its connection reads and writes by both bound keys.
- **Named refusals and guidance:** SQL scope, parameter, DTO-field, extension-path and build-queue errors have distinct names. The added tests pin those names. `ports.ts` describes the extension procedure and states that the current queue serves `.mbz` only. Expected route refusals still use the standard error result and frozen wire names.
- **Queue and SQL compatibility:** the library/build binding, id grammar, fixed queue folders, no-follow file opens, bounded status reads, atomic request writes and kernel-owned test controls are unchanged by this round. The three exact `rowid` exceptions and the moved Moodle statements are unchanged. The status fix restores the one missing runner case. Native-feature, export concurrency, Canvas deployment and configuration tests pass in the focused run; F5 passes with zero hits.
- **UNIT ACs and ownership:** AC-03 has negative scope tests plus two-library reads/writes; AC-05 rejects extra DTO fields and retains the three legacy fields; AC-06 checks the frozen route table and the native-feature responses. The changed tests fail on the corresponding old behavior. The commits stay in lane K extension, context and fitness files; no R file, LTI service, portal app or QA test file changed. F1 passes.

### Verification and limits

The same private `--no-hardlinks` clone at `6270d43` was used for both reviews. No Docker, stack, host runner, external network call or commit was used. I changed only my two review files in the integration worktree.

- Focused unit run: **890 passed, 2 skipped**; shared K0: **121 passed**; SQL-rule tests: **9 passed**. The extra launch/router/isolation run passed **20 tests**, of which 12 cover the added extension scope and path probes.
- All five LA-E1-08 regression mutations failed on assertions, not imports: bare-path acceptance, raw Canvas title, empty-step refusal, unchecked replacement SQL and unchecked root `app.ts` SQL.
- Root typecheck, changed-file ESLint, F1 and F5 pass. Scratch changes were restored; logs and probe sources are under `/tmp/la-review-a-r2.Y9zbMj/`.
- I did not run `npm run check` or the task-specific QA wrapper. K1-SIM and MOODLE-LIVE remain pending with QA under the Docker hold. Source comparison and host tests support this approval; they do not replace R1 or R2-lite.
