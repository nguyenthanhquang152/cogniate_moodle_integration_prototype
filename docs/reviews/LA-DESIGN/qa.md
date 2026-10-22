Verdict: FAIL
Round: 1

# LA design: QA testability review (G-DESIGN)

Reviewer: QA (dedicated, independent; task LA-QT). Date: 2026-10-22. Design under review: `docs/architecture/ltiaas/**` at DESIGN_SHA_PLACEHOLDER. Checklist: [TEST-STRATEGY §7](../../../tests/ltiaas/TEST-STRATEGY.md) (TD-01 to TD-16). Lead decisions used: plan §6.1 LD-1 to LD-8 (`docs/team/ltiaas/plan.md:194-201`). QA did not read the Reviewer-A or Reviewer-B files.

## Summary

The kernel design (A1) is testable. Folder discovery, no catalog file, the capability catalog, the legacy projection, `channelCapabilities`, the intended-change ids `LA-IC-nn` and the migration tests give clear black-box oracles. The no-behaviour-change proof is affordable on 2 Docker slots (§3).

The verdict is FAIL because 9 MAJOR findings remain. Each one blocks a Must acceptance criterion from being written or run black-box. Most fixes are short text changes:

- The E5 and E3 test sections of A2 do not follow LD-5 (Q-LAD-01).
- The E5 tests cannot reach the operator API or set the E5 settings in a test stack (Q-LAD-02, Q-LAD-03).
- Three Must oracles are not achievable or not defined (Q-LAD-04, Q-LAD-05, Q-LAD-06).
- K0 has no entry-point signatures (Q-LAD-07).
- The LD-1 list misses two closed-list assertions (Q-LAD-08).
- The local CI script has no design (Q-LAD-09).

## 1. Findings

Severity follows the base charter §5 and TEST-STRATEGY §7: a Must AC without an achievable or defined oracle is MAJOR.

### Q-LAD-01 — MAJOR — A2 test sections do not follow LD-5

- **Where:** `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md:294`; `LA-ADR-06-service-operability.md:418-419`; `LA-ADR-07-security-and-tenancy.md:207`; `LA-ADR-08-onboarding-and-connection-health.md:168-169`.
- **Problem:** These rows put in-process tests under "K0 (QA)": a controlled clock (AP-06-27..29), a temporary database (AP-06-23..26), two-tenant port fixtures (AP-07-01, AP-07-02), code rules (LA-ADR-08 D3). LA-ADR-05 also lists HTTP-level points as K0 (AP-05-01, -04, -05, -07, -12..-14, -19..-22), and those need a running service. The K1 rows go to QA-E2E.
- **Evidence:** LD-5 (`docs/team/ltiaas/plan.md:198`): K0 is the QA channel contract suite over the public kernel and registry entry points; kernel internals are Author unit tests; running-service points are K1 or acceptance, owned by QA. A1's files already follow it (`LA-ADR-01-channel-kernel.md:274-275`).
- **Fix:** Use the LD-5 split in each row. QA's per-AP mapping is in TEST-STRATEGY §2.4 and §8:
  - AP-05: HTTP-level points go to K1 or acceptance.
  - AP-06-28 (lead-time pass) and AP-06-29 (retention): Author unit tests with a controlled clock. The `409` part of AP-06-28, plus AP-06-27 and AP-06-30, go to SIM-lane acceptance.
  - AP-06-25 and AP-06-26: Author unit tests on a temporary database.
  - AP-07-01 and AP-07-02: per-route cross-tenant acceptance, plus Author port fixtures.
  - LA-ADR-08 code rules: Author unit tests.
  - K1 belongs to QA.

### Q-LAD-02 — MAJOR — The E5 tests cannot reach the operator API

- **Where:** `LA-ADR-06-service-operability.md:154` (listener `127.0.0.1:4110` inside the LTI service container, no proxy route); `:179` (AP-06-11).
- **Problem:** Most E5 Must points need operator API writes, for example AP-06-01 (`PATCH … limits`), -07 to -10, -14, -17, -19 to -22, -24 and -27 to -31. QA's suites run in the `e2e` container, which cannot reach a loopback listener in another container. The only other path is `docker compose exec` from the host for each call. The tasks README allows exec only for "the read-only commands that an AC names" and the listed M1 CLIs (`docs/architecture/tasks/README.md:52`, `:59`).
- **Fix:** In the `acceptance` compose profile only, bind the operator listener to the stack network (no proxy route) and make the operator key file readable by the `e2e` container. AP-06-11 keeps two checks: the proxy has no route, and the `default` and `production` profiles stay on loopback. If A2 prefers exec, the design must name the procedure, and the tasks README §2 allowance must list it.

