# Cogniate × Moodle integration prototype

This prototype publishes Cogniate courses (SCORM 1.2 and HTML) to Moodle with LTI 1.3. It has its own LTI service, a clean-room implementation of the 1EdTech specifications. For the endpoints listed in ADR-003, its API follows the public LTIAAS API reference, with listed differences.

**Status:** all 15 end-to-end checks passed on real Moodle 5.2.4. The final regression at `dd6dd11` also passed ([T7 QA §9](docs/reviews/T7/qa.md#9-final-regression-run-dd6dd11-final-code)). Portal QA passed 14 checks; the listed LTIAAS-style endpoints passed 7 checks with the real `ltiaas` SDK. T8 round 2 passed AC-T8-02 to AC-T8-10 and both race checks at `8059c31` ([T8 QA](docs/reviews/T8/qa.md)). MoodleCloud, restore through Moodle pages, and the portal token form remain unverified.

## Start here

- **Product team:** read [`docs/human_review/START-HERE.md`](docs/human_review/START-HERE.md). It takes about 30 minutes with the video, the explainer page and the decisions.
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

QA measured 36 seconds for `e2e:reset` and 9.3 seconds for `demo:prepare` (AC-T7-15). The Lead accepted QA’s fresh-clone run for AC-T9-01: both login pages opened in 61 seconds. Unfamiliar-human usability remains unproven (HR-2). Then open the stack in a browser: see the run guide, procedure 3.

## Guides

| Guide | For |
| --- | --- |
| [Run the stack](docs/guides/run-the-stack.md) | Start, open, reset and stop the local stack |
| [Moodle admin](docs/guides/moodle-admin.md) | Connect a Moodle site (automatic or manual) |
| [Teacher](docs/guides/teacher.md) | Add a Cogniate course to a Moodle course |
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
