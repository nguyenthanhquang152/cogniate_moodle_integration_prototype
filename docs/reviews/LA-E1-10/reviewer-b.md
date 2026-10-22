Verdict: APPROVE
Round: 1

# LA-E1-10 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 5770cbe^1 5770cbe` (the merge of lane L for LA-E1-10). Spec: `docs/architecture/ltiaas/tasks/LA-E1-10.md`. Design: LA-ADR-01 D6, D12; LA-ADR-04 D2, D8 LA-IC-01; BD-A1-30, BD-A1-31. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 3 NIT.**

The change is easy to follow. The create plan now reads the `endpoints` trait: `planStandard` and `StandardCreate` became `planAdmin` and `AdminCreate`, and the plan keeps the chosen profile id. The provider view adds `channel` in one place. The reserved-issuer names come from one small function, `reservedIssuerLmsNames`, which joins "X", "X or Y", "X, Y or Z", as BD-A1-31 says. A new test helper, `testProfileRegistry(textName)`, builds a test channel with one `admin` and one `fixed` profile, so later tests can reuse it. The tests check the four LTI files at F1 0, the byte-for-byte baseline text of `ISSUER_RESERVED` (also through the real registration route), a new channel's name in an error page, and a `$&` in a name (a literal fill). My one MINOR is about the registration help texts: they now use `{LMS}`, but they still hold Moodle menu paths.

## How I checked

