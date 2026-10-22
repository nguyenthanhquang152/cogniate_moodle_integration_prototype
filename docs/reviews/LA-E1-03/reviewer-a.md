Verdict: CHANGES_REQUESTED
Round: 1

# LA-E1-03 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E1-03.md`. Design: LA-ADR-01 D1, D4, D5, D8; README §4 F3; LA-ADR-07 D1 and AP-07-03; TEST-STRATEGY §3.4, §3.5.

Diff: lane `la-k`, commits `73c389c` (B-LA-E1-02-01), `21fc882` (B-LA-E1-02-02) and `33118bc` (LA-E1-03), on top of the baseline merge `07ed16b`. The Lead merged them as `a9f83be`. The dispatch names `git diff 8cf9412 21fc882`, but `33118bc` comes after `21fc882` on the lane. So I reviewed `07ed16b..33118bc` (= `a9f83be^1..a9f83be`, 8 files).

Method: a throwaway `git archive 33118bc` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran `eslint --stdin` probes, `tsc`, `vitest` and three mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E1-03-01 | BLOCKER | Dynamic `import()` with a package name goes through the fence: AC-03 items (3), (4), (5) and AP-07-03 fail |
| A-LA-E1-03-02 | MAJOR | Channel files outside the D1 entry kinds have no package fence: an `app/` module reaches `services/**/domain/**` through one re-export |
| A-LA-E1-03-03 | MINOR | Design question (A1): `app.ts` cannot import its own `app/**`, but D5 and D8 need that for P5–P7 in LA-E1-08 |
| A-LA-E1-03-04 | MINOR | Design note (A2): D1 lets `app/**` import all of `@cogniate/shared`, which includes `openSqlite` and the key provider |
| A-LA-E1-03-05 | MINOR | Channel-root tests and helper files are not typechecked |

The two LA-E1-02 fixes are correct, and their tests kill the mutants (see "Checks that pass").

## Findings

### A-LA-E1-03-01 — BLOCKER — dynamic imports are not fenced in channel files

- **File:** `eslint.config.js:41` (with `:63`, `:65` and the entry blocks `:118-143`).
- **Problem:** in channel files, `import()` and `require()` with a package name (a bare specifier) are not checked. ESLint's `no-restricted-imports` (v10.12) checks only `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration` and `TSImportEqualsDeclaration`. `channels/local-boundary` reads `ImportExpression` (`:63`), but it returns at `:41` for every specifier that is not relative or absolute.
- **Evidence:** each probe below gives 0 errors with `eslint --stdin --stdin-filename <path>` (exit 0):

  | Probe path | Text | AC item |
  | --- | --- | --- |
  | `packages/channels/moodle/app/zz.ts` | `export const load = () => import('@cogniate/cogniate-app/src/domain/connections.ts');` | AC-03 (4), AP-07-03 |
  | `packages/channels/moodle/app.ts` | the same | AC-03 (4) |
  | `packages/channels/moodle/manifest.ts` | `export const load = () => import('@cogniate/shared');` | AC-03 (3) |
  | `packages/channels/moodle/portal/index.tsx` | `export const load = () => import('@cogniate/portal/src/api.ts');` | AC-03 (5) |

  The path is real. `@cogniate/cogniate-app` and `@cogniate/portal` have no `exports` field, so a sub-path resolves: from `packages/channels/moodle/`, Node 24 `import.meta.resolve('@cogniate/cogniate-app/src/domain/db.ts')` gives `services/cogniate-app/src/domain/db.ts`. A scratch file `packages/channels/moodle/app/zz-probe.ts` with `const { openDb } = await import('@cogniate/cogniate-app/src/domain/db.ts'); return openDb(file);` passes `tsc -p packages/channels/tsconfig.node.json` (exit 0, the file is in `--listFiles`) and `eslint packages/channels` (0 messages). That is a raw database handle in channel code. LA-ADR-07 D1, row "Library", says "Channel code never gets a database handle".
