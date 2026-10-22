Verdict: APPROVE
Round: 1

# LA-E1-05 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff aa0b200^1 aa0b200`, the content that the merge of lane L head `664ca20` added. Spec: `docs/architecture/ltiaas/tasks/LA-E1-05.md`. Design: LA-ADR-01 D4 (load checks 2, 5, 7), D6 (`wireLms`, `privacyFloor`, `listOrder`, check 14), BD-A1-06. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 3 MINOR, 3 NIT.**

The move is clean. The three `lti-profiles.ts` files are plain data with source comments. The LTI profile code no longer has an LMS-name branch: check 14 reads the manifest guards, and the claim filter reads `privacyFloor`. The closed schema refuses unknown fields, also inside `flags`. The AC-05 table test writes real folders and runs the real loader, and each row asserts the check number, the reason and one log line. My findings are about the path of a newcomer who adds a profile for a new channel, the load-check error text, and three different ways to give a test registry to the profile functions.

## How I checked

- Scratch clone of `aa0b200` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied from the LA worktree). The shared LA worktree did not change.
- Clean tree: `eslint .` exit 0; `npm run typecheck` exit 0; `vitest run`: **89 files, 1314 passed, 5 skipped**.
- Newcomer probe: a new folder `packages/channels/zz-new/` with a valid manifest and two profiles. I copied the profiles from the Canvas file and made two typical mistakes (results in B-LA-E1-05-01 and -02). I deleted the folder after the probe.
- Mutation checks on `channel-registry.test.ts`. When I remove the `MANUAL_SELF_LEGACY_CHANNELS` clause from check 14, the AC-04 "standard platform" case fails. When I remove the `family_guard_mismatch` log line, the AC-04 "other profile" case fails.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | The diff does not change `platforms.ts`, `http/app.ts`, `http/auth.ts`, `main.ts`, `config.ts`, `lti/codes.ts` or any `manifest.ts`. The kernel changes (`legacy-wire.ts`, `fitness-scope.json`) and the app `testkit.ts` change are the RQ lines that the spec and the dispatch name. Two mechanical follow-ups of the `PublicUrls` change are outside the "May edit" list: `packages/shared/src/service.test.ts` (fixture env and one error regex) and `services/cogniate-app/src/providers/canvas.test.ts:66` (one fixture). The commit message calls them "Lead-approved RQ-2 … unit fixture edits". The Lead must confirm that record. |
| Ownership (epics §5) | Lane L owns `services/lti-service/src/profiles/**`, the listed `lti/*` files, the LTI `testkit.ts` and the new `lti-profiles.ts` files. OK, with the RQ note above. |
| No behaviour change outside the spec | `lms` on the provider list now comes from `wireLms`, with the same eight values. `isStandardProfile` becomes `endpoints === 'admin'`, so its results do not change for the baseline. The one new log line is AC-04 `family_guard_mismatch`. `PublicUrls` loses `moodle` (LA-IC-02). OK. |
| No LMS name in core | The diff removes the literals `'canvas'`, `'blackboard'`, `'Moodle'`, `'Canvas'` and `'Blackboard'` from `checks.ts`, `launch.ts`, `profiles/index.ts`, `profiles/types.ts` and `shared/config.ts`. New LMS words are only in `legacy-wire.ts` (allowed exception), in tests and in comments. F1 goes down (AC-11 is K0). |
| UNIT ACs | AC-03: a preservation test over every baseline profile × 7 family values, including mixed case. AC-04: both guard levels through `handleLaunch`, with the stored-row count. AC-05: 8 table rows (check 7 × 6, check 2, check 5). AC-06: every baseline profile and family. Each AC except AC-03 is new behaviour, so the old tree fails it. AC-03 is a "same as today" AC, and the mutation checks above show that it and AC-04 catch a regression. OK. |
| Start path (AC-05) | The product registry loads at module level (`profiles/index.ts:28`) through the same `loadProfileRegistry` that the test calls. The default logger writes to `LOG_DIR/lti-service.jsonl`, the same file as the service logger. So the `channel_registry_invalid` line goes where an operator looks. OK. |

## Findings

