Verdict: APPROVE
Round: 1

# LA-E1-03 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: the three lane K commits after the integration merge `07ed16b`: `73c389c` (fix B-LA-E1-02-01), `21fc882` (fix B-LA-E1-02-02), `33118bc` (LA-E1-03). This is `git diff 07ed16b 33118bc` on `nguyenthanhquang152/la-k`, merged as `a9f83be`. Spec: `docs/architecture/ltiaas/tasks/LA-E1-03.md`. Design: LA-ADR-01 D1 (build model, import table), D5; TEST-STRATEGY §3.4, §3.5. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 5 MINOR, 2 NIT.**

The build model is small and uses globs, so a new channel folder needs no edit of a root file. The F3 fence reads the core globs from `fitness-scope.json`, so F1 and F3 use one scope source. The Vitest split into a `node` and a `portal` project keeps the old test set unchanged. Both LA-E1-02 fixes now have tests that fail on the old behaviour. My findings are about four things: an import-table row that will block LA-E1-07 and LA-E1-08, a custom lint rule that has no Author test, channel-root files that the typecheck does not see, and a start-path test that is tied to the line order of `main.ts`.

## How I checked

- Scratch clone of `33118bc` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied from the LA worktree; the lock differs only in the `version` field). The shared LA worktree did not change.
- Clean tree: `eslint .` exit 0; `npm run typecheck` (now four steps) exit 0; `vitest run`: **88 files, 1280 passed, 5 skipped**.
- `vitest list --filesOnly` at `07ed16b` and at `33118bc`: the same 88 files. All are in the `node` project now, and no file runs twice. Test files under `.tmp/` and `.data/` stay excluded in both projects.
- Probes in `packages/channels/zz-probe/` (deleted after use): a `.tsx` test in `portal/` runs in jsdom with the automatic JSX runtime; a test in `app/` runs in Node; 25 ESLint `--stdin` probes (results under the findings).
- Mutation checks for the two LA-E1-02 fixes (see the Checks table).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `33118bc` changes only `eslint.config.js`, `package.json` (the `typecheck` line), `vitest.config.ts` and the two new channel tsconfigs. The root `tsconfig.json` does not change (allowed, not needed). No change to `apps/portal/vite.config.ts`, `styles.css`, `apps/portal/src/sdk/**`, `infra/scripts/fitness/**` or product source. The two fix commits change only the LA-E1-02 files that the brief names. OK. |
| Ownership (epics §5, rows 543–544) | Lane K owns the root build files and the two channel tsconfigs. OK. |
| No behaviour change outside the spec | The `textName` change is the approved fix. It has no product caller yet (`git grep "textName("` finds only the kernel and its tests). The fence and the globs change no runtime code. OK. |
| No LMS name in core | The new build files contain no LMS name. The changed core test files contain channel ids only (see B-LA-E1-02-07, still open with A1). OK. |
| UNIT ACs fail on the old behaviour | LA-E1-03 has no UNIT AC (all its ACs are K0, QA-3). Fix B-LA-E1-02-01: when I remove `await loadAppChannelRegistry(deps.logger)` from `main.ts`, 7 of 9 tests fail. When I add an environment root to the call, AC-06 fails. Fix B-LA-E1-02-02: with the old `registry.ts`, the new test fails (`Expected "your LMS"`, `Received "Moodle"`). Both earlier findings are **resolved**. |
| Build model = D1 table | Typecheck: both configs, run by the root `typecheck`. Tests: the glob `packages/channels/*/**/*.test.{ts,tsx}`, and portal tests get jsdom by path. Lint: one block per channel glob plus the core block. The Tailwind and Vite parts are out of scope (LA-E1-11). OK, with B-LA-E1-03-03. |
| F3 = D1 import table | Each row refuses its probe. App and portal code may import port types and the SDK. Two rows need a design answer or a test: B-LA-E1-03-01, B-LA-E1-03-02. |

## Findings

### B-LA-E1-03-01 — MINOR — `app.ts` cannot import its own `app/**` files, but the P5–P7 ports need that (route to A1)

