Verdict: APPROVE
Round: 2

# T6 review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 7bf48b6^1 7bf48b6` (merge of the T6 branch by Author-2 / Codex; 34 files: `apps/portal/**`, `services/cogniate-app/src/app/{portal,courses,server}.ts`, `infra/compose.yaml`, root scripts). Spec: `tasks/T6.md`, ADR-008 (layout, dev loop), ADR-009, app contract §2–§5, flows §6a-1. Look: `docs/research/ui/dev-portal-integrations.png` compared with `apps/portal/evidence/integrations.png` and `integration-results.png`.

| Check | Result |
| --- | --- |
| `npm run check` | Pass: 44 test files, 601 tests |
| `npm run build` | Pass. Portal: JS 322.4 kB (gzip 100.1 kB), CSS 22.2 kB (gzip 6.3 kB), DM Sans 400/500/600/700 as woff2 and woff. Player: 15.7 kB plus 1.6 kB. |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 1 | B-T6-01 |
| MINOR | 2 | B-T6-02, B-T6-03 |
| NIT | 1 | B-T6-04 |

## Lead's focus questions

- **Component structure and readability for the Cogniate front-end team:** Mixed.
  - The files follow the pages (`Integrations.tsx`, `connect/Connect.tsx`, `courses/Courses.tsx`, `courses/PublishDialog.tsx`, `results/Results.tsx`), with small shared pieces in `ui.tsx` (`ErrorNotice`, `ConnectionError`, `CopyButton`, `Modal`, `Empty`, `Loading`), a typed `api.ts`, `hooks.ts` (`useApi` with optional polling) and `types.ts`. React Router 7 holds the T6 routes.
  - Two components are long (about 230 and 270 lines), and the styling is not the dev-portal stack (B-T6-02).
- **UI text in STE, one action per step, `moodle-steps.json`:** The steps are data, as specified (`format: "cogniate-moodle-steps/1"`, `moodleRelease: "5.2.4"`, `menuPath`, `labels`, `optional`), and the wizard renders them. But the dynamic list misses the step that makes the tool usable (B-T6-01), and four step texts hold two actions (B-T6-04).
- **Accessibility:** Good.
  - `Modal` uses a native `<dialog>` with `showModal()`, a Tab trap, Escape through `onCancel`, focus returned to the opener, and `aria-labelledby`.
  - Errors use `role="alert"`, status lines `role="status"`, and the upload progress bar `role="progressbar"` with `aria-valuenow`.
  - Route focus moves to the page `h1` (`tabIndex={-1}`), and a test covers focus return after a delayed load.
- **State and error handling:**
  - `ErrorNotice` shows the code, the trace id, `details.action`, and the per-reason `title` and `action` of a rejected package.
  - `ConnectionError` shows the connection's `lastError`.
  - The results view has loading, empty ("Results appear after a learner opens this course from Moodle"), conflict, override ("Moodle keeps another grade …") and preview states.
  - Some branches are left over from building without T5 and copy server rules or texts (B-T6-03).
- **Tests:** `portal.test.ts` covers the wizard (both methods, http and foreign-origin rejection without a request, the six contract keys, exact copy values), cards and filters, escaping, the reject report, publish rules, result states and focus. `server.test.ts` covers the signed-out redirects and the exact-bytes download. One test file is in the wrong workspace (B-T6-04).
- **`dev:web` loop:** It matches ADR-008. `apps/portal/scripts/dev-web.mjs` runs `vite build --watch` for the portal and the player (no dev server behind the proxy) and stops both children cleanly. `stack-up.sh` builds a missing portal once. When the build is missing, `portal.ts` answers `503 "The portal is not built. Run npm run build, then reload."`, which is a good message.
- **Bundle size:** Fine for a prototype (100 kB gzip JS). `@fontsource` ships woff next to woff2. Modern browsers load only woff2, so this costs nothing at run time.
- **Look:** Close to the dev portal: sidebar, library selector, title and subtitle, five pills, 3×3 cards with logo tiles and "Connect" pills, dark card tokens, DM Sans. It adds copy that the reference does not have (B-T6-04).

---

## Findings

### B-T6-01 — MAJOR — The dynamic Moodle steps end at "Activate" and never tell the admin to set "New window" and "Show in activity chooser"

- **Location:** `apps/portal/src/connect/moodle-steps.json` (`dynamic`); `apps/portal/src/connect/Connect.tsx` (`MoodleSteps`); ADR-009 lines 13 and 77; flows §6a-1 ("Activate. Edit: usage = activity chooser, launch container = New window"); `tasks/T7.md` scenario A step 2, AC-T7-02, AC-T7-14.
- **Problem:** Dynamic registration makes the Moodle tool "embed without blocks" and "preconfigured list only" (ADR-009). The admin must then edit "Tool configuration usage" and "Default launch container". The wizard's steps stop at "Select Activate for the new Cogniate tool", so an admin who follows them ends with a tool that:
  - is not its own entry in the activity chooser, so the teacher's path "Add an activity → Cogniate (<library>)" (T7 A4) does not exist;
  - opens embedded, so every learner gets the extra "Open in a new window" page.
