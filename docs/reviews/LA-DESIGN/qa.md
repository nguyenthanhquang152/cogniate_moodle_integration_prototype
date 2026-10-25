Verdict: PASS
Round: 3

# LA design: QA testability review (G-DESIGN)

Reviewer: QA (dedicated, independent; task LA-QT, retry dispatch `ctx_8ea334f6cd89`). Date: 2026-10-22. Design under review: the 15 files of `docs/architecture/ltiaas/**` at `19476fc9ae7dbb6599ee41a038bbd10fae34b9da`. Checklist: [TEST-STRATEGY §7](../../../tests/ltiaas/TEST-STRATEGY.md) (TD-01 to TD-16). Lead decisions used: plan v1.2 §6.1 LD-1 to LD-8 (`docs/team/ltiaas/plan.md:190-201`). Severity: base charter §5 and TEST-STRATEGY §7 (a Must point without an achievable oracle is MAJOR; a Should or Could gap is MINOR).

Independence: QA did not read `reviewer-a.md` or `reviewer-b.md`. QA read only messages addressed to its own handle. Exposure note: while QA checked a regression question, one `grep` read about 5 lines of LTI service source (`services/lti-service/src/store/registrations.ts`, the `expires_at` field) and listed `services/lti-service/src/store/`. The tasks README §2 does not allow QA to read service source. QA did not use these lines; Q-LAD-20 cites the base contract instead.

## Round 3

Design under review: `88909be46a97273bdf189442a443598148ab5de0` (previous: `877d951`). Scope (bounded): only the diff `877d951..88909be` of `docs/architecture/ltiaas/**`, with `review-response-R2-A1.md` and `review-response-R2-A2.md`. Questions: are the round-2 open items fixed, and does the diff add a BLOCKER or MAJOR? Task LA-QT3, dispatch `ctx_b4e0f5fef5eb`. Independence: QA did not open `reviewer-a.md` or `reviewer-b.md`. QA read only messages addressed to its own handle.

### R3.0 Summary

The MAJOR Q-LAD-23 is closed. Q-LAD-25, Q-LAD-26 and Q-LAD-27 are closed. Q-LAD-24 is only half closed: A2 fixed AP-05-29, but A1's LA-ADR-02 test-impact line still names the old oracle. It stays MINOR, because the correct oracle follows from the rules and from AP-07-11. The diff adds no BLOCKER and no MAJOR.

No Must feature has a missing item (TEST-STRATEGY §7), so the testability verdict is **PASS**.

Open after round 3: **BLOCKER 0, MAJOR 0, MINOR 1 (Q-LAD-24, A1 part), NIT 0.** The MINOR goes to `docs/team/ltiaas/deferred.md` (charter-LA §5) or to the P3 breakdown.

### R3.1 Re-check of the round-2 open items at `88909be`

| Id | Round-2 severity | Response | Status | Evidence at `88909be` |
| --- | --- | --- | --- | --- |
| Q-LAD-23 | MAJOR | fixed (A1); aligned (A2) | **Closed** | `adr/LA-ADR-03-learning-record-core.md:171`: random boot id per process; `stop()` from the `SIGTERM` handler deletes the heartbeat row; a start that finds a fresh row of its own id with another boot id waits, and the web part serves at once; `job_instance_conflict` only when that other heartbeat keeps moving (a second live process); "a normal restart (stop, then start) has today's timing"; the same rule for the LTI service runner. `:168`: `lease_owner` includes the boot id, so a process that lost its lease cannot record late. `:172`: recovery runs only in case 1. `:217`: Author unit tests with a controlled clock (clean restart, crash restart, duplicate process). `data-model.md:135`, `:174`; `operability.md:31`. The frozen restart paths are graceful: T5 `p2-app-restart` uses `docker compose stop` (`tests/host/run-t5.mjs:108`), and `lti-restart` and the knob passes use `stack:restart` (`:133`, `:184`), which recreates the container after a `SIGTERM`. So their timing stays as today. |
| Q-LAD-24 | MINOR | A2 part fixed; A1 part: no row in `review-response-R2-A1.md` | **Still open (A1 part), MINOR** | Fixed: AP-05-29 now expects `PLATFORM_NOT_ACTIVE` (`adr/LA-ADR-05-lti-advantage-completeness.md:234`). Open: `adr/LA-ADR-02-generic-lti-channel.md:168` still says "a launch before the grant gets `deployment_not_approved`" for the inactive staged platform. AP-07-11 (`adr/LA-ADR-07-security-and-tenancy.md:83`), D5 item 10 (inactive) and the base login code (`docs/architecture/security.md:27`) all give `PLATFORM_NOT_ACTIVE`, so QA uses that (TEST-STRATEGY §2.4 K1-REG R6). The P3 AC must not copy the LA-ADR-02 line. A2's note on AP-08-04 is correct: there the staged record is active (LA-ADR-08 D3 rule 1), so `deployment_not_approved` is right. |
| Q-LAD-25 | MINOR | fixed (A1, with B-LAD-20) | **Closed** | `adr/LA-ADR-01-channel-kernel.md:124`: `storage?: { tables, columns }` with the Moodle values. K0 can check it in the manifest schema, and F5 has its list. |
| Q-LAD-26 | MINOR | fixed (A2) | **Closed** | `adr/LA-ADR-05-lti-advantage-completeness.md:330`: "README F7.7 makes K2 U1–U4 Must; other K2 checks (F7.9) are Could". |
| Q-LAD-27 | MINOR | fixed (A2) | **Closed** | The cap is per (client address, tool account): `adr/LA-ADR-06-service-operability.md:103`, `contracts/lti-service-api-delta.md:101`, `:164`, `security-delta.md` §13. AP-06-05 (`adr/LA-ADR-06-service-operability.md:113`) uses a fresh account, a second fresh account as the control, and restores the setting in its clean-up. |

### R3.2 New BLOCKER or MAJOR in the diff

None. QA checked the changed text for testability and for the no-behaviour-change proof:

- **Check 14 on `standard` platforms (A-LAD-19):** a registration-level family is now refused on a Moodle `standard` platform. Only new channels guard at the registration level (`brightspace`: `desire2learn`, E2-N), so no baseline launch changes. QA aligned K1-LAUNCH L4 (TEST-STRATEGY v1.3).
- **The verify step from the binding authority (B-LAD-20):** the baseline authorities are today's, so M2 shows no change.
- **`lms = 'canvas'` at the staged switch (A-LAD-20):** this is an Author writer test; there is no wire change.
- **The app-edge limit (app API delta §5a, Should):** 120 per minute, burst 30 per address on `/tool/launch` and `/tool/deep-link`. All frozen browser launches come from the one `e2e` address. The design gives an escape (`APP_RATE_LIMITS` in the `acceptance` compose), so this is a regression risk only, not a defect. QA records the peak at E0 (TEST-STRATEGY §9.2 item 14).
- **`--confirm-foreign-hosts`:** an Author test. It touches no frozen command, because M1 grants have no off-origin admin value.

Note for P3 (no finding, Should): the §5a acceptance point needs "a valid launch from another address" (`contracts/cogniate-app-api-delta.md:152`). QA has one client address, so the AC should check a valid launch from the same address after `Retry-After`, or name a second source (TEST-STRATEGY §9.2 item 14).

### R3.3 QA-owned changes in this round

