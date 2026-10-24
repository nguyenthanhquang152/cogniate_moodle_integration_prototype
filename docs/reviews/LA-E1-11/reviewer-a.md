Verdict: APPROVE
Round: 4

# LA-E1-11 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 0d9aeda^1 0d9aeda` (lane P, Codex; lane commits `b47f54c` RQ-2, `5553806`, `9d96faa`, `df93e73`). The `apps/portal/**`, `packages/channels/*/portal/**`, `vitest.config.ts` and `packages/channels/tsconfig.portal.json` files at `HEAD` are the same as at `0d9aeda`. Later commits changed only kernel and fitness files.
- References: `docs/architecture/ltiaas/tasks/LA-E1-11.md`; LA-ADR-01 D1 (build model, import table), D5 (P11 sketch), D9; A1 BD-A1-24, -25, -26 and -32; app API delta §2.
- I ran on the host (no Docker):
  - Vitest project `portal`: 7 files, 83 tests pass.
  - `tsc --noEmit` for `apps/portal/tsconfig.json` and `packages/channels/tsconfig.portal.json`: both exit 0.
  - `vite build` of `apps/portal` into a temporary `--outDir`: passes.
  - `lms-names.mjs`: `F1 PASS`. `fitness.test.mjs`: 37/37 pass.
  - A comparison of the old step JSON with the new manifest text slices (Canvas and Blackboard, 4 steps each): every step is equal, and no `{…}` placeholder other than `{LMS}` is left.
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 0 MAJOR, 2 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Channel modules import only the SDK | Yes. Every import in `packages/channels/*/portal/**` is `@cogniate/portal-sdk` (95), `react`, the channel's own `../manifest.ts`, or a file in the same folder (tests also import `vitest` and Testing Library). The SDK reaches `react-router` and `lucide-react` for the modules. |
| No XSS path from manifest data or connection values | None found. Manifest texts (`channelText`, `fillText`) and connection values go into React text nodes or attributes. React escapes them. The diff adds no `dangerouslySetInnerHTML` or `innerHTML`. The `href` values are the ones from before the move: `connection.siteUrl` (with `/mod/lti/toolconfigure.php` for Moodle), `publication.moodleCourse.url`, `build.downloadUrl`, and the SCORM download path built with `idPath`. The logo colour comes from a fixed class map (an unknown value gives `blue`), so manifest data cannot add a class. |
| Sim-only channels need the provider list (BD-A1-26) | Correct. Cards: `visibleChannels` shows a `simulation-only` channel only when `GET /app-api/lms-providers` lists its id, and the list is empty until the request answers. Routes: `Connect` serves both route forms. For a `simulation-only` channel it waits for the list, shows the error if the request fails, and shows "not found" when the channel is absent. The list itself names a `simulation-only` channel only when a simulation profile is loaded (`services/cogniate-app/src/app/connections.ts:125`). Test: "hides an unlisted simulation channel's card and rejects its direct route". |
| Routes (AC-02) | `/integrations/:channelId/connect` and `/integrations/:channelId/:connectionId`. An unknown id gives `NotFound` (`Connect.tsx:35`, `ProviderSetup.tsx:23`). A connection of another channel gives `NotFound` (`ConnectionSetup.tsx:36` compares `channelOf(connection)`, not the legacy `lms`). Tests cover both, also when the legacy `lms` field matches. |
| Verify step (AC-03, BD-A1-24) | `verificationAuthority` uses the stored `bindingAuthority` first, then the chosen method's authority. `self` shows the first-launch text, `verifiedAdminLaunch` shows the admin-launch text, and anything else shows the approval code. Tests: each baseline manifest, a staged DR (`dynamic` + `operatorGrant`), and `verifiedAdminLaunch`. |
| Slots (BD-A1-25, -32) | `ConnectionError` is always rendered when given, with `Default`. The Moodle slot keeps today's title default and the `MOODLE_TOOL_MAY_EXIST` text from `pendingToolText` (kernel `legacy-wire.ts`, same text). `ConnectionDetails`, `connectionPanels`, `coursePanels` (`version`, `onChanged`) and `publicationPanels` replace the Moodle and Canvas branches of the old shell in the same order. |
| Texts equal to before (except below) | Registered status ("Registered — activate in Moodle"), "Waiting for {LMS}", the three disconnect texts, the Blackboard and Canvas step lists (probe above), the Moodle teacher line, the disconnected notices, and the "To reconnect…" notice. The Integrations cards keep their order (`card.order` 1, 2, 3 after Kajabi), titles, descriptions and colours. |
| "Must not edit" and ownership | Respected. `manifest.ts`, `app.ts`, `lti-profiles.ts`, app code and `package-lock.json` are unchanged. The two K-file lines are RQ-2 (`b47f54c`). F1 portal counts only go down: `PublishDialog.tsx` 8 → 1, `types.ts` 11 → 5, and 32 other entries are removed. `api.ts`, `provider-errors.tsx` and `Results.tsx` keep their counts, so the portal total is 18. |

