# Operability design (milestone LA)

Status: **Proposed** (P2 design, Architect-2 A2, 2026-10-22). Decisions: [LA-ADR-06](adr/LA-ADR-06-service-operability.md) (E5), [LA-ADR-03 D7](adr/LA-ADR-03-learning-record-core.md#d7-one-job-runner-for-the-outbox-and-the-e5-jobs-must) (job runner), [LA-ADR-07](adr/LA-ADR-07-security-and-tenancy.md), [LA-ADR-08](adr/LA-ADR-08-onboarding-and-connection-health.md). Storage commands: [ADR-012](../adr/ADR-012-sqlite-volume-storage.md) (unchanged in LA, LD-3). Existing operator guide: [`docs/guides/operator.md`](../../guides/operator.md).

This file is the design input for the operator runbook that Docs writes in E8. It says **what** an operator runs and sees. It does not repeat the API details ([contract delta](contracts/lti-service-api-delta.md)). Procedure steps use the imperative and one action per step.

## 1. Scope

| In LA (pilot on one host) | In LG (production platform) |
| --- | --- |
| One compose stack; one LTI service process; one app process (the worker runs in it, or as `npm run worker`) | Several instances, a queue, managed Postgres, cloud KMS, secret manager, ingress with WAF, paging |
| Operator API on a loopback listener; CLIs inside the container | Operator API on a private network with mutual TLS, behind SSO |
| `/metrics` scraped by a local collector (any OpenMetrics reader) | Hosted metrics, traces and log pipeline |
| Cold backup in a maintenance window (ADR-012 §8) | Point-in-time recovery |

## 2. Configuration

New and changed settings (all optional unless marked; the base settings stay as in `infra/compose.yaml` and `.env`):

| Setting | Service | Default | Meaning | Source |
| --- | --- | --- | --- | --- |
| `STACK_PROFILE` | both | `default` | `default`, `acceptance`, or new `production` (fail-closed start rules) | LA-ADR-06 D12 |
| `OPERATOR_HOST`, `OPERATOR_PORT` | LTI | `127.0.0.1`, `4110` (`acceptance` profile: `0.0.0.0`, for the `e2e` container; never routed by the proxy) | operator listener; `/metrics`, `/readyz` with reasons | LA-ADR-06 D3 |
| `LTI_KEYRING_FILE` | LTI | `/run/secrets/lti/keyring.json` (host: `infra/.secrets/lti/keyring.json`) | key ring JSON (`active` + `keys`); no file = `LTI_MASTER_KEY` as version `legacy` | LA-ADR-06 D6 |
| `LTI_MASTER_KEY_FILE`, `APP_MASTER_KEY_FILE` | LTI, app | unset | file forms of the master keys; required form in `production` | LA-ADR-06 D12 |
| `APP_KEYRING_FILE` | app | `/run/secrets/app-keys/keyring.json` (host: `infra/.secrets/app-keys/keyring.json`) | app key ring JSON, the same shape and rules as `LTI_KEYRING_FILE` (BD-A2-77: it must hold `legacy`; `APP_MASTER_KEY` next to it must equal it); no file = `APP_MASTER_KEY(_FILE)` as the active version `legacy`. `production` refuses `APP_MASTER_KEY` as an environment value (`app_master_key_in_env`) (BD-A2-91) | LA-ADR-06 D6 |
| `LTI_RATE_LIMITS` | LTI | built-in table | JSON overrides of the default limits at start; the operator API value (`PATCH /operator/v1/rate-limits`) wins over it | LA-ADR-06 D1 |
| `TRUSTED_PROXY_CIDRS` | LTI | `proxy` (CIDRs or host names; names resolved every 60 s) | peers whose `X-Forwarded-For` counts; required in `production` | LA-ADR-06 D1 |
| `SIGNING_KEY_PUBLISH_LEAD_S` | LTI | `86400` (min `600`) | wait between `next` and activation. Read once at start (`keys/key-config.ts`); a value that is not a whole number ≥ 600 stops the start with one line | LA-ADR-06 D7 |
| `SIGNING_KEY_ROTATE_DAYS` | LTI | `90` | age limit for the alert and for `autoRotate` accounts | LA-ADR-06 D7 A whole number ≥ 8; a bad value stops the start (BD-A2-68). Rotation applies only to accounts with `autoRotate: true` (account field, BD-A2-65). |
| `AUDIT_RETENTION_DAYS` | both | `400` | audit retention (LA-H4) | LA-ADR-06 D4 |
| `CLOSED_ACCOUNT_RETENTION_DAYS` | LTI | `30` | days after the close before the `account-purge` job deletes the account's data (the tombstone row and the audit events stay); a whole number ≥ 1; a bad value stops the start (BD-A2-66, LA-H4) | LA-ADR-06 D2 |
| `JOB_INSTANCE_ID` | both | `lti-1`, `app-1` | lease owner of the job runner (with a random boot id per process). A normal restart (stop, then start) keeps today's timing: `stop()` deletes the heartbeat row. After a crash without `stop()`, the new runner waits up to 30 s before its first send, and the web part serves at once. Only a second **live** process with the same id stops its runner (`job_instance_conflict`: a worker process exits 1; the web process keeps serving with its runner off). The rule holds for both runners (LA-ADR-03 D7, Q-LAD-23) | LA-ADR-03 D7 |
| `APP_JOB_RUNNER` | app | `on` | `off` in the web process when `npm run worker` runs apart; `production` refuses both on | LA-ADR-03 D7 |
| `OPERATOR_NAME` | app | unset | default actor of `app:grant` and `app:binding` | LA-ADR-07 D4 |
| `OPERATORS`, `OPERATORS_FILE` | app | unset | allowed operator names (comma list, or a JSON array file); one of them required when a CLI runs with `STACK_PROFILE=production` | LA-ADR-07 D4 Both set: the CLI refuses (`operators_ambiguous`, BD-A2-45). |
| `PUBLIC_MOODLE_URL` | LTI | — | leaves the LTI service config in E1 (A1, LA-ADR-04 S3) | R4 C-3 |

On the LA compose stack (BD-A2-105): `infra/compose.yaml` gives each service a fixed list of settings and has no `env_file`. A setting that is not in that list does not reach the service, and the service uses its default. So in LA these settings of the table do not reach the services: `LTI_MASTER_KEY_FILE`, `APP_MASTER_KEY_FILE`, `LTI_RATE_LIMITS`, `SIGNING_KEY_PUBLISH_LEAD_S`, `SIGNING_KEY_ROTATE_DAYS`, `CLOSED_ACCOUNT_RETENTION_DAYS`, `APP_JOB_RUNNER`, `OPERATOR_NAME`, `OPERATORS`, `OPERATORS_FILE`, and, for the app only, `AUDIT_RETENTION_DAYS` and `JOB_INSTANCE_ID`. The two key-ring files work, because their defaults are the mounted paths. `TRUSTED_PROXY_CIDRS` is fixed to `proxy`. On the stack:

- Change a rate limit with the operator API (`PATCH /operator/v1/rate-limits`), not with `LTI_RATE_LIMITS`.
- Give an app CLI its operator settings for one run: `docker compose exec -e OPERATOR_NAME=… -e OPERATORS=… cogniate-app …`.
- `npm run stack:restart -- <service> --env` accepts registered test knobs only. It is not a way to set the settings above.
- `production` does not run. The stack scripts save only `default` or `acceptance`, and compose gives both master keys as environment values, which `production` refuses (`master_key_in_env`, `app_master_key_in_env`). The `production` rules are for a host setup, which milestone LG makes (deferred row "LA-E5-22 note (K)").
- The separate app worker (`npm run worker`, §3) has no compose service.

Secret files (never in git; mode `0600` or `0400`, no group or world bit; mounted read only). The service checks the mode on the opened file. In `production`, a file with a group or world bit stops the start (`secret_file_mode`); other profiles log `secret_file_mode_open {setting}` (BD-A2-78). A key-ring file alone is enough to start, when it holds the version `legacy` (BD-A2-77):

| File | Holder | Content |
| --- | --- | --- |
| `infra/.secrets/lti-api-key.<account>` | the host (`npm run seed`, `lti:bootstrap`, the `compat` runner) | tool account API key. `lti:bootstrap` writes it (`0600`). The app does not read this file (BD-A2-105) |
| `infra/.secrets/app/lti-api-key` | app (`LTI_API_KEY_FILE`; read at each use) | a copy of `infra/.secrets/lti-api-key.cogniate`. `lti:bootstrap` keeps it equal at each run, also when the key does not change (write, then rename; `0600`). The folder `infra/.secrets/app/` (`0700`) is mounted read only at `/run/secrets/app`, so the app container sees only its own key. `stack:reset` deletes the folder (BD-A2-105) |
| `infra/.secrets/lti-operator-key` | LTI service container (CLIs) | operator key of the host's operator. `npm run seed` makes it once (`lti:operator init --if-none`); `stack:up` does not |
| `infra/.secrets/lti/keyring.json` | LTI service | key ring (when used) |
| `infra/.secrets/lti/lti-operator-key` | LTI service container (CLIs) | a copy of `infra/.secrets/lti-operator-key` that the host wrapper writes atomically at each run (`0600`). A missing original deletes it; `stack:reset` deletes it (BD-A2-34) |
| `infra/.secrets/app-keys/keyring.json` (and an app master-key file, when used) | app | the app key ring. The folder `infra/.secrets/app-keys/` (`0700`) is mounted read only at `/run/secrets/app-keys` and hidden from the `e2e` container by its own empty tmpfs (BD-A2-91) |
| `infra/.secrets/operators.json` | app | allowed operator names (production) |

Rules for the secret folders (build ratifications, [build decisions A2](build-decisions-A2.md) BD-A2-02, BD-A2-03):

- `npm run stack:reset` deletes `seed.json`, the API key files, `lti-operator-key` and its copy `infra/.secrets/lti/lti-operator-key` together with the databases. It keeps `.env`, `infra/.certs/` and the key-ring folder `infra/.secrets/lti/`: key material, like the master key in `.env`. To remove a test ring, delete `infra/.secrets/lti/keyring.json` by hand.
- The folder `infra/.secrets/lti/` (mode `0700`) must exist before any `docker compose up`. `npm run stack:up` and the QA runners (`prepare_e2e` in `infra/scripts/lib.sh`) make it. Without it, Docker makes the LTI service mount source as root, and the `e2e` container cannot start (its read-only bind of `infra/.secrets` cannot make the tmpfs mount point).
- The `e2e` test container sees `infra/.secrets` read only, but never the key ring: an empty tmpfs covers `/repo/infra/.secrets/lti` ([security delta §10](security-delta.md#10-keys-and-secrets), visibility rule). QA writes a test ring only from its host clone (tasks README form (a)). Do not remove the tmpfs line to make the `e2e` container start: make the folder.

The `production` profile refuses to start when a rule of LA-ADR-06 D12 fails. The log line is `config_refused {reason, message, setting?}` (BD-A2-79).

Production refusals (the message is fixed text and never holds a value):

| Reason | Message |
| --- | --- |
| `test_knob_active` | Production does not allow test knobs. Remove every test knob setting, then start the service again. |
| `simulation_on` | Production does not allow simulation profiles. Remove LTI_PROVIDER_SIMULATION or set it to off, then start the service again. |
| `private_host_allowlist` | Production does not allow private outbound hosts. Remove OUTBOUND_PRIVATE_HOST_ALLOWLIST, then start the service again. |
| `master_key_in_env` | Production does not allow the master key as an environment value. Remove LTI_MASTER_KEY and use LTI_MASTER_KEY_FILE or the key-ring file. |
| `no_trusted_proxy` | Production needs TRUSTED_PROXY_CIDRS. Set it to the address or host name of the proxy, then start the service again. |
| `operator_bind_not_loopback` | Production allows the operator listener on loopback only. Set OPERATOR_HOST to 127.0.0.1 or ::1, then start the service again. |
| `app_master_key_in_env` (app) | Production does not allow the app master key as an environment value. Remove APP_MASTER_KEY and use APP_MASTER_KEY_FILE or the app key-ring file. |
| `secret_file_mode` (with `setting`) | A secret file has group or world access. Set the mode of the file named by the setting to 0600, then start the service again. |

## 3. Deployment topology (pilot)

```mermaid
flowchart LR
  subgraph HOST["One host (Docker compose project)"]
    PX["proxy (Caddy)<br/>TLS, routes by host name"]
    subgraph LTI["lti-service container"]
      LP[":4100 public<br/>/lti/*, /api/*, /healthz, /readyz"]
      LO["127.0.0.1:4110 operator<br/>/operator/v1/*, /metrics, /readyz"]
      LJ["job runner<br/>retention, audit-retention,<br/>signing-key jobs, key-rewrap"]
    end
    subgraph APP["cogniate-app container"]
      AP[":4200 app, :4201 content"]
      AO["127.0.0.1:4210 operator<br/>/metrics, /readyz (Should)"]
      AW["job runner<br/>record-dispatch outbox"]
    end
    V1[("ltidb volume<br/>lti.db")]
    V2[("appdb volume<br/>cogniate.db")]
    SEC[["infra/.secrets (read only)"]]
  end
  LMS([LMS platforms]) -->|https| PX
  B([Browsers]) -->|https| PX
  PX --> LP
  PX --> AP
  AP -->|API key| PX
  LTI --- V1
  APP --- V2
  SEC --- LTI
  SEC --- APP
  OPS([Operator shell]) -->|docker compose exec| LO
  MON([Metrics collector]) -.->|scrape on the host network, LG| LO
  MON -.-> AO
```

Rules:

- The proxy routes only the four public host names. It has no route to `:4110` or `:4210`.
- In the `acceptance` profile only, the LTI operator listener binds the stack network, so QA's `e2e` container can call it (LA-ADR-06 D3). The `default` profile keeps loopback; `production` refuses any other bind.
- In the pilot, a collector reads `/metrics` with `docker compose exec lti-service wget -qO- http://127.0.0.1:4110/metrics` (or a sidecar in the same network namespace). LG exposes it on a private network.
- One LTI service process and one app process, each with one job runner. The app worker may run apart (`npm run worker`, LA-ADR-03 D7) only when the web process has `APP_JOB_RUNNER=off` and the worker has a distinct `JOB_INSTANCE_ID`. The LA compose stack has no worker service and does not pass these two settings (§2, BD-A2-105). The runner then still keeps at most one send in flight per placement, learner and reporter (LA-ADR-03 D7, A-LAD-03).
- Stop timing (BD-A2-31): a stop with no job in flight ends in about 1 s. With a job in flight, the service waits up to the job lease (60 s), and exits by itself at 70 s at the latest (`service_exit_forced`, exit code 1). Docker waits 75 s (`stop_grace_period`) before it kills. So `npm run stack:restart` can take up to about 75 s when a long job runs. Every interval job runs once at each start (BD-A2-32).
- In-memory state (score clock, platform token cache, JWKS cache, rate-limit buckets) is per process. That is safe with one LTI service process only (LA-ADR-06 D13 item 4).

## 4. Observability signals

### 4.1 Logs

Every service writes JSON lines (security §11). Key events for operators:

| Area | Events |
| --- | --- |
| Launch path | `login_rejected`, `launch_check_failed {check, code, detail}`, `launch_accepted {binding}`, `launch_claims_minimized`, `rate_limited` |
| Platform calls | `outbound_request`, `outbound_blocked {reason}`, `platform_token`, `platform_rate_limited` |
| Admin | `api_auth_failed`, `account_status_changed`, `api_key_issued`, `api_key_revoked`, `signing_key_changed`, `platform_created`, `deployment_updated`, `platform_deleted` |
| Keys | `key_provider_not_ready`, `key_open_failed` |
| Jobs | `job_run {job, ms, result, counts}`, `retention_cleanup` |
| Start | `service_started`, `config_refused`, `test_knob_active` |
| App (A1 names) | `launch_rejected {reason}`, `score_sync`, `grant_*`, `binding_*`, `connection_check` |

Request lines (BD-A2-61): in the LTI service, `http_request.path` is the matched route template (for example `/lti/login/:account`), with no ids filled in and no query. A request that matches no route logs the fixed value `<unmatched>`. The resolved tenant is in `tool_account_id`. So an unknown account, an encoded segment or a raw path value never reaches the log.

The audit log (tables `audit_event` in both services) is the record of who changed what. Logs are for diagnosis; audit events are for accountability.

### 4.2 Metrics (LTI service, `/metrics`)

| Metric | Type | Labels | Use |
| --- | --- | --- | --- |
| `lti_http_requests_total` | counter | `route_class`, `status_class`, `tool_account_id` | traffic, 5xx ratio |
| `lti_http_request_duration_seconds` | histogram | `route_class` | latency |
| `lti_launch_total` | counter | `result` (`accepted`, `failed`), `check`, `tool_account_id` | launch failure ratio and cause |
| `lti_launch_binding_total` | counter | `binding` (`cookie`, `storage`) | platform storage use |
| `lti_rate_limited_total` | counter | `class`, `key_kind`, `mode` (`hard`, `soft`) | abuse or a limit that is too low; `soft` = an account class above its rate |
| `lti_api_auth_failed_total` | counter | `scheme`, `code` | key problems; ltik failures under a valid key (no bucket spends them, LA-ADR-06 D1) |
| `lti_outbound_total` | counter | `result` (`response`, `blocked`), `reason` | network and guard |
| `lti_outbound_duration_seconds` | histogram | — | platform latency |
| `lti_platform_token_failures_total` | counter | `platform_id` | registration problems |
| `lti_platform_rate_limited_total` | counter | `platform_id` | LMS throttling |
| `lti_jwks_fetch_failures_total` | counter | `platform_id` | platform key set unreachable |
| `lti_jwks_cache_age_seconds` | gauge | `platform_id` | near the 24 h maximum age = launches will fail |
| `lti_signing_key_age_seconds` | gauge | `tool_account_id`, `status` | rotation due; `next` waiting |
| `lti_api_key_expires_in_seconds` | gauge | `tool_account_id` (smallest value) | expiry soon |
| `lti_operator_key_expires_in_seconds` | gauge | — (smallest value) | expiry soon |
| `lti_key_provider_sealed_rows` | gauge | `version` | re-wrap progress |
| `lti_audit_events_total` | counter | `action`, `result` | admin activity |
| `lti_job_runs_total` | counter | `job`, `result` | job health |
| `lti_job_last_success_timestamp_seconds` | gauge | `job` | stale jobs |
| `lti_ready` | gauge | — | 1 = ready |

Label rules: no personal data; `platform_id` only on the listed failure metrics and only a stored platform id; `tool_account_id` only a stored account id (empty for an unknown account or before the account is resolved; never a raw path value), so it is bounded by the account count.

Sources (BD-A2-52; LA-E5-17):

| Metrics | Source |
| --- | --- |
| `lti_rate_limited_total` | an observer in the limiter, before the log sampling: every hard refusal and every soft-class excess |
| `lti_audit_events_total` | every audit insert counts once when its outermost transaction **commits** (BD-A2-60): `insertAuditEvent` registers `afterCommit(db, fn)` of the shared transaction helper. A savepoint scope keeps its own buffer (`RELEASE` merges it into the parent; `ROLLBACK TO` drops it); the outermost `COMMIT` runs the buffer once after it succeeds; `ROLLBACK` drops it; with no open transaction it counts at once. So `withAudit`, the refused path and the `key-rewrap` end event count the same way, and a rolled-back insert never counts. Not a table count: retention deletes rows. |
| `lti_platform_token_failures_total`, `lti_jwks_fetch_failures_total` | injected observers in the platform token client (`onTokenResult({platformId, ok})`) and the JWKS cache (`onJwksFetch({platformId, ok, fetchedAt})`). A JWKS event is emitted once per verify call that waited on a fetch (the starter or a single-flight joiner), with that call's own platform id; a cache hit or a caller with no platform id emits none (BD-A2-54). **Pending instrumentation (LA-E5-17 RQ-1, lane L):** not exposed until that commit lands. |
| `lti_jwks_cache_age_seconds` | at scrape time, not from events: for each stored active platform, its stored JWKS URL and the cache getter `lastSuccessAt(jwksUrl)` give age = now − last success. Every platform that shares a cache entry (for example every Canvas cloud platform, one fixed URL) gets an accurate age, also when all its own calls were cache hits. No entry yet = no series (BD-A2-54). Pending with the same RQ-1. |
| `lti_http_*`, `lti_launch_*`, `lti_outbound_*`, `lti_platform_rate_limited_total`, `lti_job_*`, `lti_api_auth_failed_total` | the existing log events and the HTTP hook |
| key gauges (`lti_signing_key_age_seconds`, `lti_api_key_expires_in_seconds`, `lti_operator_key_expires_in_seconds`, `lti_key_provider_sealed_rows`), `lti_ready` | store queries and the readiness checks at scrape time |

A series with no accurate source is not exposed. It never shows a zero or a placeholder.

### 4.3 App signals (Should; names and endpoint: A1, [app API delta §8a](contracts/cogniate-app-api-delta.md#8a-app-metrics-should-with-e5-metrics))

The app has no `/metrics` today. With E5 it gets `GET /metrics` and `GET /readyz` on an app operator listener `127.0.0.1:4210` (not routed by the proxy), with the same label rules as the LTI service.

| Metric (A1 name) | Use |
| --- | --- |
| `app_dispatch_rows{reporter,status}`, `app_dispatch_oldest_pending_seconds{reporter}` | grade return backlog (`DispatchBacklog`) |
| `app_dispatch_sends_total{reporter,outcome}` (`accepted`, `conflict`, `rejected`, `retryable`, `throttled`, `local_failure`) | grade return health (`DispatchFailures`, `PlatformThrottled`) |
| `app_launch_refusals_total{reason,channel}` | setup problems per channel (`deployment_not_approved`, `site_mismatch`, `lms_mismatch`, `unknown_platform`) |
| `app_grant_redemptions_total{result}`, `app_grant_compensation_failures_total` | onboarding health |
| `app_job_runs_total{job,result}`, `app_job_last_success_timestamp_seconds{job}` | job health. `JobStale` watches the interval jobs (for example `retention`) only; `record-dispatch` logs one run per row, so an idle outbox has no new success, and `DispatchBacklog` watches the outbox. |

App rules (BD-A2-88; LA-E4-07, lane R):

- Listener: `OPERATOR_HOST` (default `127.0.0.1`) and `OPERATOR_PORT` (default `4210`) in the app process, with the same names and rule as the LTI service. `production` refuses a non-loopback bind (`operator_bind_not_loopback`, the same fixed message). It runs in the web process only.
- Sources: the dispatch gauges are store queries at scrape time (no pending row = age `0`). `app_dispatch_sends_total` counts at the commit of the recording transaction (`afterCommit`). `app_grant_redemptions_total` is a scrape-time count of ended `binding_attempt` rows, which is a true counter only while no job deletes those rows; a job that deletes them moves this series to a commit observer in the same change. `app_grant_compensation_failures_total` and the job series come from log events. `app_launch_refusals_total` gets one line in the launch page; an unknown channel id becomes `''`, and a reason outside `[a-z][a-z0-9_]{0,63}` becomes `other`.
- Topology: the send and job series exist only when the web process runs the job runner (`APP_JOB_RUNNER=on`). A standalone worker exposes no listener in LA, so those series are absent, not zero. The store-based series and `DispatchBacklog` work in both topologies.

### 4.4 Health and readiness

| Endpoint | Where | Answer |
| --- | --- | --- |
| `/healthz` | public | liveness; `production`: `{status, service}` only |
| `/readyz` | public and operator listener | `200` ready, or `503`; the operator answer lists `reasons` (`database`, `migrations`, `key_version_missing`) The app `/readyz` (operator listener only) checks only the app: the database, the migrations, and the app key provider when it exists. It never checks the LTI service, so an LTI outage does not make the app not ready; the runbooks check both services (BD-A2-88). |

### 4.5 Service level objectives (recommendation; LA-H8)

| Objective | Pilot target | Production target |
| --- | --- | --- |
| Launch path available (`/readyz` 200 and launch 5xx ratio < 1 %) | 99.5 % per month | 99.95 % (Q11) |
| Final outcomes delivered to the LMS within 1 h, while the LMS is up | 99 % | 99.9 % |
| Recovery point (RPO) / recovery time (RTO) | LA-H8 (Lead: 1 h / 4 h; see §7) | LG managed backup |

## 5. Alerts

Severity: **page** = act now; **ticket** = act within one working day. The paging tool is LG; in the pilot, an alert is an e-mail or chat message from the collector.

| Alert | Condition | Severity | First action |
| --- | --- | --- | --- |
| `LtiNotReady` | `/readyz` not 200 for 2 min | page | Read `key_provider_not_ready`, `config_refused` and `service_started` lines. Check the key ring file and the volume. |
| `Lti5xxRatio` | 5xx > 2 % of requests over 10 min | page | Find `internal_error` lines; take the trace ids. |
| `LaunchFailureRatio` | per account: failed launches > 20 % over 15 min, and ≥ 20 launches | ticket | Group by `check`: 6 = platform key set; 9 = deployment state; 2 or `storage` = browser cookies or storage; 13, 14 = profile or site values. |
| `JwksAgeHigh` | `lti_jwks_cache_age_seconds` > 12 h for a platform | ticket | `outbound_blocked` reason for that host; run the connection check (LA-ADR-08 D4). |
| `PlatformTokenFailing` | ≥ 5 token failures in 15 min for one platform | ticket | Run the connection check; ask the LMS admin if the tool registration changed. |
| `PlatformThrottled` | any `lti_platform_rate_limited_total` increase over 1 h | ticket | Check the dispatch backlog; the outbox waits by itself (LA-ADR-03 D7). |
| `DispatchBacklog` | oldest pending dispatch > 1 h | ticket | Check that the worker runs (`job_run` lines), then platform throttling, then token failures. |
| `DispatchFailures` | > 10 `failed` dispatches per hour | ticket | Group `lastError` codes; tell the library (Resend after a fix). |
| `RateLimitedSpike` | > 100 `rate_limited` lines per minute | ticket | Abuse (one address) or a limit that is too low (one account, normal traffic): change the account `limits`. |
| `ProtocolAccountHigh` | any `rate_limit_soft` line of `protocol_account` or `registration_account` | ticket | A flood from many addresses or a real peak. Look at the addresses in `rate_limited` lines; a real peak needs a higher soft value, a flood needs edge blocking (residual R-LA-5). |
| `LtikFailureSpike` | `lti_api_auth_failed_total{scheme="LTIK-AUTH-V2"}` > 300 per minute for 5 min | ticket | Someone sends random ltiks to the app's `/tool/launch` (A-LAD-02). Check the app's per-address limit and its logs. |
| `SigningKeyOld` | active key age > `SIGNING_KEY_ROTATE_DAYS` | ticket | Start §6.1. |
| `NextKeyWaiting` | a `next` key older than 7 days | ticket | Finish §6.1, or retire the `next` key. |
| `ApiKeyExpiring`, `OperatorKeyExpiring` | expires within 14 days | ticket | §6.2, §6.4. |
| `KeyRingNotRewrapped` | `lti_key_provider_sealed_rows` > 0 for a non-active version, 7 days after a key-ring change | ticket | Run the re-wrap (§6.3). |
| `JobStale` | last success older than 3 × the job interval | ticket | Read `job_run` lines of that job. Then follow §8a. Interval jobs only (not the queue job `record-dispatch`; BD-A2-88). |
| `BackupMissing` | no verified backup within the RPO | page (pilot) | Run §7.2. |
| `CertificateExpiry` | TLS certificate expires within 21 days | ticket | Renew (dev: `npm run gen-env`; LG: ingress). |
| `SharedPlatformQuota` | outbound calls to one shared Blackboard platform > 8,000 per 24 h | ticket | Anthology's default limit is 10,000 REST calls per 24 h per application (R2 §9 item 13; whether AGS calls count is UNVERIFIED). Ask for a raise before the limit. |

## 6. Key rotation procedures

### 6.1 Tool signing key (every 90 days)

Before you start:

1. List the Canvas connections that use an inline key: in the portal health view, `artifactKeyCurrent` (LA-ADR-08 D5), or ask the library admins if that view is not built.
2. Agree a time with each inline-key Canvas admin. Canvas holds one inline key only, so these installs fail between the activation and the new paste.

Procedure:

1. Make the next key: `POST /operator/v1/accounts/cogniate/signing-keys` (CLI wrapper in the runbook). Write down the new kid B.
2. Check the key set: `GET /lti/keys/cogniate` lists the active key A first and B second.
3. Wait `SIGNING_KEY_PUBLISH_LEAD_S` (24 h by default).
4. Activate B: `POST …/signing-keys/B/activate`.
5. Check: one teacher "Select content" works on one Moodle site, or on the simulator; the log has `signing_key_changed {kid: B, status: active}`.
6. Tell the inline-key Canvas admins to paste the new JSON at once (Canvas admin guide, procedure 6).
7. Do nothing more. After 30 days the `signing-key-cleanup` job removes A from the key set and zeroes its private part. NOTE: until LA-E5-19 registers this job on the runner, A leaves the key set by time (30 days after `retired_at`), but its sealed private part stays in the database. Then, after the 30 days, run `POST …/signing-keys/A/retire {immediate: true}`; it sets `removed` and clears the private part at once (BD-A2-28).

Compromise of the active key:

1. Make B (step 1) and activate it with `force: true` at once. If a `next` key exists already, step 1 gives `409 SIGNING_KEY_NEXT_EXISTS`: activate that key with `force: true` instead, or, if you do not trust it, remove it first (next procedure). The emergency CLI `lti:bootstrap --rotate-signing-key` always removes a waiting `next` key and makes a new one.
2. Retire A at once: `POST …/signing-keys/A/retire {immediate: true}`.
3. Tell the inline-key Canvas admins to paste the new JSON.
4. Record the incident and the audit event ids.

Compromise of the next key (it is published, but it never signed):

1. Remove it at once: `POST …/signing-keys/<next kid>/retire {immediate: true}`. It leaves the key set at once. No platform loses a valid JWT.
2. Make a new next key when you need one (step 1 of the procedure).
3. Record the incident and the audit event id.

### 6.2 Tool account API key

1. Issue a second key: `POST /operator/v1/accounts/<id>/api-keys {label, scopes}`. The answer shows the key once.
2. Put the key into the tool back end. For Cogniate on the stack (BD-A2-105):
   1. Write the key to `infra/.secrets/lti-api-key.cogniate` (mode `0600`).
   2. Run `npm run lti:bootstrap -w services/lti-service -- --account cogniate --name Cogniate`. An active key exists, so it issues no key. It copies the file to `infra/.secrets/app/lti-api-key`.

   The rule: the host keeps `lti-api-key.<account>`; the app reads only its copy (`LTI_API_KEY_FILE=/run/secrets/app/lti-api-key`), at each use. Do not write the copy by hand.
3. Check that `lastUsedAt` of the new key moves and `lastUsedAt` of the old key stops (`GET …/api-keys`).
4. Revoke the old key: `POST …/api-keys/<old id>/revoke`.

Emergency (leaked key): `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <name> --rotate-api-key`. It issues a new key and revokes every other key at once. It writes the new key to `infra/.secrets/lti-api-key.<id>`, and for `cogniate` also to the app copy.

### 6.3 Master key (key ring)

In this procedure `k1` is the version in use now. On a stack without a key-ring file, the version in use is `legacy` (the value of `LTI_MASTER_KEY`): then step 3 makes the file `infra/.secrets/lti/keyring.json` with `legacy` and `k2`.

1. Make a new version (for example `k2`): 32 random bytes as 64 hex characters.
2. Put the escrow copy of `k2` in the escrow store before you change the stack.
3. Add `k2` to the key-ring file, keep `k1`, and set `"active": "k2"`.
4. Restart the LTI service. Check `/readyz` = 200.
5. Start the re-wrap: `POST /operator/v1/key-provider/rewrap`. Write down the `traceId` and the time of the answer.
   - `202`: a run started.
   - `503 NOT_READY` (`job_runner_not_active`): the job runner is not active yet, for example just after a restart. Wait `Retry-After` seconds, then do step 5 again.
   - `409 JOB_RUNNING`: a run is in progress. Wait one minute, then do step 6.
6. Read the outcome. Get `GET /operator/v1/audit?action=key_provider.rewrap&traceId=<traceId>`. Until the trace filter exists, use `&since=<time of step 5>`, newest first. Read the event with actor `system:key-rewrap`, field `details.outcome`. If no such event exists one minute after a `202`, do step 5 again (two calls at the same time can skip one run).
   - `complete`: check `GET /operator/v1/key-provider`: `sealedCount` is 0 for every version except `k2`. Go to step 7.
   - `partial` (`stopReason` `lease`, `stopping` or `legacy_remains`): the run stopped safely. Do step 5 again until the outcome is `complete`.
   - `failed` with `unreadable` above 0: `unreadableVersions` names a key version that the ring does not have. Put that version back from escrow into the key-ring file, restart the LTI service, and do step 5 again.
   - `failed` with `errorClass`: read the LTI service log lines with that trace id. Do step 5 once more. If it fails again, start an incident (§9).
7. Make a backup (§7.2) and record the key versions in the backup record.
8. If `k1` has `derivedCount` 0, remove it from the key-ring file, restart the LTI service and check `/readyz` = 200. Else keep it.
9. Keep the escrow copy of `k1` until every backup that needs it has expired.

CAUTION: The version `legacy` also derives the existing service keys (LA-ADR-06 D6): its `derivedCount` stays above 0 after the re-wrap. On an existing stack, keep `legacy` in the ring.

CAUTION: Do not remove a version while its `sealedCount` or `derivedCount` is above 0, and only after a complete re-wrap (job end `outcome: complete`; BD-A2-38). The service then refuses to become ready (`key_version_missing`).

The Cogniate app follows the same steps when it uses the key provider (Should; LA-E5-22, BD-A2-91), with its own files and command: the ring is `infra/.secrets/app-keys/keyring.json`; status is `npm run app:keys -- status --operator <name>` (the active version and the `sealedCount` per version); re-wrap is `npm run app:keys -- rewrap --operator <name>`, which prints `{rewrapped, skippedChanged, unreadable}` and writes one app audit event `key_provider.rewrap`. Picker ltiks may stay in an old version until they expire. The app has no legacy refusal in LA. Order (BD-A2-97): write the ring, restart the app, check that the app `/readyz` answers `200` (no `key_version_missing`), then run `app:keys -- rewrap`. A re-wrap before the restart seals blobs with a version that the running app does not have: dispatches then retry until the restart, and the connection list shows no registration URL for those rows.

### 6.4 Operator key

1. Issue a new key for the same operator: `POST /operator/v1/operator-keys {operator}`.
2. Write it to `infra/.secrets/lti-operator-key`.
3. Revoke the old key with the new key: `POST /operator/v1/operator-keys/<old id>/revoke`.

Key file lost: run `docker compose exec lti-service npm run lti:operator -- init --replace --name <operator>`. It revokes every operator key and makes a new one (one audit event, actor `system:bootstrap`). Write the new key to `infra/.secrets/lti-operator-key`. (`npm run seed` uses `init --if-none`, which changes nothing when a key exists. When the file is missing, seed writes nothing and prints this `--replace` command. `npm run stack:up` makes no operator key.)

### 6.5 Service keys (incident)

0. Find the platform: `GET /operator/v1/accounts/<id>/platforms`, and match the issuer and the client id that the library gives you (BD-A2-53).
1. Revoke the keys of the scope: `POST /operator/v1/accounts/<id>/service-keys/revoke {platformId, deploymentId?, contextId?, resourceLinkId?}` (Should).
2. Tell the library: dispatches of those activities fail with `401` until a learner or teacher launches each activity again; then use Resend on the failed rows.

## 7. Backup and restore

### 7.1 What to keep

| Item | Where | How |
| --- | --- | --- |
| `lti.db`, `cogniate.db` | ADR-012 volumes | `npm run stack:data-backup -- --out <folder>` (both services stopped) |
| Course packages and uploads | `infra/.data/cogniate-app/{packages,uploads}` | file copy in the same window |
| Key ring and master keys | secret files | escrow copy, kept apart from the database backup, with its own access list |
| API key and operator key files | `infra/.secrets/` | not needed for a restore: issue new keys after a restore |

WARNING: A backup folder contains secrets in sealed form and is useless without the matching key versions. Keep it outside the checkout and outside shared evidence (ADR-011 §14).

### 7.2 Backup procedure (pilot, LA-H8 option (a))

1. Announce the maintenance window (both services stop for the time of the copy).
2. Stop the Cogniate app and the LTI service (`npm run stack:down` of the current revision).
3. Run `npm run stack:data-backup -- --out <folder outside the checkout>`. It verifies the copies against its manifest.
4. Copy the content folders.
5. Write the backup record: backup id, time, revision, key-ring versions in use (`GET /operator/v1/key-provider` before the stop).
6. Start the stack (`npm run stack:up`). Check `/readyz` = 200 on both services.
7. Move an encrypted copy of the folder off the host.

### 7.3 Restore drill (once per release)

The restore accepts only a backup of the **same** compose project: another `COMPOSE_PROJECT_NAME` gives `project_mismatch` (`infra/scripts/stack-data.mjs:178`; ADR-011 §14). LA changes no storage command (LD-3). So the drill keeps the project name.

1. Use a second host or Docker context with a copy of the checkout and the **same** `COMPOSE_PROJECT_NAME` as the backed-up stack. (QA's lane drill, LA-E5-24, uses a fresh QA project and restores into that same project.)
2. Put the key-ring versions of the backup record into the key-ring file of that copy (from escrow).
3. With both services stopped, run `npm run stack:data-restore -- --from <folder>`.
4. Start it. Check `/readyz` = 200 on the LTI service and `/healthz` = 200 on the app (the app `/readyz` exists only with the app operator listener).
5. Run one simulator learner launch and one score dispatch.
6. Record the start and end times (the measured RTO) and the backup age (the RPO of this drill).
7. Remove the drill copy.

CAUTION: Do not use `npm run stack:reset` in a drill: it also deletes the seed and key files (`seed.json`, the API key files, `lti-operator-key`) and `infra/.data/backups/` (`infra/scripts/stack-reset.sh:2-4`). It keeps the key-ring folder `infra/.secrets/lti/` (§2).

## 8. Tenant operations

| Task | Steps |
| --- | --- |
| New tool account (vendor model, LA-H7) | `POST /operator/v1/accounts` with the tool URLs; set `limits` and `claimPolicy`; issue an API key with the needed scopes; give the key and the protocol URLs to the vendor through an approved channel. |
| Suspend a tool account | `PATCH /operator/v1/accounts/<id> {status: "suspended"}`. Launches show `TOOL_ACCOUNT_SUSPENDED`. Undo with `active`. |
| Close a tool account | The close is final (BD-A2-27). 1. `GET /operator/v1/accounts/<id>` and check the id and the name with the requester. 2. Use the id from that answer in `PATCH /operator/v1/accounts/<id> {status: "closed"}`; never copy a body from another account. Every key stops at once. The purge job deletes its data after `closedRetentionDays` (Should). A second-operator confirmation is the LA-H21 follow-up. |
| Tool URLs of `cogniate` after a change of `PUBLIC_APP_URL` | `npm run seed` keeps the stored tool URLs of an existing account (BD-A2-25). On an existing volume, set them with `PATCH /operator/v1/accounts/cogniate {launchUrl, deepLinkingUrl, registrationUrl}` (`<PUBLIC_APP_URL>/tool/launch`, `/tool/deep-link`, `/tool/register`). A fresh stack is not affected. |
| Grant for an admin-value connection with a host off the issuer host | `app:grant issue` marks every bound value whose host is not the issuer host (for example a D2L token host). Before the issue, confirm with the LMS administrator, through the evidence channel, that the vendor issued this client id for this issuer at that host. Then add `--confirm-foreign-hosts`; without it the command exits 1 (LA-ADR-02 D6, A-LAD-23). Record the confirmation in `--evidence-ref`. |
| Wrong library binding | `app:binding suspend`, then `release` (ADR-011 §4b), with `--operator` and the evidence fields (LA-ADR-07 D5). |

## 8a. Jobs: read their state and run one on demand

The LTI service runs its jobs by itself (LA-ADR-06 D11: each job runs at start, then on its interval). Use this procedure when the `JobStale` alert fires, or when you must run a job now (BD-A2-81).

1. List the jobs: `GET /operator/v1/jobs`. Each row has `name`, `everyMs` (`null` = on demand only), `lastRunAt` (ISO 8601 or `null`) and `lastResult`.
2. Run one job: `POST /operator/v1/jobs/<name>/run`. Write down the `traceId` and the time of the answer.
   - `202`: the run started. Go to step 3.
   - `503 NOT_READY` (`job_runner_not_active`): the job runner is not active yet, for example just after a restart. Wait `Retry-After` seconds, then do step 2 again.
   - `409 JOB_RUNNING`: a run of that job is in progress. Wait one minute, then do step 3.
   - `404 NOT_FOUND`: the job name is wrong. Use a name from step 1.
3. Read the result: the LTI service log line `job_run {job, result, counts}` with that `trace_id` (BD-A2-85: the log line is the source; `GET /operator/v1/jobs` is only the list). If the service could not start the run after the `202`, the log has `job_run_request_failed {job}` with that trace id: do step 2 again.
   - `ok`: done. `counts` gives the work of the run.
   - `skipped_lease`: another run held the job. Wait one minute and read step 1 again.
   - `failed`: read the log lines with that trace id. Do step 2 once more. If it fails again, start an incident (§9).
4. For `key-rewrap`, follow §6.3 steps 5 and 6 instead (the job end event has the outcome).
5. For `account-purge`: each purged account has one audit event `account.purge` (`GET /operator/v1/audit?action=account.purge`), with `details.counts` = a list of `{table, rows}`. The `tool_account` row stays as a closed tombstone: `GET /operator/v1/accounts/<id>` still answers `status: closed`, and the id is never used again. Its audit events stay until `audit-retention` removes them.

## 9. Incident first steps

| Symptom | Look at | Likely cause | Action |
| --- | --- | --- | --- |
| Teachers see `STATE_COOKIE_MISSING` | `lti_launch_binding_total`, `launch_check_failed {check: 2 or storage}` | blocked third-party cookies; no platform storage on that LMS | Learners: new window. Teachers on Moodle: use Chrome, Edge or Firefox (Q16). Canvas: check that `storage` launches appear. |
| All launches of one platform fail at check 6 | `lti_jwks_cache_age_seconds`, `outbound_blocked` | the LMS key set is unreachable | Connection check; contact the LMS admin. |
| Grades do not arrive | `DispatchBacklog`, `PlatformThrottled`, `PlatformTokenFailing` | worker stopped, LMS throttling, or a changed registration | In that order. |
| One account gets `429` in normal use | `lti_rate_limited_total{class}` | a limit too low for a big class start | Raise the account `limits`. |
| A library reports a foreign course list | audit events of `platform.*` and `binding_*` | a wrong binding | Suspend and release (§8). |
| Service does not become ready after a key change | `/readyz` reasons | a key version missing from the ring | Put the version back from escrow (§6.3 CAUTION). |
| All launches of one platform fail at check 5 with `aud_untrusted` | `launch_check_failed {check: 5, code: INVALID_ISSUER_OR_AUDIENCE, detail: aud_untrusted}` | the LMS sends an extra `aud` value besides the client id (BD-A2-73) | Ask the LMS admin which extra audience the LMS sends, and confirm that it is expected. Then the tenant sets it: `PATCH /api/platforms/<id> {"trustedAudiences": ["<exact value>"]}` (it replaces the list; `[]` clears it). `azp_missing` or `azp_mismatch` cannot be fixed with this list: the LMS must send `azp` = the client id. |
| Platform-storage launches of one account stop after the storage check: the frame stays blank and the tool gets no launch | the browser console (a CSP `form-action` violation); the request line of `POST /lti/launch/{account}/storage-check` shows `303` | the host of the account's `launchUrl` or `deepLinkingUrl` is not a plain DNS name: an IPv6 literal, or characters other than letters, digits, dots and hyphens (for example `_`). The storage-check page then allows `'self'` only (BD-A2-104). Cookie launches of the same account still work. | Set the tool URL to a DNS host name: `PATCH /operator/v1/accounts/<id>` with `launchUrl` or `deepLinkingUrl`. |

## 10. Open items

| Item | Owner |
| --- | --- |
| Pilot RPO choice among LA-ADR-06 D14 (a), (b), (c) | LA-H8 |
| Whether Blackboard AGS calls count against the 10,000 calls per 24 h (§5 `SharedPlatformQuota`) | live check (LA-H3) |
| Paging tool, log pipeline, hosted metrics | LG |