| File | Change |
| --- | --- |
| `tests/ltiaas/TEST-STRATEGY.md` v1.3 | §2.4 K1-LAUNCH L4: a registration-level family on a Moodle `standard` platform gives the check 14 refusal before any claim is stored; on other platforms the launch passes and logs `family_guard_mismatch` (A-LAD-19). §9.2 item 14: E0 records the peak rate of `/tool/launch` and `/tool/deep-link` per address; the P3 wording of the §5a acceptance point. |

Still open for P3, unchanged from round 2: README OC-7 (three QA command forms, Lead) and TEST-STRATEGY §9.2 item 11 (K1-CAP C2 for guarded routes that are not built yet, Lead confirms).

## Round 2

Design under review: the 15 design files at `877d951ccce1efa29bab6867b5c102ca0407c1ed` (previous: `19476fc`), with the response files `docs/architecture/ltiaas/review-response-R1-A1.md` and `review-response-R1-A2.md`. Plan v1.2 with LD-9 (`docs/team/ltiaas/plan.md:202`) and OC-9 (commit `0b18dcb`). Task LA-QT2, dispatch `ctx_c9eff3e6fa01`. Independence: QA did not open `reviewer-a.md` or `reviewer-b.md`. The response files cite their finding ids, and QA read only those rows. QA read only messages addressed to its own handle.

### R2.0 Summary

All 9 open round-1 findings are closed, also the MAJOR Q-LAD-14 (the API key expiry boundary is now an Author unit test with a controlled clock). No answer was "deferred" or "disputed" for a QA finding.

The verdict is FAIL because of one new MAJOR in the changed text:

- **Q-LAD-23 (MAJOR):** the new instance heartbeat rule of the job runner (LA-ADR-03 D7) makes a restarted service exit 1 for up to 30 s. That contradicts "recovery is immediate, as today" in the same row, and it changes the restart behaviour that the frozen T5b and M1 restart checks use.

New cheap MINOR fixes: Q-LAD-24 (two oracles for the I-SELF K1 negative case), Q-LAD-25 (manifest `storage` field missing from the sketch), Q-LAD-26 (K2 priority wording), Q-LAD-27 (AP-06-05 isolation).

Open after round 2: **BLOCKER 0, MAJOR 1, MINOR 4, NIT 0.**

### R2.1 Re-check of the round-1 findings at `877d951`

| Id | Round-1 severity | Response | Status | Evidence at `877d951` |
| --- | --- | --- | --- | --- |
| Q-LAD-14 | MAJOR | fixed (A2) | **Closed** | `adr/LA-ADR-06-service-operability.md:230` (expiry 1 hour to 2 years; outside the range `400 INVALID_REQUEST`, field `expiresAt`; the same rules for operator keys); `:242` (AP-06-21: SIM lane checks only the `400` part, with no wait; the boundary at `expires_at ± 1 s` is an Author unit test with a controlled clock, for both key kinds); `:448` (Author unit row), `:449` (SIM-lane row: "the `400` part of AP-06-21"); `contracts/lti-service-api-delta.md:200`, `:211`. TD-12 is met. |
| Q-LAD-15 | MINOR | fixed (A2; A1 for OC-7) | **Closed** | AP-06-15 is an Author migration test (`adr/LA-ADR-06-service-operability.md:216`, `:448`); `init --if-none` in every `stack:up`, `--replace` for a lost key file (`:160`, `:425`); AP-06-13 names its command and checks a second `stack:up` (`:186`); the command form is OC-7 (c) (`README.md:352`; `adr/LA-ADR-06-service-operability.md:476`). |
| Q-LAD-16 | MINOR | fixed (A1, A2) | **Closed** | LA-IC-14 in `adr/LA-ADR-04-refactor-and-migration.md:144` and `adr/LA-ADR-05-lti-advantage-completeness.md:317`, with the three M1 lines and the K0 projection golden. |
| Q-LAD-17 | MINOR | fixed (A1, A2) | **Closed** | `wireLms` profile data (`adr/LA-ADR-01-channel-kernel.md:343`; load check 7 at `:182` allows it only on the baseline profiles); `adr/LA-ADR-04-refactor-and-migration.md:66`; `contracts/lti-service-api-delta.md` §4.7. |
| Q-LAD-18 | MINOR | fixed (A1, A2) | **Closed** | `fitness-scope.json` from S2 (`README.md:102`; `adr/LA-ADR-04-refactor-and-migration.md:41`); each F5 rule has a start step (`adr/LA-ADR-04-refactor-and-migration.md:53`; `README.md:120`; `adr/LA-ADR-06-service-operability.md:452`). |
| Q-LAD-19 | MINOR | fixed (A1) | **Closed** | `adr/LA-ADR-01-channel-kernel.md:263`: `services/cogniate-app/src/kernel/ports.ts` holds every named type; it is a public interface file that QA may read and import (types only) from S5. |
| Q-LAD-20 | MINOR | fixed (A2) | **Closed** (residual MINOR Q-LAD-27) | `LTI_RATE_LIMITS` and the operator API can set every class and `registrationSessionsPerAddress` (`adr/LA-ADR-06-service-operability.md:87`); the account classes are soft (`:103`); E0 records peak rates and open sessions (`:433`). |
| Q-LAD-21 | MINOR | fixed (A1) | **Closed** | `README.md:132` (acceptance per step; a step 3 failure is a dependency finding). |
| Q-LAD-22 | NIT | fixed (A2) | **Closed** | `adr/LA-ADR-05-lti-advantage-completeness.md:115` (no `303` and no ltik), `:118` (the error page, not the storage-check page). |

### R2.2 New findings

#### Q-LAD-23 — MAJOR — The instance heartbeat makes every same-slot restart exit 1 for up to 30 s

- **Where:** `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md:171` ("Instance id"); `:177` ("Worker process": the runner runs in the web process by default); `data-model.md:133-136` (`job_instance`); `operability.md:31`.
- **Problem:** The row says: "A runner refuses to start when a live heartbeat (newer than 30 s) has the same id: `job_instance_conflict`, exit 1". The same row then says: "At start, the runner takes back at once the leases of its own instance id (the same slot restarted) … With one instance, recovery is immediate, as today". These two rules conflict. The old process writes its heartbeat every 10 s, and the design has no step that removes the row at stop. So after a crash, a deploy, or `npm run stack:restart -- cogniate-app` (`docker compose up -d --force-recreate --wait`, `infra/scripts/stack-restart.sh` line 74), the new process finds a heartbeat younger than 30 s with its own id and exits 1. The runner is in the web process, so the whole app is down until the old heartbeat is 30 s old and the restart policy starts it again.
- **Evidence (regression proof, plan measure 3):**
  - The frozen restart checks use this path: T5b AC-T5-30 "in flight and restart" (`tests/acceptance/T5b/8-supersede.spec.ts:70`), the T5b LTI service restart (`tests/acceptance/T5b/4-conflict-resend.spec.ts:73`, if the rule also covers the LTI service runner), and the M1 race and gate rows with `stack:restart` (`docs/architecture/tasks/README.md:59`). After E4 their timing changes by up to 30 s per restart. A deadline in a check can then fail with no `LA-IC` id.
  - The P2 recovery (A-LAD-05, `adr/LA-ADR-03-learning-record-core.md:172`) needs exactly this same-slot restart to work at once.
