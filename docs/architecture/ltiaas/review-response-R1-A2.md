# Review response, G-DESIGN round 1: Architect A2

Status: fix round 1 (task LA-D2c, 2026-10-22). Design SHA under review: `19476fc`. Reviews: [Reviewer-A](../../reviews/LA-DESIGN/reviewer-a.md), [Reviewer-B](../../reviews/LA-DESIGN/reviewer-b.md), [QA](../../reviews/LA-DESIGN/qa.md). A2 changed only its own files: LA-ADR-05 to LA-ADR-08, `contracts/lti-service-api-delta.md`, `operability.md`, `security-delta.md`.

Cross-file items went to A1 through the Lead (README §8 OC-10). A1's answers are used here: the rule name I-SELF (LA-ADR-02 D2a, D5 item 10), `PortContext` with `ChannelSql`, `MANUAL_SELF_LEGACY_CHANNELS`, `wireLms`, the guard levels of check 14, `picker_pick`, `APP_JOB_RUNNER=off`. Lead decision OC-9 closes the scope question of A-LAD-17.

## 1. Findings routed to A2

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| A-LAD-01 | BLOCKER (A2 part) | fixed | `contracts/lti-service-api-delta.md` §4.5 (origin binding, `endpointsOnIssuerOrigin`, `complete.bindingRef`, answer `active`), §4.6 (`clientAssertionAud`), §4.6.1 rules 1–3 and 7, §2.6, §8 D35, §9, C10, C20; `security-delta.md` §2.4, §2.6, §9 ("Platform access token" row), §12 binding rows, residual R-LA-7; `adr/LA-ADR-07` D2 rules A2, A5, new A6, alignment note, T24, T25, AP-07-11, §6; `adr/LA-ADR-08` F2, D2 table, D3 rules 1 and 6, D4 "App API" and "Work" | A1's invariant I-SELF is the rule (LA-ADR-02 D2a). A2 wire: an active `POST /api/platforms` that breaks I-SELF gets `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`; a `complete` that breaks it creates the platform inactive with the binding ref (staged), and the app switches the connection to `operatorGrant`. Admin values must not be a fixed host or a fixed-issuer host of any loaded profile. The connection check and the verified admin launch run only when I-SELF holds or a grant bound the values. K1 negative case: AP-07-11. |
| A-LAD-02 | BLOCKER | fixed | `adr/LA-ADR-06` D1 (rows "Order", "`auth_failure`", class table, AP-06-04, new AP-06-34), §5 LA-IC-10, §6; `contracts/lti-service-api-delta.md` §1.4; `security-delta.md` §13; `operability.md` §4.2, §5 (`LtikFailureSpike`); `adr/LA-ADR-07` T13 | Only a failed API key or operator key spends `auth_failure`. An ltik or service key `401` under a valid API key spends no bucket; `api` and `admin` spend only after the whole authentication passes. The app-edge limit on `/tool/launch` and `/tool/deep-link` is A1's (OC-10). AP-06-34: 200 random-ltik calls with the valid key never give `429`, and the next valid call passes. |
| A-LAD-06 | MAJOR | fixed | `adr/LA-ADR-06` D7 "Columns" row, D11 `signing-key-cleanup` (runs at start), §5 LA-IC-10 row, §6 migration test | The migration keeps the published set: a retired key younger than 30 days gets `retired_at` = migration time; an older retired key becomes `removed` and is never published again; the cleanup job zeroes its private part. Golden `GET /lti/keys/:account` of an upgraded stack: equal. |
| A-LAD-07 | MAJOR | fixed | `adr/LA-ADR-06` D1 ("Client address" row, class table column "Mode", text under the table, log row, new AP-06-35); `contracts/lti-service-api-delta.md` §1.4, §2.4, §6 (`rate_limit_soft`); `operability.md` §5 (`ProtocolAccountHigh`); `security-delta.md` §13; `adr/LA-ADR-07` T13, R-LA-5 | `protocol_account` and `registration_account` are soft: log, metric and alert, never `429`. IPv6 addresses count by /64. The registration session cap is per client address (10, a setting), so many senders cannot fill one account's cap. Residual R-LA-5: floods from many addresses are an edge (WAF) matter in LG. |
| Q-LAD-14 | MAJOR | fixed | `adr/LA-ADR-06` D5 "Expiry" row, AP-06-21, §6 rows; `contracts/lti-service-api-delta.md` §3 (api-keys and operator-keys rows) | The expiry boundary is an Author unit test with a controlled clock. The SIM lane keeps the parts that need no wait: `expiresAt` outside 1 hour to 2 years (operator keys: 1 year) gives `400 INVALID_REQUEST` (field `expiresAt`). Same rule for operator keys. |
| A-LAD-09 | MINOR | fixed | `adr/LA-ADR-05` D1 rules 3, 7, 8, security property, AP-05-04, new AP-05-32, §6; `contracts/lti-service-api-delta.md` §2.1, §2.2; `security-delta.md` §2.2, §5, §6; `adr/LA-ADR-07` T6, R-LA-6 | (1) The storage-check page sends `Referrer-Policy: same-origin`, and the POST needs `Origin` = our LTI origin; the remaining risk is recorded as R-LA-6 (class of R2), not "the same as the cookie". (2) Key `cog_state_<d>`: at most 16 keys, about 1 KB. (3) Request values reach the login page only through one escaped JSON block. |
| A-LAD-10 | MINOR | fixed | `adr/LA-ADR-05` D3b | One row per pick in A1's `picker_pick` (LA data model §5b); stats and the retention exception read it. |
| A-LAD-11 | MINOR | fixed | `adr/LA-ADR-06` D1 class table and text | `admin` default 600 per minute, burst 200. A1 caches `GET /api/providers` in the app for 60 s (OC-10). |
| A-LAD-12 | MINOR | deferred | — | One owner per file and the merge order are P3 breakdown work (Lead), with B-LAD-06. No design rule changes. |
| A-LAD-14 | MINOR | fixed | `adr/LA-ADR-06` D5 "Migration" row; `contracts/lti-service-api-delta.md` §3 `POST /operator/v1/accounts` | A new account writes the SHA-256 of 32 random bytes that nobody holds into the frozen `api_key_hash` column. |
| A-LAD-16 | MINOR | fixed | `adr/LA-ADR-06` D6 new row "Legacy refusal" | After a re-wrap that leaves no legacy blob, `service_setting` stores `legacyBlobs: refused`, and `open` refuses headerless blobs. `legacy` stays only for `mac`. |
| A-LAD-17 | MINOR | fixed | `adr/LA-ADR-07` D4 "Credential" row | Lead decision OC-9: E5 Must 3 covers the LTI service CLIs only; the app CLIs stay shell commands with a named, audited operator; R-LA-2 goes to the human review list. |
| A-LAD-18 | NIT | fixed | `adr/LA-ADR-06` §7; `adr/LA-ADR-07` §7; `contracts/lti-service-api-delta.md` §4.7 | Closed rows removed; the §4.7 note now says that LA-IC-01 names all four fields. |
| B-LAD-16 | NIT | fixed | same as A-LAD-18; human decision notes in LA-ADR-05 to LA-ADR-08 | LA-H21 to LA-H24 are in plan v1.2 §6.2; the "proposed by A2" marks are gone. |
| B-LAD-17 | NIT (part c) | fixed | `adr/LA-ADR-07` D2 rule A3 | Cites `MANUAL_SELF_LEGACY_CHANNELS`. Parts a, b, d are A1's. |
| B-LAD-13 | MINOR (A2 references) | fixed | `adr/LA-ADR-08` F4, D5, §5 | `artifact_key_kid` is cited in migration `016` with the other E6 tables (A1 moved it). |
| B-LAD-14 | MINOR (A2 wording) | fixed | `contracts/lti-service-api-delta.md` §4.6.1 rule 3 | The reserved issuer set comes from the fixed issuer values of the loaded profiles; A1's load check 7 makes `issuerKind` agree with `issuer`. |
| Q-LAD-15 | MINOR | fixed | `adr/LA-ADR-06` D3 "Trust bootstrap", AP-06-13, AP-06-15, §5, §6, §7; `operability.md` §6.4 | AP-06-15 is an Author migration test. `stack:up` uses `lti:operator init --if-none`; `--replace` recovers a lost key file. The AP-06-13 command form is listed for the tasks README allowance (README OC-7, Lead). |
| Q-LAD-16 | MINOR | fixed | `adr/LA-ADR-05` §5 table (LA-IC-14 row) | A1 added LA-IC-14 to LA-ADR-04 D8; A2 gives the exact expected values. |
| Q-LAD-18 | MINOR (E5 rules) | fixed | `adr/LA-ADR-06` §6 "Fitness (F5)" row | `'/lti/launch/'` from the D2 task; `DELETE FROM audit_event` from the D4 task; the SQL lint start is A1's (S2). |
| Q-LAD-20 | MINOR | fixed | `adr/LA-ADR-06` D1 "Settings" row, AP-06-05, §5 LA-IC-10 row | `LTI_RATE_LIMITS` and the operator API can set every class and `registrationSessionsPerAddress`. AP-06-05 uses a fresh account. QA records peak rates and open sessions at E0. |
| Q-LAD-22 | NIT | fixed | `adr/LA-ADR-05` AP-05-04, AP-05-07 | Black-box oracles: "no `303` and no ltik"; "the error page, not the storage-check page". |

