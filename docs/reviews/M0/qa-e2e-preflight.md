Verdict: PREFLIGHT COMPLETE — environment and harness only, no product verification
Round: 1

# M0-QE: QA-E2E environment and test preflight

Task: M0-QE (Blackboard and Canvas phase). Role: QA-E2E, Claude Code Opus 5.5, xhigh. Dispatch `ctx_3c4961a02f14`.
Branch: `nguyenthanhquang152/lti-multi-lms`, HEAD `e280173` at the time of reading. Inventory time: 2026-10-20 04:59 UTC.

This file is a plan and an inventory. It does not verify product behavior. It does not define acceptance criteria. The Architect writes them.

## 0. Rules for this preflight

- I did not start, stop or reset a stack. I did not install Canvas. I did not create accounts, send external messages, or open a public tunnel.
- I read: the charter, `docs/team/multi-lms-plan.md`, `docs/architecture/tasks/T7.md`, `docs/architecture/local-stack.md`, the `tests/**` harness, the infra scripts that the QA runners call (resource control only), and the timings in `docs/reviews/T7/qa.md`.
- I did not read: Author or Author-2 notes, new M0 architecture or new implementation (none was committed at `e280173`), or LTIAAS documentation.
- Independence (charter §1): future QA-E2E tests come from the approved acceptance criteria. I read the Author notes only after I write those tests.

## 1. Baseline resources (read-only)

| Item | Value at 04:59 UTC |
| --- | --- |
| Host | macOS 27.0.1, arm64, 12 CPUs, 32 GiB RAM. Free disk: 773 GiB on the data volume. |
| Docker | Docker Desktop, engine 29.8.2 (linux/arm64), Compose 5.6.0, context `desktop-linux`. VM: 12 CPUs, **7.75 GiB memory** (8,319,238,144 bytes). The disk image uses 12 GB on the host. |
| Containers | **0 running, 0 stopped.** |
| Volumes (other owners, keep) | 7: `cogniate-codex_{moodledata,pgdata}`, `cogniate-codex2_{moodledata,pgdata}`, `cogniate-stack_{e2e_tests_node_modules,moodledata,pgdata}`. |
| Networks | Only `bridge` (172.17.0.0/16), `host`, `none`. No compose network exists. |
| Images | 35 images, 6.917 GB in total (1.477 GB reclaimable). Build cache 5.544 GB. All base images for a Moodle stack are present: `caddy:2.11.7-alpine`, `postgres:16-alpine`, `erseco/alpine-moodle:v5.2.4`, `node:24.22.0-alpine3.24`, `mcr.microsoft.com/playwright:v1.56.0-noble`, `cogniate-build-moodle:v5.2.4`, `python:3.12-slim`. 22 old per-project `*-e2e:1.56.0` images remain from earlier QA runs (see G-1). |
| Ports on 127.0.0.1 | 443, 8443, 8543, 8643, 8743: all free. |
| Host routes to avoid | 192.168.1.0/24 (LAN) and 100.64.0.0/10 (VPN). Use a 172.2x.0.0/16 stack subnet. |
| Tools | Node 24.21.0, npm 11.19.0, git 2.56.0, `/usr/bin/script`, `/usr/bin/openssl`. npm cache: 630 MB. |
| Earlier QA clones | `~/cogniate-qa-runs/`: 78 folders, 6.5 GB. Not mine to delete. |
| Course fixtures | Not in this worktree. Present in the main checkout `/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses/`. Both SHA-256 values equal the values in `tests/e2e/host/run-t7.mjs` (`a685744e…` SCORM, `9f04d3ab…` HTML). |
| Worktree state | No `.env`, no `infra/.certs`, no `node_modules`. One untracked file: `pnpm-workspace.yaml` (not mine). |

## 2. Reusable Moodle regression commands

