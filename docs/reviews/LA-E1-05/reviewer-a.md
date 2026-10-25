Verdict: APPROVE
Round: 2

# LA-E1-05 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E1-05.md`. Design: LA-ADR-01 D4, D6 (check 14, `wireLms`, `privacyFloor`, `listOrder`); LA-ADR-04 D8 LA-IC-02; LA-ADR-05 (floor rule); LA-ADR-07 T18; BD-A1-06.

Diff: `git diff aa0b200^1 aa0b200` (lane `la-l` head `664ca20`, 23 files; git shows the three profile files as renames into `packages/channels/*/lti-profiles.ts`).

Method: a throwaway `git archive aa0b200` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the unit tests, `eslint .`, `tsc` (LTI service, shared, channel configs) and 11 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E1-05-01 | MINOR | No unit test protects the frozen provider-list value `lms` (a one-token mutant that changes `standard` from `null` to `"moodle"` passes all 519 LTI service tests) |
| A-LA-E1-05-02 | MINOR | Design note (A2, A1): no load check limits `privacyFloor: 'none'`, and the launch test fails open |
| A-LA-E1-05-03 | NIT | No check that a new profile's `listOrder` comes after the baseline real profiles (D4) |

There is no BLOCKER and no MAJOR finding. The move is behaviour-neutral for Moodle, Canvas and Blackboard on every point that I checked (see "Checks that pass").

## Findings

### A-LA-E1-05-01 — MINOR — the frozen `lms` wire value has no unit test

- **File:** `services/lti-service/src/profiles/registry.ts:22` (`lms: source.wireLms === undefined ? channel : source.wireLms`).
- **Problem:** the code is correct today. But no Author test asserts the derived `lms` of the `standard` profile, which is the value that `GET /api/providers` sends (`http/routes/platforms.ts:350`). AC-02 (K0) checks `wireLms`, not `lms`. So only the K1-SIM golden G1 (AC-01, pending the Docker window) protects this frozen wire value.
- **Evidence:** mutant M7 `source.wireLms ?? channel` makes `standard` → `lms: "moodle"` on the wire. Result: `Tests 519 passed (519)` for `services/lti-service`. `canvas.test.ts` and `registry.test.ts` assert `lms: 'canvas'` and `lms: 'blackboard'`, but nothing asserts `lms: null` for `standard`.
- **Suggested fix:** one unit assertion: for each key of `BASELINE_PROFILE_WIRE_LMS`, `profileDefinition(id).lms` equals the map value, including `null` for `standard`. Or assert the `lms` column of the `GET /api/providers` answer in `multi-lms.test.ts`.

### A-LA-E1-05-02 — MINOR — design note: the privacy floor is not frozen, and the launch test fails open

- **Files:** `services/lti-service/src/profiles/schema.ts:9`; `services/lti-service/src/lti/launch.ts:117`.
- **Problem 1 (design, route to A2 with A1):** load check 7 accepts `privacyFloor: 'none'` on any profile. Load check 7 freezes `wireLms` (BD-A1-06), but it does not freeze the floor. So a new channel profile, or an edit of a Canvas or Blackboard profile, can set `none` and pass the start. Then that LMS stores every claim (names, e-mail, `custom`, `lis`) with no core edit. D6 fixes the values as "`allowlist` for every Canvas and Blackboard profile, `none` for `standard`". LA-ADR-02 sets `allowlist` for `lti-generic` and `brightspace`. LA-ADR-07 T18 says the floor "cannot be lowered". Today only the claim policy (E3) is in the scope of that rule. This is not an Author defect: the spec does not ask for a floor check.
- **Problem 2 (code, small):** `profile.privacyFloor === 'allowlist' ? minimizeClaims(...) : keep all` fails open. Today the closed enum makes this safe. If a later value (for example a stricter floor) is added to the enum, that value will keep every claim.
- **Evidence:** the schema has `privacyFloor: z.enum(['allowlist', 'none'])` and no rule per profile id. Mutants M3 (never minimize) and M4 (always minimize) are each killed by `multi-lms.test.ts` (Blackboard allowlist and the `standard` launch), so today's behaviour is covered.
- **Suggested fix:** (1) A2 decides whether `none` is allowed only for a frozen list of profile ids in `legacy-wire.ts` (today `standard`), with a load check 7 rule like the `wireLms` rule. (2) Write the launch test as `profile.privacyFloor !== 'none'`, so that only the explicit `none` value keeps every claim.