### Q-LAD-03 — MAJOR — The E5 settings cannot be changed in a test stack

- **Where:**
  - `LA-ADR-06-service-operability.md:86` (`LTI_RATE_LIMITS` only at start; per-account overrides cover the key classes only).
  - `:81` (`TRUSTED_PROXY_CIDRS`, default the whole stack subnet).
  - `:261` (`LTI_KEYRING_FILE`).
  - `:108-111` (AP-06-02 to AP-06-05) and `:274`, `:276` (AP-06-24, AP-06-26).
  - `LA-ADR-07-security-and-tenancy.md:117`, `:131` (AP-07-04, AP-07-09 "in the production profile").
- **Problem:**
  - `npm run stack:restart -- <service> --env` accepts only registered knobs (`infra/scripts/stack-restart.sh:6-7`; `packages/shared/src/knobs.ts:34`), and none of these three settings is a knob.
  - AP-06-02, -04 and -05 need lower limits for the IP-keyed classes. AP-06-24 and -26 need another key ring.
  - AP-06-03 needs an untrusted peer. With the default (the whole stack subnet) the `e2e` container is a trusted peer, so the untrusted case cannot happen.
  - AP-07-04 and AP-07-09 need the production rule. A test stack cannot start the production profile, because D12 refuses a non-empty outbound allowlist (`LA-ADR-06-service-operability.md:361`) and the local Moodle needs one.
- **Fix:**
  - Register the test values as knobs (the tasks README §3 mechanism), or let the operator API set the global limits.
  - In the `acceptance` profile, set `TRUSTED_PROXY_CIDRS` to the proxy's address only.
  - Name the key-ring file path inside the clone that compose mounts.
  - For the CLI checks, define a per-process rule, for example `docker compose exec -e STACK_PROFILE=production cogniate-app npm run app:grant …`, and name it in the AC.

### Q-LAD-04 — MAJOR — AP-05-03 cannot produce the storage path in the test browser

- **Where:** `LA-ADR-05-lti-advantage-completeness.md:114`.
- **Problem:** AP-05-03 asks for "a browser that blocks third-party cookies" and expects `launch_accepted {binding: "storage"}`. The state cookie is `Partitioned` (`docs/architecture/security.md:110`). Chromium keeps a partitioned cookie in an LMS frame (`docs/architecture/adr/ADR-011-multi-lms.md:287`), and partitioned cookies are designed to work when third-party cookies are blocked. QA's only browser is Chromium (`tests/playwright.config.ts:30`). So the launch uses the cookie (binding `cookie`), and the oracle never shows. F3.1 (Must) then has no achievable black-box proof.
- **Fix:** Change the setup to "with the state cookie removed for the framed request". The test can do that with a route rule that drops the `__Host-lti_state_*` cookie, or with a browser setting that also blocks partitioned cookies; qa.md records which one. Safari stays a live row (Q16).

### Q-LAD-05 — MAJOR — AP-05-09 has two conflicting oracles