## Findings

- **A-LA-E1-11-01 (BLOCKER): the Moodle logo changes from the graduation-cap icon to the letter "m", on the Integrations card and on the Connect page.**
  - Where: `apps/portal/src/IntegrationLogo.tsx:34` (now `{mark}`). Before: `{name === "Moodle" ? <GraduationCap size={28} /> : mark}` (`0d9aeda^1`, same file, line 34). Callers: `Integrations.tsx:150`, `connect/Connect.tsx:51`.
  - Problem:
    - The old static card data had `mark: "m"`, but the old component never showed it for Moodle: it drew the icon. The Moodle manifest copied the data value (`card.mark: 'm'`), and the new component shows the letter for every channel.
    - Required outcome, AC-LA-E1-11-04: "the three baseline cards keep their title, text, mark and colour". The task goal says "Nothing visible changes".
    - No unit test, T6 or M2 test looks at the logo content, so no test fails today. A K2 U1 check that compares `card.mark` with the text would also pass, but the card that users see is different.
  - Suggested fix (P cannot edit `manifest.ts`, so it needs a ruling first):
    - A1 adds an optional data field, for example `card.icon` with a small fixed set (`'graduation-cap'`), that the shell maps to a lucide icon. K sets it in the Moodle manifest by RQ-1. This keeps BD-A1-25 ("Logo: from `manifest.card`", no code hook).
    - Or A1 and the Lead accept the letter as a recorded visible change and tell QA-E2E for K2 U1 and M2.
- **A-LA-E1-11-02 (MINOR): more visible changes outside the spec, which are not recorded.**
  - Where:
    - `connect/Connect.tsx:51`: the Blackboard logo on its Connect page changes from red to blue. Before: `color={lms === "moodle" ? "orange" : "red"}`.
    - `connect/ConnectionStatus.tsx:22`: the "Open {LMS}" button moves for all three channels. Before, it was in the "Registered / Your library is connected" card, next to "Go to Courses". Now it is in the top overview card. BD-A1-25 puts the link in the `ConnectionDetails` slot, so the move can be intended.
    - `courses/PublishDialog.tsx:71-73`: after a Canvas or Blackboard publication, the modal now says "Published to Canvas" and "the Canvas content picker". Before, it said "Moodle" for every LMS.
    - `IntegrationLogo.tsx:27`: the logo now has a `title`, so a tooltip shows on hover.
  - Problem: each change is small, and most of them fix old wrong values. But the goal says "Nothing visible changes", and AC-05 compares the wizard screens with M2. No LA-IC or note tells QA-E2E about them.
  - Suggested fix: keep them, and list them in the task's hand-over to QA-E2E (K2 U1/U2, M2). Or ask A1 for one line in the LA-IC list. If the Lead wants zero visible change, revert the Blackboard colour and the publish-modal text, and keep the link in its old card.
- **A-LA-E1-11-03 (MINOR): Moodle pages now depend on a live call to the LTI service, so they stop working when that call fails.**
  - Where: `Integrations.tsx:139` (`ready` only from the list); `connect/ProviderSetup.tsx:21-28` (now also used for Moodle, new and existing connections). `GET /app-api/lms-providers` calls the LTI service each time (`services/cogniate-app/src/app/connections.ts:123`).
  - Problem:
    - Before, Moodle was ready at once, and its connect and manage pages did not read the list. Now, while the list loads, the Moodle card shows a disabled "Connect" button. When the call fails (LTI service down or slow), the button stays disabled with no reason given. The Moodle connect page then shows an error, and the manage page of a pending Moodle connection shows an error instead of its setup steps.
    - D9 says the Moodle result "does not change". That is true only when the call succeeds. A unit test changed to fit: "shows eleven cards …" now has to list Moodle as ready (`portal.test.ts:371`).
  - Suggested fix: on the Integrations page, show the list error with "Try again" instead of silent disabled buttons. For an existing connection, let the Lead decide if the module wizard may render without the list (Moodle needs no profile data from it).