- **Fix (A1):** Keep the duplicate-id protection, but never refuse the same slot:
  - The heartbeat row stores a random boot id.
  - `stop()` deletes its own row.
  - A start that finds a fresh heartbeat of its own id with another boot id does not exit. It waits until that heartbeat is 30 s old, or until the row is gone, and the web part serves at once. It exits with `job_instance_conflict` only when that other heartbeat keeps moving, which shows a second live process.
  - State that a single-instance restart has today's timing, and add an Author unit test with a controlled clock. If the rule also applies to the LTI service runner (`operability.md:31` says "both"), say so in data-model §4.

#### Q-LAD-24 — MINOR — The I-SELF K1 negative case has two launch oracles

- **Where:** `adr/LA-ADR-02-generic-lti-channel.md:168` ("a launch before the grant gets `deployment_not_approved`"); `adr/LA-ADR-07-security-and-tenancy.md:83` (AP-07-11: "a learner launch of that platform gets `PLATFORM_NOT_ACTIVE`"). Also `adr/LA-ADR-05-lti-advantage-completeness.md:234` (AP-05-29, Should, Canvas DR: "`deployment_not_approved`"); QA missed this one in round 1.
- **Problem:** A staged registration creates the platform **inactive** (`adr/LA-ADR-02-generic-lti-channel.md:118`, D5 item 10). The LTI service refuses a login to an inactive platform with `PLATFORM_NOT_ACTIVE` (`docs/architecture/security.md:27`; `docs/architecture/contracts/lti-service-api.md:81`). So the app never sees the launch, and `deployment_not_approved` cannot happen. The oracle follows from the rules, so QA uses AP-07-11. But a P3 AC copied from LA-ADR-02 or AP-05-29 would be wrong.
- **Fix (A1 for LA-ADR-02, A2 for AP-05-29):** Change both texts to "the LTI service refuses the login with `PLATFORM_NOT_ACTIVE`", as AP-07-11 says.

#### Q-LAD-25 — MINOR — The manifest sketch has no `storage` field

- **Where:** `adr/LA-ADR-01-channel-kernel.md:306` ("Channel SQL may name only the tables and columns that its manifest lists in `storage`"); `README.md:120` (F5 uses that list); the `ChannelManifest` sketch at `adr/LA-ADR-01-channel-kernel.md:95-132` has no `storage` field.
- **Problem:** K0 checks every manifest against the schema (TEST-STRATEGY §2.7), and QA's F5 probe for channel SQL needs the field's shape. Without it, the K0 schema case and the F5 probe cannot be written test-first (TD-08).
- **Fix (A1):** Add `storage?: { tables: string[]; columns: string[] }` (or the chosen shape) to the D2 sketch, with the Moodle values.

#### Q-LAD-26 — MINOR — The priority of K2 U1–U3 is stated two ways

- **Where:** `README.md:326` (F7.7: K2 U1–U4 are **Must**); `adr/LA-ADR-05-lti-advantage-completeness.md:330` ("README F7.7 keeps the other K2 cases Could").
- **Problem:** The A2 text says that U1–U3 are Could, but the README makes them Must. QA-E2E plans U1–U3 by this priority.
- **Fix (A2):** Write "README F7.7 makes U1–U4 Must; other K2 checks (F7.9) are Could".

#### Q-LAD-27 — MINOR — AP-06-05 is not isolated by a fresh account

- **Where:** `adr/LA-ADR-06-service-operability.md:113` (AP-06-05: "On a fresh account …, so no other test loses its sessions"); `:103` and `contracts/lti-service-api-delta.md:101` (the cap counts open sessions per **client address**, not per account).
- **Problem:** All QA requests come from one `e2e` address. With the cap set to 3, earlier open registration sessions of that address (K1-REG R3 Dynamic Registrations in the same lane; a session lives up to 1 hour, `docs/architecture/contracts/lti-service-api.md:159`) count too. So the "4th" session can be refused earlier, and while the cap is 3, other registration tests from that address fail. A fresh account changes nothing for a per-address cap.
- **Fix (A2):** Either key the cap by (client address, tool account), so that a fresh account isolates the test and one sender still cannot fill another account's cap, or state the precondition "no open registration session from this address" (QA then gives AP-06-05 a run-order line: first registration test of a fresh lane) and restore the cap in the test's clean-up.

### R2.3 Checklist changes since round 1 (TEST-STRATEGY §7.1)

| Id | Round 1 | Round 2 | Note |
| --- | --- | --- | --- |
| TD-01 | met, with Q-LAD-18 | met | scope file from S2 |
| TD-04 | met, with Q-LAD-17 | met | `wireLms`; `MANUAL_SELF_LEGACY_CHANNELS`, `LAUNCH_GUARD_CHANNELS` in `legacy-wire.ts` |
| TD-08 | met, with Q-LAD-19 | met, with Q-LAD-25 | `ports.ts` public; the manifest `storage` field is missing |
| TD-09 | met, with Q-LAD-16 | met | LA-IC-14; plan LD-9 test-change lists |
| TD-12 | **missing** (Q-LAD-14) | met | expiry by a controlled clock; storage check 120 s by a unit test or one real wait |
| TD-15 | met, except Q-LAD-14 | met, with Q-LAD-24 | the AP-07-11 oracle follows from the rules |
| TD-13, TD-16 | met | met | build model and fitness checks from S2; extra root unchanged |

The regression proof (§4 of the strategy) is affected by Q-LAD-23 (restart timing after E4).

### R2.4 Can 2 Docker slots afford the proof?

Yes, and with less slot time than in round 1. R1 now runs only before the PASS of the six runtime steps (`adr/LA-ADR-04-refactor-and-migration.md:113`):

| Item | Count | Slot time |
| --- | --- | --- |
| R1 (M1 `sim`, M2, K1, golden) | 6 steps (S3, S4, S5, S6, S8, E4) | about 4 h on the SIM slot |
| R2-lite (LD-8) | 4 steps (S3, S5, S6, S7) | about 0.7–1.7 h on the Moodle slot |
| Migration steps (M1 `migration` and `snapshot-upgrade`, U1) | S4, E4 | about 45 min on the SIM slot |
| Wave-end gate (also R1 for S1, S2, S7, S9) | 4 waves | about 1 h SIM in parallel with about 2.5 h Moodle each |

Total: about 16–18 h of QA slot time over four waves. K2 U1–U4 are now Must, but they already were in the wave-end K2 run (QA-E2E, SIM lane, about 5 min per channel, estimate). If Q-LAD-23 stays as written, each app restart after E4 can add up to 30 s.

### R2.5 QA-owned changes in this round, and open items

| File | Change |
| --- | --- |
| `tests/ltiaas/TEST-STRATEGY.md` v1.2 | README OC-11 and plan LD-9: §2.2 K2 row (U1–U4 Must, U5 Could); §2.4 K1-LAUNCH L4 (guard levels `launch` and `registration`), new K1-REG R6 (I-SELF negative case = AP-07-11, oracle `PLATFORM_NOT_ACTIVE`); §2.6 pass rule (K2 U1–U3 per channel); §2.8 generic provider (foreign token host configuration); §4.2 and §4.4 (R1 only before the PASS of S3, S4, S5, S6, S8, E4; S1, S2, S7, S9 use R0 and the golden compare; R1 for them at the wave end); §4.3 and §4.7 (LD-9 test-change list per `LA-IC`; rows LA-IC-11 to LA-IC-14); §9.2 items 12 and 13. |

