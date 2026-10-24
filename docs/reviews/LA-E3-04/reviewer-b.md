Verdict: APPROVE
Round: 1

# LA-E3-04 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 3344520^1 3344520 -- services/lti-service/src/lti/{deep-linking,idtoken}.ts` and their tests plus `http/routes/compat.test.ts` (lane L commit `f6d0601`, merged as `3344520`; the same merge holds the LA-E3-01 fix round, reviewed separately). Spec: `docs/architecture/ltiaas/tasks/LA-E3-04.md`. Design: LA-ADR-05 D3a, D3c, D3d; contract delta §4.1, §4.2; LA-IC-12. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

The change is small, and a tool developer can read it:
- The doc comment of `checkContentItems` now says "0 to 20 items, at most 1 if accept_multiple is false".
- Each refusal gives `400 INVALID_CONTENT_ITEM` with a plain reason: "send 0 to 20 content items", "the platform accepts at most one content item (accept_multiple is false)", and, for an item index, "the platform does not accept line items".
- The shaped token adds `acceptLineItem` and `acceptMediaTypes` only when the platform sends them (`compact`), so old tokens keep their shape.
- The tests cover each rule on all three response routes, and they verify the signed JWT, not only the status.

## How I checked

- Scratch clone of `3344520` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run` on `services/lti-service/src/lti`, `http/routes/compat.test.ts`, `profiles` and `store/states.test.ts`: **18 files, 288 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0.
- With the **old** `lti/deep-linking.ts` restored in the scratch clone, `deep-linking.test.ts` and `compat.test.ts` give **5 failed, 51 passed**. So the new rows fail on the old behaviour.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `lti/deep-linking.ts`, `lti/idtoken.ts` and their Author tests, and `http/routes/compat.test.ts` (the test of an allowed file). No change in `lti/launch.ts`, `login.ts`, `http/app.ts`, `http/auth.ts` or app files for this task. `services.ts` and `compat.ts` need no change: they call `checkContentItems`. |
| Ownership | Lane L, B2. OK. |
| No behaviour change outside the spec | LA-IC-12 only: an empty list is now valid. The Author test changes for it are the two removed "no items" rows and one `[]` → `null` input in the refusal table (`compat.test.ts:311`); QA keeps its own LA-IC-12 list (plan LD-9). |
| No LMS name in core | None. |
| UNIT ACs | AC-03 (`deep-linking.test.ts`: two items with `accept_multiple: false` refused, zero or one accepted; 21 items refused for `undefined`, `true` and `false`). AC-06 (`idtoken.test.ts`: no `acceptLineItem` or `acceptMediaTypes` member without the settings; a negative check that the old code also met, which is the point of the AC). AC-07 (`compat.test.ts`: the AC-01 and AC-04 inputs on `/api/deeplinking`, `/message` and `/form`, with the verified JWT payload). |

## Finding

### B-LA-E3-04-01 — NIT — The two new route tests repeat the "get and verify the JWT" steps

- **File:** `services/lti-service/src/http/routes/compat.test.ts:241-270` (the `suffix === '/form' ? /name="JWT" value="([^"]+)"/ … : body.message` line and the `jwtVerify(…)` call appear in both tests).
- **Problem:** Each future Deep Linking route test (LA-E3-13 per-type fields) will copy the same three lines. If the form markup changes, every copy must change.
- **Suggested fix:** One helper in the test file, `async function signedContentItems(response, suffix)`, that returns the verified payload. Both tests then read as "for each route: status, then `signedContentItems(…)`".

## Not checked

- K1-SIM AC-01, -02, -04, -05 (QA). QA's LA-IC-12 test-change list.