## 2. Supporting edits for findings routed to A1

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| A-LAD-03, B-LAD-09 | BLOCKER, MINOR (A1) | aligned | `operability.md` §2 (`JOB_INSTANCE_ID`, `APP_JOB_RUNNER`), §3 | One runner per process; `npm run worker` only with `APP_JOB_RUNNER=off` in the web process and a distinct instance id; one send in flight per placement, learner and reporter (A1, LA-ADR-03 D7). |
| A-LAD-08, B-LAD-08 | MAJOR (closed by LD-9) | aligned | `adr/LA-ADR-05` D4 item 4, §5 ("Moodle" row, text under the table); `contracts/lti-service-api-delta.md` §9 | Each LA-IC changes frozen assertions only through its reviewed test-change list (plan LD-9). |
| B-LAD-03 | MAJOR (A1) | aligned | `adr/LA-ADR-07` D1 "Library" row | `app.ts` stays pure; only `app/` extension code gets a `PortContext` with a library-bound `ChannelSql`. The contradiction with LA-ADR-01 is gone. |
| B-LAD-04 | MAJOR (A1) | aligned | `security-delta.md` §12 "Signed product family" | Two guard levels of check 14: `launch` (Canvas, Blackboard) and `registration` (new channels; launches only log `family_guard_mismatch`). |
| B-LAD-07 | MAJOR (A1) | aligned | `adr/LA-ADR-05` §6 K2 row | K2 U4 is a Must case (the only end-to-end proof of F3.1). |
| Q-LAD-17 | MINOR (A1) | aligned | `contracts/lti-service-api-delta.md` §4.7 | The frozen `lms` value comes from the profile field `wireLms`. |

## 3. Open items after this round

| Item | Owner |
| --- | --- |
| App-edge per-address limit on `/tool/launch` and `/tool/deep-link` (A-LAD-02 abuse control for random ltiks) | A1 (README OC-10) |
| Tasks README §2: three QA command forms (key-ring file and restart; `STACK_PROFILE=production` CLI; `lti:operator init`) | Lead, P3 (README OC-7) |
| One owner per hot file and the merge order (A-LAD-12, B-LAD-06) | Lead, P3 |