- **Required outcome:** AC-LA-E1-03-03: "F3 probes with `eslint --stdin --stdin-filename <path>` each give an error: … (3) `manifest.ts` imports anything but `@cogniate/channel-kernel` types; (4) `app.ts` or a file in `<id>/app/` imports `services/**/domain/**` (A2 AP-07-03); (5) a file in `<id>/portal/` imports portal code outside `apps/portal/src/sdk/`." AP-07-03: "A channel `app/` module cannot import `services/**/domain/**`: the F3 import rule … fails the lint." A dynamic import is an import. Lazy `import()` is a normal ESM form (for example `React.lazy` in a portal module). So an acceptance criterion fails on a reachable path (charter §5: BLOCKER).
- **Suggested fix:** in channel files, give `import()` and `require()` the same allow-list as static imports. (a) If the argument is not a string literal, report it. Channel code needs no computed import, because the loaders are core. (b) If the argument is a literal package name, test it against the allowed pattern of the entry kind. Keep one table for each entry kind, and use it in the `no-restricted-imports` blocks and in the local rule. The simpler option is to forbid dynamic imports with a package name in channel files. Also read a template literal without substitutions as a string. That closes the core case ``import(`../../../../packages/channels/moodle/app.ts`)``, which is exit 0 today (only F1 catches it, through the channel id). Add the four probes above to the Author's tests or to QA's F3 probe list.

### A-LA-E1-03-02 — MAJOR — channel files outside the D1 entry kinds have no package fence

- **File:** `eslint.config.js:118-143`. There is no block for `packages/channels/*/**` files that are not `manifest.ts`, `lti-profiles.ts`, `app.ts`, `app/**` or `portal/**`.
- **Problem:** a file such as `<id>/helpers.ts`, `<id>/lib/**` or `<id>/util/**` gets only the base `**/tests/**` pattern and `local-boundary`. `local-boundary` skips package names. An `app/**` file may import such a file (`\.{1,2}/.*`, inside its own channel). So an `app/` module can reach the domain through one re-export.
- **Evidence (exit 0 for each):**
  - `packages/channels/moodle/helpers.ts`: `export { openDb } from '@cogniate/cogniate-app/src/domain/db.ts';`
  - `packages/channels/moodle/app/zz.ts`: `export { x } from '../helpers.ts';`
  - `packages/channels/moodle/util/a.ts`: `import { x } from '@cogniate/lti-service/src/store/platforms.ts'; export default x;`
- **Rule that fails:** LA-ADR-01 D1, import table row "A channel folder | never another channel folder; never `services/**/domain/**` directly". README §4 F3 pass rule: "0 errors". Then AP-07-03 holds for the file name only, not for the code that the `app/` module runs.
- **Suggested fix:** add one block for all of `packages/channels/*/**` that forbids `@cogniate/cogniate-app`, `@cogniate/lti-service`, `@cogniate/portal`, `@cogniate/player` (each with `/**`) and any specifier that contains `/services/` or `/domain/`. Flat config replaces the rule options of a matching later block, so also merge these patterns into each entry block. For non-test files that are not an entry kind, use the `app/**` allow-list, or report "not a D1 entry file". Ask A1 if non-entry files are allowed at all.

### A-LA-E1-03-03 — MINOR — design question for A1: `app.ts` cannot import its own `app/**`

- **File:** `eslint.config.js:127-128`.
- **Problem:** `app.ts` may import only kernel types and the port types. So `import { … } from './app/web-services.ts'` and `import manifest from './manifest.ts'` in `app.ts` are errors (probes, exit 1). This matches the D1 row literally, so it is not an Author defect. But D5 puts `extensionRoutes`, `publishHooks` and `packageExporters` (P5–P7, with their `handle` and `afterPublish` code) on the `ConnectionSetup` export of `app.ts`. D8 puts that code in the channel's `app/`, and D4 loads only `app.ts` on the app side. So in LA-E1-08 (Moodle web services, course shell, `.mbz`, and the Canvas configuration), `app.ts` must import `app/**`, and F3 will fail. `eslint.config.js` is not in the LA-E1-08 "May edit" list.
- **Suggested fix:** A1 rewrites the D1 row, for example "kernel types, port types, its own `app/**` (and its own `manifest.ts`)". Then K adds `\./(?:manifest\.ts|app/.+)` to the `app.ts` allow-list. `local-boundary` already keeps those paths inside the channel. Route this before LA-E1-08 starts.

### A-LA-E1-03-04 — MINOR — security design note for A2: `@cogniate/shared` in channel `app/**`

- **File:** `eslint.config.js:134` (as D1 asks).
- **Problem:** D1 lets `app/**` import values from `@cogniate/shared`. At `33118bc`, the shared barrel (`packages/shared/src/index.ts`) exports `openSqlite`, `applyMigrations`, `transaction`, `createLocalKeyProvider`, `keyProviderFor`, `legacyKeyRing`, `parseKeyRing`, `encrypt`, `decrypt` and `createOutboundClient`. So channel `app/` code can open a raw SQLite handle or a key provider with an import that F3 allows. That defeats LA-ADR-07 D1 ("a library-bound `ChannelSql` …, never a raw handle") and the `PortContext.outbound` rule (D5), without any lint error.
- **Suggested fix:** A2 decides. The cheap control: for channel files, `paths: [{ name: '@cogniate/shared', importNames: [...] }]` that lists the database, key and outbound factories. Another option is a small `@cogniate/shared` sub-path export for channels. This is not a gate for this task.

