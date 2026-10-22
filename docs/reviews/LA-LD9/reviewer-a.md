Verdict: APPROVE
Round: 1

# LD-9 test-change lists: Reviewer-A (lens "Is it right and is it safe?")

- Lists:
  - `tests/ltiaas/golden/expected/LA-IC-12.json`
  - `LA-IC-16.json`
  - `LA-IC-17.json`
  - the rule in `tests/ltiaas/golden/lib/compare.mjs`
  - TEST-STRATEGY §4.7 rows LA-IC-12, -16 and -17
  - `tests/ltiaas/golden/README.md` §5

  The commits are `c953275` and `6340e02`. The files at `HEAD` are the same.
- References: LA-ADR-04 D6, D8; plan LD-9; A1 BD-A1-36, BD-A1-41; LA-ADR-05 D3; AC-LA-E0-03-08.
- I ran on the host (no Docker):
  - `node --test tests/ltiaas/golden/golden.k0.test.mjs`: 11/11 pass.
  - A probe of `compareCaptures` with G-BASE G1 and ten changed copies of `acceptance.*Health.outbound_allowlist`.
  - My own scan of each claimed file, and `git grep` over `tests/acceptance`, `tests/e2e`, `tests/host`, `tests/fixtures`, `apps` and `packages/channels/moodle/portal`.
- Blind review: I did not open the other reviewer's file.

| List | Verdict | Counts |
| --- | --- | --- |
| LA-IC-12 (LA-E3-04 service part) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-02) |
| LA-IC-16 (simulator allowlist rule) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT (A-LA-LD9-01, -02) |
| LA-IC-17 (strict Moodle `PUT …/platform`) | APPROVE | 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-LA-LD9-03) |

## LA-IC-12: complete

- Golden fields: none today. That is right: `capture.golden.ts` never reads `GET /api/idtoken` of a Deep Linking launch (it imports `idToken` but does not call it) and never sends an empty item list. The G2 `deep-link` records come from the one-item golden pick.
- Frozen tests: none. That is right:
  - My `git grep` found no `contentItems: []` or `content_items: []` in a frozen suite.
  - The only frozen reader of `deepLinkingSettings` is `T3a/1-deep-linking.spec.ts:47-52`, which reads `acceptTypes` by property, so the new `acceptLineItem` and `acceptMediaTypes` members do not break it.
- The three Author unit-test files are named, with what each one changes.
- The file names the G4 picker text that LA-E3-05 adds (`goldenFieldsPendingAppPart`), and `changes` is empty. When LA-E3-05 lands, its LD-9 list must add `G4.{blackboard,canvas}.pages.picker.text` to `changes`, or the G4 compare fails.

## LA-IC-16: complete, and the rule cannot hide a non-simulator change

- Golden fields: only `G1.acceptance.ltiHealth.outbound_allowlist`. That is right:
  - `acceptance.appHealth` has no simulator host (README §4b: "The app allowlist does not change").
  - The `default` profile has none.
  - G2 keeps only the records of the three baseline providers (`capture.golden.ts:165`).
- Frozen tests: none. That is right: no frozen suite reads `outbound_allowlist`, and no frozen test names one of the seven new hosts (`git grep` outside `tests/sim` and `docs`). The LA suites that use the rule (LA-E1-05 AC-07 and AC-09) are listed. The LA-E7-03 runner already handles more than three providers.
- Rule probe (`compareCaptures` against G-BASE G1, with `LA-IC-16.json`):

  | Candidate | Result |
  | --- | --- |
  | The 3 non-simulator hosts in G-BASE order plus the 15 manifest hosts | pass, explained by LA-IC-16 |
  | Plus `evil2.test` | fail |
  | Plus `lms-sim.test` (does not end in `.sim.test`) | fail |
  | Plus `x.sim.test`, which is not in the manifest | fail |
  | One manifest host missing | fail |
  | The non-simulator hosts in another order | fail |
  | A manifest host added to `acceptance.appHealth` | fail (strict diff) |
  | A manifest host added to `default.ltiHealth` | fail (strict diff) |

  The rule also refuses duplicates, entries that are not strings, and a manifest allowlist with a host that does not end in `.sim.test`. So the only change it can explain is "the `.sim.test` set equals the manifest allowlist set". The manifest itself is checked fail-closed by the simulator and by `lib.sh`.
