Verdict: APPROVE
Round: 1

# LA-E1-10 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 5770cbe^1 5770cbe` (lane `la-l`, Codex; one conflict in `legacy-wire.ts` resolved to the integration side, with the same content). These files at `HEAD` are the same as at `5770cbe`.
- References: `docs/architecture/ltiaas/tasks/LA-E1-10.md`; LA-ADR-01 D6 and D12; LA-ADR-04 D2 and D8 (LA-IC-01); A1 BD-A1-30 and BD-A1-31.
- I ran on the host (no Docker):
  - `vitest run services/lti-service`: 62 files, 781 tests pass.
  - `fitness:lms-names`: `F1 PASS`, and the four task files have 0 hits.
  - A run-time comparison of the old and the new `lti/codes.ts`. I loaded the file at `5770cbe^1` from a temporary copy and compared it with the new module.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Page texts byte-equal (AC-04, logic) | Yes. The action lines and the registration help texts are now templates with `{LMS}`. They are filled with the text name of the standard profile's channel (today "Moodle"), and `ISSUER_RESERVED` with `reservedIssuerLmsNames`. My run-time comparison of all 25 `PROTOCOL_ERRORS` codes found 0 differences in `protocolAction(code)` and the status between the old and the new module, and the `cookieHelp` texts are also equal. The new unit test pins "Canvas or Blackboard" in both `ISSUER_RESERVED` texts (BD-A1-31). `renderErrorPage` still escapes the heading, the action and the detail, and the name is used only in the optional "… said:" line. So passing `lms` on pages without a detail, such as `PROVIDER_PROFILE_MISMATCH`, changes no output. `withLms` now replaces with a function, so a text name with `$&` or `$'` cannot be read as a replacement pattern. |
| Reserved-issuer names (BD-A1-31) | Correct. `reservedIssuerProfiles` keeps the old rule: fixed endpoints, a non-null issuer that is not a `{…}` template, in registry order. The names are the owning channels once each, mapped by `textName` and joined "X", "X or Y" or "X, Y or Z". The source is not `LAUNCH_GUARD_CHANNELS`. `reservedIssuerOrigins` and `profileOfFixedIssuer` use the same helper, so the reserved set and the error text cannot drift apart. |
| `pendingToolText` (BD-A1-30) | The DR route imports the frozen text from `@cogniate/channel-kernel` (`legacy-wire.ts`). It has no LMS parameter, so the `MOODLE_TOOL_MAY_EXIST` text is unchanged. |
| Wire values (AC-01, LA-IC-01) | `GET /api/providers` adds only `channel` (`p.channel`). Every other field and its order are unchanged, and `lms` still comes from `wireLms` (`standard` → `null`, pinned by the LA-E1-05 test). |
| Routing cannot pick a wrong profile (AC-03) | Correct. `POST /api/platforms` resolves the profile once, with `findProfile(b.profile ?? 'standard', ctx.profiles)`, so simulation gating still applies, and an unknown id is still `UNKNOWN_PROFILE`. It then branches on `endpoints`. The admin plan now stores the selected profile's id instead of a hard-coded `'standard'`. For the baseline, `standard` is the only admin profile, so the stored value is the same. The early field-error branch uses the same lookup, only to keep the §3.9 field error of an admin profile. The deployment, platform-update and `service-context` sites read `endpoints` and `sharing` through `ctx.profiles`, with the same results for the baseline. Tests: `zz-admin` and `standard` take the admin plan and keep their id; `zz-fixed` takes its issuer and endpoints from its profile. |
| No claim, key or auth change | Yes. `lti/launch.ts`, `lti/login.ts`, `store/**`, `http/auth.ts` and the key modules are not changed. The claim allowlist and the privacy floor are untouched. |
| New channel text (AC-05) | The test registry (`testkit.ts`, `testProfileRegistry`) adds a channel `zz` with the text name "your LMS". A login error page then shows "your LMS". Unit test. |
| F1 (AC-07) | The four LTI files (`http/error-page.ts`, `http/routes/registration.ts`, `lti/codes.ts`, `lti/login.ts`) are now at 0 in `f1-baseline.json`, and the tree run passes. Lowering a lane's own counts is RQ-3. |
| "Must not edit" and ownership | Respected. `http/app.ts`, `http/auth.ts`, `main.ts`, `config.ts`, `store/**`, the app and the manifests are unchanged. |

## Notes (no finding)

- `protocolAction` (and so the `ISSUER_RESERVED` action line) uses `{ simulation: true }` when no options are passed. Today the registration route always passes its own help text, filled with `ctx.profiles`, so this default is not used on a live path. When a later caller relies on `protocolAction` for this code, pass the request's `ProfileOptions`, so that a simulation-only channel cannot appear in a production text.
- An admin-endpoint profile other than `standard` now gets the admin plan with today's `standard` rules (endpoints on the issuer origin, reserved issuers). That is the stricter side, and LA-E2-03 adds the `any-https` rules of contract delta §4.6.1.
- `reservedIssuerLmsNames` returns an empty name when no loaded profile has a fixed issuer. No configuration can reach that today, because the baseline Canvas and Blackboard profiles are always loaded.
- The K1-SIM and MOODLE-LIVE ACs (AC-01, AC-02, AC-04, AC-06) wait for the Docker window. The unit tests and my comparison above cover their logic.
