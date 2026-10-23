Verdict: APPROVE
Round: 1

# LA-E3-05 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh. It replaces a Codex Reviewer-A session (see the Lead brief). Same lens.
- Diff: `git diff 1ff8944 176e823` (merge of lane L2). Commits:
  - `6d7e86d`: migration `018_picker_pick.sql`, `pickers.ts`, `launchStats`;
  - `8d967bb` (RQ-2, R file `domain/retention.ts`);
  - `042073c` (RQ-2, K files `clients/lti-client.ts` and `domain.test.ts`);
  - `7c417c3`: the retention test;
  - `7f46339`: `tool-pages/picker.ts`, the new `picker.test.ts`, one granted row in `launch.test.ts`.
- References: `docs/architecture/ltiaas/tasks/LA-E3-05.md`; LA-ADR-05 D3 (D3a to D3c, build notes BD-A2-87); data-model §5b; security delta §4 to §6.
- I ran these in a private clone at `176e823`. I deleted the Vitest cache before each run. No Docker, no stack.
  - Vitest on `services/cogniate-app`: 52 files, 689 tests pass, 2 skipped.
  - `npm run test:k0`: 149 tests pass.
  - F1 and F5 PASS; `npm run typecheck`: exit 0; ESLint on the app: clean.
  - Four probes on the picker routes (below). I deleted the probe file after the run.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

### Checks (lens A focus of the brief)

