# Local stack

Status: T0 round 2. Decision: [ADR-005](adr/ADR-005-local-topology-tls-cookies.md). Commands: `infra/README.md` (owned by the Author). The goal: the browser sees the same sites, TLS and cookie rules as production. There is no "dev mode" that turns off a check.

## 1. Topology

```mermaid
flowchart LR
    subgraph Host [Developer Mac]
      HB["npm run demo:browser<br/>throwaway Chrome profile"]
    end
    subgraph Net ["compose network (STACK_SUBNET, default 172.28.0.0/16)"]
      PX["proxy: Caddy, static dev certificate<br/>aliases moodle.test, lti.cogniate.test,<br/>app.cogniate.test, content.cogniate-content.test"]
      LT[lti-service :4100]
      AP["cogniate-app :4200 app, :4201 content"]
      MO["moodle :8080 http, SSLPROXY"]
      PG[(postgres)]
      E2[e2e: Playwright 1.56.0]
      SK["sink: evil.test<br/>acceptance profile"]
      QP["qa-platform.test static files<br/>acceptance profile"]
    end
    HB -- "127.0.0.1:443" --> PX
    E2 -- "https *.test" --> PX
    MO -- "tool JWKS" --> PX
    LT -- "Moodle auth, token, AGS" --> PX
    AP -- "LTI service API" --> PX
    PX --> LT
    PX --> AP
    PX --> MO
    PX --> SK
    PX --> QP
    MO --> PG
```

## 2. Names and URLs

Code and tests read the four values. No URL literal is allowed in code.

| Variable (`.env`) | Default | Upstream | Production analog | Site |
| --- | --- | --- | --- | --- |
| `PUBLIC_MOODLE_URL` | `https://moodle.test` | `moodle:8080` | `school.moodlecloud.com` | `moodle.test` |
| `PUBLIC_LTI_URL` | `https://lti.cogniate.test` | `lti-service:4100` | `lti.cogniate.ai` | `cogniate.test` |
| `PUBLIC_APP_URL` | `https://app.cogniate.test` | `cogniate-app:4200` | `dev-portal.cogniate.ai` | `cogniate.test` |
| `PUBLIC_CONTENT_URL` | `https://content.cogniate-content.test` | `cogniate-app:4201` | a separate content domain (Q10) | `cogniate-content.test` |

Site check: `moodle.test` and `cogniate.test` are different sites. So the stack exercises the cross-site POST from `auth.php`, the cross-site deep-linking return, and `SameSite=None` on the state cookie. The spike layout (`localhost:8080` and `localhost:3000`) is same-site and hides these paths (spike §7).

| Item | Rule |
| --- | --- |
| Ports | Only the proxy publishes `127.0.0.1:${PUBLIC_PORT:-443}`. If `PUBLIC_PORT` is not 443, every URL gets `:PORT`, and seed adds the port to Moodle `curlsecurityallowedport`. |
| DNS | Docker network aliases on the proxy. We do not use `*.localhost`: Chromium and musl map it to loopback (spike §6). |
| TLS | `gen-env` makes a dev CA (Name Constraints `permitted DNS:test`, life ≤ 1 year) and one leaf certificate (SAN = the four names) with `openssl`, **before** any container starts. Files in `infra/.certs/` (git-ignored). `stack:reset` keeps them. Caddy loads the static leaf (no `tls internal`). |
| Trust | Moodle: `$CFG->dataroot/moodleorgca.crt` = Alpine CA bundle + root (Moodle reads it first). Node: `NODE_EXTRA_CA_CERTS`. e2e Chromium: NSS database. Human: `npm run demo:browser` (accepts only our leaf) or a manual keychain trust. |
| Moodle | `SITE_URL = PUBLIC_MOODLE_URL`, `SSLPROXY=true`. So `MoodleSession` is `Secure`. |
| Moodle dev-only | `curlsecurityblockedhosts` = the Moodle default list with only `STACK_SUBNET` cut out (`172.16.0.0/12` is split around it; every other default entry stays). `curlsecurityallowedport` = `443` only (plus `PUBLIC_PORT` if it is not 443; port 80 is removed). Inside the subnet only the proxy listens on 443, so Moodle can reach only the proxy. `noemailever=1`. MoodleCloud does not need these: production tool URLs are public https on 443. |
| Node | `node:24-alpine` containers, repo mounted, `node --watch`. Unit tests run on the host. |
| State | All state is in the checkout: `.env`, `infra/.certs/`, `infra/.secrets/` (incl. `seed.json`), `infra/.logs/`, `infra/.data/`, `.tmp/`. Plus Docker volumes named after `COMPOSE_PROJECT_NAME`. |
| Second stack | `COMPOSE_PROJECT_NAME`, `PUBLIC_PORT`, `STACK_SUBNET` let QA run a clean clone next to the Author's stack (charter §3a). |