Run each command from a QA working copy that has the `tests/` folder of the target SHA or newer. Each runner clones the SHA into `~/cogniate-qa-runs/<run id>` and runs its own stack there (charter §3a).

`FIX=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses`

| # | Purpose | Command | Baseline (earlier PASS) |
| --- | --- | --- | --- |
| R1 | Root check, no fixture skip | In a fresh clone of the SHA: `npm ci && COURSE_FIXTURES_DIR=$FIX npm run check` | 48 files, 708 tests, 0 skips at `3f934ee`. Without `COURSE_FIXTURES_DIR`, 5 tests skip. The new phase changes these counts. |
| R2 | Full T7 Moodle regression (owner: QA-E2E) | `COMPOSE_PROJECT_NAME=qa-e2e-m3-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 COURSE_FIXTURES_DIR=$FIX node tests/e2e/host/run-t7.mjs --sha <SHA> --runs 3 --demo --check-confirm` | Per run: 183–188 s, of which `e2e:reset` took 41–42 s. 17 pass, 1 skip (the demo check runs in the demo pass). Demo pass: `e2e:reset` 36–49 s, `demo:prepare` 8.3–9.3 s. Source: `docs/reviews/T7/qa.md`. |
| R3 | T7 with a newer QA suite than the SHA | Add `--replace-e2e` to R2. The runner records the diff of `tests/e2e` against the SHA. | — |
| R4 | Moodle protocol suites (owner: QA; QA-E2E runs them only on a Lead request) | `COMPOSE_PROJECT_NAME=qa-<task>-r<N> PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 [COURSE_FIXTURES_DIR=$FIX] node tests/host/run-<t2\|t3c\|t4a\|t4b\|t5\|t8>.mjs --sha <SHA>` | T2a/T2b/T3a/T3b, T3c, T4a, T4b1/T4b2, T5a/T5b/T6, T8. Each uses the `acceptance` profile and knob passes. |

Notes:

- R2 is the regression gate for "keep the existing Moodle flow". It runs with the `default` profile and no knobs (AC-T7-13).
- R2 makes `npm ci` and image builds. The first run needs the npm registry unless the cache has every package.
- The runner refuses a project name that does not start with `qa-e2e`. It refuses a busy port, an overlapping subnet, or a project that already has resources.
- `--keep` leaves the stack up for debugging. Use it only when the Lead asks.

## 3. Isolated stack controls and cleanup

### 3.1 Proposed allocation (the Lead decides)

| Stack | `COMPOSE_PROJECT_NAME` | `PUBLIC_PORT` | `STACK_SUBNET` |
| --- | --- | --- | --- |
| QA-E2E Moodle regression (R2) | `qa-e2e-m3-r<N>` | 8543 | 172.31.0.0/16 |
| QA-E2E provider simulation smoke (L1) | `qa-e2e-sim-r<N>` | 8643 | 172.27.0.0/16 |
| QA acceptance (R4) | `qa-<task>-r<N>` | 8443 | 172.29.0.0/16 |
| Author and Author-2 stacks | Saved in their own `.env`. QA-E2E did not read those files (they hold secrets). | — | — |

In the earlier phase, QA stacks ran next to ten baseline containers (two other stacks). Docker has 7.75 GiB. `npm run stack:doctor` asks for 6 GB or more. So run two stacks at most at the same time. Do not run a local Canvas next to them (section 6). The runner preflight still refuses a busy port or an overlapping subnet.

### 3.2 Controls that exist

| Control | Where |
| --- | --- |
| Stack identity (`COMPOSE_PROJECT_NAME`, `PUBLIC_PORT`, `STACK_SUBNET`) is saved in `.env`. A different shell value stops the command. | `infra/scripts/lib.sh:16-31` |
| `stack:reset` refuses a project that belongs to another checkout. | `infra/scripts/lib.sh` `require_own_project` |
| `e2e:reset` and `test:e2e` ask for "yes". Without a terminal they need `--yes` or `E2E_CONFIRM=1`, else they stop. | `infra/scripts/e2e-reset.sh`, `qa-suite.sh` |
| Teardown removes only containers, volumes and networks with the label `com.docker.compose.project=<project>`. | `tests/e2e/host/run-t7.mjs` `teardown()`, `tests/host/core.mjs:319` |
| The core runners report other projects' containers that stopped or restarted. | `tests/host/core.mjs:326-331` |

