Verdict: APPROVE
Round: 1

# LA-E1-02 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff b93d7f2 8cf9412` (lane commit `8cf9412`; not merged yet, because `test:k0` waits for QA's K0 config).
- References: `docs/architecture/ltiaas/tasks/LA-E1-02.md`; LA-ADR-01 D2–D4 and D6 (load checks 1–8); LA-ADR-04 S2; app API delta §2. Lead-approved RQ-2 edit: `infra/scripts/storage-compat.test.mjs:130`.
- Blind review: I did not open the other reviewer's file. I wrote my findings before I judged the Author's choices.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Load checks fail closed | Yes. `buildChannelRegistry` runs checks 1, 2, 3, 4, 5 (when profiles are loaded), 6 and 8 in order, and throws `RegistryError` at the first failure (`packages/channel-kernel/src/registry.ts:151-212`). Every channel is checked, also a `simulation-only` one that the options hide. Each reason has a negative test (`registry.test.ts:65-110`, including `channel_id_duplicate` across two roots, so a test root cannot shadow a product channel). The loader also fails closed: an unreadable root, a failed import, a folder without `manifest.ts`, and a non-list `lti-profiles.ts` all throw (`registry.ts:86-119`; test `:169-178`). |
| App start stops | Yes. `loadAppChannelRegistry` runs inside the app listener `build`, before `listen` (`services/cogniate-app/src/main.ts`). A `RegistryError` logs one `channel_registry_invalid {channel, reason, check, detail}` line and rethrows (`services/cogniate-app/src/kernel/registry.ts:16-25`). The test runs the real `startService` per check and shows one line and no `service_started` (`kernel/registry.test.ts:59-86`; AC-05). |
| One constant root (dynamic import) | Yes. `CHANNEL_ROOT` is built from `import.meta.url` (`kernel/registry.ts:9`), and product code passes only `[CHANNEL_ROOT]` (`:28-30`). The test sets 14 plausible root variables and sees exactly one call `[[CHANNEL_ROOT], 'app']` (`kernel/registry.test.ts:96-106`; AC-06). The loader imports only fixed entry names (`manifest.ts`, `lti-profiles.ts`, `app.ts`) from directories found by `readdir`. Symlinked folders are skipped (a `Dirent` of a symlink is not `isDirectory()`), so a folder cannot point outside the root. |
| Six legacy flags, byte for byte | Yes. `legacyProjection` builds the six flags in M1 key order (`legacy-wire.ts:32-41`). The baseline test compares `JSON.stringify` of each channel with the M1 objects (`registry.test.ts:43-52`). I checked those objects against today's adapters at `b93d7f2`: `providers/moodle.ts:35`, `canvas.ts:24` and `blackboard.ts:44` are equal, key order included. |
| Schema strictness | Correct. The manifest schema is one `strictObject`. Authority is only `self` or `operatorGrant`, so `verifiedAdminLaunch` fails check 1 (AC-11). Families are lower case, so the `toLowerCase()` lookup of `ownerOfFamily` cannot miss a manifest entry. `FieldSpec` has no `default`, there is no `setup.verify`, and the `{LMS}`, `{tool}`, `{site}` placeholders are checked (`manifest.ts:83-141`). Check 4 refuses unknown ids, ids with a source other than `manifest`, and wrong value kinds (`capabilities.ts:135-147`). A prototype key such as `toString` also fails, because its spec has no `manifest` source. |
| Authority rules (AC-11) | Correct. Rule A3 (`manual` + `self` only in `MANUAL_SELF_LEGACY_CHANNELS` = `['moodle']`) and rule A4 (no `self` on a `sharing: shared` profile) are in `registry.ts:196-205`, with tests for both and for the baseline Moodle manifest. Rule A4 needs the profile data, so it runs on the LTI side (LA-E1-05). The app side has no profile traits. |
| Guards (D6) | Canvas guards `canvas`, and Blackboard guards `blackboardlearn`, at `launch` level. Moodle guards nothing. Check 8 limits `launch` to `LAUNCH_GUARD_CHANNELS` (`registry.ts:206-212`). |
| Unknown channel | Fails closed for capabilities: an unknown channel gets the empty set, so every guard stays closed (`registry.ts:224-225`; test `:125-133`). See A-LA-E1-02-01 for the text name. |
| "Must not edit" and ownership | Respected. There is no `lti-profiles.ts`, no `app.ts`, no LTI service file and no `apps/**` file. The RQ-2 line only adds `test:k0` to the host-only script list. |
| No behaviour change | Yes. No route reads the registry yet (the comment in `main.ts` says LA-E1-06 passes it on). The only new runtime effect is the start-time load, which passes for the baseline. `registration.scopes` keep today's five scopes. |

## Findings

- **A-LA-E1-02-01 (NIT): an unknown non-null channel id gets the Moodle text name.**
  - Where: `packages/channel-kernel/src/registry.ts:232-233`.
  - Problem: `textName('zz-gone')` falls back to the standard profile's channel ("Moodle"). D4 defines only `null` as "the standard profile's channel". An id that no loaded channel owns (for example a connection whose channel folder was removed) would show "Moodle" in its pages. This is a wrong label, not a safety issue.
  - Suggested fix: use the standard channel only for `null`, and `GENERIC_TEXT_NAME` ("your LMS") for an unknown id. Add one assertion next to AC-03.

## Author's choices (judged after my findings)

- The app loads every channel (`simulations: true`) and hides `simulation-only` channels at listing time. This is acceptable, and it matches app delta §2 ("listed only when the LTI service reports simulations on"): the app learns the LTI service's simulation state only from `GET /api/providers`. Consequence for later tasks: in the app, `channel()`, `channelOfProfile()` and `capabilities()` also answer for a `simulation-only` channel. LA-E1-06 and LA-E1-07 must refuse a list entry *and* a connection create for such a channel when the LTI service reports simulations off. I will check that there.
- Check 4 refuses derived capability ids in a manifest: correct (D3: a manifest sets only capabilities whose source is the manifest).
- `records.readBack` as a manifest value: matches the catalog row (source `manifest`).
- Default exports in entry files: fine. A missing default is caught by check 1.
- A missing `lti-profiles.ts` is an empty list, so check 5 fails: fail-closed, as intended.
- `registration.scopes` keep today's five scopes until LA-E3-07: no behaviour change, correct for S2.
- The root typecheck does not cover `packages/channels` until LA-E1-03: acceptable. Load check 1 validates each manifest at start and in the tests.

## Notes (no finding)

- Any directory under `packages/channels/` without `manifest.ts` (for example a stray `node_modules` or a helper folder) stops the app start with `manifest_missing`. That is the right fail-closed default. The "add a channel" guide (LA-E8-01) should say so.
- The compose `node-service` mounts `../packages` read-only, so `packages/channels` and `packages/channel-kernel` reach the app container without an infra change. The host needs `npm install` for the new workspace link (the lock file is updated).
- AC-01..04, AC-07, AC-08 and AC-10 are QA's K0 checks, and AC-09 is K1-SIM. The Author tests above already cover their logic.
