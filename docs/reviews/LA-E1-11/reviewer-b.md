Verdict: CHANGES_REQUESTED
Round: 1

# LA-E1-11 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 0d9aeda^1 0d9aeda` (the merge of lane P for LA-E1-11). Spec: `docs/architecture/ltiaas/tasks/LA-E1-11.md`. Design: LA-ADR-01 D1 (build model), D5 (P11 sketch), D9; BD-A1-24, -25, -26, -32. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 1 MAJOR, 2 MINOR, 2 NIT.**

The shell is small and easy to find. `channels/registry.ts` discovers the manifests with one `import.meta.glob`, and `channels/modules.ts` discovers the portal modules the same way. `ProviderSetup` chooses the module's `Wizard` or the generic `ManifestWizard`. The moved modules import only `@cogniate/portal-sdk` and their own files, and the portal F1 count drops from 315 to 18. The shell test is good for a channel with no module. A data-only test manifest gets its card, its route, the four steps, a real `POST /connections` body and the approval-code step, and the tests also cover the unknown-channel routes, the other-channel connection and the simulation-only gate. My MAJOR is that the shell tests never load the real channel modules. With the modules, the three baseline channels do not use the four-step wizard, so AC-01 and AC-03 are not proven for the channels they name.

## How I checked

- Scratch clone of `0d9aeda` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run apps/portal packages/channels`: **7 files, 83 tests passed**. `F1 PASS: 38 files with hits, 275 hits`.
- Probe (a temporary copy of the shell test fixture, deleted after the run): I rendered `/integrations/<id>/connect` and listed the `[data-channel-step]` elements.
  - As the shell tests do (`<ChannelProvider registry={registry}>`, no modules): `moodle`, `canvas`, `blackboard` and the test channel each give `["show","collect","verify","enable"]`.
  - With the real modules (`modules={channelModules}`, the production composition): `moodle`, `canvas` and `blackboard` give **`[]`**, because their own `Wizard` replaces the shell wizard. Only the test channel gives the four steps.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `apps/portal/**` and the new `packages/channels/*/portal/**`. No change to `manifest.ts`, `app.ts`, `lti-profiles.ts`, app code or `package-lock.json`. `vitest.config.ts` and `packages/channels/tsconfig.portal.json` are the RQ-2 K-file lines that the merge message names. `f1-baseline.json` only lowers counts (RQ-3), and `fitness.test.mjs` is lane P's. OK. |
| Ownership | Lane P, B2, plus the RQ lines. OK. |
| No behaviour change outside the spec | The baseline channels keep their own wizards (see B-LA-E1-11-01), so the M2 screens should not change. K2 U1/U2 and M2 are QA's proof. |
| No LMS name in core | F1 passes. The moved modules carry the LMS words in their channel folders. |
| UNIT ACs | AC-02: routes, unknown channel, other-channel connection; real routes through `App`. OK. AC-01 and AC-03: see B-LA-E1-11-01. |
| Can a newcomer add a portal module from the SDK and the docs? | Partly. The SDK file has no comments on the module contract (B-LA-E1-11-03). The canary path (no module) works well, so a new channel needs no module at all, which is the main goal. |

## Findings

### B-LA-E1-11-01 — MAJOR — The shell tests never load the real channel modules, so AC-01 and AC-03 are not proven for Moodle, Canvas and Blackboard (route the design conflict to A1)

- **File:** `apps/portal/src/channels/shell.test.tsx:64` (`<ChannelProvider registry={registry}>` without `modules`), `:80-84`, `:134-150`; `apps/portal/src/channels/context.tsx:9` (`modules = new Map()` by default); `apps/portal/src/connect/ProviderSetup.tsx:31`; `packages/channels/moodle/portal/index.tsx:12-23`; design `LA-ADR-01-channel-kernel.md:357` (D5 sketch: `Wizard?` "replaces the whole shell wizard (Canvas, Blackboard, Moodle)") against `:432` (D9: "The shell renders the four steps of every channel from the manifest: … verify (from the binding authority …)").
- **Problem:**
  - `ChannelProvider` defaults `modules` to an empty map, so every test that renders the app through it runs with no channel module at all. In production, the context default holds the real modules, and `ProviderSetup` renders `module.Wizard` for Moodle, Canvas and Blackboard.
  - So the AC-01 rows for the baseline manifests ("renders all four default steps") and the AC-03 rows ("selects the verification step from … authority") test `ManifestWizard` directly. That component is not what a Moodle, Canvas or Blackboard user sees.
  - The baseline wizards choose their screens their own way: `MoodleWizard` by `connection.method`, and the Canvas and Blackboard wizards by their step JSON. So the BD-A1-24 rule ("the verify step reads the stored `bindingAuthority`") holds only in the generic wizard.
  - The design says both things: D5 lets the three baseline modules replace the whole wizard, while D9 and AC-01/AC-03 say that the shell renders the four steps and the authority-based verify step for every channel.
- **Evidence:** The probe in "How I checked": with `modules={channelModules}`, the baseline connect routes render no `[data-channel-step]`. The test `"uses stored authority after dynamic registration stages a self connection"` (`:145-150`) passes on `ManifestWizard`, but `MoodleWizard` ignores `bindingAuthority` (`moodle/portal/index.tsx:17-19`).
- **Suggested fix:** The Lead asks A1 to settle D5 against D9 and AC-01/AC-03. Option (a): the baseline modules keep their whole-wizard override for now (no visible change), and AC-01/AC-03 are reworded to the generic wizard, with the baseline channels' own verify behaviour as a separate row. Option (b): the baseline modules move to `steps` overrides inside the four-step shell. In both cases:
  - Add route tests that render `App` with `modules={channelModules}` for the three baseline channels, and assert what each one shows today: the first-launch text for Moodle `self`, the approval code for Canvas and Blackboard.
  - Make `ChannelProvider` default `modules` to `channelModules`, not an empty map, so a test or a caller cannot drop the modules by leaving the prop out. Tests that need "no module" pass `new Map()` on purpose.

### B-LA-E1-11-02 — MINOR — The admin steps of the baseline channels have two sources

- **File:** `packages/channels/moodle/portal/MoodleSteps.tsx:3` (`moodle-steps.json`); `packages/channels/canvas/portal/canvas-steps.json`; `packages/channels/blackboard/portal/blackboard-steps.json`; against `manifest.texts.adminSteps` (read by `ManifestWizard.tsx:63`).
- **Problem:** The generic wizard reads the steps from the manifest. The baseline wizards read them from their own `*-steps.json` files. LA-E1-02 made the manifest steps equal to these files, but nothing keeps them equal now. A text change in one place does not reach the other. K2 AC-05 says the baseline steps "come from their manifests".
- **Suggested fix:** Part of the A1 decision in B-LA-E1-11-01. Either the baseline wizards read `manifest.texts.adminSteps` (and the JSON keeps only the data the manifest has no field for, such as step ids and images), or one unit test asserts that the JSON step texts equal the manifest texts with `{LMS}` and `{tool}` filled.

### B-LA-E1-11-03 — MINOR — The SDK re-exports whole portal modules and documents nothing a channel author needs

- **File:** `apps/portal/src/sdk/index.ts:7-11` (`export * from "../api.ts"`, `"../hooks.ts"`, `"../types.ts"`, `"./ui.ts"`, `"./session.ts"`, and `./ui.ts` itself `export *`s seven UI files), `:14`; `:35-61` (`ChannelWizardProps`, `ChannelUiModule`, no comments).
- **Problem:**
  - The SDK is the one portal folder that a channel module may import (D1). With `export *`, every new export in `api.ts`, `hooks.ts`, `types.ts` or a UI file becomes channel-facing API without a decision, so portal maintainers cannot tell which names channels depend on.
  - The module contract has no comments. The D5 sketch explains `Wizard` ("replaces the whole shell wizard"), the four `steps`, and the slots with their defaults (BD-A1-25, BD-A1-32: `ConnectionError` gets `Default`). `sdk/index.ts` keeps none of that, so a newcomer learns the contract by reading the three moved modules.
- **Suggested fix:** Replace the `export *` lines with named export lists, grouped as "API client", "hooks", "DTO types", "UI kit" and "error helpers", each group with a one-line comment. Copy the D5 member comments onto `ChannelUiModule` and `ChannelWizardProps`, including when each slot renders and what the shell does without it.

### B-LA-E1-11-04 — NIT — `ManifestWizard` is one 108-line component; its four steps are not reusable defaults

- **File:** `apps/portal/src/channels/ManifestWizard.tsx:17-108`, `:36` (a three-level ternary for `defaultValue`).
- **Problem:** The four step bodies are inline JSX in one record. A module that overrides one step through `steps` cannot reuse the default of a neighbour step, and a reader must hold the whole form state in mind to change one step.
- **Suggested fix:** Extract `ShowStep`, `CollectStep`, `VerifyStep` and `EnableStep` (exported from the SDK as the documented defaults), and give `field()`'s initial value a small named helper.

### B-LA-E1-11-05 — NIT — Old names and a second tool-name builder

- **File:** `apps/portal/src/sdk/index.ts:21`, `:44` (`ProviderView = LmsProvider`, `ProviderWizardProps = ChannelWizardProps`); `apps/portal/src/channels/registry.ts:16` (`channelOf` falls back to `lms`); `packages/channels/moodle/portal/index.tsx:36` (builds `Cogniate (${library})` itself, while the shell has `channelText`).
- **Problem:** The SDK publishes the old "provider/LMS" vocabulary next to the new names, and the Moodle module repeats the tool-name format that `channelText` already builds.
- **Suggested fix:** Mark the aliases `@deprecated` with the release that removes them. Export `channelText` (or a `toolName(libraryName)` helper) from the SDK and use it in the Moodle module.

## Not checked

- K2 U1/U2, K1-SIM AC-06 and K0 AC-07/08/09 (QA). I did not run `npm run build -w apps/portal`.
- Lens-A items: the simulation-only route timing and the BD-A1-24 authority for a staged connection beyond the unit rows.