### B-LA-E1-05-01 — MINOR — A newcomer gets no type help and no pointer to the profile schema from the channel folder

- **File:** `packages/channels/{moodle,canvas,blackboard}/lti-profiles.ts:1-2` (headers) and `moodle:12`, `canvas:52`, `blackboard:30` (`] as const`, no type); `services/lti-service/src/profiles/types.ts:22-23`, `:27`, `:33-35`, `:46`; design LA-ADR-01:225 (`listOrder` rule).
- **Problem:** A new channel author copies a `lti-profiles.ts` file. The file names no schema and has no type, so the editor gives no help, and the typecheck (which covers `*/lti-profiles.ts` since LA-E1-03) checks nothing. The first feedback is a load-check error when `npm run check` imports the profile module. The rules that the author must know are in `services/lti-service/src/profiles/`, and some are only in the ADR:
  - `endpoints` and `privacyFloor` have no doc comment. The reader must find in `schema.ts:29-35` that `admin` means "all four endpoint values are `null`".
  - The `issuer` comment still says "`null` = an admin value (`standard` only …)". After this task, any profile with `endpoints: 'admin'` may have `null`.
  - `listOrder` says only "sorts by this value". The ADR rule "a new channel's profiles take values above the baseline values" is not in the code.
  - `productFamily` is required, but no code reads it. Guards come from manifest `lti.guardedFamilies`, and nothing checks that the two values agree.
- **Evidence:** In the newcomer probe, the slip `accessTokenEndpoint` (the spelling of the manifest `bindingFields` key) for `accesstokenEndpoint` was found only at run time: `profiles/registry.test.ts` failed at import with "0 test". Every test file that imports the profile module loads the registry at import time, so all of them fail the same way. `git grep -w productFamily` finds no reader outside the schema, the types and the data. The D1 fence allows `lti-profiles.ts` to import only kernel types and its own manifest, so `ProfileSource` (in the LTI service, by design) cannot be imported.
- **Suggested fix:** In this task: (1) put one header line in each `lti-profiles.ts` that names `services/lti-service/src/profiles/types.ts` and `schema.ts`; (2) add one-line docs for `endpoints` and `privacyFloor`; fix the `issuer` note; add the ADR `listOrder` rule; say that `productFamily` is information only and must equal the manifest guard family. Route to A1: allow a type-only import of `ProfileSource` in `lti-profiles.ts` (the same pattern as `app.ts` → `ports.ts`), so each file can end with `as const satisfies readonly ProfileSource[]`. Or move the type to the kernel. The runtime schema stays where it is.

### B-LA-E1-05-02 — MINOR — Load check 7 errors do not name the profile, and they do not say the expected value

- **File:** `services/lti-service/src/profiles/schema.ts:32`, `:43`, `:49`.
- **Problem:** The `profile_schema_invalid` detail gives the field path, but not the profile id. A channel with five profiles (like Canvas) gives no clue which entry failed. The endpoint rule says "Endpoint value does not match the endpoints trait." It does not say the expected value (`null` for `admin`, a value for `fixed`). The `profile_wire_lms_invalid` detail joins two cases in one sentence, and it does not give the frozen value that a baseline profile must keep.
- **Evidence:** Probe output: `load check 7 failed for channel "zz-new": profile_schema_invalid (accesstokenEndpoint: Invalid input: expected string, received undefined; profile: Unrecognized key: "accessTokenEndpoint")`. After I fixed that mistake: `profile_schema_invalid (issuer: Endpoint value does not match the endpoints trait.)`. Neither line names `zz-cloud` or `zz-self`.
- **Suggested fix:** Start each detail with the profile id, or with `#<index>` when `id` is missing or not a string: `profile "zz-self": issuer: …`. Change the endpoint message to "must be null when endpoints is 'admin', and a value or template when endpoints is 'fixed'". Split the wire check into two messages: `profile "X" is a baseline profile: wireLms must be <value>` and `profile "X" is new: remove wireLms`.

### B-LA-E1-05-03 — MINOR — Three different ways to give a test registry to the profile functions; one call site mixes two registries

