Verdict: APPROVE
Round: 2

# M2 review: Reviewer-A (correctness and security)

## Round 1 (2026-10-20)

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the M2 portal code from the correctness and security lens. No BLOCKER or MAJOR is open, and I have no finding. This is a static code review. It is **not** the M2 browser acceptance, which QA-E2E has not run. |
| Product revision | `76b03c7f24c15de2f7e164b836b27a398d45158a`. The portal paths are unchanged from `1e2c81f`, where I read them. |
| Test revision | `9964e6f132e6608216616bff621e3f9ba5667b04` (`tests/e2e/M2/**`, 64 prepared browser rows, not run). |
| Baselines | Behaviour `56591df` (ADR-011 rev 6). Implementation `2941140`. |
| Reviewer | Reviewer-A, Claude Code Opus 5.5, xhigh. Task `task_def3c0e1323e`, dispatch `ctx_8abc3ceb148c`. I did not read any Reviewer-B report. |
| Method | Static reading of `apps/portal/src/**` (wizards, shared portal, routes, dialogs) and of the app endpoints that it calls, in a clean clone. No browser run and no stack. The portal unit tests ran only inside the author-side root checks cited in the M1 report. |

### Findings

None.

### Security and privacy checks

| Check | Result | Where |
| --- | --- | --- |
| Approval code | Typed into a plain field (`autoComplete="off"`, no spell check). Cleared at submit, also when the request fails. Sent only in the request body. Never stored in web storage or in the URL, and never logged. | `connect/canvas/CanvasBinding.tsx` L18–L31, `connect/blackboard/BlackboardBinding.tsx` L21–L30 |
| No provider endpoints or secrets | Canvas and Blackboard wizards send only `name`, `siteUrl`, `method`, `lms`, `profile`, (Canvas) `serviceUrl`, then `clientId`, `deploymentId`, `grantCode`. The issuer and endpoint fields exist only in the unchanged Moodle manual setup. | `connect/ProviderSetup.tsx`, `connect/*/…Create.tsx`, `connect/ManualSetup.tsx` |
| Server is the authority | Every check (site rules, grant, library, capability) is enforced again on the server. The portal shows the server error codes and fields (`details.rule`, `details.fields`). | `connect/provider-errors.tsx`; app `connections.ts`, `redemption.ts` |
| Route isolation | `/integrations/{lms}/:id` shows "not found" when the connection's LMS differs from the route, or when the server answers `404` (another library). | `connect/ConnectionSetup.tsx` L36, `App.tsx` L117–L125 |
| Moodle-only features | No web services section and no "Also create an empty Moodle course" for Canvas and Blackboard. The `.mbz` section is labelled "Moodle only". The server guards the same capabilities (`409 CAPABILITY_NOT_SUPPORTED`). | `courses/PublishDialog.tsx`, `courses/MoodleBackup.tsx`; app `web-services.ts`, `publications.ts` |
| Disconnect text | The Blackboard dialog text equals M2. It promises no restore of old items. | `connect/DisconnectDialog.tsx` L39 |
| Canvas JSON | Copy and Download use the server document. The inline-key variant shows the key id. | `connect/canvas/CanvasConfiguration.tsx`, `ui.tsx` |

### Criteria covered by this report

| AC | Code-level result (static) | QA rows at `9964e6f` |
| --- | --- | --- |
| AC-M2-01 cards | Present: three cards, each with its own newest status | 01-cards (3) |
| AC-M2-02 Blackboard not ready | Present: not-ready text and disabled Connect from `lms-providers` | 00-blackboard-not-ready (2) |
| AC-M2-03 Canvas step 1 | Present: profile labels from the server; rule text on the right field | 02-canvas-wizard (19) |
| AC-M2-04 Canvas step 2 | Present: four rows, Copy and Download JSON, inline key | 02-canvas-wizard (6) |
| AC-M2-05 Canvas step 3 | Present: errors mapped; code cleared after each submit | 02-canvas-wizard (6) |
| AC-M2-06 Blackboard steps 1–3 | Present: no issuer, endpoint or secret field; conflict texts | 03-blackboard-wizard (4) |
| AC-M2-07 connection detail | Present: LMS badge; Canvas service URL and "Add deployment ID" only for Canvas | 04-detail (3) |
| AC-M2-08 Moodle-only features | Present (see above) | 04-detail (3) |
| AC-M2-09 disconnect | Present | 04-detail (3) |
| AC-M2-10 publish and results | Present: "Publish to an LMS"; LMS names in results | 05-publish-results (2) |
| AC-M2-11 keyboard and axe | Not judged by reading; needs the browser run | 06-keyboard-axe (6) |
| AC-M2-12 SIM scenario | Depends on the M1 engine (approved in the M1 report) | 07-sim-scenario (2) |
| AC-M2-13 routes | Present (see route isolation) | 08-routes (5) |