- Scratch clone of `5770cbe` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service/src`: **62 files, 781 tests passed**. F1 on the clone: `F1 PASS: 70 files with hits, 572 hits`, and the four lowered files are at 0.
- I read every changed text against D12 and against the scope note "DR texts that depend on the connection's channel" (LA-E2-02).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | Only "May edit" files: `routes/platforms.ts`, `service-context.ts`, `error-page.ts`, `routes/registration.ts`, `routes/protocol.ts`, `lti/codes.ts`, `profiles/index.ts`, `testkit.ts`. No change to `http/app.ts`, `http/auth.ts`, `main.ts`, `config.ts`, `store/**`, app code or manifests. `f1-baseline.json` only lowers the four files to 0, in the commit that removes the hits (RQ-3). `pendingToolText` now comes from `@cogniate/channel-kernel` (the BD-A1-30 RQ-2 commit, already merged). OK. |
| Ownership | Lane L in B2 for these files. OK. |
| No behaviour change outside the spec | LA-IC-01: `channel` is added to `GET /api/providers`. A new `admin` profile keeps its own id on create (AC-03); `standard` is unchanged. The registration and error texts are byte for byte for Moodle (the `ISSUER_RESERVED` test pins one of them; G4 is QA's K1). OK. |
| No LMS name in core | F1 passes, and the four files are at 0. The LMS words left in this diff are in comments (see B-LA-E1-10-04) and in tests. |
| UNIT ACs | AC-03: `platforms.test.ts` "admin and fixed endpoint plans" (`zz-admin` and `standard` both take the admin plan and keep their profile id; a new `fixed` profile takes the provider plan). Before this task, `planStandard` stored `profile: 'standard'`, so the `zz-admin` row fails on the old tree. AC-05: `error-page.test.ts`. The login page part was already possible after LA-E1-05, but the second test fills `INVALID_OPENID_CONFIGURATION`, which held a literal `Moodle` before this task, so the old tree fails it. OK. |
| A newcomer adds a channel's page texts | Launch and error pages: yes. The `{LMS}` fill comes from the manifest `names.text`, through `lmsNameOf` and `platformLmsName`. Registration (DR) help texts: no; see B-LA-E1-10-01. |

## Findings

### B-LA-E1-10-01 — MINOR — The registration help texts use `{LMS}`, but they still hold Moodle menu paths (route to A1 before LA-E2-02)

- **File:** `services/lti-service/src/http/routes/registration.ts:37-41` (`REGISTRATION_HELP`), `:197` (`REGISTRATION_UPDATE_NOT_ALLOWED`); `services/lti-service/src/lti/codes.ts:43` (`ISSUER_MISMATCH`).
- **Problem:** The word "Moodle" became `{LMS}`, so F1 is 0. But the sentences still give Moodle's own menus and buttons: "Site administration > Plugins > Activity modules > External tool > Manage tools", "Manage tools > Add LTI Advantage", "Register as a new external tool". Today `{LMS}` is always the standard channel (Moodle), so the pages do not change. LA-E2-02's scope is "DR page texts with `{LMS}` of the connection's channel". When it fills these templates with another channel's name, the page will say, for example, "Start the registration again from your LMS (Site administration > Plugins > Activity modules > External tool > Manage tools)". A channel author cannot fix that from the manifest. F1 = 0 also hides the problem, because menu paths are not LMS names. BD-A1-30 kept `pendingToolText` frozen for this same reason ("it uses Moodle UI words, so an `{LMS}` fill would be wrong").
- **Evidence:** `grep -n "Site administration\|Manage tools\|Add LTI Advantage\|Register as a new external tool"` on the two files at `5770cbe` gives `registration.ts:37`, `:38`, `:40`, `:41`, `:197` and `codes.ts:43`.
- **Suggested fix:** No change to the Moodle bytes in this task. The Lead asks A1, before LA-E2-02, to choose one rule. Option (a): these texts are frozen Moodle DR texts, used only when the channel is the standard channel, with a generic text without menu paths for other channels. Option (b): the "where to restart" path becomes a manifest text (for example a D12 `texts.registrationRestart`), so each channel gives its own path. In this task, add one comment above `REGISTRATION_HELP` that says which sentences use Moodle UI words.

### B-LA-E1-10-02 — NIT — New default arguments read the product registry again

- **File:** `services/lti-service/src/http/error-page.ts:23` (`lms = lmsNameOf(null)`); `services/lti-service/src/lti/codes.ts:56` (`profiles: ProfileOptions = { simulation: true }`), `:70` (`lms = lmsNameOf(null)`).
- **Problem:** LA-E1-05 round 2 made `ProfileOptions` the one seam for a test registry. These defaults reach the module registry when a caller passes nothing. A test that uses `testProfileRegistry` but forgets the name gets "Moodle" without any signal. The AC-05 test works only because it passes `result.lms` everywhere.
- **Suggested fix:** Make the name (or `ProfileOptions`) a required argument in `renderErrorPage`, `cookieHelp` and `protocolAction`. All product callers already pass one. Or say in each doc comment: "default: the product standard channel; tests must pass a name".

### B-LA-E1-10-03 — NIT — `ISSUER_RESERVED` is a special case in two places, and `protocolAction` ignores its `lms` argument for that code

- **File:** `services/lti-service/src/lti/codes.ts:56-58`; `services/lti-service/src/http/routes/registration.ts:123`.
- **Problem:** `protocolAction('ISSUER_RESERVED', 'X')` silently uses the reserved-issuer owners, not `'X'`. The registration route repeats the same `code === 'ISSUER_RESERVED'` branch for its own help text. A maintainer who adds a second code with a derived name must find both places.
- **Suggested fix:** One helper, for example `lmsFor(code, lms, profiles)`, that both callers use. Add one line to the `protocolAction` doc: "for `ISSUER_RESERVED` the name is the reserved-issuer owners (BD-A1-31); `lms` is ignored".

### B-LA-E1-10-04 — NIT — Two comments to update

- **File:** `services/lti-service/src/lti/codes.ts:3` ("`{LMS}` is `Moodle`, `Canvas` or `Blackboard`"); `:53` (`withLms` replacer).
- **Problem:** The header comment still lists the three baseline names. After this task, `{LMS}` is any channel's `names.text`. `withLms` now passes a function to `replaceAll`, so that `$&` in a name stays literal. The test shows why, but the code does not say it, and a later "simplify" edit can bring the bug back.
- **Suggested fix:** Change `:3` to "`{LMS}` is the manifest text name of the channel (D12)". Add to `:53`: "A function replacer keeps `$` patterns in a name literal."

## Not checked

- K1-SIM ACs (AC-01, -02, -04 golden G4) and MOODLE-LIVE (AC-06); K0 AC-07 (QA).
- Lens-A items: the admin-plan guards for a new `admin` profile beyond the unit rows, and the reserved-issuer order with simulations off.
