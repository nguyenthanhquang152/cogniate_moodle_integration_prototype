Verdict: CHANGES_REQUESTED
Round: 1

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