### 3.3 Cleanup gaps (QA-E2E closes them for its own runs only)

| Id | Gap | Action after each QA-E2E run |
| --- | --- | --- |
| G-1 | Teardown does not remove the per-project image `<project>-e2e:1.56.0`. | `docker image rm <own project>-e2e:1.56.0`. Never remove a shared base image or `cogniate-build-moodle:v5.2.4`. |
| G-2 | The clone stays in `~/cogniate-qa-runs/<run id>`. It holds `.env`, `infra/.secrets`, the dev CA key and the bind-mount data. | Copy the redacted evidence first. Then remove only the clone folders whose run ids this phase recorded. |
| G-3 | `tests/e2e/artifacts/` holds Playwright traces with raw test secrets. | Keep them out of commits (git-ignored) and out of review packs. Share screenshots and the redacted JSON only. |
| G-4 | `stack:up` starts a host-side Build Runner process. `stack:down` stops it. | After teardown: no `build-runner.sh` process and no `cogniate-build-*` resource for the own project. |

Before and after each run, record this snapshot. The other owners' 7 volumes must not change.

```sh
docker ps -a --format '{{.Names}}|{{.Status}}|{{.Label "com.docker.compose.project"}}'
docker volume ls --format '{{.Name}}|{{.Label "com.docker.compose.project"}}'
docker network ls --format '{{.Name}}|{{.Label "com.docker.compose.project"}}'
docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}'
docker system df
```

## 4. Three validation levels

Each evidence file names its level in its first line. A PASS at one level is not a PASS at another level.

| Level | Environment | What it can prove | What it cannot prove | Evidence label |
| --- | --- | --- | --- | --- |
| L1 | Signed platform simulation inside a QA stack (`*.test` names, dev CA) | The tool's protocol rules: signatures, claims, issuer and deployment separation, tenant isolation, SSRF refusals, replay, Deep Linking response format, AGS calls. Repeatable. | That a real Canvas or Blackboard accepts our messages, shows our tool, or stores our grades. Real UI labels and real endpoint behavior. | `SIMULATION — not a live LMS` |
| L2 | Local open-source Canvas (only if the Lead approves, section 6) | The real Canvas code for developer keys, Dynamic Registration, launch, Deep Linking and AGS, at one recorded Canvas commit. | Instructure-hosted behavior: the `sso.canvaslms.com` hosts, cloud keys, feature flags, release changes, institution policy. Any Blackboard fact. | `LOCAL CANVAS OSS <commit> — not Instructure-hosted` |
| L3 | Hosted Canvas or Blackboard tenant that the owner authorizes | Live interoperability for that tenant, version and date. | Other tenants and later releases. | `LIVE <LMS> <tenant> <date>` |

Blackboard has only L1 and L3. I found no open-source or local Blackboard Learn in the official documentation that I read.

## 5. Smallest useful browser smoke for each level

Each smoke stops at the first grade. The Architect's criteria decide the full test set.

