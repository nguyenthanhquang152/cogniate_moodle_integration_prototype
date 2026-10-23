Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `a3d94347d61804cd92bbb44792b7e487f6d85441` at merge `71f4cedddb302aef80d77032291ec3f6faf6a3fd`, against LA-E2-05, LA-ADR-01 D2/D5, LA-ADR-02 D4/D8, app API delta §3.3, BD-A1-85/-94/-95, the ownership matrix and plan §6.1. Blind review; the other reviewer's file was not read.

**Counts:** 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.

### B-LA-E2-05-01 — MAJOR — The channel hides the tool values required by its manual instructions

- **Files:** `packages/channels/brightspace/manifest.ts:39`, `packages/channels/brightspace/manifest.ts:70`; supporting consumers: `apps/portal/src/channels/ManifestWizard.tsx:92`, `tests/ltiaas/k0/contract.test.ts:1139`.
- **Problem:** the manifest defines all nine D2L tool rows but sets `lti.toolConfiguration: 'none'`. The shared wizard therefore shows none of those rows while telling the administrator to enter the tool values below. An administrator cannot obtain the login, redirect and keyset URLs from that flow. For another team following the schema and ADR, the correct setting is `'channel'`; however, the current K0 check then incorrectly requires `app.ts`. The folder thus contains a test workaround that prevents the documented manual setup. This leaves the AC-07 browser-flow prerequisite incomplete even though the data gate is green.
- **Evidence:** in a private clone, rendered the real Brightspace wizard for a pending manual connection. The issuer and all four D2L defaults were filled correctly, but the wizard never requested `/tool-configuration` and showed no tool rows. Changing only this manifest value to `'channel'` made the same probe pass and display the nine rows. With that value, `K-ADAPTER.brightspace` failed at line 1139 with `exports app.ts ConnectionSetup adapter: expected undefined to be defined`. Separately, the actual app route, with a declared fake Brightspace provider, returned all nine filled rows in the required order; the kernel already provides them.
- **Suggested fix:** finish the already-ratified BD-A1-85 dependency: QA updates K-ADAPTER to accept a channel without `app.ts` when all its profiles use admin endpoints, then K sets Brightspace to `'channel'`. Add a rendered-wizard check that the values appear alongside the instructions. Keep the channel data-only and rerun K0/F2; this needs no new adapter or core production branch. BD-A1-85 allowed the temporary `'none'` setting for E2-03, but it does not complete the E2-05 manual browser flow.

### Can another team reproduce this folder?

Apart from B-01, yes: the folder uses only documented data surfaces. The README traces the D4 facts to the ADR and R2 §5.4, distinguishes design choices from vendor facts, and marks the family, frame name and tool-form labels UNVERIFIED. It says no live platform was tested and that values from the registration page override defaults. The manifest schema documents the closed tool-row placeholders and field defaults; `ProfileSource` and the trait ADR explain admin endpoints, null stored endpoint fields, audience form, legacy flags and ordering. There is no hidden service import, custom adapter, portal module or protocol path to copy. The five colocated tests pin the constants, traits, scopes, guard and row order.

### Verification and ownership

Verification ran in `/tmp/la-e2-05-review-b-ct5y_xy1/repo` at the merge SHA. The integration worktree was changed only for this report.

- **F2 passed against `678eb72`: core = 0**, six paths: the four Brightspace files and two docs paths. The authored commit changes only its four allowed channel files; no forbidden path or core LMS-name literal was added.
- Full **`npm run check` passed**: lint and type checks; **3,017 unit tests passed, 5 skipped, in 187 files**; **254 infrastructure tests passed**; **149 K0 tests passed**; F1 and F5 had zero hits. The infrastructure tests use fake Docker commands; no real Docker or stack was started.
- UNIT AC-02 has separate default and profile-trait assertions. Changing only the token default made its test fail; changing only `endpointOrigins` from `any-https` to `issuer` made its trait test fail. Each control left the other four channel tests passing.
- Additional probes verified the exact six legacy flags (only `operatorApproval` and `addDeployment` true), four scopes, no channel `app.ts`, and the HTTP tool rows with filled host/login/launch/keyset values. The real wizard probe and the K0 control reproduce B-01. All temporary changes were restored; the private checkout is clean.

QA retains K1-SIM AC-04/-05/-06/-10, K2 AC-07 and R1; these were not run or claimed here. The folder-only extensibility measurement is proven, but the user-facing setup needs B-01 closed before this review can approve. No integration source edit, commit or push was made.

## Round 2

**Verdict: APPROVE.** Reviewed `6bfb150` and `eea9532` at merge `326ceae8db2faeb438481e4f6f1bd704b4ced697`, with the K-ADAPTER prerequisite `4d08fc1`, against BD-A1-85 and the Round 1 finding. Blind review; the other reviewer's file was not read. **Open counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

**B-LA-E2-05-01 — CLOSED.** Both manifests now use `lti.toolConfiguration: 'channel'`. The real Brightspace wizard requests the tool configuration and displays all nine rows beside the instructions; its issuer and four D2L defaults remain correct. A separate injected app-route probe returned the nine correctly filled rows in contract order without a channel adapter. Updated K-ADAPTER accepts the kernel adapter for the admin-endpoint profiles, and all 148 current K0 tests pass. The RQ-2 mock change correctly separates the tool-configuration response from the connection DTO.

### B-LA-E2-05-02 — MINOR — The visible-row regression is not pinned in the committed tests

- **Files:** `apps/portal/src/channels/staged-wizard.test.tsx:32`; `packages/channels/brightspace/channel.test.ts:62`.
- **Problem:** the portal fixture returns an empty row list, while the channel test checks only the manifest's row data. Neither proves that the wizard requests and shows the required settings. The missing rendered-wizard check requested in Round 1 remains a coverage gap; the functional fix itself is verified and can proceed.
- **Evidence:** changing only both manifests back to `toolConfiguration: 'none'` left all **52 tests in the three relevant channel/shell/staged-wizard files** and **148 K0 tests** passing. The private rendered-wizard probe then failed because no `/tool-configuration` request was made. With the reviewed values, that same probe passed and showed nine data rows.
- **Suggested fix:** through P or an RQ-2, add one rendered manual-wizard test with a non-empty tool-configuration response and assert the requested endpoint plus visible values/row order. Use the real Brightspace manifest so restoring `'none'` fails the test; the same pattern can cover the generic channel. Private probe text is at `/tmp/la-e2-05-06-review-b-51bb0tyi/shell.test-review-probe.txt`.

### Round 2 verification and scope

Used a fresh `git clone --no-hardlinks` at `/tmp/la-e2-05-06-review-b-51bb0tyi/repo`, its own successful `npm ci`, and a cleared Vitest cache before every run. **153 focused tests in eight files, 148 K0 tests and five added host-only probes passed** across this dispatch's two items. Targeted lint, full type checks, F1 (0 hits) and F5 (six rules, 0 hits) passed. All private mutations were restored; the checkout is clean.

As dispatched, `6bfb150` is the separate E2-K repair: F2 classifies its generic-channel path as `core = 1` (two paths total). It is not evidence for an E2-N folder-only commit. The LA-E2-06 commit is measured separately in that review. The manifest changes and P test RQ-2 are explicitly authorized; no new core production behavior or LMS-name literal was added. QA retains the full manual K2 flow and stack regression. Only this report and the assigned LA-E2-06 report were edited in integration; no Docker, stack, commit or push was run.