- **File:** `eslint.config.js:127-129`; design `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md:82` (D1 row `app.ts`), `:246-262` (D5 `ConnectionSetup` with `extensionRoutes`, `publishHooks`, `packageExporters`), `:289-310` (P5–P7 sketches).
- **Problem:** The `app.ts` block allows only `@cogniate/channel-kernel` and the ports file. So `app.ts` cannot import `./app/routes.ts`, and it cannot import `./manifest.ts`. But in D5 the adapter that `app.ts` exports carries the P5–P7 handlers, and those handlers live in `app/**`. LA-E1-08 cannot wire them without a lint error. Its "May edit" list, like the list of LA-E1-07, does not include `eslint.config.js`.
- **Evidence:** Probe `packages/channels/zz-probe/app.ts`: `import type { X } from './app/routes.ts'` gives `no-restricted-imports … outside the channel entry point API`. `import type m from './manifest.ts'` gives the same error. The Author applied the letter of the D1 row ("kernel types and the app port types only"). The reason for that row is purity: no database, no LTI call, no context. An import of `app/**` modules does not break purity, because those modules get the `PortContext` at call time (A2 alignment of B-LAD-03).
- **Suggested fix:** The Lead asks A1 to make the D1 row say whether `app.ts` may import its own `app/**` files and its own `manifest.ts`. If A1 says yes, add `\\./app/.+|\\./manifest\\.ts` to the `app.ts` allow-list in this task. `local-boundary` already keeps those paths inside the channel. This is a one-line change now. Later, it costs an RQ that stops the LA-E1-08 lane.

### B-LA-E1-03-02 — MINOR — The F3 fence is a custom ESLint rule plus regex allow-lists, and no Author test covers it

- **File:** `eslint.config.js:20-58` (`portPath`, `onlyImports`, `localBoundary`), `:97-105`, `:119-143`; plan LD-5; TEST-STRATEGY §3.4.
- **Problem:** The import table is in two places. Bare specifiers are in negative-lookahead regex strings per block (for example `` `@cogniate/(?:channel-kernel|shared)|${portPath}|\\.{1,2}/.*` ``). Relative paths are in the branches of a 40-line inline rule (`local-boundary`). The rule is a correct answer to a real problem: a glob cannot tell if `../../` leaves the channel. But LD-5 makes "code rules" Author unit tests, and this rule has none. The QA K0 probes (AC-03) are refusals only. AC-04 runs on a tree that has no `app.ts`, no `app/` and no `portal/` file. So nothing proves the allow branches: portal code imports its own manifest and the SDK path; `app/**` imports the ports file and its own files; portal tests are exempt. If a maintainer makes the rule too strict, the first failure comes in another task (LA-E1-07, LA-E1-08, LA-E1-11), as a lint error on correct code.
- **Evidence:** All of these probes pass, and no committed test asserts them: `portal/deep/a.tsx` imports `../../manifest.ts` and `…/apps/portal/src/sdk/ui.ts`; `app/a.ts` imports the ports file and `../manifest.ts`; `portal/a.test.tsx` imports `../app.ts`. A core file that imports a channel by relative path gets two errors for one import (`no-restricted-imports` and `channels/local-boundary`). The F3 claims in the commit message ("allow kernel types and SDK imports") are the result of a manual run, not of a test.
- **Suggested fix:** Add one Author test that lints one source text per D1 row with the real config, through `new ESLint({ cwd: <repo root> }).lintText(text, { filePath })`. Give each row one allowed import and one refused import. A lane K place that the root Vitest already runs is `packages/channel-kernel/src/import-fence.test.ts`; the Lead can give another place. If a later task adds a D1 row, it adds two rows to that test. Optional: give the `local-boundary` rule its own module with the allow table as data, so the table is in one place.

### B-LA-E1-03-03 — MINOR — Tests and other files at the channel root are not typechecked

- **File:** `packages/channels/tsconfig.node.json:3`; design D1 layout (`*.test.ts(x)` "unit tests next to the code").
- **Problem:** `tsconfig.node.json` includes only the entry files and `app/**`. A test next to `manifest.ts` or `lti-profiles.ts` (the place D1 gives, and the AC-02 probe path `zz-probe/probe.test.ts`) is run by Vitest but never typechecked. Vitest removes types without a check, so a test with a wrong field name or a wrong type still runs. In every workspace, `src/**` includes the tests, so a channel author does not expect this difference.
- **Evidence:** Probe: `zz-probe/probe.test.ts` with `const n: number = 'not a number'` and `zz-probe/helpers.ts` with the same error. `tsc -p packages/channels/tsconfig.node.json` and `tsc -p packages/channels/tsconfig.portal.json` both exit 0. `tsc --listFilesOnly` lists neither file. Vitest runs the test, and it passes. The same error in `zz-probe/app/env.test.ts` fails the typecheck, because `app/**` is included.
- **Suggested fix:** Add `"*/*.test.ts"` to the `include` of `tsconfig.node.json`. If a channel root may hold only the D1 files, write that rule in one sentence in `packages/channel-kernel/README.md`, so that a helper at the root does not escape the typecheck without notice.