| Level | Smoke steps | Oracle |
| --- | --- | --- |
| L1 Canvas profile | (1) Portal: connect a "Canvas" provider with a site URL, an issuer that differs from the site URL, and separate auth, token and JWKS hosts. (2) The simulator starts a teacher Deep Linking launch in Chromium. (3) The teacher picks one course. The simulator receives the signed response and checks it with the tool JWKS. (4) The simulator starts a learner launch for that link. The learner completes the course. (5) The simulator receives one AGS score. | Simulator log: the received Deep Linking item and the score. Tool logs: no secret (Scenario C style grep). |
| L1 Blackboard profile | The same five steps, with a shared issuer and client id and two deployment ids. Add one check: a launch with the other tenant's deployment id does not see the first tenant's content. | The same. |
| L2 local Canvas | Admin: add the tool (Dynamic Registration or manual key) and enable it. Teacher: add one assignment through Deep Linking. Student: launch, complete, return. | Canvas gradebook shows the score. Screenshot and Canvas API read by the admin. |
| L3 hosted Canvas | The L2 steps in an authorized test or beta Canvas instance, with accounts that the owner gives. | Canvas gradebook. Evidence names the instance and date. |
| L3 hosted Blackboard | Admin: register the tool by its Developer Portal client id and record the deployment id. Teacher: add the content in one course. Student: launch, complete. | Blackboard Grade Center. Evidence names the tenant and date. |

## 6. Local open-source Canvas: feasibility

Sources: the `instructure/canvas-lms` repository (`master`, last push 2026-04-30, AGPL-3.0), files `doc/docker/*`, `doc/lti/11_testing.md`, `doc/api/lti_launch_overview.md`, `config/*.example`, and the wiki "Quick Start".

| Fact | Source | Effect here |
| --- | --- | --- |
| Docker setup: `./script/docker_dev_setup.sh`. The wiki asks for 150 GB free disk, 8 GB RAM and four CPU cores. The Docker doc asks for "at least 8GB" Docker memory. | Wiki Quick Start; `doc/docker/getting_docker.md:32` | Disk and CPU are enough. Docker memory is 7.75 GiB now, below the ask, and our Moodle stack needs 6 GB more. |
| The base image `instructure/ruby-passenger:3.4-jammy` has an arm64 build. | `Dockerfile:7`; registry manifest | A native arm64 build is possible. Build time is not stated in the docs. |
| Services: `web`, `jobs`, `postgres`, `redis`. Default URL `http://canvas.docker/`, through dory or a similar proxy. | `docker-compose.yml`; `developing_with_docker.md` | Plain HTTP and a `.docker` name. Our dev CA signs `*.test` names only (`infra/scripts/gen-certs.sh:64`). A TLS front with a `*.test` name is necessary. |
| Self-hosted Canvas must set its issuer in `config/security.yml`. The example value is `https://canvas.instructure.com`. | `lti_launch_overview.md:16`; `security.yml.example` | QA must set the issuer on purpose and record it. If the example value stays, a local site claims the Instructure issuer. |
| The example `lti-keys` in `dynamic_settings.yml.example` are 512-bit RSA keys. The file says how to make a new key. | `dynamic_settings.yml.example:205-211` | Make 2048-bit keys before a test. A correct tool should refuse a 512-bit key. |
| A site admin can get an LTI access token at `/api/lti/advantage_token`. | `doc/lti/11_testing.md` | A useful oracle for L2 AGS checks. |

Verdict: **possible, but not ready, and not recommended before L1 passes.** Conditions:

1. The owner raises Docker Desktop memory to about 16 GiB, or Canvas runs alone with no Moodle stack.
2. The Author adds an optional profile: Canvas behind a TLS name such as `canvas.test` (dev CA leaf), Canvas trust of the dev CA, a network path between the stacks, and `canvas.test` in `OUTBOUND_PRIVATE_HOST_ALLOWLIST` for that profile only.
3. QA records the Canvas commit, issuer, keys and feature flags in the evidence.
4. No Canvas code goes into the product (AGPL; clean-room rule).

Not verified: Canvas outbound rules for private addresses, the Dynamic Registration feature flag in a local Canvas, and the first build time.

## 7. Prerequisite and gap matrix