- **File:** `services/lti-service/src/profiles/index.ts:28`, `:30-35`, `:46-47`, `:59-60`, `:67`, `:119-128`; `services/lti-service/src/lti/login.ts:24`; `services/lti-service/src/lti/launch.ts:67`, `:112`.
- **Problem:** Some functions read `opts.registry` (`listProfiles`, `findProfile`, `channelRegistry`, `profileOfFixedIssuer`, `siteRulesFor`, …). Others take a second positional `source` with the module registry as the default (`profileDefinition`, `lmsNameOf`, `lmsNameOfFamily`). The module constant is the third way. A caller must remember which form each function uses. If it forgets, the code still compiles, and it silently uses the product registry.
- **Evidence:** `login.ts:24` finds the profile with `profiles` (the test registry, if one is given), but names it with `lmsNameOf(…)` without `source`, so the name comes from the product registry. `launch.ts:67` and `:112` pass `profiles.registry`. The `profileDefinition` callers (`platforms.ts`, `service-context.ts`, `binding.ts`, `deep-linking.ts`, `token-client.ts`) have no options, so a test registry never reaches them. There is no product bug today, because product code has one registry. The cost is the next test that uses a test channel. In the same file pair, `login.ts:22`, `:26` still return the literal `'Moodle'`, and `launch.ts:67` now looks up the same fallback (`lmsNameOf(null, …)`).
- **Suggested fix:** Use one seam. Option (a): every lookup takes `ProfileOptions` (for example `profileDefinition(id, opts?)`, `lmsNameOf(p, opts?)`), and `opts.registry` stays the only override. Option (b): remove the per-call override, and give tests one function that swaps the module registry for one test. At a minimum, pass `profiles.registry` at `login.ts:24`. Use `lmsNameOf(null, profiles.registry)` for the two `'Moodle'` fallbacks in `login.ts` when LA-E1-10 moves the LTI page texts.

### B-LA-E1-05-04 — NIT — `lmsNameOf` keeps its old doc comment, and `LmsName` is now only `string`

- **File:** `services/lti-service/src/profiles/index.ts:116-118`.
- **Problem:** The comment "Canvas profiles → Canvas, Blackboard profiles → Blackboard, else Moodle" describes the deleted branch. Now the function gives the channel's text name, and `null` gives the name of the standard profile's channel. `export type LmsName = string` no longer constrains anything.
- **Suggested fix:** "The `{LMS}` text name of the profile's channel (`textName`). `null`: the channel of the standard profile." Remove `LmsName`, or keep it with a comment "kept for call sites until LA-E1-10".

### B-LA-E1-05-05 — NIT — The AC-04 test hides two cases behind a boolean and an if/else

- **File:** `services/lti-service/src/profiles/channel-registry.test.ts:94`, `:100`, `:115`.
- **Problem:** The report shows "checks a registration guard before storage (other profile: false)". A reader cannot see from that line which case is the refusal. The body branches twice on `otherProfile`, so each case reads like half a test.
- **Suggested fix:** Use two named tests, "a registration guard refuses a standard platform before storage" and "a registration guard passes another profile and logs family_guard_mismatch", with one shared setup helper.

### B-LA-E1-05-06 — NIT — The app test URLs keep `moodle` without the comment that the LTI test URLs have

- **File:** `services/cogniate-app/src/testkit.ts:20`; compare `services/lti-service/src/testkit.ts:24`.
- **Problem:** The spec request said "remove `moodle:`" from the app testkit. The diff keeps it under `PublicUrls & { moodle: string }`. That is a fair choice, because the tests use the value as a platform fixture. The LTI testkit says so in one comment ("The platform URL is a test fixture only …"). The app testkit does not, so a reader may think that `moodle` is still a service URL.
- **Suggested fix:** Copy the same one-line comment to the app testkit. The Lead records that the RQ took the "keep as a fixture" form.

## Not checked

- K0 (AC-02, AC-11), K1-SIM (AC-01, -07, -08, -09) and MOODLE-LIVE (AC-10). QA-4 runs them.
- Lens-A items: the security effect of the check 14 levels beyond the unit rows, and the zod handling of an explicit `wireLms: undefined`.