### B-LA-E1-03-04 — MINOR — The new start-path test proves the claim, but it depends on the line order of `main.ts` and on a partial config

- **File:** `services/cogniate-app/src/kernel/registry.test.ts:16-28`, `:104-106`, `:128-130`; `services/cogniate-app/src/main.ts:20-36`; precedent `services/lti-service/src/main.test.ts:1-40`.
- **Problem:** The fix for B-LA-E1-02-01 imports `main.ts` and mocks four modules. The "stop" signal is a `createOutboundClient` mock that throws, and the AC-05 cases assert that it is not called. So the tests fail when a change in `main.ts` keeps AC-05 true but changes the order of two lines, or reads one more config field. The failure messages ("start reached outbound client", or a `TypeError` from `join(undefined)`) do not point to the cause. LA-E1-06 to LA-E1-08 edit this start code.
- **Evidence:** Mutation 1: I moved the `createOutboundClient` line above the registry call. The registry still loads before `listen`, so AC-05 is still true. All six AC-05 cases fail. Mutation 2: I added a top-level read of `config.playerDir`. All seven start tests (AC-05 and AC-06) fail, because the `loadConfig` mock returns only `{ dataDir }`. The sibling service shows a pattern with fewer seams: `lti-service/src/main.ts` exports `startLtiService`, and `main.test.ts` starts it with a real environment and no module mocks.
- **Suggested fix:** Use the `lti-service` pattern: export one start function from `main.ts` (or from a small `start.ts`), keep the entry file thin, and put the start tests in `services/cogniate-app/src/main.test.ts`. If that is too large for this round, make these smaller changes. Stop at the registry itself: the `loadChannelFolders` wrapper calls the original function, records the call, and then throws a named sentinel. Then remove the `createOutboundClient` mock and its "not called" assertion. Build the `loadConfig` mock from a full, typed `AppConfig`, so that a new field is a type error and not a runtime `undefined`.

### B-LA-E1-03-05 — MINOR — The `textName` doc comments still describe the old fallback

- **File:** `packages/channel-kernel/src/registry.ts:60`, `:70`.
- **Problem:** The interface comment says "Null or an unknown channel: the text name of the standard profile's channel." Since `21fc882`, an unknown channel gets `your LMS`. The `GENERIC_TEXT_NAME` comment says it is used "when no loaded channel owns the standard profile (a test registry)". It is now also the answer for every unknown id. B-LA-E1-02-02 was about this question: "which rule does a lookup follow?" Now the code and the comment give different answers.
- **Evidence:** `registry.ts:232-234` (new code) and `registry.test.ts:68` (`textName('zz-unknown')` = `your LMS`) disagree with `registry.ts:60`.
- **Suggested fix:** Change `:60` to "Null: the text name of the standard profile's channel (`your LMS` if no channel owns it). An unknown channel id: `your LMS`." Change `:70` to match. Optional for A1: add the unknown-id rule to the D4 line `textName(channelId: string | null)` (LA-ADR-01:217).

### B-LA-E1-03-06 — NIT — The fence messages do not say what is allowed

- **File:** `eslint.config.js:22` (`onlyImports` message), `:32` (`boundary` message).
- **Problem:** A channel author who sees "This import is outside the channel entry point API (LA-ADR-01 D1)" or "This path crosses the channel boundary (LA-ADR-01 D1)" must open the ADR to learn what the file may import. The message is the same for `manifest.ts`, `app/**` and `portal/**`.
- **Suggested fix:** Give `onlyImports` a second argument with the allowed list in words, for example `'manifest.ts may import only @cogniate/channel-kernel types'`. Put the resolved target folder in the `local-boundary` message with `data`.

### B-LA-E1-03-07 — NIT — The `portal` project comment is hard to read

- **File:** `vitest.config.ts:20`.
- **Problem:** "Portal tests use the same jsdom environment, including new channel modules without a pragma" does not say which tests are in the project. It also does not say how they differ from `apps/portal` tests, which still use `// @vitest-environment jsdom` and run in the `node` project.
- **Suggested fix:** "Channel portal tests run in jsdom because of their path, so they need no `// @vitest-environment jsdom` line. The `apps/portal` tests keep that line and run in the `node` project."

## Not checked

- K0 ACs AC-LA-E1-03-01 to -05 (QA-3 runs them) and the full `npm run check` (I ran its lint, typecheck and unit steps, but not `test:infra` and `test:k0`).
- Lens-A items: if the fence can be bypassed (for example through symlinks or a non-literal `import()`), and if the import table is complete against D1 for security.
