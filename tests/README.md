# QA tests (black-box)

Owner: QA. This is a separate npm project, not a root workspace (charter §1). The tests come from the task acceptance criteria, not from the product code.

## Layout

| Path | Content |
| --- | --- |
| `acceptance/lib/` | Shared helpers: paths, `.env` and public URLs, HTTPS with the stack CA, Moodle WS client, `seed.json` reader, JSON log reader, Playwright fixture that blocks hosts outside the stack |
| `acceptance/T1/*.test.ts` | Vitest API tests (run in the `e2e` container) |
| `acceptance/T1/*.spec.ts` | Playwright browser tests (run in the `e2e` container) |
| `host/run-t1.mjs` | Host runner for T1: clone, Docker checks, reset, then the in-container suite. Node built-ins only. |
| `e2e/` | T7 scenarios (later) |

Each test title starts with its id: `AC-Tn-NN` (task spec), `LC-T1-NN` (Lead-approved change, not yet in T1.md) or `Hn` (test hook).

## Run a T1 verification round (host)

Run from the QA working copy. The runner clones the SHA into `~/cogniate-qa-runs/…`, runs its own stack next to the Author's stack, and removes it (containers, volumes, networks) at the end.

```sh
COMPOSE_PROJECT_NAME=qa-t1-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
  node tests/host/run-t1.mjs --sha <commit>
```

- Options: `--help`. Evidence goes to `tests/host/artifacts/<run id>/` (git-ignored, secrets redacted). `summary.json` has every result.
- Safety: the project name must start with `qa-`. The runner stops before any `stack:reset`, `stack:down` or e2e command if the stack does not run under that project. Its own cleanup removes only resources with that project label.

## Run the in-container suite only

From the repo root of a checkout with a running stack: `npm run test:acceptance` (the Author's script runs `npm ci --prefix tests && npm --prefix tests run acceptance` in the `e2e` container).

| Env variable | Use |
| --- | --- |
| `QA_TASK=T1` | Run one task folder only |
| `QA_IGNORE_HTTPS_ERRORS=1` | ADR-005 fallback for Chromium. qa.md must say when it is used. |
| `QA_REPO_ROOT`, `QA_CERTS_DIR`, `QA_SECRETS_DIR`, `QA_LOGS_DIR`, `QA_ENV_FILE` | Change the default paths (`<repo>/infra/.certs`, `.secrets`, `.logs`, `<repo>/.env`) |

## Where each T1 check runs

| Host runner (needs Docker or git) | In-container suite |
| --- | --- |
| AC-T1-01, -02, -05, -09, -10, -11, -12 (seed twice), -13; LC-T1-01 (cert files, kept by reset), LC-T1-03 to -06; H1, H2 (web login), H3, H8 (not a workspace, canary) | AC-T1-03, -04, -06, -07, -08, -10 (course set), -12 (no duplicates); LC-T1-01 (served certs), LC-T1-02; H2, H4, H7, H8 (mounts, CA env) |

`LC-T1-04` (`npm run demo:browser`) is a manual check: it opens a Chrome window.

## seed.json reader

The Lead fixed the content of `infra/.secrets/seed.json`, not the key names. So `acceptance/lib/seed.ts` (and `host/lib.mjs`) find items by shape: a user is an object with `username`, `password` and `id`; a course id is a `COGNIATE-DEV-10x` key or a `{ shortname, id }` object; a WS token is a 32-character hex string, and the oracle token has `oracle` in its key path.
