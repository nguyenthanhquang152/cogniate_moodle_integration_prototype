# Cogniate × Moodle integration prototype

This prototype publishes Cogniate courses (SCORM 1.2 and HTML) to Moodle with LTI 1.3. It has its own LTI service, a clean-room implementation of the 1EdTech specifications. For the endpoints listed in ADR-003, its API follows the public LTIAAS API reference, with listed differences.

**Status:** all 15 end-to-end checks passed on real Moodle 5.2.4. Three fresh runs passed at `c5683f8`, after the grade repair ([T7 QA §10](docs/reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19)). Portal QA passed 14 checks; the listed LTIAAS-style endpoints passed 7 checks with the real `ltiaas` SDK. T8 round 2 passed AC-T8-02 to AC-T8-10 and both race checks at `8059c31` ([T8 QA](docs/reviews/T8/qa.md)). MoodleCloud, restore through Moodle pages, and the portal token form remain unverified.

## Supported LMS

Canvas and Blackboard phase: evidence basis `31f4d0bb8afdfeee59ce50e558bb58b49ebc5d54`, 2026-10-23. Guide revision 911219b0 passed independent QA and both reviews.

Product: C6 `4008afb92fe983d52db33442e060210b929966c8`. M1 tests: C9 `9eb504f5`. M2 actual tests: C8 `5561e8f7`. Separate carried results: C4 `bf09cda`.

T7 actual tests: C10 `97b68af439b6565f891042b20497b18aadca6a24`. Tests tree: `ec2d86f590902ee99997d6ed2b78599dc3006072`. Run: `qa-e2e-m3-r3-97b68af4-2026-10-23T16-26-41-657Z`. The Lead accepted this run ([E-R8](docs/team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc)).

M1 passed two equal fresh rounds of 394 cases at product C6 and tests C9 ([E-R7](docs/team/r7-m1-verification-2026-10-23.md)). Another 94 rows are carried from C4. M2 passed 64 cases, 13 criteria and seven gates at actual C8/C6 ([E-R6](docs/team/r6-independent-verification-2026-10-23.md)). All 12 legacy groups passed, with 304 raw PASS entries ([E-R4](docs/team/r4-evidence-decision-2026-10-22.md)). Their per-subrun unique-ID counts sum to 251. This is not a global distinct count.

T7 passed all 15 criteria at C10/C6 ([E-R8](docs/team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc)). Each of three cycles had 17 PASS, zero failures and only the permitted demo skip. Demo preparation took 11.45 seconds; both player launches passed. All four confirmation/refusal checks passed.