| Prerequisite | L1 sim | L2 local Canvas | L3 Canvas | L3 Blackboard | Status and owner |
| --- | --- | --- | --- | --- | --- |
| Approved acceptance criteria for the providers | Need | Need | Need | Need | GAP. Architect (M0, in progress). |
| Moodle stack images, Node, Docker, fixtures | Need | — | — | — | AVAILABLE (section 1). |
| Dynamic provider simulator service (OIDC auth, token, JWKS, Deep Linking return, AGS, Dynamic Registration) | Need | — | — | — | GAP. Today only a static GET server exists (H-2). Owner: Architect decides the design; Author owns `infra/**`. |
| Extra `*.test` names, leaf certificate SANs and allowlist entries in a test profile only | Need | Need | — | — | GAP. Author (`infra/**`). |
| QA helpers that sign as Canvas or Blackboard (shared issuer, many deployments) | Need | — | — | — | GAP. QA and QA-E2E (`tests/**`), after the criteria. |
| Docker memory ≥ 16 GiB (or Canvas alone) | — | Need | — | — | GAP. Owner decision (machine setting). |
| Canvas install and admin user | — | Need | — | — | Not started (forbidden in this task). Lead decision. |
| Authorized hosted Canvas instance with admin, teacher and student accounts | — | — | Need | — | UNKNOWN. Lead asked the owner; answer pending. |
| Blackboard Developer Portal registration (client id) | — | — | — | Need | BLOCKED for agents: a third-party sign-up. Owner only. |
| Blackboard Learn test tenant with admin, teacher and student | — | — | — | Need | UNKNOWN. Owner. |
| Server-to-server reach from the hosted LMS to the tool (for example a JWKS URL) | — | — | Maybe | Likely | BLOCKED without authorization: needs a public URL. See H-9. |
| Browser that resolves the tool names to the local stack | Have (e2e) | Need | Need | Need | AVAILABLE: `npm run demo:browser` for a human run. |

## 8. Harness assumptions that can block a provider simulator

These are correct for Moodle tests. Do not weaken them. Add a separate, opt-in path where a level needs it.

| Id | Assumption | File | Effect |
| --- | --- | --- | --- |
| H-1 | Chromium resolves only `*.test` names: `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE *.test`. | `tests/playwright.config.ts:42` | Blocks every hosted LMS host (`*.instructure.com`, `sso.canvaslms.com`, Blackboard and Anthology hosts). L3 browser runs need a separate, named host list. L1 is not affected if all simulator names end in `.test`. |
| H-2 | Route guards abort every host outside the stack or `*.test`. | `tests/acceptance/lib/pw.ts:10`, `tests/e2e/lib/pw.ts:18` | Same as H-1, a second layer. |
| H-3 | `qa-platform.test` is a static file server. It answers GET and HEAD only, and 405 to other methods. | `infra/qa-hosts/qa-hosts.mjs:87-89`, `infra/compose.yaml:234` | It cannot be an OIDC auth endpoint, a token endpoint, an AGS endpoint, a Deep Linking return or a registration endpoint. A browser simulation needs a new dynamic service. |
| H-4 | One origin is the issuer, the platform URL, the auth endpoint and the token endpoint. One fixed deployment id. | `tests/acceptance/lib/qa-platform.ts:13-15, 46-50, 174` | Cannot express Canvas (issuer `https://canvas.instructure.com`; auth and JWKS on `sso.canvaslms.com`; site on the school domain) or a shared issuer with many deployments. |
| H-5 | The dev CA can sign only `*.test` names. `qa.crt` covers only `evil.test` and `qa-platform.test`. | `infra/scripts/gen-certs.sh:64`, `infra/compose.yaml:211` | Simulator hosts must be `*.test` and need new SANs (Author). Good side effect: a simulation cannot use a real provider host name, so it cannot pass as live. The `iss` claim may still be any string. |
| H-6 | The private-host allowlist is `moodle.test` (plus `lti.cogniate.test` for the app). The `acceptance` profile adds only `qa-platform.test` and `evil.test`. | `infra/compose.yaml:134, 165`; `infra/scripts/lib.sh:82` | The tool refuses new simulator hosts until a test profile adds them. Add them in a test profile only (plan: do not weaken SSRF checks). |
| H-7 | T7 must run with profile `default` and no knobs. | AC-T7-13; `infra/scripts/qa-suite.sh` | Simulator services must not run in the R2 regression run. Run L1 in its own pass and stack. |
| H-8 | The e2e container has a read-only repo and no inbound route from the proxy. | `infra/compose.yaml` service `e2e` | A simulator inside the test process cannot receive browser or server calls. It must be a compose service with a proxy alias. |
| H-9 | All tool names resolve only inside the compose network or by `demo:browser` on this Mac. | `docs/architecture/local-stack.md` §2 | A hosted LMS cannot call the tool. Browser-only steps can work. A step where the LMS server fetches the tool JWKS or another tool URL needs a public URL (not authorized) or a static key that the admin pastes (the Canvas key configuration has a `public_jwk` field; not verified for Blackboard). |
| H-10 | The T7 learner check expects a new top-level window (`topLevel`, `hasOpener`). | `tests/e2e/lib/e2e.ts:51-52`; AC-T7-07 | Canvas launches in an iframe unless the tool configuration says otherwise, and it has a platform storage path (`lti_storage_target`) (`lti_launch_overview.md:104-129`). Criteria for Canvas must state the window mode. Do not reuse AC-T7-07 as is. |
| H-11 | The grade oracle is Moodle web services (`seed.json` token). | `tests/e2e/lib/oracle.ts`, `tests/acceptance/lib/seed.ts` | L1 needs the simulator to log each received score. L2 and L3 need a provider-side oracle or a screenshot. |
| H-12 | The C2 secret grep reads `infra/.logs/*.jsonl`. | `tests/e2e/3-scenario-c.spec.ts` | A simulator must log to `infra/.logs/` and must register its own tokens for the grep and the redaction. |