- **A-LA-E1-11-04 (NIT): `extension()` lets an encoded `..` leave the extension namespace.**
  - Where: `apps/portal/src/api.ts:70`.
  - Problem: the guard refuses `..`, `//` and `\`, but `fetch` normalises `%2e%2e` as `..`. Probe: `/app-api/connections/con_1/x/%2e%2e/%2e%2e/courses` resolves to `/app-api/connections/courses`. Module code is trusted, and the session can call that route anyway, so nothing is gained. The guard only does part of its job.
  - Suggested fix: also refuse `%`, or build `new URL(...)` and check that the path still starts with `/app-api/connections/{id}/x/`.
- **A-LA-E1-11-05 (NIT): the SDK alias breaks in a checkout whose path has a space or a non-ASCII character.**
  - Where: `apps/portal/vite.config.ts:6-7`; `vitest.config.ts:21` (the RQ-2 line).
  - Problem: `new URL(…, import.meta.url).pathname` stays percent-encoded. Example: `/Users/a%20b/repo/apps/portal/src/sdk/index.ts`. So `@cogniate/portal-sdk` and `server.fs.allow` point to a path that does not exist. The infra tests use folder names with spaces on purpose (`sim hosts …`).
  - Suggested fix: `fileURLToPath(new URL(…, import.meta.url))` in the three places.

## Notes (no finding)

- `server.fs.allow` is the repository root, not only `packages/channels` (D1 row "Styles and dev server"). With npm workspaces, the repository root is already Vite's default allow root, and Vite's default deny list (`.env*`, `*.pem`, `*.crt`) still applies. So the dev server serves nothing new.
- A staged Dynamic Registration on Moodle (`dynamic` + `operatorGrant`, BD-A1-24) shows the approval code only in the shell wizard. The Moodle module replaces the whole wizard and does not read `bindingAuthority`. The app does not stage a Moodle DR today. The task that adds staging must also change the Moodle module.
- `ConnectionError` gives its SDK a `navigate` that does a full page load (`window.location.assign`). Every other SDK instance uses the router. No module calls it today.
- `apps/portal/src/portal.test.ts` reaches into Moodle module files with `import.meta.glob` (`CreateConnection.tsx`, `ManualSetup.tsx`, `validation.ts`, …). These tests belong in `packages/channels/moodle/portal/`. The `portal` Vitest project already runs that folder.
- AC-04 to AC-07 are K2, K1-SIM or K0 and wait for QA. The unit tests and my checks above cover their logic.

## Round 2

- Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22), lens A. Date: 2026-10-23.
- Diff: `git diff 54da76f^1 54da76f` (lane P fix commits `9ca80b3`, `b14863f`, `6894c86`, `9ebf691`; RQ-2 commits `d2beb17` and `0e6678d` in K files). Rulings: A1 BD-A1-44, BD-A1-49, BD-A1-50, BD-A1-51; LA-ADR-04 D8 LA-IC-18.
- I ran on the host (no Docker), in a throwaway `git archive 54da76f` copy:
  - Vitest project `portal`: 8 files, 111 tests pass. Kernel `registry.test.ts`: 32 pass.
  - `tsc --noEmit` for `apps/portal/tsconfig.json` and `packages/channels/tsconfig.portal.json`: both exit 0.
  - `lms-names.mjs`: `F1 PASS`. `fitness.test.mjs`: 37/37 pass. F1 portal counts only go down: `api.ts` 4 → 0, `types.ts` 5 → 2.
  - 10 mutants. 8 are killed. P4 is effectively equivalent (see the table). P6 survives (see A-LA-E1-11-06).
- Blind review: I did not open the other reviewer's file.
- **Round 2 counts: 4 closed (-01, -02, -03, -05). -04 stays open as a NIT, with a smaller gap. 1 new MINOR (-06). No BLOCKER or MAJOR is open.**

| Id | Round 2 status | Evidence |
| --- | --- | --- |
| A-LA-E1-11-01 (BLOCKER) | Closed (BD-A1-49) | `card.icon` is optional and accepts only `z.enum(['graduation-cap'])`. The kernel test refuses `unknown`, a URL, an SVG string and a function, and still requires `mark`. The Moodle manifest sets `icon: 'graduation-cap'`. `IntegrationLogo` draws `<GraduationCap size={28} />` for that name, as before LA, else `mark`. The Integrations card and the Connect page both pass `icon`. The shell test finds `svg.lucide-graduation-cap` on both. Mutants P1 (always `mark`) and P2 (free string) are each killed. Manifest data still cannot name a component, a URL or markup. |
| A-LA-E1-11-02 (MINOR) | Closed (BD-A1-50) | LA-IC-18 records the three kept changes: the publish modal LMS name, the Connect-page logo colour and the logo tooltip. "Open {LMS}" is back next to "Go to Courses" in the ready card for all three channels. Moodle keeps `${siteUrl}/mod/lti/toolconfigure.php`, and Canvas and Blackboard keep `siteUrl`, the same as `0d9aeda^1`. The overview card no longer has the link. The test checks one link per page, next to "Go to Courses". Mutants P5 (no Moodle link) and P10 (Moodle link without `toolconfigure.php`) are each killed. |
| A-LA-E1-11-03 (MINOR) | Closed in code (BD-A1-51). The test gap is -06. | `channelProvider` uses the server entry when the answer lists the channel. Before the answer, after a failure, or when the channel is not listed, a `ga` or `preview` channel gets a fallback: each method's `defaultProfile`, `ready: true`, `clientId: null`. A `simulation-only` channel gets no fallback. A later explicit `ready: false` shows `texts.notReady`. `ProviderSetup` renders the wizard and shows the error with "Try again" above it. The server still decides: the create step refuses a profile that the LTI service does not report (BD-A1-51). While the list is missing, the Blackboard Client ID shows empty. The error notice is above it, and the value appears after "Try again". Mutants P3 (no fallback) and P9 (no `ready` check) are each killed. P4 (fallback also for `simulation-only`) survives, but `Connect.tsx` already shows `NotFound` or the error for an unlisted simulation channel on both routes before `ProviderSetup` runs. So P4 does not change any page. |
| A-LA-E1-11-04 (NIT) | Open, smaller gap | `extension()` now checks the path after one `decodeURIComponent`, and a broken escape throws. The new test refuses `%2e%2e`, `%2E.`, `%2f`, `%5c` and `%zz` before `fetch`, and mutant P7 is killed. But the WHATWG URL parser removes a raw tab, CR or LF before it resolves dot segments. Probe: `"/.\t./courses"` and `"/.\n./courses"` pass the guard and resolve to `/app-api/connections/con_1/courses`, and `"/.\r./.\r./courses"` resolves to `/app-api/connections/courses`. The risk is the same as in round 1: module code is trusted, and the session can call those routes anyway. Suggested fix: also refuse ASCII control characters and spaces, or resolve `new URL(…, location.origin)` and check that the path still starts with `/app-api/connections/{id}/x/`. |
| A-LA-E1-11-05 (NIT) | Closed | `fileURLToPath(new URL(…))` is in the three places: the SDK alias and `server.fs.allow` in `apps/portal/vite.config.ts`, and the SDK alias in `vitest.config.ts`. |

### A-LA-E1-11-06 — MINOR — the readiness-fallback tests do not fail on the round-1 behaviour

- **File:** `apps/portal/src/channels/shell.test.tsx` ("keeps %s available when profile discovery fails, then honors explicit not-ready data", lines 158–160; "keeps an existing self connection usable when profile discovery fails", lines 178–180).
- **Problem:** BD-A1-51 asks for "one shell test (call fails: Moodle still works …)". Each test finds the wizard text first, and then it finds "Try again". The fallback renders the wizard while the list is still loading, so `findByLabelText("Connection name")` succeeds before the failed answer arrives. So the tests do not prove that the wizard is still there after the failure. Mutant P6 puts back the round-1 rule `if (error) return <ErrorNotice …/>`, so after the failure the page shows only the error. All 111 tests still pass with P6.
- **Evidence:** in the throwaway copy, I added one line to each test after the "Try again" wait: `expect(screen.getByLabelText("Connection name")).toBeTruthy()` in the first test, and the "The first launch from Moodle changes the status to Connected." text in the second. The real code passes (111/111). With P6, the 5 cases fail (moodle, canvas, blackboard, the canary, and the existing self connection).
- **Suggested fix:** add these two lines (assert the wizard after the failure is shown). No product change is needed.

### Other round-2 changes (lens A)

| Change | Result |
| --- | --- |
| Stored authority in the real wizards (BD-A1-44) | `verificationAuthority` uses the stored `bindingAuthority`, else the chosen method's manifest authority, else `operatorGrant`, the strictest default. The Moodle module now shows `ManifestBinding` (the approval code form) for a pending connection whose authority is not `self`. Both Moodle methods are `self` in the manifest, so M1 Moodle pages do not change. This closes my round-1 note about a staged Moodle DR. Blackboard and Canvas show their binding form only for `operatorGrant`, else the instructions. Mutant P8 is killed. |
| SDK named exports | The `export *` lines are replaced by named lists. The API part is `ApiError`, `api`, `idPath`, `extension`, `configurationSnapshot` and `uploadPackage`. `configurationSnapshot(path, …)` takes an `/app-api` path, and Canvas passes the same encoded path as before (`/connections/${idPath(id)}/canvas-configuration`). The SDK already exports `api`, which reaches any `/app-api` path with the session, so this adds no new reach. |
| Step texts | The Blackboard and Canvas step instructions and the Moodle dynamic steps now come only from the manifest through `channelText`. The JSON files keep only layout metadata. The texts still go into React text nodes. |
| Ownership | The kernel schema line, its test and the Moodle manifest line are K files, in the RQ-2 commits `d2beb17` and `0e6678d` (BD-A1-49 allows RQ-2). `f1-baseline.json` only lowers the counts of P's own files (`api.ts`, `types.ts`), as RQ-3 allows (`b14863f`). Note for the Lead (no finding): the `fileURLToPath` line in `vitest.config.ts` (a K file, epics §5) is in the P commit `6894c86`, not in a named RQ-2 commit as `b47f54c` was in round 1. Please record it in the board row (RQ-2) or confirm it. No app or LTI service file changes. |

## Round 3

- Reviewer: Codex, Reviewer-A, same lens A. Date: 2026-10-23.
- Diffs: `git show 02fb3bf` and `git show 463f350` (merge `5b5b3a2`). References: task LA-E1-11, the two round-2 findings above, the fix-round-2 brief and plan §6.1.
- **Verdict: APPROVE. A-LA-E1-11-04 and A-LA-E1-11-06 are closed. New findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E1-11-06 — MINOR | Closed | Both tests assert the wizard content after waiting for the failed request's "Try again" button. In a private clone, restoring `if (error)` in `ProviderSetup` fails exactly the four new-connection cases and the existing self-connection case. The fixed code passes all five. |
| A-LA-E1-11-04 — NIT | Closed | `extension()` checks the browser-normalized URL path against the connection extension prefix, including its trailing slash. The old decode guard stays. All three tab/LF/CR traversal probes throw before fetch; removing the new prefix check fails exactly those three cases. The valid escaped filename test still passes and preserves the encoded connection id and same-origin credentials. The checked URL and fetch input use the same path. |

Validation at `9c87853`: the full portal project passes **8 files, 114 tests**, including the shell UNIT AC-01–03 tests. Both portal TypeScript projects pass, and F1 passes. Both mutants fail at the expected assertions; all scratch files were restored. The diff changes only P-owned portal files and adds no LMS-specific production branch or visible wizard change. The earlier `vitest.config.ts` ownership note is acknowledged as RQ-2 in the Lead's fix brief.

This was a blind review in a private `git clone --no-hardlinks`. No Docker, stack, build-server start, commit, or other reviewer's file. K2 and M1/M2/T7 remain QA gates; this small fix does not claim to rerun them.


## Round 4 — BD-A1-119 card identity

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Diff: `a8bbac53^1..a8bbac53` (P `0eedb055`), against LA-ADR-01 D9, BD-A1-119 and the LA-E1-11 card-identity note. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT. Prior findings remain closed.**

- `Integrations.tsx:144` adds the attribute to the common `Card as="article"`, outside all loading, readiness and connection branches. Its value comes from `manifest.id`; static cards use `null`, converted to `undefined`, so React omits their attribute. `Card` spreads the prop onto the article. This also covers disabled Connect and connected/Manage cards. Text, markup structure, styles and behavior are unchanged; no production selector uses this new attribute.
- **27/27 portal-file tests pass.** The new case checks the ordered visible manifest ids while requests are pending, after not-ready data, after ready data, and with a connection/Manage link; it also checks all eight static cards and the total card count. Seven private mutants each fail this new test at an assertion: remove the attribute entirely (old behavior), omit it only while loading, only when not ready/Connect disabled, only for ready Connect, or only for Manage; add it to static cards; substitute the title for the manifest id.
- Only the two P-owned portal files changed; no forbidden file or LMS-specific production branch was added. Verification used fresh `/tmp/la-reviewer-a-ctx-7e7f8f4848c6` (`--no-hardlinks`, HEAD `b0bac2e5`, own `npm ci`, Vitest cache cleared before each run); the two reviewed files match the merge, and the clone is restored clean. Logs and mutant results: `/tmp/la-reviewer-a-ctx-7e7f8f4848c6-evidence/`. No Docker, stack, commit or other reviewer's file was used. The M2/K2 re-gate remains QA's work.
