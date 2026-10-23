Verdict: APPROVE
Round: 2

# LA-E3-16 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session as LA-E3-15).
- Diff: `git diff 4d31891^1 4d31891` (lane P). Commits:
  - `f3633a2`: the shell registration-URL part exported as `RegistrationUrl` and `renewRegistrationUrl`;
  - `4c9809f`: the Canvas DR path in the Canvas wizard;
  - `7216b0b`: URL text for A1 BD-A1-106.
- References: `docs/architecture/ltiaas/tasks/LA-E3-16.md`; LA-ADR-05 D6 ("Authority", "Manifest", "Portal"); A1 BD-A1-104, BD-A1-106; app contract §4 and app API delta §3.4.
- I ran these in a private clone at `4d31891`. I deleted the Vitest cache before each run. No Docker, no stack.
  - `npm run test:unit` (all workspaces): 191 files, 3091 tests pass, 5 skipped. It includes `canvas.test.tsx` (18 tests).
  - `npm run test:k0`: 148 tests pass.
  - F1 PASS; `npm run typecheck`: exit 0; ESLint on `packages/channels/canvas` and `apps/portal/src`: clean.
  - An independent check of the manual DOM hashes on the tree before this task (below).
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Checks

| Check | Result |
| --- | --- |
| No manual byte change | Holds. Request: with `manual`, the create body is `{"lms":"canvas","method":"manual","name",…,"siteUrl",…,"profile",…}`, with the same keys in the same order as before. `method` now comes from state, and its default is `manual` (AC-01 test compares the exact JSON string). The pending manual steps (JSON step and approval form) render the same. I checked this myself: I ran the AC-05 hash test on the tree before this task (`4d31891^1`), and the manual-only create step and the pending manual steps give the same SHA-256 values (`f76f793a…`, `2126a877…`) as on `4d31891`. The probe file is kept at `/tmp/ra-e201/e316/ra-e316-hash.test.tsx`. The real Canvas manifest has both methods since LA-E3-15, so the create step now also shows the "Connection method" choice. AC-01 requires that choice. The committed test proves that removing that one fieldset gives the old DOM. One note for QA-E2E (no finding): M2-11's keyboard walk on the create step now passes one more tab stop, the radio group, before "Next". |
| The staged form sends exactly `{ clientId, deploymentId, grantCode }` | Yes. `CanvasBinding` keeps its submit code. The only change is `initial` for the start values of the two ids, and they stay editable. The AC-03 test checks `PUT /app-api/connections/con_dr/platform` with exactly `{clientId, deploymentId, grantCode}` after an edited deployment id. The approval code starts empty and is cleared after the request (unchanged). The grant redemption compares the values with the granted ones (D6, BD-A2-89), so a wrong pre-filled or edited value cannot activate a platform. |
| No secret or token shown | Holds. The page shows only the registration URL with its single-use `ref`, which is the designed capability for the LMS administrator. The shell wizard shows the same through the same app route. It also shows the URL expiry and the staged platform's client id and deployment id, which are not secrets (ADR-011 §1). No grant code, ltik or key is displayed. A pending `dynamic` connection never requests the developer key JSON (`canvas-configuration`); the AC-02 test checks this. |
| The method choice cannot create a method that the channel does not have | Holds. The choices come only from `provider.methods`, the server's list from the manifest `registration`. With one method there is no choice (AC-01, manual-only case). The type allows only `manual` and `dynamic`. The server refuses any other method anyway (`CAPABILITY_NOT_SUPPORTED` for `dynamic` without the method, `INVALID_REQUEST` otherwise). |
| Pending `dynamic` steps | Step 1 is the registration URL part (copy button, expiry, "Get registration URL", which calls `POST /connections/:id/registration-url`) instead of the JSON. Step 2: without a staged platform, it shows the "Finish the registration in Canvas" text and no inputs; with a staged platform, it shows the binding form pre-filled from `platform.clientId` and `platform.deploymentIds[0]`. Tests: AC-02 and AC-03. If the create answer already has a registration URL (BD-A1-106), the step shows it at once. |
| Shell refactor (no behaviour change for other channels) | `ShowStep` renders `RegistrationUrl` with the same two elements and conditions as before. `renew` passes the same updated connection object. The shell wizard tests pass. Editing `ManifestWizard.tsx` is part of the "export the existing part" grant: the part was inline JSX before. |
| Must-not-edit list and F1 | Respected. No change to the Canvas manifest, `app.ts`, `app/**`, `services/**` or another channel folder. The LMS-named texts stay in the Canvas folder (F1 PASS). |

AC-04 (K1-SIM, end to end) needs the K fix for BD-A1-106 and LA-E3-09. That is QA work.

### Verdict

APPROVE for lens A. The manual path is byte-identical, which I checked against the tree before this task. The staged form sends exactly the three binding values. No secret is shown. The method choice offers only the methods that the server lists.


## Round 2 — BD-A2-106 follow-up

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed lane P commit `aa351bad0b52d1941df6f658aace8d3f6c0c1619` against BD-A2-106, the updated task spec, LA-ADR-05 D6 and LD-9. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

- `canvas-steps.json:33` matches the complete BD-A2-106 string exactly. A structural comparison confirms that this is the only JSON value changed; the other changed file is its existing AC-01 test. Both files are in lane P's allowed scope. No method filter, manifest, service, refusal page, other text or request behavior changes.
- The sentence correctly states Cogniate's current support limit. D6 leaves hosted Canvas support pending the CANVAS-HOSTED live check; the central configuration hosts are refused and the hosted token host is unverified. It does not say that every possible hosted configuration fails, and both choices remain available as BD-A2-106 requires. Existing E3-09 AC-05 QA evidence supports the pre-fetch refusal boundary.
- **20/20 Canvas unit tests passed**, including the manual request and AC-05 DOM hashes. With only the JSON restored to the old text, the new AC-01 assertion failed for the missing hosted-Canvas sentence. Restoring the patch made AC-01 and AC-05 pass again (**2/2**). Tests used a fresh `--no-hardlinks` clone at `5261d4da`, its own `npm ci`, and a cleared Vitest cache before each run; temporary changes were then removed.
- **No frozen M2 or K2 assertion requires the old sentence, so no LA-IC row is needed for this change.** The search covered `tests/**`; the relevant M2 wizard and keyboard checks do not compare this help text. M2's `lib/m2.ts:126` screenshots are recorded artifacts, not snapshot comparisons. K2 `02-u2-wizards.k2.ts:123` and `lib/k2.ts:521` match method-name prefixes, which still match the longer accessible name. The unchanged AC-05 hash check removes the method fieldset before comparing the create DOM.

Evidence logs: `/tmp/la-reviewer-a-ctx-4fa5c7d0454a-canvas.log`, `/tmp/la-reviewer-a-ctx-4fa5c7d0454a-old-text-mutant.log`, `/tmp/la-reviewer-a-ctx-4fa5c7d0454a-restored.log`. No Docker, stack, host stack runner, commit or Reviewer-B file was used. The Lead's merge and the planned wave-end M2/K2 runs remain; this review does not claim those browser runs occurred.