## 9. Open items for the Lead

1. Answer from the owner: which hosted Canvas and Blackboard tenants exist, and who may use them.
2. Decide whether L2 (local Canvas) is in scope, and whether the owner raises Docker memory.
3. Ask the Architect to name the simulator design (H-3, H-4) and its test profile, so that the Author and QA owners are clear.
4. Allocate ports and subnets (section 3.1).
5. Approve QA-E2E cleanup of its own clone folders and its own `*-e2e` image after each run (G-1, G-2).

QA-E2E resumes when the reviewed acceptance criteria are ready.

## 10. Evidence for this file

All commands were read-only, except a download of four public Canvas documentation files to `/tmp/qe-canvas-docs/`.

- `docker info`, `docker ps -a`, `docker volume ls`, `docker network ls`, `docker images`, `docker system df`, `docker context ls`.
- `sysctl hw.memsize hw.ncpu`, `df -h`, `lsof -iTCP:<port> -sTCP:LISTEN`, `netstat -rn`.
- `shasum -a 256` of the two course zips.
- `gh api repos/instructure/canvas-lms/contents/<path>`, `docker manifest inspect instructure/ruby-passenger:3.4-jammy`.

## Sources

- Canvas LMS repository: <https://github.com/instructure/canvas-lms> (`doc/docker/developing_with_docker.md`, `doc/docker/getting_docker.md`, `doc/lti/11_testing.md`, `doc/api/lti_launch_overview.md`, `doc/api/lti_dev_key_config.md`, `config/security.yml.example`, `config/dynamic_settings.yml.example`, `Dockerfile`, `docker-compose.yml`)
- Canvas Quick Start: <https://github.com/instructure/canvas-lms/wiki/Quick-Start>
- Blackboard LTI 1.3 OIDC flow: <https://docs.blackboard.com/docs/blackboard/lti/1.3/core/oidc-auth>
- Anthology Developer Portal: <https://developer.anthology.com/>
