# Cogniate × Moodle integration prototype

This prototype publishes Cogniate courses (SCORM 1.2 and HTML) to Moodle with LTI 1.3. It has its own LTI service, with an API in the same shape as the public LTIAAS API (a clean-room implementation of the 1EdTech specifications).

**Status:** the full end-to-end test passed on a real Moodle 5.2.4 site, 15 of 15 checks, three runs in a row ([`docs/reviews/T7/qa.md`](docs/reviews/T7/qa.md)). The portal details (T6), the LTIAAS-style API (T3c) and the native `.mbz` channel (T8) are in final QA.

## Start here

- **Product team:** read [`docs/human_review/START-HERE.md`](docs/human_review/START-HERE.md). It takes about 30 minutes with the video, the explainer page and the decisions.
- **People who run it:** read [`docs/guides/run-the-stack.md`](docs/guides/run-the-stack.md).

## Quick start (Mac, Docker Desktop, Node 24)

The two course zips must be in `docs/raw/data/courses/` (they are not in git).

```sh
npm ci
npm run fixtures:check
npm run gen-env
npm run e2e:reset      # WARNING: deletes the local Moodle site and the local Cogniate data
npm run demo:prepare   # connection, two published courses, two Moodle activities
```

QA measured 36 seconds for `e2e:reset` and 9.3 seconds for `demo:prepare` (AC-T7-15). Then open the stack in a browser: see the run guide, procedure 3.

## Guides

| Guide | For |
| --- | --- |
| [Run the stack](docs/guides/run-the-stack.md) | Start, open, reset and stop the local stack |
| [Moodle admin](docs/guides/moodle-admin.md) | Connect a Moodle site (automatic or manual) |
| [Teacher](docs/guides/teacher.md) | Add a Cogniate course to a Moodle course |
| [Learner view](docs/guides/learner-view.md) | What a learner sees, and what happens when… |
| [Native channel](docs/guides/native-channel-moodlecloud.md) | Put a course into Moodle as a normal Moodle course (pending QA) |
| [Troubleshooting](docs/guides/troubleshooting.md) | Symptoms and fixes |

## Repository map

| Folder | Content |
| --- | --- |
| `services/lti-service` | The LTI service: LTI 1.3 launch, Deep Linking, grades (AGS), registration, LTIAAS-style REST API |
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