### A-LA-E1-03-05 — MINOR — channel-root tests and helpers are not typechecked

- **File:** `packages/channels/tsconfig.node.json:3`.
- **Problem:** the include list (`*/manifest.ts`, `*/lti-profiles.ts`, `*/app.ts`, `*/app/**/*`) leaves out channel-root tests (`<id>/*.test.ts`) and channel-root helpers. Portal tests are checked, because the portal config includes `*/portal/**/*`. Vitest strips types, so a test with a type error can still pass.
- **Evidence:** `const n: number = "x";` in `packages/channels/zz-probe/probe.test.ts`: `tsc -p packages/channels/tsconfig.node.json` exits 0. The same line in `zz-probe/portal/p.test.tsx`: `tsc -p packages/channels/tsconfig.portal.json` exits 2.
- **Why it matters:** AC-05 asks that a scratch folder "with `manifest.ts`, `lti-profiles.ts` and one test" is "typechecked, linted and tested" with no root edit. LA-E1-07 AC-10 (the `sharing` equality test) will likely live at `<id>/app.test.ts`.
- **Suggested fix:** `"include": ["*/*.ts", "*/app/**/*"]`, after A1 confirms the D1 build-model list.

## Checks that pass

| Item | Result |
| --- | --- |
| AC-01 (typecheck) | `package.json:16` runs `tsc` for both channel configs after the workspaces. A type error in a channel `app/` file makes `tsc -p packages/channels/tsconfig.node.json` exit 2. QA runs the `npm run check` probe (K0). |
| AC-02 (unit tests) | The `node` project includes `packages/channels/*/**/*.test.{ts,tsx}` without the portal tests. A probe `zz-probe/probe.test.ts` ran once, in `node`. |
| AC-03 (static probes) | All five kinds give an error: core relative and bare paths to `packages/channels/moodle/manifest.ts`; `lti-profiles.ts` → `../canvas/manifest.ts`; `app/zz.ts` → `../../canvas/manifest.ts`; `manifest.ts` → `@cogniate/shared` and a value import of `@cogniate/channel-kernel`; `app.ts` and `app/` → `services/cogniate-app/src/domain/connections.ts` (relative and by package name); `portal/index.tsx` → `apps/portal/src/api.ts`. These are allowed: a type import of the kernel in `manifest.ts`, a type import of `kernel/ports.ts` in `app.ts` (a value import is an error), and `apps/portal/src/sdk/x.ts` from `portal/`. A type-only `import('../canvas/manifest.ts')` is also an error. Dynamic imports: see A-LA-E1-03-01. |
| AC-04 (clean tree) | `eslint .` on the `33118bc` tree exits 0. Both channel configs: `tsc` exits 0. |
| AC-05 (no root edit) | The scratch probe folders needed no root build edit. Also see A-LA-E1-03-05. |
| Vitest split | `vitest list` gives the same 1000 lines with the `07ed16b` config and the `33118bc` config. A portal `.tsx` probe ran once, in jsdom, with the automatic JSX runtime. A node probe ran once, in node. This is the portal's jsdom setup (the portal tests use only the `@vitest-environment jsdom` pragma). |
| B-LA-E1-02-01 | Mutants: with the registry call removed from `main.ts`, 7 of 9 tests fail (AC-05 ×6, AC-06). With the call moved after `createOutboundClient`, 7 fail. The test imports the real `main.ts`. `startService` builds the listeners in order (`packages/shared/src/service.ts:47-50`), so the content listener never runs with the mocked config. |
| B-LA-E1-02-02 | Mutant: with the old `textName`, the new test fails ("Moodle" received, "your LMS" expected). No product code calls `textName` yet (`git grep`), so nothing else changes. |
| Must not edit | `apps/portal/vite.config.ts`, `apps/portal/src/styles.css`, `apps/portal/src/sdk/**` and `infra/scripts/fitness/**` are not touched. The only product source change is `packages/channel-kernel/src/registry.ts`, which is the dispatched B-02 fix. |
| Ownership | Lane K owns all 8 files (epics §5: the root build files row, the channel tsconfig row, the `packages/channel-kernel/**` row, and the K app kernel). |
| No LMS name in core | None added in `eslint.config.js`, `vitest.config.ts`, `package.json` or the tsconfigs. The "Moodle" values are in test files, which F1 does not check. The fence reads its globs from `packages/channel-kernel/fitness-scope.json` (one source with F1). |