| Open item | Owner |
| --- | --- |
| README OC-7: three QA command forms for the tasks README §2 (key-ring file and LTI restart for AP-06-24; `STACK_PROFILE=production` app CLI for AP-07-04 and AP-07-09; `lti:operator init` for AP-06-13). QA writes no test that needs them before P3 adds them (TEST-STRATEGY §9.2 item 12). | Lead, P3 breakdown |
| TEST-STRATEGY §9.2 item 11: K1-CAP C2 joins a guarded capability only in the task that builds its route (`content.ungraded`, `setup.connectionCheck`). | Lead confirms in P3 |

## Round 1 summary

The design is much more testable than the pre-review draft. 12 of the 13 pre-review findings are closed in the design. Q-LAD-08 is now QA-owned (README OC-8), and QA closed it in this round (TEST-STRATEGY v1.1 §4.3). The kernel surface for K0 is named, the operator API is reachable from the `e2e` container, every E5 setting has a test control, and the admin-value platform rules have a wire contract.

The verdict is FAIL because of one MAJOR finding:

- **Q-LAD-14 (MAJOR):** the API key expiry point AP-06-21 (F5.5, Must) needs a wait of at least 1 hour. The design names no control for this time rule (TD-12). The fix is one row in LA-ADR-06 §6.

The other new findings are MINOR or NIT (Q-LAD-15 to Q-LAD-22). They are safe to defer, or the P3 breakdown can close them.

## R1.1 Re-check of the pre-review findings at `19476fc`