- **Evidence:**
  - The dynamic step ids are `open-manage-tools`, `paste-registration-url`, `register-new-tool` (optional), `confirm-connection`, `activate-tool`.
  - A search for "New window", "launch container" and "activity chooser" in `moodle-steps.json` and `Connect.tsx` finds nothing.
  - T7 scenario A step 2 says "QA follows the steps that the wizard shows (`moodle-steps.json`): … 'Activate', edit 'Tool configuration usage' and 'Default launch container'". AC-T7-02 expects "New window" and "Show in activity chooser", and AC-T7-14 checks the labels that A2 uses. So T7 will fail on this.
  - The current `tasks/T6.md` no longer names the edit step (the T0 round-1 text did). The Author followed the spec text. The Architect should restore it.
- **Suggested fix:** Add the edit steps after `activate-tool`, one action each (STE), with the exact Moodle 5.2.4 labels:
  - `edit-tool`: "Select Edit for the Cogniate tool." (labels: the edit icon or "Edit")
  - `set-tool-usage`: "Set Tool configuration usage to Show in activity chooser and as a preconfigured tool." (labels: "Tool configuration usage", "Show in activity chooser and as a preconfigured tool")
  - `set-launch-container`: "Set Default launch container to New window." (labels: "Default launch container", "New window")
  - `save-tool`: "Select Save changes." (labels: "Save changes")

  Then ask the Architect to name these steps in `tasks/T6.md` and AC-T6-12, so that QA checks them.

### B-T6-02 — MINOR — The styling is a second system next to Tailwind, and two components are long

