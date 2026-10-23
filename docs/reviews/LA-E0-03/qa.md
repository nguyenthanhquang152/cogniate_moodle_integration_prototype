Verdict: PASS
Round: 2

# LA-E0-03 Golden outputs G1–G4: QA (Round 2 — Slots 2 and 3A Complete)

Tester: lead QA (Orca task `task_0163f40d972e`, dispatch `ctx_fa2c527b7a28`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E0-03.md`. Design: `tests/ltiaas/TEST-STRATEGY.md` §4.5–§4.7, `tests/ltiaas/GATE-RUN-PLAN.md` §4.1–§4.2.

Independence: QA wrote the golden capture and compare tool (`tests/ltiaas/golden/**`) from the task spec, `TEST-STRATEGY.md` §4.6–§4.7, the public API contracts and the frozen M1 helpers. QA read no product source, no Author notes and no reviewer file.

| Item | Value |
| --- | --- |
| Base SHA (`G-BASE`, Slot 2) | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (G-BASE `bd368ff`, product `9f8ac62`) |
| Candidate SHA (Slot 3A) | `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` (`8f1ecea`: Merge lane R `LA-E4-07` fix round 1; pre-`LA-E3-15` `4a62acb` and pre-`LA-E3-07` `a390edb`) |
| Lane and slots | Authorized `DOCKER-YES` window `05:31Z–06:25Z` (`msg_24b22de2951f`): Slot 2 (`qalead-la-1`, `qalead-la-2`) and Slot 3A (`qalead-la-3`), `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`, one stack at a time (`05:31:42Z–05:40:19Z`) |
| Golden tool files | `tests/ltiaas/golden/README.md`, `tests/ltiaas/golden/compare.mjs`, `tests/ltiaas/golden/run-golden.mjs`, `tests/ltiaas/golden/capture.golden.ts`, `tests/ltiaas/golden/vitest.config.mts`, `tests/ltiaas/golden/golden.k0.test.mjs`, `tests/ltiaas/golden/lib/compare.{mjs,d.mts}`, `tests/ltiaas/golden/lib/normalize.{mjs,d.mts}`, `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/{G1,G2,G3,G4,meta}.json`, `tests/ltiaas/golden/expected/LA-IC-{01,03,04,12,13,14,15,16,17,18,19,20,21}.json` |
| Run artifacts | Slot 2: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/` (`golden-1`, `golden-2`, `u1-seed-1b17261.json` `0600`, `logs/`); Slot 3A: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/r1-docker/` (`golden-cand`, `golden-cand-port9443`, `expected/`, `logs/`) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E0-03-01 | PASS (K1-SIM + K0) | `golden capture v1` (`g-base-1` on `qalead-la-1`, `g-base-2` on `qalead-la-2`) + `AC-04 support: the stored capture is complete (G1-G4, meta)` | `COMPOSE_PROJECT_NAME=qalead-la-1 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/ltiaas/golden/run-golden.mjs --sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6 --label g-base-1 --out .../golden-1` | `G1.json` captured on two fresh stacks (`default` and `acceptance` `GET /api/providers`, `GET /app-api/lms-providers`, both `/healthz` bodies, connection DTOs for Moodle/Blackboard/Canvas across `pending`/`registered`/`connected`/`disabled`, tool-configuration rows per baseline channel, and Canvas configuration JSON `jwk=url` and `jwk=inline` with inline public key placeholder). Port-normalized (`:9473` → `:9443`) `golden-1` compares `EQUAL: 0 differences` (`3 ms`) against `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json` (`compare-stored-vs-1-port9443.txt`). |
| AC-LA-E0-03-02 | PASS (K1-SIM + K0) | `golden capture v1` (`G2.blackboard`, `G2.canvas`) | same | `G2.json` stores OIDC parameters, token requests (assertion claims, `aud` form, scopes), score bodies, and Deep Linking response claims and items from `/__sim/records` for both `blackboard` (`17` records) and `canvas` (`18` records); `0` differences vs stored baseline (`compare-stored-vs-1-port9443.txt`). |
| AC-LA-E0-03-03 | PASS (K1-SIM + K0) | `golden capture v1` (`G3`, `G4`) | same | `G3.json` stores connection DTOs, publications (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending`), results API rows, score sync rows, and Resend answers (`failed`, `sent`, `superseded`). `G4.json` stores all tool error pages per channel (`picker`, `PUBLICATION_NOT_AVAILABLE`, `PICKER_USED`, `HANDOFF_USED`, `ROLE_NOT_ALLOWED`, `deep-link-with-resource-link`, `PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_DEPLOYMENT`, `STATE_COOKIE_MISSING`, `INVALID_STATE`, `PROVIDER_PROFILE_MISMATCH`, `SERVICE_ORIGIN_MISMATCH`, `DEPLOYMENT_NOT_ACTIVE`, plus `common` `INVALID_LTIK`, `PICKER_NOT_FOUND`, `PLAY_NOT_FOUND`), learner labels, and player status texts. `0` differences vs stored baseline. |
| AC-LA-E0-03-04 | PASS (K1-SIM) | `g-base-1` (`qalead-la-1`, `48 s` capture) vs `g-base-2` (`qalead-la-2`, `45 s` capture) | `node tests/ltiaas/golden/compare.mjs --base .../golden-1 --candidate .../golden-2` | `EQUAL: 0 differences (0 not explained), 0 expected changes missing; expected-delta files: none; 5 ms` (`logs/compare-1-vs-2.txt`). |
| AC-LA-E0-03-05 | PASS (K0 + K1-SIM) | `AC-05 normalization`, `AC-05 drop list`, `AC-05 secret scan`, `GOLDEN-SECRET-SCAN` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | `12/12` pass (`255 ms`); `0` secret hits across `g-base-1` (`128` tracked secret values), `g-base-2` (`128` values), `cand-8f1ecea` (`129` values), `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`, and all `13` `tests/ltiaas/golden/expected/LA-IC-*.json` files. |
| AC-LA-E0-03-06 | PASS (K0) | `AC-06 compare without Docker: the CLI compares the stored capture with itself in under 5 s` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | `24 ms` (`< 5,000 ms`), `EQUAL: 0 differences`. |
| AC-LA-E0-03-07 | PASS (K0) | `AC-07 negative control: one changed field in a copy of the capture fails and is named with the old and new value` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | Exits `1` and prints `DIFF G1 acceptance.providers.profiles[1].issuer (changed)`. |
| AC-LA-E0-03-08 | PASS (K0 + K1-SIM) | `AC-08 expected delta`, `cliBinding`, Slot 3A compare on `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` | `node tests/ltiaas/golden/compare.mjs --base .../golden-1 --candidate .../golden-cand --expected "LA-IC-01,LA-IC-03,LA-IC-12,LA-IC-13,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21"` | Exits `0` in `26–29 ms`: `EQUAL: 264 differences (0 not explained), 0 expected changes missing` (`logs/compare-8f1ecea.txt` and `logs/compare-8f1ecea-vs-stored-1b17261.txt`). |
| AC-LA-E0-03-09 | PASS (K1-SIM) | `golden capture v1` U1 seed rows (`u1-seed-1b17261.json` + `G3.{blackboard,canvas}.publications.*.results`) | Verified in `g-base-1`, `g-base-2`, and `cand-8f1ecea` | For both `blackboard` and `canvas`, `GET /app-api/publications/:id/results` in `G3.json` and `u1-seed-1b17261.json` (`0600`) contain score sync rows in all 5 required statuses: `sent` (`tries: 1`), `conflict` (`tries: 1`), `failed` (`tries: 1`), `superseded` (`tries: 2`), and `pending` (`tries: 2`). |

## Slot 3A Candidate Capture & Compare on Integration SHA `8f1ecea` (`8f1eceadb8e4e116ec34deb6dbb85f142741f7fc`)

- **Why `8f1ecea`:** Integration SHA `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` (Merge lane R `LA-E4-07` fix round 1; Lead check green: `3079` unit, `254` infra on rerun, `149` K0, `F1` `0`, `F5` `6`) precedes the two E3 merges whose LD-9 records were pending at slot start (`LA-E3-15` `4a62acb` for `LA-IC-14` and `LA-E3-07` `a390edb` for `LA-IC-04`).
- **Capture (`qalead-la-3`):** `COMPOSE_PROJECT_NAME=qalead-la-3 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16` completed in `1m 48s` (`45 s` in-container capture, `129` tracked secret values, `0` secret hits, `0` leftover Docker resources).
- **Expected-Delta Set Used (`11` IDs):**
  1. `LA-IC-01` (`tests/ltiaas/golden/expected/LA-IC-01.json` — additive `channel`, `channelName`, `channelCapabilities`, `family`, `registration` on `G1.*.lmsProviders.lms[*]`; `channel`, `channelName`, `channelCapabilities`, `bindingAuthority` on `G1.connections[*]`, `G1.connectionList.connections[*]`, and `G3.{blackboard,canvas}.connection`; `channel`, `endpoints`, `issuerKind`, `endpointOrigins` on `G1.*.providers.profiles[*]`; plus the E2 `lti-generic` and `brightspace` entries in `G1.*.lmsProviders.lms[3..4]` and `G1.*.providers.profiles[6..9]`, with all `8` baseline profiles verified `100%` equal on every baseline field).
  2. `LA-IC-03` (`tests/ltiaas/golden/expected/LA-IC-03.json` — Moodle `standard` DR `path-prefix` issuer rule and full-URL equality check; `0` golden diffs on baseline).
  3. `LA-IC-12` (`tests/ltiaas/golden/expected/LA-IC-12.json` — Deep Linking `Cancel` button text on `G4.blackboard.pages.picker.text` and `G4.canvas.pages.picker.text` from `LA-E3-05`, plus `LA-E3-04` service part; `2` golden diffs explained).
  4. `LA-IC-13` (`tests/ltiaas/golden/expected/LA-IC-13.json` — Could gaps `scoreGiven: null`, NRPS `service_versions`, `trustedAudiences`; `0` golden diffs on baseline).
  5. `LA-IC-15` (`tests/ltiaas/golden/expected/LA-IC-15.json` — `G3.{blackboard,canvas}.publications.B-conflict.results[0].scoreSyncs[0].lastError` channel-parameterized `409 PLATFORM_CONFLICT` text; `2` golden diffs explained).
  6. `LA-IC-16` (`tests/ltiaas/golden/expected/LA-IC-16.json` — `G1.acceptance.ltiHealth.outbound_allowlist` `.sim.test` set comparison against `tests/sim/hosts.json`; `1` golden diff explained).
  7. `LA-IC-17` (`tests/ltiaas/golden/expected/LA-IC-17.json` — `BD-A1-41` strict `POST /app-api/connections` schema; `0` golden diffs on baseline).
  8. `LA-IC-18` (`tests/ltiaas/golden/expected/LA-IC-18.json` — `BD-A1-50` shared-platform unconfigured portal notice; `0` golden diffs on baseline).
  9. `LA-IC-19` (`tests/ltiaas/golden/expected/LA-IC-19.json` — `BD-A1-57` launch `family_guard_mismatch` warning vs refusal; `0` golden diffs on baseline).
  10. `LA-IC-20` (`tests/ltiaas/golden/expected/LA-IC-20.json` — `BD-A1-63`/`81`/`90` `ChannelErrorNotice` fallback; `0` golden diffs on baseline).
  11. `LA-IC-21` (`tests/ltiaas/golden/expected/LA-IC-21.json` — `BD-A1-93` DR update preserves stored `active` value; `0` golden diffs on baseline).
- **Comparison Result:**
  - `g-base-1` (`:9473`) vs `cand-8f1ecea` (`:9473`): `EQUAL: 264 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-12, LA-IC-13, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 29 ms` (`exit 0`).
  - Committed `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`:9443`) vs port-normalized `cand-8f1ecea-port9443` (`:9443`): `EQUAL: 264 differences (0 not explained), 0 expected changes missing; 26 ms` (`exit 0`).
  - Zero differences in `G2` (`blackboard` and `canvas` OIDC, token assertions, Deep Linking items, and score payloads are byte-for-byte identical to `G-BASE`).

## Docker Boundary Records (`GATE-RUN-PLAN.md` §3.2, §3.3)

- **Before-slot snapshot (`05:31:42Z`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/logs/before-{ps,networks,volumes,volumes-inspect}.{txt,json}` (`0` running containers; networks `bridge`, `host`, `none`; `32` protected baseline volumes).
- **After-slot snapshot (`05:40:19Z`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/r1-docker/logs/after-{ps,networks,volumes,volumes-inspect}.{txt,json}` (`0` running containers; networks `bridge`, `host`, `none`; `32` protected baseline volumes).
- **Boundary diffs:** `0` diffs on `docker ps`, `0` diffs on `docker network ls`, `0` diffs on `docker volume ls -q`, `0` diffs on `docker volume inspect` JSON (`375` lines), and `0` leftover `qalead-la-*` containers, volumes, or networks.
- **Background watcher:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/logs/docker-ps-watch.log` confirmed at most one `qalead-la-<n>` stack ran at any time during `05:31Z–05:40Z`.

---

## Round 1 Archive (2026-10-22, Host-Only Tool Verification)

- Built `tests/ltiaas/golden/**` and verified `AC-LA-E0-03-05..08` (`K0`, `9/9` pass in `212 ms`) while `AC-LA-E0-03-01..04, 09` awaited an authorized LA Docker window.
