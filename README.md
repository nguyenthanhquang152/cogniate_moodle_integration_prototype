# Cogniate × Moodle integration prototype

This prototype publishes Cogniate courses (SCORM 1.2 and HTML) to Moodle with LTI 1.3. It has its own LTI service, a clean-room implementation of the 1EdTech specifications. For the endpoints listed in ADR-003, its API follows the public LTIAAS API reference, with listed differences.

**Status:** all 15 end-to-end checks passed on real Moodle 5.2.4. Three fresh runs passed at `c5683f8`, after the grade repair ([T7 QA §10](docs/reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19)). Portal QA passed 14 checks; the listed LTIAAS-style endpoints passed 7 checks with the real `ltiaas` SDK. T8 round 2 passed AC-T8-02 to AC-T8-10 and both race checks at `8059c31` ([T8 QA](docs/reviews/T8/qa.md)). MoodleCloud, restore through Moodle pages, and the portal token form remain unverified.

## Supported LMS

Canvas and Blackboard phase: branch `nguyenthanhquang152/lti-multi-lms`, 2026-10-22. Documentation remains a **draft**, based on `82aff91`. Final source stamp and approval are pending.

Candidate under validation: C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360`. Tests tree: `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`.

The Lead accepted full2 round 1: 488/488 cases, including independent Canvas judgments for 233/233 cases ([handoff](docs/team/model-transition-2026-10-22.md)). This is one round only. Final acceptance needs the second round, exact case equality, legacy groups, final isolation checks and cleanup. Fresh M2/T7, Architect conformance, independent Docs QA and two final reviews also remain pending.

| LMS | Claim | Evidence label |
| --- | --- | --- |
| Moodle 5.2.4 (local container) | Connect, publish, Deep Linking, SCORM and HTML grades passed end to end. | `MOODLE-LIVE` |
| MoodleCloud | Not tested (Q5). | — |
| Canvas, Instructure-hosted | Implemented and tested against a signed simulation only. Not yet tested on a real Canvas site. | `SIM`; `CANVAS-HOSTED` rows `UNVERIFIED` (B-1) |
| Canvas, self-hosted | Implemented and tested against a signed simulation only. Not yet tested on a real Canvas site. | `SIM`; `CANVAS-LOCAL` row L-C13 deferred and `UNVERIFIED` |
| Blackboard Learn | Implemented and tested against a signed simulation only. Not yet tested on a real Blackboard site. | `SIM`; `BLACKBOARD-LIVE` rows `UNVERIFIED` (B-2, B-3) |

### Evidence labels

The guides tag each step with one of these labels. This table gives the current status of each label.

| Label in a guide | Meaning | Status on 2026-10-22 |
| --- | --- | --- |
| `MOODLE-LIVE AC-T7-…` | End-to-end test on the local Moodle 5.2.4 container | PASS in three runs at `c5683f8` and in one run at `aff4882` ([T7 QA](docs/reviews/T7/qa.md#m3-checkpoint-update--final-candidate-aff4882-t7-pass)). Fresh T7 on C4: pending. |
| `MOODLE-LIVE AC-M1-23`, `AC-M1-30` | Upgrade and rollback on the local Moodle container (host runner) | C4 full2 round 1: cited cases PASS within the 12/12 migration results ([Lead checkpoint](docs/team/multi-lms-plan.md)). Final two-round acceptance: pending. |
| `SIM AC-M2-…` | Portal browser test against a signed simulation (fixed `.sim.test` hosts) | 64 of 64 PASS at `aff4882` ([M2 QA](docs/reviews/M2/qa.md#9-round-8--fifth-frozen-m2-run-at-aff4882-2026-10-20)). Fresh M2 on C4: pending. |
| `SIM AC-M1-…` | API and launch test against a signed simulation | C4 full2 round 1: 394/394 `sim` rows and 12/12 snapshot rows PASS ([Lead checkpoint](docs/team/multi-lms-plan.md)). Independent Canvas judgment: 233/233 PASS. Final two-round acceptance: pending. |
| `SIM AC-M1-41` | Storage commands (ADR-012) | C4 full2 round 1: all 72 rows PASS, including 2 migration rows and 70 storage rows ([Lead checkpoint](docs/team/multi-lms-plan.md)). Final acceptance: pending. |
| `HOST-QA` | Host-only QA with simulated Docker answers | Storage-command QA Round 2 PASS at `9f8ac62` ([report](docs/reviews/M1/storage-command-qa.md)). No runtime credit. |
| `DOC F-…` | A fact from provider documentation ([research](docs/research/multi-lms.md)) | Proves nothing about our code. |
| `UNVERIFIED L-…` | A live check on a real LMS ([M3 live matrix](docs/architecture/tasks/M3.md#5-live-check-matrix)) | All 32 rows `UNVERIFIED`. Blockers: B-1, B-2, B-3. |
| `PROCESS` | A human step with no product behaviour to test, for example the operator's request check (Q22) | — |
| `Not verified by QA` | Only the builder checked it | — |

A tag can name one QA case instead of a criterion, for example `SIM M1-19.canvas.inline-key`. The case has the status of its criterion row above.

`SIM` means a signed simulation of the LMS. It tests our protocol handling, not real LMS behaviour.

Earlier failed attempts and environment deviations remain in [M1 QA](docs/reviews/M1/qa.md) and the [phase plan](docs/team/multi-lms-plan.md). Diagnostic and host-only passes give no full acceptance credit. The 12 legacy groups use their documented fixtures and knobs, followed by default-profile checks with no knobs.

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
| [Canvas admin](docs/guides/canvas-admin.md) | Connect a Canvas site (draft; not yet tested on a real Canvas site) |
| [Blackboard admin](docs/guides/blackboard-admin.md) | Connect a Blackboard Learn site (draft; not yet tested on a real Blackboard site) |
| [Operator](docs/guides/operator.md) | Cogniate staff: approval codes, suspend and release, upgrade and rollback (draft) |
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
