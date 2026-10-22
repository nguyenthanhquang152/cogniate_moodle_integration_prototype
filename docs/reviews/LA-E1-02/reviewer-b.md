Verdict: APPROVE
Round: 1

# LA-E1-02 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff b93d7f2 8cf9412` (lane K commit `8cf9412` on `nguyenthanhquang152/la-k`, not merged yet). Spec: `docs/architecture/ltiaas/tasks/LA-E1-02.md`. Design: LA-ADR-01 D1–D4, D10, D11; LA-ADR-04 D1 S2, D2; README §4. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 5 NIT.**

The kernel is small and easy to read. It has five files with one job each, a README with the entry points and the load-check table, and frozen names in one file. The tests are table-driven, and each load check has one failing case. A new channel author can copy one of the three manifests. Each manifest names its sources in a comment and in its README facts table. My findings are about test seams, two hand-kept copies of one shape, and one fallback that does not fail closed.

## How I checked

- Scratch clone of `8cf9412` in a private `/tmp` folder (`git clone --no-hardlinks`, with `node_modules` copied from the lane K worktree). The shared LA worktree did not change.
- `vitest run packages/channel-kernel services/cogniate-app/src/kernel`: **3 files, 43 tests passed** (0.39 s).
- `eslint` on the changed folders: 0 problems. `tsc --noEmit` on the kernel and app projects: exit 0.
- `npm query .workspace --offline`: `packages/channel-kernel` is a workspace; no path under `packages/channels/` is a workspace (AC-10).
- `tsc --listFilesOnly` on every tsconfig of the repository: 0 files under `packages/channels/` (see the Checks table, "Manifest types").

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | Only the files of the "May edit" column changed, plus the Lead-approved RQ-2 line (`infra/scripts/storage-compat.test.mjs:131` at `8cf9412`, the brief's "line 130": `'test:k0'` added to the host-only list; nothing else in that file). The commit has no `lti-profiles.ts`, no `app.ts`, no LA-E1-03 build file, no `apps/**` and no `services/lti-service/**` change. Root `package.json` changes only `check` and the new `test:k0` line. OK. |
| Ownership (epics §5) | Lane K owns `packages/channel-kernel/**`, the three new channel folders and `services/cogniate-app/src/kernel/registry.ts` in B1. OK. |
| No behaviour change outside the spec | `main.ts:34` builds the registry inside the app listener `build`, before `listen` (`packages/shared/src/service.ts:50-51`). No route reads the result yet (comment `main.ts:32-33`; LA-E1-06 passes it on). A valid tree therefore changes nothing that is visible. |
| No LMS name in core | The new non-test core files have LMS words only in comments and in `legacy-wire.ts` (the allowed exception). The `main.ts` Moodle tokens existed before this task. The new unit tests in core paths contain channel ids; TEST-STRATEGY §3.1 keeps unit tests out of F1, but see B-LA-E1-02-07. |
| Kernel boundaries | `text` ← `manifest` ← `capabilities`; `legacy-wire` → `capabilities`; `registry` → all. No cycle. The Node built-ins load inside `loadChannelFolders` only (`registry.ts:82-85`), so the portal can import the package. The public surface (`index.ts`) is the D4 list plus the schema and catalog helpers. OK, with B-LA-E1-02-04. |
| `RegistryError.check` carries 7 and 8 (design note) | `LoadCheck = 1 \| … \| 8` (`registry.ts:32`). OK. |
| One constant root (D4) | `CHANNEL_ROOT` comes from `import.meta.url` (`kernel/registry.ts:9`); `loadAppChannelRegistry` passes only that root. OK, with B-LA-E1-02-01 on the proof. |
| AC-07 `fitness-scope.json` = README §4 | The classes and globs are equal. The JSON writes "applied SQL migrations" as the two migration folders that exist (`services/cogniate-app/src/domain/migrations/*.sql`, `services/lti-service/src/db/migrations/*.sql`). It keeps the simulator-manifest exception of `infra/**` as free text, because no such file exists yet. Both are fair machine forms of the table. |
| Manifest values | The three card texts equal `apps/portal/src/Integrations.tsx:30-50`. The Moodle admin steps equal the `dynamic` list of `connect/moodle-steps.json`, with `{LMS}` and `{tool}` in place of the names. The guard families and levels equal the D3/D6 tables. |
| Manifest types | No tsconfig includes `packages/channels/*/manifest.ts` at this commit, so `satisfies ChannelManifest` is not checked yet. Only the runtime schema (load check 1) and the baseline unit test check the manifests. LA-E1-03 adds the channel tsconfigs and the QA build-model probe, so this needs no change here. I record it so that nobody reads "typed" as "typechecked" before LA-E1-03 lands. |
| UNIT ACs fail on the old behaviour | AC-05, AC-06 and AC-11: the old tree has no kernel and no app registry, so every test fails. Better: each table row asserts the check number and the reason, so a removed or weakened check fails its own row. |
| K0, DOC and K1 ACs | AC-01 to AC-04, AC-08 and AC-10 are QA K0 (the `test:k0` config `tests/ltiaas/k0/vitest.config.mts` does not exist at this commit; AC-08 waits for it). AC-09 is K1-SIM. They are not mine to pass. |

## Findings

### B-LA-E1-02-01 — MINOR — The start tests prove a copy of the `main.ts` wiring, not `main.ts`

- **File:** `services/cogniate-app/src/kernel/registry.test.ts:73-80`, `:103`; `services/cogniate-app/src/main.ts:31-34`.
- **Problem:** AC-05 says that a failing check "stops the app start", and AC-06 says that "the app start calls the loader with one constant root". The tests check a listener that the test file builds itself ("the same listener shape as main.ts"), and they call `loadAppChannelRegistry` directly. No test fails if `main.ts` drops the call, moves it after `listen`, or calls `buildAppChannelRegistry([CHANNEL_ROOT, process.env.X])`.
- **Evidence:** The test `build` function calls `buildAppChannelRegistry([CHANNEL_ROOT, root], …)` (`:77`), not the `main.ts` listener. The AC-06 test spies on `loadChannelFolders` through `loadAppChannelRegistry` (`:103-105`) and never starts the app. K0 tests the kernel entry points only, and no K1 case starts the app with a broken channel. So this repeats the "do tests prove the claim?" gap of B-LA-E1-01-02.
- **Suggested fix:** Pick one. (a) Move the app listener list out of `main.ts` into a small exported function (for example `appListeners(env)`), so that `main.ts` only calls `startService(APP_SERVICE_NAME, appListeners(...))`, and let the two tests start that list. (b) Keep the code. Ask QA-3 for one host-only check that starts `services/cogniate-app/src/main.ts` from a scratch clone with a broken folder under `packages/channels/`, and expects exit ≠ 0 and one `channel_registry_invalid` line. (a) is cheaper to keep green.

### B-LA-E1-02-02 — MINOR — `textName` of an unknown channel falls back to the standard channel ("Moodle"), not to a neutral name

- **File:** `packages/channel-kernel/src/registry.ts:60`, `:232-233`; test `packages/channel-kernel/src/registry.test.ts:57`.
- **Problem:** `textName('zz-unknown')` returns `Moodle`. The ADR Context lists this pattern as a defect: "`lmsOfProfile` maps every unknown profile to `moodle`". The same registry fails closed for capabilities: an unknown channel gets the empty set (`:62`, `:224-225`). A maintainer cannot guess which rule a lookup follows.
- **Evidence:** D4 defines only `null = the standard profile's channel`. It says nothing about unknown ids. The code already has the neutral `GENERIC_TEXT_NAME = 'your LMS'` (`:71`), but uses it only when no channel owns `standard`. No caller exists yet. LA-E1-09 and LA-E1-10 (S7 texts) will be the first users, so a connection whose channel is unknown would then show Moodle texts.
- **Suggested fix:** Keep `null` → the standard channel (Moodle texts stay byte for byte). Return `GENERIC_TEXT_NAME` for a non-null id that is not loaded, and change the test row. If A1 wants the current rule, write it in D4 and in the interface comment with the reason.

### B-LA-E1-02-03 — NIT — Two hand-kept copies of the manifest shape and of the "manifest capability" list

- **File:** `packages/channel-kernel/src/manifest.ts:35-81` (interface) and `:108-141` (schema), with the cast at `:150`; `packages/channel-kernel/src/capabilities.ts:71-74` (`ManifestCapabilityId`) and the catalog `source: 'manifest'` rows at `:48-66`.
- **Problem:** A field change (for example `FieldSpec.default` in LA-E2-03) needs an edit in two places. The `as ChannelManifest` cast hides a difference between them. The same is true when a new capability gets `source: 'manifest'` in the catalog but not in the union.
- **Evidence:** No type-level link exists between `z.infer<typeof MANIFEST>` and `ChannelManifest`, or between the union and the catalog. Drift shows up later, as a load failure or (after LA-E1-03) as a type error in a channel folder, far from the kernel edit.
- **Suggested fix:** Keep the interface: it is the documented shape for channel authors. Add compile-time links. Declare the catalog `as const satisfies Record<CapabilityId, CapabilitySpec>` and derive `ManifestCapabilityId` from the rows whose `source` is `'manifest'`. Add one assignability check of `Omit<z.infer<typeof MANIFEST>, 'capabilities'>` against `Omit<ChannelManifest, 'capabilities'>`, so the typecheck fails when the two drift.

### B-LA-E1-02-04 — NIT — Manifest field types and the load-problem type live in `capabilities.ts`

- **File:** `packages/channel-kernel/src/capabilities.ts:5-7`, `:125-129`; `packages/channel-kernel/src/manifest.ts:5`.
- **Problem:** `RegistrationMethod` and `BindingAuthority` are manifest field types, and `CheckProblem` is the shared result of every load check. All three live in the capability module. A reader of `manifest.ts` must open `capabilities.ts` to see its own field types.
- **Suggested fix:** Move `RegistrationMethod` and `BindingAuthority` to `manifest.ts`, and `CheckProblem` next to `RegistryError` (or into a tiny `problems.ts`). `capabilities.ts` then imports them from there. Do it in the next kernel task that edits these files; it changes no behaviour.

### B-LA-E1-02-05 — NIT — No rule for when a manifest writes an explicit `false`

- **File:** `packages/channels/moodle/manifest.ts:32-33`; `packages/channels/canvas/manifest.ts:32`; `packages/channels/blackboard/manifest.ts:28`.
- **Problem:** "Absent = false or empty" (D2). Moodle writes `content.multiple: false` and `launch.windowHint: false`, but leaves out `deployments.multiple`, `setup.artifacts` and `launch.topLevelContinue`. A new channel author does not know which `false` values to write.
- **Evidence:** The explicit values are the ones with a design source (A-T0-11, D-10). That rule is good, but nothing in the code or the docs states it.
- **Suggested fix:** Add one sentence to `packages/channel-kernel/README.md`: "Write a `false` or empty value only when it records a decision with a source; add the source in a comment."

### B-LA-E1-02-06 — NIT — Load check 6 has no positive case for a new channel, and a missing `lti-profiles.ts` reports a misleading reason

- **File:** `packages/channel-kernel/src/registry.test.ts:86-88`, `:162-167`; `packages/channel-kernel/src/registry.ts:111`, `:189-194`, `:196-205`.
- **Problem:** (a) The check 6 rows prove two refusals, and the Moodle row proves the legacy exception. No row proves that a new channel with `dynamic` and `self` on an `exclusive` profile loads. If someone makes check 6 stricter by mistake (refuse every `self` outside the legacy list), no test fails, and the E2 generic channel finds out first. (b) On the LTI side, a folder without `lti-profiles.ts` gets the reason `profile_not_in_lti_profiles` with `profile "<id>"`. The operator looks for a wrong profile id, but the cause is a missing file.
- **Suggested fix:** (a) Add one passing row: test channel, `dynamic`/`self`, `ltiProfiles: [{ id, sharing: 'exclusive' }]`, the build passes. (b) In the loader, keep `undefined` for a missing file on the LTI side, and let check 5 report `lti_profiles_missing` with the file path. Or add the file name to the check 5 detail. Either can wait for LA-E1-05, which owns the LTI side.

### B-LA-E1-02-07 — NIT — The scope file has no class for "excluded from F1" (route to A1)

- **File:** `packages/channel-kernel/fitness-scope.json:3-36`; design `docs/architecture/ltiaas/README.md:104-110`; `tests/ltiaas/TEST-STRATEGY.md:254`.
- **Problem:** TEST-STRATEGY §3.1 has a class "Excluded from F1, counted by F2: unit tests (`*.test.ts`, `*.test.tsx`), `testkit.ts`". README §4 does not have it, so the JSON (correctly equal to README §4, AC-07) does not have it either. This task adds channel ids in two core unit tests (`packages/channel-kernel/src/registry.test.ts`, `services/cogniate-app/src/kernel/registry.test.ts`). If LA-E1-04's F1 reads only this file, these tests enter the ratchet and must reach 0 at LA-E1-12. If it does not, the exclusion is a second, hidden scope source.
- **Suggested fix:** No change in this task. The Lead asks A1 to add the class to README §4. The Author then adds it to `fitness-scope.json` (for example `"f1Excluded": { "globs": ["**/*.test.ts", "**/*.test.tsx", "**/testkit.ts"] }`) before or with LA-E1-04.

## Not checked

- K0, K1-SIM (AC-09) and the full `npm run check` (the K0 config is not in this commit).
- Lens-A items: the exact M1 capability bytes against the LA-E0-03 golden file, and the security rules of check 6 beyond the test rows.