- **A-LA-LD9-01 (NIT): the compare explains the allowlist difference as LA-IC-16 even when no expected-delta file is given.**
  - Where: `tests/ltiaas/golden/lib/compare.mjs` in `compareCaptures` (`allowlistDiff.explainedBy = simHostsEntry ? simHostsEntry.id : 'LA-IC-16'`).
  - Problem: probe: the same candidate with `expected = []` also passes. AC-LA-E0-03-08 says "a difference named in an `LA-IC` expected-delta file passes; the same difference without that file fails". BD-A1-36 wants a lasting rule, so an always-on rule can be what was meant, but the README and the K0 test do not say that this id is an exception.
  - Suggested fix: explain the difference only when `LA-IC-16.json` (or `--sim-hosts`) is given. Or write the exception into README §5 and add a K0 case that pins it.
- Notes:
  - The rule reads `tests/sim/hosts.json` from the checkout that runs the compare. Run it in a checkout of the compared SHA, or pass `--sim-hosts`.
  - With the file, a self-compare of G-BASE fails at today's SHA, because the manifest has 15 hosts and G-BASE has 8. That is correct, but do not pass the file to the G-BASE self-check.
  - This list covers only the manifest change. The new default simulator record fields from the LA-E7-05 part of `0e65ab1` (my A-LA-E7-02-04) are a separate G2 change that has no id yet.

## LA-IC-17: complete

- Golden fields: none. That is right, but for another reason than the file gives. The golden script never calls the app's `PUT …/platform`: it registers the Moodle-shaped QA platform with the LTI service (`POST /api/platforms`, `tests/acceptance/lib/qa-platform.ts:43`). So no golden field can see the new refusal. See A-LA-LD9-03 for the wrong line reference.
- Frozen tests: none. I checked every Moodle or standard `PUT …/platform` body in the scan list:
  - `T4b1/1-connect.spec.ts:128-134`, `3-security.spec.ts:116`, `4-adoption.spec.ts:17-24` (`sixOf`);
  - `M1/canvas/41-canvas-grades.test.ts:89-90` and `61-canvas-containment.test.ts:156-158` (standard connections with exactly six keys);
  - `T6/2-connect.spec.ts`;
  - `e2e/2-scenario-b.spec.ts:52` (the label-to-key map of the six).

  The Moodle portal form sends only `platformFields` (`packages/channels/moodle/portal/ManualSetup.tsx:35-40`).
- The other `PUT …/platform` calls in the test tree are Canvas or Blackboard bodies, which were already strict.
- **A-LA-LD9-03 (NIT): the scan entry `tests/ltiaas/golden/capture.golden.ts:276-285` points to the lines that write the capture files, not to a platform body.**
  - Where: `LA-IC-17.json` `scanChecked`, `tests/ltiaas/golden/README.md` §5, and TEST-STRATEGY §4.7 row LA-IC-17.
  - Problem: the file has 279 lines, and lines 276-279 only write `G1.json`–`G4.json`. The golden capture has no app `PUT …/platform` call. The 0-change result stays right, but the record names the wrong evidence.
  - Suggested fix: replace the entry with "golden capture: no app `PUT …/platform`; the QA platform is registered by `POST /api/platforms` (`tests/acceptance/lib/qa-platform.ts:43`)".

## A-LA-LD9-02 (NIT): two `approval` paths point to files that are not on the integration branch

- Where: `LA-IC-12.json` `"approval": "docs/reviews/LA-E3-04/qa.md"`, and `LA-IC-16.json` `"approval": "docs/reviews/LA-E7-03/qa.md"`. Neither file exists at `HEAD`, because `docs/reviews/LA-E3-04/` and `docs/reviews/LA-E7-03/` hold only reviewer files. LA-IC-16 belongs to LA-E7-02 (BD-A1-36), whose QA record is `docs/reviews/LA-E7-02/qa.md`. `LA-IC-17.json` points to `docs/reviews/LA-E1-07/qa.md`, which exists.
- Problem: an auditor cannot follow the approval link from the expected-delta file.
- Suggested fix: point LA-IC-16 to `docs/reviews/LA-E7-02/qa.md` (or the LA-E7-03 QA README under `tests/ltiaas/tasks-ops/LA-E7-03/`). Land the LA-E3-04 `qa.md`, or point to the record that exists.
