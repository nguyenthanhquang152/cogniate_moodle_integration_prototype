# T6 integration self-check

Date: 2026-10-18. Branch: `feat/t6-portal-ui`. No push was made.

The accepted T6 portal is merged with T5a and the current contract updates. Two learners completed the real SCORM course through Moodle. The portal shows Passed 100 and one Sent sync for each learner. This is Author-2 evidence, not an independent QA verdict.

## Commits and merge

- `1943ee8`: merge commit. Parents: accepted T6 `c9756de` and `feat/moodle-lti-prototype` at `d9dcc7b`.
- The commit that contains this report adds the UI integration changes and live evidence. See `git log feat/moodle-lti-prototype..HEAD`.

Conflicts and root script resolution:

| File | Resolution |
| --- | --- |
| `infra/compose.yaml` | Keep the upstream read-only `apps/` mount. It serves both `apps/player/dist` and `apps/portal/dist`. |
| `services/cogniate-app/src/app/server.ts` | Keep the player directory, status API, T5a/T4b2 routes, and portal handler. |
| `package-lock.json` | Regenerate with `npm install` after the package scripts are resolved. Both web workspaces remain. |
| `package.json` | Keep one `dev:web` entry: the portal script that watches both web workspaces. |

Those four files are the complete list of integration edits outside `apps/portal`. The merge also imports upstream work unchanged. No new edit was made to tests, docs, player, tracking, LTI service, content host, worker, or the protected domain files.

## Portal changes

- Use the real T5a results GET response. Keep best result, attempts, ordered sync history, conflict, failure, and override rendering.
- Add the `superseded` sync status. Show sent times and the time of a gradebook read.
- Show `Preview — no grade sent` and `Not applicable` for a preview with no gradebook value.
- Keep Resend wired to `POST /app-api/score-syncs/:id/resend`. A 404 or 501 explains that Resend is unavailable and keeps the saved result unchanged.
- Give the same clear fallback for the T5b gradebook refresh endpoint. Successful action messages are visible and announced.
- Use tuple keys for result rows, so punctuation inside an identifier cannot make two rows share a key.
- Keep connection `lastError`, code, and trace ID rendering. Show a useful action for immediate manual-connect errors as well.
- State the reconnect sequence: delete the old Moodle tool, disconnect, then connect again. Every registration update is refused.
- Keep the contract label `Selected in Moodle`; use `In use` when learners exist.

Changed portal files: `src/results/Results.tsx`, `src/types.ts`, `src/ui.tsx`, `src/connect/Connect.tsx`, and `src/portal.test.ts`. Evidence and both T6 reports are under `apps/portal`.

## Checks

- `npm ci && npm run check`: passed after the merge. After the added fallback/preview checks, `npm run check` passed with **42 files, 564 tests passed, and 5 existing skips**.
- `npm run build`: passed for the player and portal.
- `npm run dev:web`: both Vite builds started in watch mode and completed. The watchers were then stopped.
- `git diff --check`: passed.
- Live axe check: zero violations on Results and the manual Manage Moodle page.

## Live stack evidence

Only this stack was used:

```sh
COMPOSE_PROJECT_NAME=cogniate-codex PUBLIC_PORT=9443 STACK_SUBNET=172.30.0.0/16 npm run stack:down
COMPOSE_PROJECT_NAME=cogniate-codex PUBLIC_PORT=9443 STACK_SUBNET=172.30.0.0/16 npm run stack:up
COMPOSE_PROJECT_NAME=cogniate-codex PUBLIC_PORT=9443 STACK_SUBNET=172.30.0.0/16 npm run seed
```

The containers were recreated after the merge. Data was kept. The existing real SCORM upload and registered Moodle tool were used. The missing activity was added with:

```sh
npm run seed:lti-activity -- --type 1 --course COGNIATE-DEV-101 \
  --name 'T6 real SCORM integration' \
  --url 'https://lti.cogniate.test:9443/lti/launch/cogniate?resource=pub_A4Sk5slwXQijco0Z8mygtQ'
```

Moodle activity: `cmid=3`, `instanceid=1`. Publication: `pub_A4Sk5slwXQijco0Z8mygtQ`.

The browser check used local Chrome through Playwright, with no mocked network responses. Each user signed in to Moodle, launched the activity, opened the player, visited the lesson, chose the correct answer, and scrolled to the end. The course's own dwell timer and SCORM adapter completed the attempt. No tracking state or result was inserted directly.

| User | Real results GET and portal | Moodle grade |
| --- | --- | --- |
| `cg_student`, sub `4` | Passed 100; one attempt; one `sent` sync; one try | 100 / 100 |
| `cg_student2`, sub `5` | Passed 100; one attempt; one `sent` sync; one try | 100 / 100 |
| `cg_teacher`, sub `3` | Preview; Passed 100; one attempt; no sync | No grade row |

Names are anonymous in the API. The portal correctly uses `Learner 4 @ moodle.test:9443` and the other returned labels.

The course view shows `Selected in Moodle: 1` and `In use: 2`. The real refresh endpoint returns 404. Its message is clear and all three outcomes stay visible.

The manual form was also submitted with an already registered Moodle tool. The real API returned `409 PLATFORM_IN_USE`. The portal showed the error, action, and trace ID. See the persistence gap below.

Artifacts:

- [Real results response](evidence/integration-results.json)
- [Live UI checks](evidence/integration-checks.json)
- [Results screenshot](evidence/integration-results.png)

The isolated stack remains running for review. Credentials remain in the ignored local seed file. No secret or capability token is in these artifacts.

## Acceptance status and gaps

| Criterion | Current evidence | Remaining work |
| --- | --- | --- |
| AC-T6-08 | Both real learners show Passed 100 and Sent; Moodle also stores 100. | The gradebook column cannot refresh until T5b supplies its endpoint. Independent QA still owns the full verdict. |
| AC-T6-14 | Conflict/failure/history/override components remain covered. Added tests prove 404/501 Resend and Refresh fallbacks keep the result. Live real history shows one sent row per learner. | The real conflict, failed-to-pending-to-sent Resend, and teacher override recipes need T5b and QA. No claim of live coverage for those recipes. |

T5a supplies every Results field needed for its current scope. It returns `gradebook: null`; refresh, `gradebookDiffers`, and Resend belong to T5b. No Results backend change was made.

Two inherited backend contract gaps were reported to the coordinator:

1. `services/cogniate-app/src/app/connections.ts:203`: a duplicate manual platform returns `PLATFORM_IN_USE` but does not store `connection.lastError`. The real GET still returns null after failure. The portal can show the immediate error, but cannot retain the server error after reload without that field.
2. `services/cogniate-app/src/tool-pages/picker.ts:40`: `RETURN_URL_MISMATCH` still advises `Select content again`. Contract section 6 forbids retry advice for this error and asks for the trace ID to go to the Moodle administrator.

The merged tool handlers retain the new page codes, error-page events, status API, and registration-update rejection. Those backend files were inspected and kept unchanged. The existing test suite passes, but the two gaps above still need their owner's fix.