| Check | Result |
| --- | --- |
| Picker POST: Origin, capability, ltik binding | Correct. Both POST routes call `openPicker` first: unknown `404`, used `410`, expired `410`. Then `originRefused` checks that `Origin` equals `PUBLIC_APP_URL`; another value, `null` or no header gives `403` and changes nothing. The ltik comes only from the picker session (decrypted). `acceptMultiple` and `acceptLineItem` come from `GET /api/idtoken` with that ltik, never from a form field. The signed answer goes only to a return URL on the picker's site origin; otherwise the claim is released (unchanged rule). |
| Item count, duplicate and unknown ids, ownership (`picker.ts:223-237`) | Correct. `publicationId` may be a string or an array. The POST needs 1 to 20 entries, no duplicates, and every entry must be a `pub_…` id that `publicationOfConnection` finds for the picker's connection (same library) with status `available`. Otherwise it gives `400 PUBLICATION_NOT_AVAILABLE`, with no claim and no Deep Linking call, and the picker stays usable. Two or more ids without multi-select (`content.multiple` is not `true`, or `acceptMultiple` is not the boolean `true`) get the same `400`. Committed tests cover 21 ids versus 20, another connection, a withdrawn publication, a duplicate, no id, a malformed id, and the Moodle-shaped crafted POST (AC-12). Probe P4: a form order of A, C, B gives the items in the list order C, B, A. Each item has its own `lineItem.resourceId`. |
| Body size | Bounded before the route. The form parser has an 8 KiB limit: a 400-id form body gives `413` (probe P2). A 390 KB JSON body also gives `413` with no lookup. The 21-id case makes 21 indexed lookups. |
| Cancel (`picker.ts:251`) | Correct. It has the same `openPicker` and Origin checks. It claims the picker with no publication: `used_at` is set, `publication_id` is `NULL`, and no `picker_pick` row is written. It sends `contentItems: []` with `options.message` "No course was added.", and it auto-submits like a pick, with the same return-URL check and page headers (`picker-submit`, `form-action` = return origin, nonce). A failed Deep Linking call releases the claim. Probe P3: Cancel also works on a placement that takes no graded items. A pick after a Cancel gives `410 PICKER_USED` (AC-05). |
| Not-graded refusal before any Deep Linking call | Correct. GET: `rulesOf` runs before the list, and `notGraded` gives the `403` page `PLACEMENT_NOT_GRADED` with `picker_rejected {reason: placement_not_graded}`. POST: after the id checks and before `claimPicker` and `deepLinking`. The only LTI call is `GET /api/idtoken`. `notGraded` is `acceptLineItem === false` and `content.ungraded` not `true`, so the strict reading wins. Test: Moodle and `lti-generic` show no Deep Linking call. |
| Atomic claim and picks (`pickers.ts`) | Correct. `claimPicker` runs the `used_at IS NULL AND expires_at > now` update and the pick inserts in one transaction; nested calls use a SAVEPOINT (`@cogniate/shared` `transaction`). So a race between two POSTs, or a POST and a Cancel, has one winner. `releasePicker` deletes the picks and resets the session together. `linkPickToResourceLink` keeps the old matching rule: the oldest open pick of the publication in (connection, deployment, context). It sets `picker_pick.resource_link_id`, and also `picker_session.resource_link_id` for a single pick, so the two stay in step. |
| Migration `018` backfill (AC-10) | No stat changes. The old open-pick count was `picker_session WHERE publication_id = ? AND used_at IS NOT NULL AND resource_link_id IS NULL`. The backfill copies every used session with a publication, together with its `resource_link_id`. The new count (`picker_pick … resource_link_id IS NULL`) therefore selects exactly the same rows. The foreign keys hold, because publications and resource links are never deleted. The committed test seeds a database at migration 017 with old SQL (open, matched, other-context and unused sessions), upgrades a copy, and compares every `activities` stat (3, 1, 1). A second open applies nothing again. |
| Retention (RQ-2) | No stat drop and no orphan rows. The old condition stays, and `NOT EXISTS (open picker_pick)` is added, so a multi-pick session with an open pick is kept. The app opens SQLite with `PRAGMA foreign_keys = ON`, so `ON DELETE CASCADE` removes the picks of a deleted session. A Cancel session (no picks) is deleted on the normal schedule. Test: a session whose picks are all matched is deleted, together with its picks. |
| UNIT ACs | AC-09 (a three-item pick adds 3 to each stat before a launch; a single pick adds 1 and writes `publication_id`) and AC-10 have tests that fail on the old code. The K1-SIM and MOODLE-LIVE rows are QA work. |
| Must-not-edit list and ownership | Respected. No manifest, `tool-pages/launch.ts`, `app/server.ts` or LTI service file changed. The Cancel route is registered inside `registerPickerPages`, so no mount line was needed. In `domain/launch.ts`, only `launchStats` changed. The other-lane files are the Lead's grants: RQ-2 `retention.ts` (R), RQ-2 `lti-client.ts` and `domain.test.ts` (K), and the `launch.test.ts` row. F1 PASS. |
| L2 local choices (now BD-A2-87, ratified) | I agree with each of them. `403` matches the other `/tool/*` refusals. Reading both flags from the shaped token closes form tampering. Refusing again in the POST closes a crafted POST. A duplicate is a forged request, so the same `400` is right. The list order is stable, unlike the click order. One cost: the picker GET now calls `GET /api/idtoken` on every channel, also Moodle, so an LTI service failure now gives the GET page `LTI_SERVICE_ERROR`. Before, that showed only at the POST. Safe, and covered by T7 (QA). |

### Finding

- **A-LA-E3-05-01 (NIT): an empty multi-select submit gives a misleading page.**
  - Where: `services/cogniate-app/src/tool-pages/picker.ts:192` (checkboxes have no `required`, by design) with `:226` (an empty list gives `PUBLICATION_NOT_AVAILABLE`).
  - Problem: a teacher who clicks "Add to {LMS}" with no box ticked gets "This course is not available for this {LMS} site. In {LMS}, use Select content again and choose one available course." But no course was chosen, and the picker is still usable with Back. The radio list cannot hit this, because a radio button with `required` blocks an empty submit in the browser.
  - Safety: none. Nothing is claimed or sent.
  - Suggested fix (optional, UX): a short "Choose at least one course." refusal for an empty list, or one line of page script that disables the button until a box is ticked. Otherwise, record it in `deferred.md`.

### Verdict

APPROVE for lens A. Cancel and the multi-select POST keep the picker checks (capability, Origin, ltik from the session, return-URL origin). The bounds, duplicates, unknown ids and other-connection ids are refused before any claim or Deep Linking call. The not-graded refusal comes before any Deep Linking call. The migration and the retention change keep every stat and leave no orphan rows.