The QA-E2E plan (`docs/reviews/M2/qa-plan.md`) lists the open items H-1 to H-8. They are selector, baseline-text and runner choices, and none needs a portal change from my lens. H-3 (the old Moodle disconnect text) and H-6 (T7 selectors that use the old labels) need a Lead decision before AC-M3-02a.

### Scope limits

No M2 criterion has browser evidence yet. `SIM` rows never prove live Canvas or Blackboard behaviour.

## Round 2 (2026-10-20): integrated implementation and harness

| Item | Value |
| --- | --- |
| Verdict | **APPROVE** for the M2 portal implementation and prepared browser-harness source from this review lens. No new M2 finding. This does not approve the integrated release: M1 and M3 are **CHANGES_REQUESTED** at this SHA. |
| Exact reviewed SHA | **`eb43247d02df622d5da72dafac41d919f65a91fe`**, including product and harness, reviewed in detached checkout `/tmp/cogniate-review-a-eb43247.XUbPtw`. |
| Normative basis | Applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943`, ADR-011 and M2. Proposal `78bc34a` and design approvals `b6e8f73` do not substitute for this code review. |
| Reviewer | Independent replacement Reviewer-A, Codex GPT-6-Astra, xhigh, authorized in the current team brief at `1cb392e`. Task `task_74de10f72cf9`, dispatch `ctx_3604d1e6a48e`. No delegation or claim of cross-model review. |
| Independence | Used my earlier report and previously shared findings. Did not read Reviewer-B's new review or communicate conclusions with that reviewer. Only my existing M1/M2/M3 report files were edited; held for Lead commit. |
| Evidence | Static source/harness review and focused units/harness preparation checks below. No browser session, stack, full acceptance, live tenant, commit or push. |

### Static review and prior findings

- The provider-neutral `PROVIDER_NOT_READY` mapping uses the same title and action on the server and portal. Strict body fields and grant errors remain server-authoritative. The snapshot stays hidden in the public connection DTO.
- Approval codes are cleared when submitted, including failures. The forms do not persist them in URLs or web storage. Canvas and Blackboard setup do not collect arbitrary provider endpoints or secrets.
- Detail requests retain library-scoped server checks. Route/provider mismatches render not found; request cancellation, route identity and form resets prevent the previous connection's data from being reused by a new route. No new tenant-data path was found by source tracing.
- The existing Blackboard unverified card and provider-specific setup content remain distinct from the new neutral readiness error. Moodle setup and status/error wording remain unchanged by the snapshot repair.
- Historical B-M2-01 is closed in the candidate source. `apps/portal/src/connect/blackboard/blackboard-steps.json:19` says the first Submit shows settings, and `:23` requires a final Submit to save. The following deployment-ID instruction remains after the final Submit. All four entries remain `verified: false`; this is not evidence that a live Learn screen was exercised.
- Historical B-M3-01's M2 wizard-step/badge fixes remain present. Historical B-M3-02's stale-route observer now stays in the same document, with a sentinel and a `MutationObserver` on `document.documentElement`; navigation uses the app route. This repairs the destroyed-observer problem. The delayed request may be cancelled on navigation, so I do not label this as proof that a stale response was delivered and ignored.
- Prepared rows still cover route/library/provider isolation, form state, navigation, accessibility and SIM flows. M2 end-to-end binding behavior depends on the unresolved M1 findings, and common acceptance evidence depends on the M3 gate-capture repair.

### Supplemental checks

The following ran at the exact reviewed SHA after offline dependency installation:

```sh
npm run test:unit -- \
  apps/portal/src/multi-lms.test.ts \
  apps/portal/src/connect/canvas/canvas.test.ts \
  apps/portal/src/connect/blackboard/blackboard.test.ts \
  apps/player/src/lms-name.test.ts \
  packages/tracking/src/status-text.test.ts \
  services/cogniate-app/src/app/canvas-configuration.test.ts \
  services/cogniate-app/src/tool-pages/canvas-embedded.test.ts

node tests/e2e/host/run-m2.mjs --harness-only
```

The unit command passed **51 tests in 7 files, zero skips**, exit 0. Log: `/tmp/cogniate-review-a-eb43247-m2-unit.log`. The harness-only command passed **2 self-tests** and tests typecheck, and discovered/accounted for **64 browser cases**, with T7 selection unchanged, exit 0. Log: `/tmp/cogniate-review-a-eb43247-m2-harness.log`.

These are supplemental checks, not the 64 browser cases themselves. Screenshots, keyboard/axe behavior, actual route races and complete SIM flows still require the authorized QA run. Live Canvas and Blackboard rows remain unverified, and no SIM result is promoted to live evidence.
