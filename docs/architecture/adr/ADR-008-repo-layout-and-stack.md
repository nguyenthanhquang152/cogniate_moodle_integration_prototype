# ADR-008: Repo layout and stack

Status: Accepted (round 2). Date: 2026-10-16.

## Context

One Author builds the code. QA owns `tests/**` as a separate npm project (charter §1). Two reviewers read every diff. Host tools: Node 24, npm (no pnpm), Docker. Pre-pulled images: `erseco/alpine-moodle:v5.2.4`, `postgres:16-alpine`, `mcr.microsoft.com/playwright:v1.56.0-noble`.

## Decision

### Layout

```text
package.json                 npm workspaces: packages/*, services/*, apps/*  (not tests/)
tsconfig.base.json, eslint.config.js, vitest.config.ts   (all exclude tests/**)
.env.example                 names only
services/
  lti-service/src/
    protocol/                login, launch, keys, register (HTML endpoints)
    api/                     /api/* (LTIAAS-shaped)
    platform/                token client, AGS, NRPS, registration client
    domain/                  repositories, launch checks, keys
  cogniate-app/src/
    app/                     /app-api/* (portal API), SPA serving
    tool-pages/              /tool/*, /play/*
    content-host/            /pkg/*, /rt/*  (untrusted boundary)
    worker/                  score sync
    domain/                  repositories, attempts, publications, connections
apps/
  portal/                    React + Vite + Tailwind (static build)
  player/                    browser TS: shell script, SCORM 1.2 runtime, HTML runtime (Vite library build)
  player-spike/              T5-spike throwaway code and SPIKE-NOTES.md (reference only; not built, not shipped)
packages/
  shared/                    modules listed below (a new module needs a reason in the done report)
  tracking/                  pure functions: CMI rules, Moodle LMSFinish rule, outcome, AGS mapping, HTML progress rules
  package-inspector/         zip checks, manifest parsing, HTML profile
infra/                       compose, proxy, Moodle provisioning, scripts (Author)
tests/                       QA only: own package.json and lock file, Playwright and Vitest configs, fixtures
docs/
```

`packages/shared` modules:

| Module | Content | From |
| --- | --- | --- |
| `config` | `loadPublicUrls()` and env parsing | T1 |
| `knobs` | test knob registry (whole-number values; T8 adds string values for `BUILD_RUNNER_FAIL_AT`) | T1 |
| `logger` | JSON lines, redaction, boot trace id | T1 |
| `server` | inbound HTTP helpers and service startup (T1 files `service.ts`, `http.ts`) | T1 |
| `errors` | error shape and codes | T2a |
| `outbound` | SSRF-guarded client (security §9) | T2a |
| `crypto` | AES-256-GCM, token hashing | T2a |

Import rules (ESLint `no-restricted-imports`):

- `cogniate-app/src/content-host/**` may import only `cogniate-app/src/domain/attempts*`, `packages/tracking` and `packages/shared`.
- `packages/tracking` imports nothing from the services.
- No code imports from `tests/**`.

### Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Runtime | Node 24 (`node:24-alpine` in compose) | Type stripping, `node:sqlite` |
| Language | TypeScript, strict, `erasableSyntaxOnly`; services run `.ts` directly | No build step for services |
| HTTP | Fastify 5 (`@fastify/formbody`, `@fastify/multipart`, `@fastify/static` with Range) | Mature, typed |
| Validation | Zod 4 | Types and runtime checks |
| JWT | `jose` 6 (no remote fetch) | ADR-002 |
| Zip / XML / HTML | `yauzl`, `fast-xml-parser` (entities off), `parse5` | Safe parsing |
| SCORM API object | Our own SCORM 1.2 subset in `apps/player` (T5-spike decision; `scorm-again` only as an optional test oracle) | ADR-004 |
| Unit tests | Vitest (host) | One runner, jsdom for player code |
| Acceptance and E2E | `@playwright/test` **1.56.0 exactly**, in the `mcr.microsoft.com/playwright:v1.56.0-noble` image | Must match the browsers in the image |
| Portal | React 19, Vite, Tailwind 4, shadcn-style components, React Router | Same stack as the dev portal |
| Look | Dev-portal CSS variables (`--background: 252 20% 5%`, `--primary: 270 70% 65%`, `--card-border`, `--radius: .75rem`, `--gradient-button`, `--gradient-primary`, sidebar tokens). DM Sans from `@fontsource/dm-sans`. | Looks like the existing portal |

### Front-end dev loop

`npm run dev:web` runs `vite build --watch` for `apps/portal` and `apps/player`. The `cogniate-app` container serves the mounted build folders, so a reload of the browser shows the change on the real `https://app.cogniate.test` origin (the `__Host-` cookie and the `Origin` rule need that origin). No Vite dev server behind the proxy.

### Root scripts (the set grows by task)

`check` (lint + typecheck + unit tests), `build`, `gen-env`, `stack:up`, `stack:down`, `stack:reset`, `stack:restart`, `stack:logs`, `stack:moodle-reach-check`, `stack:node-reach-check`, `seed`, `demo`, `demo:browser`, `fixtures:check`, `test:acceptance`, `test:e2e` (T1); `seed:lti-manual` and argument forwarding of `test:acceptance` (T2a); `STACK_PROFILE=acceptance` (T2b); `seed:lti-activity`, optional `stack:snapshot`/`stack:restore` (T4b2); `dev:web` (T5a); `demo:prepare`, `moodle:cron` (T7); `test:compat` (T3c).

## Consequences

- No `dist/` for services. Imports use `.ts` extensions. No enums, namespaces or parameter properties.
- The untrusted content host has its own folder and import fence, so a reviewer sees any new dependency.
- QA and Author share one Playwright version. An upgrade changes the image and the package together.