### A-LA-E1-05-03 — NIT — `listOrder` of a new profile is not checked

- **File:** `services/lti-service/src/profiles/schema.ts:11`.
- **Problem:** D4 says "a new channel's profiles take `listOrder` values above the baseline values". The schema accepts any non-negative integer. A new profile with `listOrder: 5` sorts between `standard` (0) and `canvas-cloud-production` (10), so the order of `GET /api/providers` changes for clients.
- **Suggested fix:** a load check 7 rule: a profile that is not a baseline profile has a `listOrder` above the largest baseline `listOrder` in its group. Or record the convention as a review rule only.

## Checks that pass

| Item | Result |
| --- | --- |
| Profile data is unchanged | All issuers, endpoints, `{serviceUrl}` and `{clientId}` templates, `sharing`, `siteUrlOn`, `serviceUrl`, `productFamily`, `refusedHostSuffixes`, `sources` and the flags `deepLinkingResponseSub`, `clientAssertionAudArray`, `serviceOriginCheck` are byte-equal in the renames. `minimizeClaims` becomes `privacyFloor` (Canvas, Blackboard `allowlist`; `standard` `none`), the same effect. The loaded profile objects, `flags`, `sources` and `refusedHostSuffixes` are frozen, so nothing can change a floor at run time. |
| `GET /api/providers` | The same explicit field list (`platforms.ts:350`, no `flags`). `lms` comes from `wireLms` (baseline values = `BASELINE_PROFILE_WIRE_LMS`, the eight pairs of BD-A1-06). Order: `listOrder` 0, 10–40, 50, then the simulation group 60, 70 = `standard`, four Canvas, `blackboard`, `blackboard-sim`, `canvas-sim-cloud` (today's order). Simulation profiles appear only with simulations on. |
| Claims (lens focus) | `minimizeClaims` was read in one place only (`launch.ts:115` before, `:117` after). `grep` finds no other claim store that reads a profile flag. The allowlist still runs after every check and before `createLaunch`. M3 and M4 are killed. |
| Check 14 (AC-03, AC-04) | The baseline manifests guard `canvas` and `blackboardlearn` at the `launch` level, and Moodle guards nothing. The kernel schema forces lower-case families. So the refused set equals today's set, case folding included. A `registration` guard refuses only on a `MANUAL_SELF_LEGACY_CHANNELS` profile, before any claim is stored, and on other platforms it logs `family_guard_mismatch` (info) and passes (D6). Mutants: M1 (drop the manual-self refusal), M2 (registration treated as launch) and M9 (no info log) are each killed. |
| Closed schema (AC-05) | `z.strictObject` at the top level and in `flags`. M5 and M6 (non-strict) are killed by the "unknown trait", "source-supplied owner" and "unknown flag" cases. The `wireLms` rule runs in both directions: M8b (no rule) fails 3 cases, and M10 (presence only, no value compare) fails "changed baseline wire value". Load checks 2 and 5 are covered. The test calls `loadProfileRegistry`, the same function that the module start runs (`profiles/index.ts:28`), and asserts exactly one `channel_registry_invalid` line. The kernel drops malformed profile values before its checks 2, 5 and 6, so check 7 reports them. |
| Text names (AC-06) | `lmsNameOf` and `lmsNameOfFamily` give today's values for the eight profiles and for `null`, `canvas`, `BlackboardLearn`, `moodle`, unknown and empty families. Unknown and unstored profiles fall back to the `standard` channel text, as before (`binding.ts:18`, `login.ts:24`). |
| `isStandardProfile` | Now `endpoints === 'admin'`. Only `standard` has `admin` today, so the call sites in `platforms.ts` and `service-context.ts` keep their results. |
| LA-IC-02 (AC-07, AC-11) | Before the change, no product code read `urls.moodle` (only `config.ts` had it). The app and the LTI service no longer need `PUBLIC_MOODLE_URL`. The outbound allowlist and `/healthz` do not read it (`HealthBody` has no URLs). `config.ts` has no LMS word left. The `fitness-scope.json` exception is removed. |
| No LMS name in core | The added core lines with an LMS word are only the eight pairs in `legacy-wire.ts` (the F1 exception). |
| Must not edit | `platforms.ts`, `http/app.ts`, `http/auth.ts`, `main.ts`, `config.ts`, `lti/codes.ts` and the manifests are untouched. `legacy-wire.ts`, `fitness-scope.json` and the app `testkit.ts` are the RQ edits that the dispatch names. Two more one-line fixture edits are outside the "May edit" list: `services/cogniate-app/src/providers/canvas.test.ts` (the `urls` fixture) and `packages/shared/src/service.test.ts` (the env and the error text). The `PublicUrls` change forces both. The Lead should confirm that they are inside the approved RQ-2. |
| Build and tests | On the `aa0b200` tree: `vitest` for `services/lti-service`, `packages/shared` and `packages/channel-kernel` gives 52 files and 755 tests passed. `eslint .` exits 0. `tsc` for the LTI service, shared and `packages/channels/tsconfig.node.json` exits 0. |

## Round 2

- Reviewer: Reviewer-A (the same lens as round 1; this session continues it). Diff: `git diff 1b342e6^1 1b342e6` (lane `la-l` fix round: `e281f54`, `068f560`, `06ddec7`, `510bb72`, `ead5edb`; merged with the lead QA kit line in `2b7530a`). The files at `HEAD` are the same as at `1b342e6`.
- References: my round-1 findings above; A2 BD-A2-21 (privacy floor); A1 BD-A1-21 (kernel `ProfileSource` types) and BD-A1-23 (`listOrder` bound); LA-ADR-01 D4 and D6 (check 7).
- I ran on the host: `vitest` for `services/lti-service/src/profiles`, `packages/channel-kernel` and the multi-LMS launch tests, 5 files and 76 tests pass.
- Blind review as before.
- **Verdict (round 2): APPROVE.** All three round-1 findings are closed. New: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E1-05-01 (MINOR) | closed | New unit test "keeps every frozen provider-list lms value, including the explicit null". It asserts the derived `lms` of every `BASELINE_PROFILE_WIRE_LMS` key, `standard` → `null` included. So the round-1 mutant (`wireLms ?? channel`, which gives `standard` → `"moodle"`) now fails a unit test, not only the K1 golden. |
| A-LA-E1-05-02 (MINOR) | closed | BD-A2-21:<br>(1) `PRIVACY_FLOOR_NONE_PROFILES = ['standard']`, frozen in `legacy-wire.ts` (the F1 file exception).<br>(2) Load check 7 refuses `privacyFloor: 'none'` on any other profile, with `profile_privacy_floor_invalid` naming the profile (`profiles/schema.ts`). `privacyFloor` is required, and an unknown value fails the schema. A raise of `standard` to `allowlist` passes, as the ruling allows.<br>(3) The launch keeps every claim only for an explicit `none` (`lti/launch.ts`: `privacyFloor === 'none' ? keep : minimizeClaims`), so any other value minimizes (fail closed).<br>A new channel cannot borrow the exception by naming a profile `standard`: kernel check 2 keeps one owner per profile id across all channels (`packages/channel-kernel/src/registry.ts:163-170`). |
| A-LA-E1-05-03 (NIT) | closed | BD-A1-23: a profile that is not a baseline key needs `listOrder` above the largest loaded baseline value (70, the simulation profiles included, so the result does not depend on the simulation setting). Else check 7 gives `profile_list_order_invalid` with the profile id and the bound (`profiles/registry.ts`). Tests cover 0, 50 and 70 as refused, and the order of a new real profile after the baseline and before every simulation profile. |

### Other changes (checked)

- `ProfileSource` types now come from `@cogniate/channel-kernel` (BD-A1-21). Each `lti-profiles.ts` uses `import type` and `satisfies readonly ProfileSource[]`, and the LTI schema keeps `satisfies z.ZodType<ProfileSource>`, so the type and the schema cannot drift. The type-only import stays inside the BD-A1-16 channel fence.
- One `ProfileOptions` context: `profileDefinition`, `lmsNameOf`, `lmsNameOfFamily` and `platformLmsName` now take the request's options, so a test or a non-default registry is used the same way on every path. The login fallback text now comes from `lmsNameOf(null, …)` (today "Moodle"), not from a literal, which also removes an LMS name from core.
- Check 7 diagnostics now name the profile id and the expected value (`wireLms must be null`, `Expected null for endpoints "admin"`). The error texts hold profile data only, no secret.