- **Location:** `apps/portal/src/styles.css` (1,129 lines, 152 class rules such as `.page-heading`, `.integration-card`, `.button.compact.secondary`, `.notice.error`); the components' `className` values (mostly these global classes, with few Tailwind utilities); `connect/Connect.tsx` `ConnectionSetup` (lines 235–465); `courses/Courses.tsx` `CourseDetail` (lines 167–434); ADR-008 Stack ("Tailwind 4, shadcn-style components … same stack as the dev portal").
- **Problem:** Tailwind 4 is installed (`@import "tailwindcss"`, `@theme inline`), but the UI is styled mainly with hand-written global classes. There are no shadcn-style primitives (Button, Card, Badge, Dialog). The Cogniate front-end team, which works with Tailwind and shadcn in the dev portal, would have to learn and maintain a second style system. In addition, two components of about 230 and 270 lines each mix data loading, polling, several sub-views and actions.
- **Evidence:** The `className` sample: `page-heading`, `eyebrow`, `filter-pills`, `integration-card`, `card-top`, `button compact secondary`, `notice error`, `copy-control`, `modal panel`. Utilities appear only next to them (for example `integration-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3`).
- **Suggested fix:**
  1. Move the repeated pieces into small shadcn-style components (`components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `notice.tsx`, `dialog.tsx`) styled with Tailwind utilities and the `@theme` tokens. Keep `styles.css` for the tokens and the base layer.
  2. Or, if the team chooses global CSS, write that decision into ADR-008.
  3. Split `ConnectionSetup` (status panel, dynamic steps, new URL, manual values) and `CourseDetail` (header, versions and report, publications, actions).

### B-T6-03 — MINOR — Leftovers from building without T5 now give wrong messages and copy server rules and texts

- **Location:** `apps/portal/src/results/Results.tsx` (`actionError`, the `unavailable` state, the `refreshed` cache merge and `gradeDiffers`); `apps/portal/src/ui.tsx` `connectionErrors`; `services/cogniate-app/src/domain/results.ts` line 111 (server `gradebookDiffers`); `packages/shared/src/html.ts` `pendingToolText`.
- **Problem:**
  - `actionError` turns **any** `404` or `501` of Resend or Refresh into "… is not available yet. Your saved results have not changed. Try again when this feature is available.", and a `404` or `501` on results shows "Results are not available yet. The results service is not ready.". With T5 merged, a real `404 NOT_FOUND` (for example a sync row or publication outside the library) shows a wrong, misleading message.
  - When a row has `gradebook: null`, the view merges a client-side cache of the last refresh and recomputes `gradebookDiffers` with its own copy of the rule. The server now stores the read (`gradebook_read`) and computes `gradebookDiffers` itself, so there are two sources of truth for one grade rule.
  - `connectionErrors` writes its own action texts for tool-page codes. Its Pending-tool sentence ("Delete the Pending Cogniate tool in Manage tools, then connect again.") is a third wording, after T4b1 round 2 made `pendingToolText()` the one source.
- **Evidence:** The tests "shows an unavailable results state when T5 endpoints are missing" and "keeps saved results when Resend or Refresh returns 404/501" lock in this branch-time behaviour.
- **Suggested fix:**
  1. Remove the "not available yet" branches and their tests, and show the API error (`ErrorNotice` already shows code, action and trace id).
  2. Show the server's `gradebook` and `gradebookDiffers` (the refresh response already returns the rows), and delete `gradeDiffers` and the cache.
  3. Take the connection action text from the server (for example add `lastError.action` to the Connection JSON), or import `pendingToolText` from `@cogniate/shared`.

### B-T6-04 — NIT — Small text, placement and hygiene points

- **Location and fix:**
  - `moodle-steps.json`: four texts hold two actions ("Paste the registration URL into Tool URL. Select Add LTI Advantage."; "Check the site and library in the Cogniate dialog. Select Connect."; "Return to Manage tools. Select Activate for the new Cogniate tool."; "Enter the tool settings below. Select Save changes."). `register-new-tool` has three sentences and 33 words. Use one action per step (STE), which also makes T7's step-by-step check exact.
  - `apps/portal/src/server.test.ts` tests cogniate-app routes through `../../../services/cogniate-app/src/testkit.ts`. Move it to `services/cogniate-app/src/` (next to `portal.ts` and `courses.ts`), so each workspace keeps its own tests.
  - Report and evidence files are in the product folder: `apps/portal/T6-REPORT.md`, `T6-INTEGRATION-REPORT.md`, `evidence/*.json`, `evidence/*.png`. Move them to `docs/reviews/T6/` (or the Lead's records), or delete them. They will go stale in the source tree.
  - There is copy that neither the dev-portal reference nor the spec has: "YOUR CONNECTED WORKSPACE", "One library. Your tools, connected.", "MOODLE PUBLICATION". Keep UI text to the reference and to STE.
  - The results view says "1 tries". Write "1 try".
  - `Modal` uses a fixed `id="modal-title"`. Use `useId()`.
  - The ErrorNotice special case builds the AC-T6-06 sentence "The package has an unsafe file path: <path>" in the UI. It is better to have the server's `REJECT_INFO` title carry it, so the text has one source.

---

## Round 2

Round 2 verdict: **APPROVE**. No open BLOCKER or MAJOR finding. One new MINOR (B-T6-05).

Input: `git diff 0d1e169 adb0f61 -- apps/portal` (46 files, Author-2 / Codex). `npm run check`: pass, 46 test files, 648 tests. `npm run build`: pass, portal JS 336.3 kB (gzip 103.6 kB), CSS 32.9 kB (gzip 8.1 kB).

| Id | Status | Evidence |
| --- | --- | --- |
| B-T6-01 (MAJOR) | **Resolved** | `moodle-steps.json` `dynamic` now ends with `edit-tool-settings`: "On the same tool card, click Edit. Set Tool configuration usage to "Show in activity chooser and as a preconfigured tool". Set Default launch container to "New window". Click Save changes." The labels are `Edit`, `Tool configuration usage`, `Show in activity chooser and as a preconfigured tool`, `Default launch container`, `New window`, `Save changes`. So T7 A2 and AC-T7-02 can follow it. |
| B-T6-02 | **Resolved** (one rest) | Small shadcn-style primitives in `apps/portal/src/ui/` (`button.tsx` with variants and `cn`, `badge`, `card`, `dialog`, `input`, `notice`, `tabs`). `styles.css` is 267 lines with tokens and base only (0 class rules, was 152). The long components are split: `connect/` into `CreateConnection`, `ConnectionSetup`, `ConnectionStatus`, `DynamicSetup`, `ManualSetup`, `MoodleSteps`, `DisconnectDialog`; `courses/` into `CourseDetail`, `CoursePackage`, `Publications`, `UploadForm`. The largest file is now `App.tsx` (398 lines). Rest (NIT): many hard-coded hex values in utilities (for example `text-[#b3a4c6]`, `text-[#cbb9e0]`, `bg-[#292631]`). Map the repeated colors to `@theme` tokens, as the dev portal does. |
| B-T6-03 | **Resolved** | No `gradeDiffers`, no "not available yet" branch and no `connectionErrors` map remain (search over `apps/portal/src`, tests excluded). The results view shows the server's `gradebook` and `gradebookDiffers`, and the action texts come from the server. |
| B-T6-04 (NIT) | Partly | The step texts still hold two to four actions each (`edit-tool-settings` has four sentences). The report and evidence files are still in the product folder, now also `T6-ROUND2-REPORT.md` and `evidence/round2-*`. Safe to defer. |

### B-T6-05 — MINOR — The "Manage Moodle" page says "the first launch changes the status to Connected" when it is already Connected

- **Location:** `apps/portal/src/connect/ConnectionStatus.tsx` `ConnectionReady`, line 68 (`<p>The first launch from Moodle changes the status to Connected.</p>`, outside any status check).
- **Problem:** For a `connected` connection, the page shows the badge "Connected" and the heading "Your library is connected", and then a sentence that says the status will *become* Connected. The user reads two opposite states on one screen. (The Lead saw this on the page.)
- **Evidence:** The heading and the dynamic steps depend on `connection.status === "registered"`, but line 68 is shown for every status.
- **Suggested fix:** Show that sentence only when `status === "registered"`. For `connected`, show a fact instead, for example "Last launch from Moodle: <lastLaunchAt>" (the Connection JSON has `lastLaunchAt`). Add one component test for each state.