| Id | Pre-review severity | Status | Evidence at `19476fc` |
| --- | --- | --- | --- |
| Q-LAD-01 | MAJOR | **Closed** | Each A2 test section follows LD-5: `adr/LA-ADR-05-lti-advantage-completeness.md:319-331` (HTTP points are K1 or SIM-lane acceptance; K0 only for registry values), `adr/LA-ADR-06-service-operability.md:438-448` (controlled clock and temporary database are Author unit tests: AP-06-25, -26, the lead-time part of -28, -29, -32), `adr/LA-ADR-07-security-and-tenancy.md:217-228` (port fixtures are Author unit tests; AP-07-01, -02 are black-box per route), `adr/LA-ADR-08-onboarding-and-connection-health.md:172-182` (code rules are Author unit tests). Two items stay open as new findings: Q-LAD-14 (AP-06-21) and Q-LAD-15 (AP-06-15). |
| Q-LAD-02 | MAJOR | **Closed** | `adr/LA-ADR-06-service-operability.md:155` (the `acceptance` compose profile binds `OPERATOR_HOST=0.0.0.0`; `http://lti-service:4110`; no proxy route); `:157` (operator key file `infra/.secrets/lti-operator-key`, readable like `seed.json`); `:181` (AP-06-11 checks both the proxy and the `default` loopback bind); `contracts/lti-service-api-delta.md:188`; `operability.md:23`, `:84`. The `e2e` container mounts all of `infra/.secrets` read only (`infra/compose.yaml:465`). |
| Q-LAD-03 | MAJOR | **Closed** (P3 item open) | Rate limits: `PATCH /operator/v1/rate-limits` sets every class, also the address-keyed classes (`adr/LA-ADR-06-service-operability.md:86`; `contracts/lti-service-api-delta.md:196-197`). Trusted proxy: `proxy` only in every compose profile, so the `e2e` container is an untrusted peer (`:81`; AP-06-03 at `:110`). Key ring: fixed path `infra/.secrets/lti/keyring.json`, mounted at `/run/secrets/lti/` (`:263`; procedure AP-06-24 at `:276`). CLI production rule: `STACK_PROFILE` of the CLI process (`adr/LA-ADR-07-security-and-tenancy.md:117`). The two QA allowances are README OC-7 (`README.md:316`, owner: Lead in P3). |
| Q-LAD-04 | MAJOR | **Closed** | AP-05-03 now removes the state cookie from the framed launch request (route rule or a browser setting that also blocks partitioned cookies) and says why (`adr/LA-ADR-05-lti-advantage-completeness.md:114`; K2 row `:328`). QA aligned its own U4 wording (TEST-STRATEGY §9.1). |
| Q-LAD-05 | MAJOR | **Closed** | AP-05-09 expects today's `failed` row "No gradebook column" with no score POST (`adr/LA-ADR-05-lti-advantage-completeness.md:138`; rule `:129`); LA-ADR-03 D2 agrees (`adr/LA-ADR-03-learning-record-core.md:68`); AP-05-28 checks the Moodle-shaped case; README OC-2 closed (`README.md:311`). |
| Q-LAD-06 | MAJOR | **Closed** | `contracts/lti-service-api-delta.md:35-36` (C20, C21), `:284-302` (§4.6.1: required fields, rules 1–6, codes `PLATFORM_URL_NOT_IN_PROFILE`, `ISSUER_RESERVED`, `INVALID_SITE_URL`, check order), `:304-316` (§4.7 trait fields per profile), `:397`, `:399` (§8 D33, D35). Both codes exist in the base contract (`docs/architecture/contracts/lti-service-api.md:463-464`). LA-IC-01 names the trait fields (`adr/LA-ADR-04-refactor-and-migration.md:129`). |
| Q-LAD-07 | MAJOR | **Closed** (residual MINOR Q-LAD-19) | `adr/LA-ADR-01-channel-kernel.md:165` (extra root: function argument only; product code passes one constant root; no environment variable or knob); `:167-197` (`loadChannelFolders`, `buildChannelRegistry`, `ChannelRegistry`, `RegistryError`, `LoadedChannel`); `:217-241` (`ConnectionSetup` sketch); `:337` (K0 uses these entry points); LA-ADR-07 T1 matches (`adr/LA-ADR-07-security-and-tenancy.md:153`); README F4 (`README.md:116`). |
| Q-LAD-08 | MAJOR | **Closed by QA in this round** (Lead approval at E0) | The design rule is in `adr/LA-ADR-04-refactor-and-migration.md:113`, and the owner is QA (README OC-8, `README.md:317`). QA added LD-1 rows 7 and 8 and widened the E0 scan to exact lists and counts (TEST-STRATEGY v1.1 §4.3). A scan at `19476fc` found no other hit (§R1.6). |
| Q-LAD-09 | MAJOR | **Closed** (residual MINOR Q-LAD-21) | `README.md:119-130` (§4a: command, steps, network rule, exit codes 0/1/2, acceptance with a planted `ltis_` key); F7.6 points to §4a. |
| Q-LAD-10 | MINOR | **Closed** (residual MINOR Q-LAD-17) | `adr/LA-ADR-04-refactor-and-migration.md:63` (error and page codes `MOODLE_TOOL_MAY_EXIST`, `MOODLE_WS_ERROR`), `:64` (behaviour-class values and the legacy manual-`self` list); `adr/LA-ADR-01-channel-kernel.md:298`. |
| Q-LAD-11 | MINOR | **Closed** (residual MINOR Q-LAD-18) | `adr/LA-ADR-04-refactor-and-migration.md:41` (S2 installs F1 with today's counts as the ratchet baseline, and F3), `:48` (S9 only brings the counts to 0); `README.md:113`, `:115`. |
| Q-LAD-12 | MINOR | **Closed** | `adr/LA-ADR-01-channel-kernel.md:139` (Author unit tests and the K0 canary with the capability off). |
| Q-LAD-13 | MINOR | **Closed** (residual MINOR Q-LAD-20) | `auth_failure` default is now 120 per minute, burst 120 (`adr/LA-ADR-06-service-operability.md:99`); QA records the `401` rate per minute at E0, and the `acceptance` compose may raise `auth_failure` with `LTI_RATE_LIMITS` (`:429`). |

## R1.2 New findings

### Q-LAD-14 — MAJOR — The API key expiry point needs a wait of at least 1 hour

- **Where:** `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md:227` (D5 "Expiry: Optional, 1 hour to 2 years"); `:239` (AP-06-21); `:445` (SIM-lane acceptance "AP-06-01 to AP-06-24"); `:444` (the Author unit row has no expiry case).
- **Problem:** AP-06-21 (F5.5, Must) needs a key that is past its `expires_at`. The shortest expiry is 1 hour, and no API can set a time in the past. The design names no control for this time rule: no acceptance-only knob, and no Author unit test with a controlled clock. So the SIM-lane test must wait at least 1 hour inside a booked slot. That is not proportional (LD-4), and QA cannot control the service clock (TEST-STRATEGY §1.2).
- **Evidence:** TD-12 (TEST-STRATEGY §7.1): "Each time rule … has either a black-box control … or an Author unit test with a controlled clock; the design says which." The LA-ADR-06 Author unit row names a controlled clock only for AP-06-28, AP-06-29 and AP-06-32 (`:444`). The operator key expiry (`401 INVALID_OPERATOR_AUTHORIZATION_HEADER` for an expired key, `contracts/lti-service-api-delta.md:85`) has no point and no test either. The contract gives no answer for an `expiresAt` outside 1 hour to 2 years (`contracts/lti-service-api-delta.md:199`).
- **Fix (A2):** In LA-ADR-06 §6, add "API key and operator key expiry, with a controlled clock" to the Author unit row, and move the expiry boundary of AP-06-21 there. In SIM-lane acceptance, keep only the parts that need no wait:
  - an `expiresAt` outside 1 hour to 2 years gives a defined refusal (QA proposes `400 INVALID_REQUEST` with the field name);
  - the answer of an expired key equals the answer of an unknown key (the Author test shows it; AP-06-19 already shows it for a revoked key).

  The other option is an acceptance-only knob for the minimum expiry (tasks README §3). The design must say which option it uses.

### Q-LAD-15 — MINOR — Two E5 points need container commands that the QA rules do not allow

- **Where:** `adr/LA-ADR-06-service-operability.md:213` (AP-06-15), `:183` (AP-06-13), `:445` (SIM-lane list), `:456` (the migration test already checks the trigger), `:421` and `:432` (`stack:up` runs `lti:operator init` "once"); `README.md:316` (OC-7 names two allowances only).
- **Problem:**
  - AP-06-15 needs an `UPDATE` in a SQLite shell inside the LTI service container. The service image is `node:24.22.0-alpine3.24` (`infra/compose.yaml:16`), which has no `sqlite3` shell. The tasks README allows `docker compose exec` only for read-only commands (`docs/architecture/tasks/README.md:52`). This is a white-box check of a trigger, and the Author migration test already proves it (`:456`; LD-5). So the Must outcome stays testable, and the defect is only the QA listing.
  - AP-06-13 needs `docker compose exec lti-service npm run lti:operator -- init …`. OC-7 does not list this command.
  - AP-06-13 makes `init` exit 1 when an active operator key exists, and `stack:up` runs `init` (`:421`, `:432`). The design does not say what `stack:up` does on a stack that already has a key. If the script stops there, every `stack:up` on an existing volume fails: the M1 `migration` and `snapshot-upgrade` phases, U1, and each lane restart.
- **Fix (A2; Lead for OC-7):** Move AP-06-15 to the Author unit row (the proof is the migration test at `:456`). Add the AP-06-13 command to OC-7. Say that `stack:up` calls `init` only when no active operator key exists, or treats that refusal as "already done".

### Q-LAD-16 — MINOR — Canvas Dynamic Registration (Should) changes frozen M1 rows without an `LA-IC` id

- **Where:** `adr/LA-ADR-05-lti-advantage-completeness.md:227` (Canvas gets a `dynamic` method; `registration.dynamic` becomes true); the intended-change table `:305-315` has no row for D6; `adr/LA-ADR-04-refactor-and-migration.md:127-141` (LA-IC-01 to LA-IC-13, none for D6).
- **Problem:** When D6 ships, the Canvas legacy flag `dynamicRegistration` becomes `true` and the Canvas methods get `dynamic`. These frozen M1 assertions then fail:
  - `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218` (`CANVAS_CAPABILITIES` has `dynamicRegistration: false`);
  - `:241` (`method: dynamic` gives `422 CAPABILITY_NOT_SUPPORTED`);
  - `:257` (`canvas.methods` equals `['manual']`).

  The K0 legacy projection golden of Canvas changes too. LA-ADR-04 D6 says that a frozen-test failure without an id is a FAIL (`:114`). These are behaviour changes, not LD-1 rows.
- **Fix (A2, A1 for D8):** Add an id (for example LA-IC-14, Should) with these golden fields and frozen tests, in the same Lead-approved list as LA-IC-04.

### Q-LAD-17 — MINOR — The frozen `lms: null` of the `standard` profile has no source

- **Where:** `adr/LA-ADR-01-channel-kernel.md:248` (`ProfileLms` is replaced by `channel`), `:252` (the `lms` field stays frozen: `canvas`, `blackboard`, `null` for the baseline profiles; the channel id for new profiles); `adr/LA-ADR-04-refactor-and-migration.md:63-64` (D2 frozen values); `contracts/lti-service-api-delta.md:306`.
- **Problem:** For a new profile, `lms` is the channel id. But the profiles of the `moodle` channel must still show `lms: null`. No profile field and no `legacy-wire.ts` entry holds this value. Core then needs a rule such as "channel `moodle` gives `null`". That is an LMS name in core (F1). Without the rule, the value changes and golden G1 differs with no id. This is a TD-04 gap.
- **Fix (A1):** Add the value to LA-ADR-04 D2 "Values that core writes" (so it lives in `legacy-wire.ts`), or make it profile data, for example a field `wireLms: null` in `packages/channels/moodle/lti-profiles.ts`.

### Q-LAD-18 — MINOR — The scope file and the F5 rules have no start step

- **Where:** `README.md:99` (`fitness-scope.json` arrives in "E1 S9"), `:113` and `:115` (F1 and F3 from step S2), `:117` (F5 "0 hits", no step); `adr/LA-ADR-04-refactor-and-migration.md:41`, `:48`.
- **Problem:**
  - F1 and F3 start at S2, but the machine-readable scope file arrives at S9. From S2 to S9 the core globs must live in a second place (TD-01 asks for one list).
  - Some F5 rules are false today: the `'/lti/launch/'` literal before the account resolver (E5 D2), core reads of `connection.lms` before S4, `score_sync` before E4. If F5 starts too early, `npm run check` fails. The design does not say when each rule starts, so QA cannot plan the one failing probe per rule (TEST-STRATEGY §3.6).
- **Fix (A1, with A2 for the E5 rules):** S2 adds `fitness-scope.json`. Give each F5 rule its start step: `connection.lms` reads at S4; `score_sync` at E4 (migration `014`); `'/lti/launch/'` with E5 D2; `DELETE FROM audit_event` with E5 D4; the SQL portability lint at S2, for new SQL files only.

### Q-LAD-19 — MINOR — The `ConnectionSetup` sketch uses types that the design does not define

- **Where:** `adr/LA-ADR-01-channel-kernel.md:217-241`.
- **Problem:** The sketch uses `ToolConfigurationContext`, `PlatformBodyContext`, `CreateRequestContext`, `InitialTargetContext`, `StagedCreate`, `BindingTarget`, `GrantPurpose`, `ToolRow`, `ProfileView` and `PlatformBodyValues`, and it points to `providers/types.ts:136-160`, which is service source. QA does not read service source before it writes tests (tasks README §2). So the K-ADAPTER cases of K0 (TEST-STRATEGY §2.7) cannot be written test-first; they must wait for step S5. The registry, manifest and projection parts of K0 are fully typed, so TD-08 is met for them.
- **Fix (A1):** Say that `services/cogniate-app/src/kernel/ports.ts` is a public interface file that QA may read and import (types only) when S5 creates it, or add the context shapes to the sketch.

### Q-LAD-20 — MINOR — The no-change claim for rate limits has an escape for `auth_failure` only

- **Where:** `adr/LA-ADR-06-service-operability.md:429` (LA-IC-10 row "Rate limits"), `:94-95` (`registration` 10 per minute, burst 5, per address; `registration_account` 1 per minute, burst 20), `:102` (at most 20 open registration sessions per account, with no setting), `:112` (AP-06-05).
- **Problem:** The `acceptance` compose may raise `auth_failure` when E0 shows a suite above it. The other classes have the same risk at lower values, and the cap of 20 open sessions has no setting. A registration session lives up to 1 hour (`docs/architecture/contracts/lti-service-api.md:159`). T3b, T4b1, T6 and T7 start registrations on the `cogniate` account (for example `tests/acceptance/T3b/1-registration.spec.ts:16`, `tests/acceptance/T3b/3-negative.spec.ts:15`). AP-06-05 itself leaves 20 open sessions. On `cogniate`, every later registration test in the same lane would get `REGISTRATION_SESSION_LIMIT` for up to 1 hour.
- **Fix (A2; QA for E0):** At E0, QA records the peak rate per class and the peak count of open sessions per account (with the T7 rate record). Let `LTI_RATE_LIMITS` in the `acceptance` compose raise any class, and make the session cap part of the same `rate_limits` setting. AP-06-05 names a fresh account that the test makes with `POST /operator/v1/accounts`.

### Q-LAD-21 — MINOR — The CI script acceptance depends on live advisory data

- **Where:** `README.md:126` (step 3 `npm audit --omit=dev --audit-level=high`), `:129` (acceptance "On a clean clone: exit 0").
- **Problem:** Step 3 reads the registry advisory data at run time. A new advisory for a dependency makes a clean clone exit 1, also when the script is correct. The acceptance then cannot tell a script defect from a new dependency finding.
- **Fix (A1):** Write the acceptance per step. Steps 1, 2, 4 and 5 pass on a clean clone. Step 3 passes, or fails with the advisory ids in its output line; a step 3 failure is a dependency finding, not a script defect. The planted-key check stays the fixed negative control.

### Q-LAD-22 — NIT — Two storage points name internal rows as oracles

- **Where:** `adr/LA-ADR-05-lti-advantage-completeness.md:115` (AP-05-04 "no ltik row exists"), `:118` (AP-05-07 "stores no `storage_check` row").
- **Problem:** QA cannot read these rows. Black-box forms exist.
- **Fix (A2):** AP-05-04: "no `303` and no ltik". AP-05-07: "the answer is the error page, not the storage-check page".

## R1.3 Checklist result (TEST-STRATEGY §7.1) at `19476fc`

| Id | Result | Note |
| --- | --- | --- |
| TD-01 | met, with Q-LAD-18 | one scope table (`README.md:99-107`); the JSON copy must come at S2, not S9 |
| TD-02 | met | folder discovery, no catalog file (LA-ADR-01 D4) |
| TD-03 | met | channel folders are not workspaces (LA-ADR-01 D1) |
| TD-04 | met, with Q-LAD-17 | LA-ADR-04 D2 has the error codes and the written values (Q-LAD-10 closed); one frozen value is missing |
| TD-05 | met | `channelCapabilities` on the DTO and on `lms-providers` (LA-ADR-01 D11) |
| TD-06 | met | guard table in LA-ADR-01 D3, also `setup.connectionCheck`; `records.*` guards by unit test and canary (Q-LAD-12 closed). The C2 case of a guard whose route is not built yet is a QA kit rule (TEST-STRATEGY §9.2 item 11). |
| TD-07 | met | operator listener reachable in the `acceptance` profile (Q-LAD-02 closed); simulator records, API fields and log events exist for every port |
| TD-08 | met, with Q-LAD-19 | registry builder, loader and `ChannelRegistry` typed (Q-LAD-07 closed); the `ConnectionSetup` context types are not defined |
| TD-09 | met, with Q-LAD-16 | LA-IC-01 to LA-IC-13; Canvas DR (Should) has no id |
| TD-10 | met | LA-ADR-04 D4, D5; data-model §7; old rows for U1 |
| TD-11 | met | no simulator profile for admin-value channels (LA-ADR-02 D7) |
| TD-12 | **missing for API key expiry** | Q-LAD-14. Other time rules have a control: rate limits by operator API; lead time with `force` plus a unit test; retention, leases and job rules by unit test; `Retry-After` by a simulator option; the 120 s storage check by a unit test (or a real 121 s wait). |
| TD-13 | met | the extra root is a function argument only (LA-ADR-01 D4); the operator listener binds the stack network only in the `acceptance` profile |
| TD-14 | met | log events and codes in both contract deltas |
| TD-15 | met, except Q-LAD-14 | Q-LAD-04, -05, -06, -09 closed; Q-LAD-22 is wording only |
| TD-16 | met | S2 installs F1, F3 and the registry (K0 wiring); E2-K before E2-N (LA-ADR-02 D8) |

## R1.4 Can 2 Docker slots afford the proof?

Yes. The design did not change the cost picture of the pre-review (§3 below). LD-8 is now a Lead decision, and LA-ADR-04 D6 keeps R1 at about 30 min (M1 `sim` and M2) per E1 step; QA adds K1 and golden for about 40 min (TEST-STRATEGY §4.4).

| Item | Count | Slot time |
| --- | --- | --- |
| R1 per E1 step | 9 steps (S1–S9) | about 6 h on the SIM slot |
| R2-lite (LD-8) | 4 steps (S3, S5, S6, S7) | about 0.7–1.7 h on the Moodle slot |
| Migration steps (M1 `migration` and `snapshot-upgrade`, U1) | S4, E4 | about 45 min on the SIM slot |
| Wave-end gate | 4 waves | about 1 h SIM in parallel with about 2.5 h Moodle each |

Total: about 18–20 h of QA slot time over four waves. The local CI script (README §4a) and K0 need no Docker. Q-LAD-14 would add at least 1 h of idle slot time per run if it stays as it is. Q-LAD-20 could stop a lane if a frozen suite reaches a limit.

## R1.5 Must coverage

Every Must feature of README §7 maps to a test level (TEST-STRATEGY §8). Status:

| Feature | Status |
| --- | --- |
| F5.5 API key lifecycle | blocked by Q-LAD-14 (expiry oracle) |
| F0.3 open-world rewrite | ready: LD-1 rows 7–8 added by QA; the Lead approves the final list at E0 |
| F5.3, F5.6, F5.8 | ready; the P3 breakdown adds the QA allowances of OC-7 (and the AP-06-13 command, Q-LAD-15) |
| All other Must features (F0.1–F0.4, F1.1–F1.11, F2.1–F2.5, F2.7, F2.8, F3.1–F3.4, F4.1–F4.5, F5.1, F5.2, F5.4, F5.7, F7.1–F7.6, F8.1–F8.5) | ready; F5.9 and F4.7 have no runtime behaviour (review only) |

## R1.6 QA-owned changes in this round

These are QA files. They are not findings against the design. The Lead authorized the §4.3 change through README OC-8 (Lead answer to the QA question, 2026-10-22).

| File | Change |
| --- | --- |
| `tests/ltiaas/TEST-STRATEGY.md` v1.1 §4.3 | LD-1 rows 7 (`tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255`, exact `lms` list) and 8 (`tests/acceptance/M1/common/90-simulation-gates.test.ts:19`, exactly 6 profiles). The E0 scan also looks for exact lists and counts. A scan at `19476fc` found no other hit. `tests/acceptance/T6/1-integrations.spec.ts:24` (at least 9 cards) is already open-world. The `simulation_profiles: []` checks of the `default` profile stay true. A Should behaviour change (Q-LAD-16) needs an `LA-IC` id, not an LD-1 row. |
| `tests/ltiaas/TEST-STRATEGY.md` v1.1 §9 | §9.1: the files read at `19476fc` and what QA aligned (K0 entry points, LA-IC-12 and -13, README §4a, the U4 wording that follows AP-05-03). §9.2: item 9 (LD-1 rows, Lead approves at E0), item 10 (CI script aligned), item 11 (K1-CAP C2 only from the task that builds the guarded route; open for the Lead). |

## Pre-review (uncommitted draft, 03:31)

Kept as written at 03:31 (verdict then: FAIL, 9 MAJOR and 4 MINOR). Headings are one level lower. Line numbers in this part point into the uncommitted draft, not into `19476fc`; §R1.1 above re-checks each finding at `19476fc`.

Reviewer: QA (dedicated, independent; task LA-QT). Date: 2026-10-22. Design under review: `docs/architecture/ltiaas/**` at DESIGN_SHA_PLACEHOLDER. Checklist: [TEST-STRATEGY §7](../../../tests/ltiaas/TEST-STRATEGY.md) (TD-01 to TD-16). Lead decisions used: plan §6.1 LD-1 to LD-8 (`docs/team/ltiaas/plan.md:194-201`). QA did not read the Reviewer-A or Reviewer-B files.

### Summary

The kernel design (A1) is testable. Folder discovery, no catalog file, the capability catalog, the legacy projection, `channelCapabilities`, the intended-change ids `LA-IC-nn` and the migration tests give clear black-box oracles. The no-behaviour-change proof is affordable on 2 Docker slots (§3).

The verdict is FAIL because 9 MAJOR findings remain. Each one blocks a Must acceptance criterion from being written or run black-box. Most fixes are short text changes:

- The E5 and E3 test sections of A2 do not follow LD-5 (Q-LAD-01).
- The E5 tests cannot reach the operator API or set the E5 settings in a test stack (Q-LAD-02, Q-LAD-03).
- Three Must oracles are not achievable or not defined (Q-LAD-04, Q-LAD-05, Q-LAD-06).
- K0 has no entry-point signatures (Q-LAD-07).
- The LD-1 list misses two closed-list assertions (Q-LAD-08).
- The local CI script has no design (Q-LAD-09).

### 1. Findings

Severity follows the base charter §5 and TEST-STRATEGY §7: a Must AC without an achievable or defined oracle is MAJOR.

#### Q-LAD-01 — MAJOR — A2 test sections do not follow LD-5

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

#### Q-LAD-02 — MAJOR — The E5 tests cannot reach the operator API

- **Where:** `LA-ADR-06-service-operability.md:154` (listener `127.0.0.1:4110` inside the LTI service container, no proxy route); `:179` (AP-06-11).
- **Problem:** Most E5 Must points need operator API writes, for example AP-06-01 (`PATCH … limits`), -07 to -10, -14, -17, -19 to -22, -24 and -27 to -31. QA's suites run in the `e2e` container, which cannot reach a loopback listener in another container. The only other path is `docker compose exec` from the host for each call. The tasks README allows exec only for "the read-only commands that an AC names" and the listed M1 CLIs (`docs/architecture/tasks/README.md:52`, `:59`).
- **Fix:** In the `acceptance` compose profile only, bind the operator listener to the stack network (no proxy route) and make the operator key file readable by the `e2e` container. AP-06-11 keeps two checks: the proxy has no route, and the `default` and `production` profiles stay on loopback. If A2 prefers exec, the design must name the procedure, and the tasks README §2 allowance must list it.

#### Q-LAD-03 — MAJOR — The E5 settings cannot be changed in a test stack

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

#### Q-LAD-04 — MAJOR — AP-05-03 cannot produce the storage path in the test browser

- **Where:** `LA-ADR-05-lti-advantage-completeness.md:114`.
- **Problem:** AP-05-03 asks for "a browser that blocks third-party cookies" and expects `launch_accepted {binding: "storage"}`. The state cookie is `Partitioned` (`docs/architecture/security.md:110`). Chromium keeps a partitioned cookie in an LMS frame (`docs/architecture/adr/ADR-011-multi-lms.md:287`), and partitioned cookies are designed to work when third-party cookies are blocked. QA's only browser is Chromium (`tests/playwright.config.ts:30`). So the launch uses the cookie (binding `cookie`), and the oracle never shows. F3.1 (Must) then has no achievable black-box proof.
- **Fix:** Change the setup to "with the state cookie removed for the framed request". The test can do that with a route rule that drops the `__Host-lti_state_*` cookie, or with a browser setting that also blocks partitioned cookies; qa.md records which one. Safari stays a live row (Q16).

#### Q-LAD-05 — MAJOR — AP-05-09 has two conflicting oracles

- **Where:** `LA-ADR-05-lti-advantage-completeness.md:138` ("no dispatch row exists"); `docs/architecture/ltiaas/README.md:298` (OC-2, open); `LA-ADR-03-learning-record-core.md:63` (D2 keeps today's rule).
- **Problem:** A graded placement without a line item gives a `failed` row "No gradebook column" today (ADR-010 rule 1), and LA-ADR-03 keeps that rule until the ungraded rule (LA-IC-07, Should) ships. A test for F3.2 (Must) cannot satisfy both.
- **Fix:** Close OC-2. QA proposes: AP-05-09 expects today's `failed` "No gradebook column" row until LA-ADR-05 D5 ships.

#### Q-LAD-06 — MAJOR — No contract oracle for admin-value platform creation

- **Where:** `docs/architecture/ltiaas/README.md:300` (OC-4, open); `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:269-282` (§4.6, §4.7).
- **Problem:** K1-REG R1 and R4 for `lti-generic` and `brightspace` (F2.4, F2.5, Must) need the `POST /api/platforms` rules for admin-value profiles: an endpoint on another https origin (`endpointOrigins: any-https`), an issuer with a path, the reserved-issuer rule, and their status codes. The tests also need the trait fields on `GET /api/providers` (`endpoints`, `issuerKind`, `endpointOrigins`). The delta does not have them, so QA cannot write the expected status and code.
- **Fix:** A2 adds both rows to the delta, and contract §8 rows where they differ from LTIAAS.

#### Q-LAD-07 — MAJOR — K0 entry points have no signatures

- **Where:** `LA-ADR-01-channel-kernel.md:161` ("Tests can give the loader an extra root"); `:170` (P2 `ConnectionSetup`: responsibilities only); `LA-ADR-07-security-and-tenancy.md:140` (T1: "the test-only extra loader root is refused in the production profile").
- **Problem:** K0 (F7.1) and the canary channel (F1.11, README check F4) must be written from the design before the code (base charter §1; LD-5). The design names a "registry builder" and an extra root, but gives no signature. P2 has no type sketch, so K-ADAPTER cases cannot be written test-first. LA-ADR-07 T1 implies the extra root is a runtime setting that the production profile must refuse. That conflicts with "production code has no extra root" (LA-ADR-01 D4) and would add a test-only path to the services (TD-13).
- **Fix:**
  - Add a TS sketch of the pure registry builder in `@cogniate/channel-kernel` (for example `buildChannelRegistry({ roots, simulations })`), and say that the extra root is only a function argument, with no environment variable.
  - Add the `ConnectionSetup` interface, or name `services/cogniate-app/src/providers/types.ts:136-160` plus the listed additions.
  - Reword LA-ADR-07 T1 to match.

#### Q-LAD-08 — MAJOR — The LD-1 list misses two closed-list assertions

- **Where:** `LA-ADR-04-refactor-and-migration.md:111` ("Only the E0 open-world rewrite changes test assertions"); TEST-STRATEGY §4.3 (QA-owned list and E0 scan).
- **Problem:** When E2 adds `lti-generic` and `brightspace`, two more frozen assertions fail:
  - `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255`: the exact `lms` list of `GET /app-api/lms-providers`.
  - `tests/acceptance/M1/common/90-simulation-gates.test.ts:19`: exactly 6 profiles in the default profile.

  Neither is in R5's six rows. The E0 scan of TEST-STRATEGY §4.3 looks only for whole-object comparisons, so it would also miss them. Plan measure 3 then fails for a reason that is not a behaviour change.
- **Fix (owner: QA in the E0 brief; the Lead approves the LD-1 list):** Add both rows, with the open-world form "baseline entries present and unchanged; extras belong to registered channels". Widen the E0 scan to exact lists and counts of profiles, providers, LMS entries, cards and simulation profiles.

#### Q-LAD-09 — MAJOR — The local CI script (F7.6) has no design

- **Where:** `docs/architecture/ltiaas/README.md:277` (F7.6, Must; sources "plan §3 E7; QA strategy").
- **Problem:** Neither source fixes the tools, the network rule or the pass threshold. TEST-STRATEGY §8 E7 only says that the script exits non-zero on a planted secret. This is QA's own gap. No AC can be written for F7.6 yet.
- **Fix (owner: the Lead assigns QA or A1):** QA proposes:
  - Steps: `npm ci --ignore-scripts`; `npm run check`; `npm audit --omit=dev --audit-level=high` (read-only registry access, and a network failure is reported, not passed); the SBOM from the built-in `npm sbom --sbom-format cyclonedx`; a secret scan with fixed patterns over tracked files.
  - Pass: exit 0. A planted secret in a temp copy makes the script exit non-zero.

#### Q-LAD-10 — MINOR — The frozen wire-name list is not complete for F1

- **Where:** `LA-ADR-04-refactor-and-migration.md:57-65` (D2 table); `:85` (D4 rule 2, behaviour-class values).
- **Problem:** D2 has no row for LMS-named error and page codes that stay in core: `MOODLE_TOOL_MAY_EXIST` (`docs/architecture/contracts/cogniate-app-api.md:669`; text in `packages/shared/src/html.ts:8-12`), and `MOODLE_WS_ERROR` if it stays in core. It also has no row for the behaviour-class values `moodle`, `canvas`, `blackboard` that core writes into `connection.lms` for new channels. F1 then cannot reach 0, or an Author renames a frozen code.
- **Fix:** Add two rows ("error and page codes" and "behaviour-class values") and keep their literals only in `legacy-wire.ts`.

#### Q-LAD-11 — MINOR — The ratchet and the import fence start late

- **Where:** `LA-ADR-04-refactor-and-migration.md:41` (S2, first channel folders); `:48` (S9: "ratchet reaches 0").
- **Problem:** No step installs the F1 baseline ratchet or the F3 import fence before S9. During S1–S8 a change can add LMS names to core with no failing check. That breaks TD-16 and the plan text "ratchet from today's baseline" (`docs/team/ltiaas/plan.md:57`).
- **Fix:** S2 installs F1 with the baseline counts and F3. S9 only brings the counts to 0.

#### Q-LAD-12 — MINOR — Two guards have no black-box case

- **Where:** `LA-ADR-01-channel-kernel.md:135-136` (`records.reporters`, `records.readBack`).
- **Problem:** Every LA channel has these capabilities, so no channel lets the guard fire, and kit case C2 cannot run for them.
- **Fix:** Record them as covered by Author unit tests plus the K0 canary with the capability off. No product change is needed.

#### Q-LAD-13 — MINOR — The rate-limit regression claim covers T7 only

- **Where:** `LA-ADR-06-service-operability.md:420` (regression row); `:98` (`auth_failure` 30 per minute per client address, "also with a valid key").
- **Problem:** The acceptance suites send many expected `401` answers from one `e2e` address (M1 negative rows, T2a, T3a). If one minute holds more than 30, the next calls get `429`, and an unchanged suite fails.
- **Fix:** QA records the `401` rate per minute of the M1 `sim` phase and the legacy suites at E0. If a suite exceeds the bucket, A2 keys `auth_failure` per address and key prefix, or the change gets an `LA-IC` id.

### 2. Checklist result (TEST-STRATEGY §7.1)

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

### 3. Can 2 Docker slots afford the proof?

Yes. The costs come from measured times (TEST-STRATEGY §4.4):

| Item | Count | Slot time |
| --- | --- | --- |
| R1 per E1 step (M1 `sim`, M2, K1, golden) | 9 steps (S1–S9) | about 6 h on the SIM slot |
| R2-lite (LD-8) | 4 steps (S3, S5, S6, S7) | about 1–1.7 h on the Moodle slot |
| Migration steps (M1 `migration` and `snapshot-upgrade`, U1) | S4, E4 | about 45 min on the SIM slot |
| Wave-end gate | 4 waves | about 1 h SIM in parallel with about 2.5 h Moodle each |

Total: about 18–20 h of QA slot time over four waves. Under LD-2, Authors work without Docker by default, so this fits. The risk is batching: S3 runs in parallel with S4–S6 (`LA-ADR-04-refactor-and-migration.md:51`), so QA runs one R1 for steps that land together.

### 4. Must coverage

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