The Architect gave final [AC-M4-06 APPROVE](docs/reviews/M4/architect-conformance.md#r76-verdict), with no open BLOCKER or MAJOR. [ADR-011](docs/architecture/adr/ADR-011-multi-lms.md) is accepted for design and prototype conformance. [ADR-012 revisions 3.3–3.7](docs/architecture/adr/ADR-012-sqlite-volume-storage.md) are accepted for the prototype only. The limits and decisions in [G1](docs/human_review/decisions-needed.md#g1-storage-design-blocking-design-findings-closed) still apply. Guide revision 911219b0 passed independent QA and both reviews.

| LMS | Claim | Evidence label |
| --- | --- | --- |
| Moodle 5.2.4 (local container) | Connect, publish, Deep Linking, SCORM and HTML grades passed end to end. | `MOODLE-LIVE` |
| MoodleCloud | Not tested (Q5). | — |
| Canvas, Instructure-hosted | Implemented and tested against a signed simulation only. Not yet tested on a real Canvas site. | `SIM`; `CANVAS-HOSTED` rows `UNVERIFIED` (B-1) |
| Canvas, self-hosted | Implemented and tested against a signed simulation only. Not yet tested on a real Canvas site. | `SIM`; `CANVAS-LOCAL` row L-C13 deferred and `UNVERIFIED` |
| Blackboard Learn | Implemented and tested against a signed simulation only. Not yet tested on a real Blackboard site. | `SIM`; `BLACKBOARD-LIVE` rows `UNVERIFIED` (B-2, B-3) |

### Evidence labels

The guides tag each step with one of these labels. This table gives the current status of each label.

| Label in a guide | Meaning | Status on 2026-10-23 |
| --- | --- | --- |
| `MOODLE-LIVE AC-T7-…` | End-to-end test on the local Moodle 5.2.4 container | Historical PASS: three runs at `c5683f8` and one at `aff4882` ([T7 QA](docs/reviews/T7/qa.md#m3-checkpoint-update--final-candidate-aff4882-t7-pass)). C8 attempt: FAILED. C10: all 15 criteria PASS; three cycles of 17 PASS ([E-R8](docs/team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc)). |
| `MOODLE-LIVE AC-M1-23`, `AC-M1-30` | Upgrade and rollback on the local Moodle container (host runner) | Cited cases passed in both C4 rounds. They remain carried migration evidence in the separate 94-row ledger ([E-R7](docs/team/r7-m1-verification-2026-10-23.md)). They are not fresh C6/C9 runs. |
| `SIM AC-M2-…` | Portal browser test against a signed simulation (fixed `.sim.test` hosts) | Accepted r7: 64/64 PASS, 13 criteria and seven gates at actual C8/C6 ([E-R6](docs/team/r6-independent-verification-2026-10-23.md)). Later dependency equivalence does not change that run identity. |
| `SIM AC-M1-…` | API and launch test against a signed simulation | Two equal fresh rounds: 394 PASS each at C6/C9. Another 94 C4 rows are carried separately ([E-R7](docs/team/r7-m1-verification-2026-10-23.md)). This is not 488 fresh cases. |
| `SIM AC-M1-41` | Storage commands (ADR-012) | All 72 rows passed in both C4 rounds: two migration rows and 70 storage rows. They remain carried evidence ([Architect assessment](docs/reviews/M4/architect-conformance.md#r68-review-of-the-qa-carried-evidence-mapping-for-adr-012-about-0417-utc)). The unit, host-fault and bind-mount limits still apply. |
| `HOST-QA` | Host-only QA with simulated Docker answers | Storage-command QA Round 2 PASS at `9f8ac62` ([report](docs/reviews/M1/storage-command-qa.md)). No runtime credit. |
| `DOC F-…` | A fact from provider documentation ([research](docs/research/multi-lms.md)) | Proves nothing about our code. |
| `UNVERIFIED L-…` | A live check on a real LMS ([M3 live matrix](docs/architecture/tasks/M3.md#5-live-check-matrix)) | All 32 rows `UNVERIFIED`. Blockers: B-1, B-2, B-3. |
| `PROCESS` | A human step with no product behaviour to test, for example the operator's request check (Q22) | — |
| `Not verified by QA` | Only the builder checked it | — |

A tag can name one QA case instead of a criterion, for example `SIM M1-19.canvas.inline-key`. The case has the status of its criterion row above.

`SIM` means a signed simulation of the LMS. It tests our protocol handling, not real LMS behaviour.

Earlier failed attempts and environment deviations remain in [M1 QA](docs/reviews/M1/qa.md) and the [phase plan](docs/team/multi-lms-plan.md). Diagnostic and host-only passes give no full acceptance credit. The 12 legacy groups use their documented fixtures and knobs, followed by default-profile checks with no knobs.

Legacy functional results were accepted, but the exclusive-host condition failed ([E-R4](docs/team/r4-evidence-decision-2026-10-22.md)). M2 attempt 3 remains NOT ACCEPTED despite its 64 functional passes. Accepted M2 r7 missed the prelaunch hold. The later bridge reconciliation and the 256-event query limit remain disclosed ([E-R6](docs/team/r6-independent-verification-2026-10-23.md)). No check was waived.

The C8 T7 attempt remains FAILED. One screenshot failure caused seven later failures. Its separate shared-log scan found one redaction failure. C10 contains the reviewed repairs and the accepted new run ([E-R8](docs/team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc)).

The M1, M2 and legacy import closures exclude all four C10 repair files. M1 and M2 typecheck globs include E2E files. Typecheck passed at C10. These facts do not change any accepted run identity.

T7 used a shared host; attribution does not prove exclusivity. Keep, teardown and operational closure passed, with all 32 complete protected records unchanged. The strict scan passed with 162 values and zero shared hits. All 51 default tests had no viewport click retries; all 12 required PNGs passed judgment. Snapshot comparisons cannot detect resources created and removed between captures. The LA watcher restarted and replayed events; no gap exceeded two minutes.

## Start here

- **Product team:** read [`docs/human_review/START-HERE.md`](docs/human_review/START-HERE.md). It takes about 30 minutes with the video, the explainer page and the decisions.
- **Canvas and Blackboard:** open [`docs/human_review/canvas-blackboard.html`](docs/human_review/canvas-blackboard.html) in a browser (about 10 minutes, works offline).
- **People who run it:** read [`docs/guides/run-the-stack.md`](docs/guides/run-the-stack.md).

## Quick start (Mac, Docker Desktop, Node 24)

The two course zips are not in git. Get them from the product team.

```sh
mkdir -p docs/raw/data/courses   # then copy the two course zips into this folder
npm ci
npm run fixtures:check
npm run gen-env
npm run e2e:reset      # WARNING: deletes the local Moodle site and the local Cogniate data. If it asks, type yes.
npm run demo:prepare   # connection, two published courses, two Moodle activities
```

QA measured 43 seconds for `e2e:reset` and 8.64 seconds for `demo:prepare` (AC-T7-15). The Lead accepted QA’s fresh-clone run for AC-T9-01: both login pages opened in 61 seconds. Unfamiliar-human usability remains unproven (HR-2). Then open the stack in a browser: see the run guide, procedure 3.

## Guides

| Guide | For |
| --- | --- |
| [Run the stack](docs/guides/run-the-stack.md) | Start, open, reset and stop the local stack |
| [Moodle admin](docs/guides/moodle-admin.md) | Connect a Moodle site (automatic or manual) |
| [Canvas admin](docs/guides/canvas-admin.md) | Connect a Canvas site (not yet tested on a real Canvas site) |
| [Blackboard admin](docs/guides/blackboard-admin.md) | Connect a Blackboard Learn site (not yet tested on a real Blackboard site) |
| [Operator](docs/guides/operator.md) | Cogniate staff: approval codes, suspend and release, upgrade and rollback |
| [Teacher](docs/guides/teacher.md) | Add a Cogniate course to a Moodle, Canvas or Blackboard course |
| [Learner view](docs/guides/learner-view.md) | What a learner sees, and what happens when… |
| [Native channel](docs/guides/native-channel-moodlecloud.md) | Build a Moodle backup or empty course; see the guide for verified scope |
| [Troubleshooting](docs/guides/troubleshooting.md) | Symptoms and fixes |

## Repository map

| Folder | Content |
| --- | --- |
| `services/lti-service` | The LTI service: LTI 1.3 launch, Deep Linking, grades (AGS), registration, REST API for the listed LTIAAS-style endpoints |
| `services/cogniate-app` | The stand-in Cogniate app: portal API, tool pages, content host, score sync |
| `apps/portal`, `apps/player` | The portal UI and the course player |
| `packages/` | Shared code, the package inspector, the tracking rules |
| `infra/` | The local Docker stack and its commands ([`infra/README.md`](infra/README.md)) |
| `tests/` | The QA acceptance and end-to-end tests (a separate npm project) |
| `docs/` | Architecture, reviews, guides and the human review pack |

## Rules

- Team roles and the review process: [`docs/team/charter.md`](docs/team/charter.md). Design: [`docs/architecture/README.md`](docs/architecture/README.md).
- No real secrets in git. `npm run gen-env` makes local dev secrets in `.env` (git-ignored).
- Do not push. Do not sign up for third-party services from this project.