## 3. Profiles

| Profile | Adds | Used by |
| --- | --- | --- |
| default | proxy, postgres, moodle, lti-service, cogniate-app | everything, T7 |
| `test` | `e2e` container | `test:acceptance`, `test:e2e` |
| `acceptance` (from T2b; start: `STACK_PROFILE=acceptance npm run stack:up`) | `sink` (alias `evil.test`): answers 200 to every request and logs `sink_hit {host, method, path}` to `infra/.logs/sink.jsonl`. `qa-platform.test`: `https://qa-platform.test/<path>` serves `tests/fixtures/qa-platform/<path>` (`.json` as `application/json`), and logs `qa_platform_hit {method, path}` to `infra/.logs/qa-platform.jsonl`. QA writes its JWKS there at run time and git-ignores the generated files (no test private key in git). Both names get a second leaf certificate (`infra/.certs/qa.crt`, SAN `evil.test`, `qa-platform.test`, signed by the same dev CA), so the T1 leaf does not change. Both names are added to `OUTBOUND_PRIVATE_HOST_ALLOWLIST` of both services in this profile only. `/healthz` and `service_started` show `"profile": "acceptance"` and the active allowlist. | T2b to T5b acceptance runs |

`npm run test:acceptance -- <args>` does these steps: (1) `STACK_PROFILE=acceptance npm run stack:up` (only the changed services restart); (2) run the QA suite in `e2e` with `<args>` and the caller's `QA_*` env (H14); (3) `npm run stack:up` without `STACK_PROFILE` to restore the default, also when the suite fails. If a run is killed between (1) and (3), the profile stays on: `/healthz` shows `"profile": "acceptance"`, and step (3) by hand restores the default.

T7 runs with `"profile": "default"` and no test knobs (AC-T7-13).

## 4. Fallbacks

The Author does not choose a fallback alone. The Lead decides at the time-box.

| # | When | Change | ACs |
| --- | --- | --- | --- |
| F1 | Caddy cannot load the static certificate | Small Node TLS proxy with the same `infra/.certs/` files, names and ports | none change |
| F2 | Moodle does not work behind the proxy with `SSLPROXY` | Moodle on `http://moodle.test` through the proxy. Record the Chrome "insecure form" risk on the deep-linking return. | AC-T1-07 (cookie not `Secure`). Deep-linking ACs may fail: Lead decides. |
| F3 | HTTPS costs more than the time-box (needs a Lead decision) | Spike layout: http, `localhost`, Node and Playwright in Moodle's network namespace | See the table below. Human-review item: "cross-site cookie path not tested". |

ACs that change or become N/A under F3:

| AC | Under F3 |
| --- | --- |
| AC-T1-03, LC-T1-01, AC-T1-13 | N/A (no TLS) |
| AC-T1-07 | N/A (`MoodleSession` without `Secure`) |
| AC-T2-08 | Cookie without `__Host-`, `Secure`, `SameSite=None`, `Partitioned` (not allowed on http) |
| AC-T4-01 | Cookie without `__Host-` and `Secure` |
| AC-T5-01, AC-T5-03 | Origins `http://localhost:4201` and `http://localhost:4200` |
| AC-T5-17 | App and content are the same site: the cookie-isolation claim (security §1) is not tested |
| AC-T7-07 | Final URL `http://localhost:4200/play/...` |

## 5. Facts from the Author spike that this design uses

Source: `infra/moodle/SPIKE-NOTES.md`.

| Fact (spike section) | Design consequence |
| --- | --- |
| Moodle 5.2.4 ready in about 31 s. CLI at `/var/www/html/admin/cli`. (§1, §2) | Provisioning uses CLI PHP. Reset is cheap. |
| Issuer = wwwroot. Deployment id = tool type id. Login sends `client_id` and `lti_deployment_id`. (§5a, §5d) | Login checks `iss` + `client_id` + deployment. |
| `id_token` `exp = iat + 60 s`. (§5d) | 60 s skew. Validate at once. |
| Dynamic registration: new tool PENDING, embed, preconfigured only; choice page if the domain exists. (§5b) | Wizard shows Activate + edit. The service and app handle "update". |
| `lti_add_type` from CLI works. (§5a) | T2a dev seed without UI. |
| AGS score → gradebook 80/100. NRPS without name or email. (§5d) | ADR-010 mapping. Privacy default works. |
| Moodle curl blocks private IPs and allows ports 80/443. (§6) | Dev-only change: only `STACK_SUBNET` is cut out of the block list, only port 443 allowed. Production needs public https on 443. |
| `MoodleSession` is `SameSite=Lax`, fixed in code; `auth.php` re-posts. (§7) | Our cookies handle only our side. |
| Native SCORM upload and `.mbz` backup work; restore elsewhere not verified. (§8) | Native channel stays stretch. |