- **Where:** `LA-ADR-05-lti-advantage-completeness.md:138` ("no dispatch row exists"); `docs/architecture/ltiaas/README.md:298` (OC-2, open); `LA-ADR-03-learning-record-core.md:63` (D2 keeps today's rule).
- **Problem:** A graded placement without a line item gives a `failed` row "No gradebook column" today (ADR-010 rule 1), and LA-ADR-03 keeps that rule until the ungraded rule (LA-IC-07, Should) ships. A test for F3.2 (Must) cannot satisfy both.
- **Fix:** Close OC-2. QA proposes: AP-05-09 expects today's `failed` "No gradebook column" row until LA-ADR-05 D5 ships.

### Q-LAD-06 — MAJOR — No contract oracle for admin-value platform creation

- **Where:** `docs/architecture/ltiaas/README.md:300` (OC-4, open); `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:269-282` (§4.6, §4.7).
- **Problem:** K1-REG R1 and R4 for `lti-generic` and `brightspace` (F2.4, F2.5, Must) need the `POST /api/platforms` rules for admin-value profiles: an endpoint on another https origin (`endpointOrigins: any-https`), an issuer with a path, the reserved-issuer rule, and their status codes. The tests also need the trait fields on `GET /api/providers` (`endpoints`, `issuerKind`, `endpointOrigins`). The delta does not have them, so QA cannot write the expected status and code.
- **Fix:** A2 adds both rows to the delta, and contract §8 rows where they differ from LTIAAS.

### Q-LAD-07 — MAJOR — K0 entry points have no signatures

- **Where:** `LA-ADR-01-channel-kernel.md:161` ("Tests can give the loader an extra root"); `:170` (P2 `ConnectionSetup`: responsibilities only); `LA-ADR-07-security-and-tenancy.md:140` (T1: "the test-only extra loader root is refused in the production profile").
- **Problem:** K0 (F7.1) and the canary channel (F1.11, README check F4) must be written from the design before the code (base charter §1; LD-5). The design names a "registry builder" and an extra root, but gives no signature. P2 has no type sketch, so K-ADAPTER cases cannot be written test-first. LA-ADR-07 T1 implies the extra root is a runtime setting that the production profile must refuse. That conflicts with "production code has no extra root" (LA-ADR-01 D4) and would add a test-only path to the services (TD-13).
- **Fix:**
  - Add a TS sketch of the pure registry builder in `@cogniate/channel-kernel` (for example `buildChannelRegistry({ roots, simulations })`), and say that the extra root is only a function argument, with no environment variable.
  - Add the `ConnectionSetup` interface, or name `services/cogniate-app/src/providers/types.ts:136-160` plus the listed additions.
  - Reword LA-ADR-07 T1 to match.

### Q-LAD-08 — MAJOR — The LD-1 list misses two closed-list assertions

- **Where:** `LA-ADR-04-refactor-and-migration.md:111` ("Only the E0 open-world rewrite changes test assertions"); TEST-STRATEGY §4.3 (QA-owned list and E0 scan).
- **Problem:** When E2 adds `lti-generic` and `brightspace`, two more frozen assertions fail:
  - `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255`: the exact `lms` list of `GET /app-api/lms-providers`.
  - `tests/acceptance/M1/common/90-simulation-gates.test.ts:19`: exactly 6 profiles in the default profile.

  Neither is in R5's six rows. The E0 scan of TEST-STRATEGY §4.3 looks only for whole-object comparisons, so it would also miss them. Plan measure 3 then fails for a reason that is not a behaviour change.
- **Fix (owner: QA in the E0 brief; the Lead approves the LD-1 list):** Add both rows, with the open-world form "baseline entries present and unchanged; extras belong to registered channels". Widen the E0 scan to exact lists and counts of profiles, providers, LMS entries, cards and simulation profiles.

### Q-LAD-09 — MAJOR — The local CI script (F7.6) has no design

- **Where:** `docs/architecture/ltiaas/README.md:277` (F7.6, Must; sources "plan §3 E7; QA strategy").
- **Problem:** Neither source fixes the tools, the network rule or the pass threshold. TEST-STRATEGY §8 E7 only says that the script exits non-zero on a planted secret. This is QA's own gap. No AC can be written for F7.6 yet.
- **Fix (owner: the Lead assigns QA or A1):** QA proposes:
  - Steps: `npm ci --ignore-scripts`; `npm run check`; `npm audit --omit=dev --audit-level=high` (read-only registry access, and a network failure is reported, not passed); the SBOM from the built-in `npm sbom --sbom-format cyclonedx`; a secret scan with fixed patterns over tracked files.
  - Pass: exit 0. A planted secret in a temp copy makes the script exit non-zero.

### Q-LAD-10 — MINOR — The frozen wire-name list is not complete for F1

- **Where:** `LA-ADR-04-refactor-and-migration.md:57-65` (D2 table); `:85` (D4 rule 2, behaviour-class values).
- **Problem:** D2 has no row for LMS-named error and page codes that stay in core: `MOODLE_TOOL_MAY_EXIST` (`docs/architecture/contracts/cogniate-app-api.md:669`; text in `packages/shared/src/html.ts:8-12`), and `MOODLE_WS_ERROR` if it stays in core. It also has no row for the behaviour-class values `moodle`, `canvas`, `blackboard` that core writes into `connection.lms` for new channels. F1 then cannot reach 0, or an Author renames a frozen code.
- **Fix:** Add two rows ("error and page codes" and "behaviour-class values") and keep their literals only in `legacy-wire.ts`.

### Q-LAD-11 — MINOR — The ratchet and the import fence start late

- **Where:** `LA-ADR-04-refactor-and-migration.md:41` (S2, first channel folders); `:48` (S9: "ratchet reaches 0").
- **Problem:** No step installs the F1 baseline ratchet or the F3 import fence before S9. During S1–S8 a change can add LMS names to core with no failing check. That breaks TD-16 and the plan text "ratchet from today's baseline" (`docs/team/ltiaas/plan.md:57`).
- **Fix:** S2 installs F1 with the baseline counts and F3. S9 only brings the counts to 0.

### Q-LAD-12 — MINOR — Two guards have no black-box case

- **Where:** `LA-ADR-01-channel-kernel.md:135-136` (`records.reporters`, `records.readBack`).
- **Problem:** Every LA channel has these capabilities, so no channel lets the guard fire, and kit case C2 cannot run for them.
- **Fix:** Record them as covered by Author unit tests plus the K0 canary with the capability off. No product change is needed.

### Q-LAD-13 — MINOR — The rate-limit regression claim covers T7 only

- **Where:** `LA-ADR-06-service-operability.md:420` (regression row); `:98` (`auth_failure` 30 per minute per client address, "also with a valid key").
- **Problem:** The acceptance suites send many expected `401` answers from one `e2e` address (M1 negative rows, T2a, T3a). If one minute holds more than 30, the next calls get `429`, and an unchanged suite fails.
- **Fix:** QA records the `401` rate per minute of the M1 `sim` phase and the legacy suites at E0. If a suite exceeds the bucket, A2 keys `auth_failure` per address and key prefix, or the change gets an `LA-IC` id.

## 2. Checklist result (TEST-STRATEGY §7.1)

| Id | Result | Note |
| --- | --- | --- |
| TD-01 | met | README §4 scope table and `fitness-scope.json` (`docs/architecture/ltiaas/README.md:99-107`) |
| TD-02 | met | folder discovery, no catalog (LA-ADR-01 D4) |
| TD-03 | met | channel folders are not workspaces (LA-ADR-01 D1) |
| TD-04 | partial | Q-LAD-10 |
| TD-05 | met | `channelCapabilities` on the DTO and `lms-providers` (LA-ADR-01 D11) |
| TD-06 | met, with Q-LAD-12 | guard table in LA-ADR-01 D3 |
| TD-07 | met, except Q-LAD-02 | simulator records, API fields and log events exist for every port |
| TD-08 | missing | Q-LAD-07 |
| TD-09 | met | LA-ADR-04 D8, LA-IC-01 to LA-IC-10 |
| TD-10 | met | LA-ADR-04 D4, D5; data-model §7 migration tests |
| TD-11 | met | admin-value channels need no simulator profile (LA-ADR-02 D7) |
| TD-12 | partial | Q-LAD-01, Q-LAD-03 |
| TD-13 | partial | Q-LAD-07 (extra root as runtime setting); Q-LAD-02 must stay acceptance-only |
| TD-14 | met | log events and codes in both contract deltas |
| TD-15 | partial | Q-LAD-04, -05, -06, -09 |
| TD-16 | partial | Q-LAD-11 |

## 3. Can 2 Docker slots afford the proof?

Yes. The costs come from measured times (TEST-STRATEGY §4.4):

| Item | Count | Slot time |
| --- | --- | --- |
| R1 per E1 step (M1 `sim`, M2, K1, golden) | 9 steps (S1–S9) | about 6 h on the SIM slot |
| R2-lite (LD-8) | 4 steps (S3, S5, S6, S7) | about 1–1.7 h on the Moodle slot |
| Migration steps (M1 `migration` and `snapshot-upgrade`, U1) | S4, E4 | about 45 min on the SIM slot |
| Wave-end gate | 4 waves | about 1 h SIM in parallel with about 2.5 h Moodle each |

Total: about 18–20 h of QA slot time over four waves. Under LD-2, Authors work without Docker by default, so this fits. The risk is batching: S3 runs in parallel with S4–S6 (`LA-ADR-04-refactor-and-migration.md:51`), so QA runs one R1 for steps that land together.

## 4. Must coverage

Every Must feature of README §7 maps to a test level in TEST-STRATEGY §8, except the items blocked by the findings above:

| Features | Blocked by |
| --- | --- |
| F3.1 | Q-LAD-04 |
| F3.2 | Q-LAD-05 |
| F2.4, F2.5 | Q-LAD-06 |
| F5.1–F5.8 | Q-LAD-01, -02, -03 |
| F7.1, F1.11 | Q-LAD-07 |
| F0.3 | Q-LAD-08 |
| F7.6 | Q-LAD-09 |

F5.9 (connection secrets port, shape only) and F4.7 (backlog ports, names only) have no runtime behaviour; review covers them.
