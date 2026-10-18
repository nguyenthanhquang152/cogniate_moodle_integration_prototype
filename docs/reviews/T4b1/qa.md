Verdict: PASS
Round: 2

# T4b1 QA verification

| Item | Value |
| --- | --- |
| SHA | `716a72c9edf7a5205d705adff8ad5598bdc6bb3d` (T4b1 round 2 `0fc5e33`, T4b2 `4c6a04d`, QA tests incl. AC-T4-36) |
| Spec | `tasks/T4b1.md` at `2cf7d33` (AC-T4-36 no adoption, every registration update refused), contract `cogniate-app-api.md` §4, security §2.5, §2.6 |
| Scope of the run | T4a (regression), the T3b registration ACs (regression: the registration code changed), T4b1 and T4b2 on project `qa-t4b-r1`. AC-T3-29 and AC-T3-30 were not re-run: they need the T3a state, and they test LTI service line-item code that T4b does not change. |
| Tests used | The SHA tests plus QA-side fixes (section 3), with `--replace-tests` for the T4b runs. Changed: `lib/moodle-reg.ts`, `lib/moodle-dl.ts`, `T4b2/5-negative.spec.ts`, `host/run-t4a.mjs`, `host/run-t4b.mjs`. The Lead can commit `tests/**`. |
| Runners | `run-t4a.mjs --sha 716a72c…` (T4a), then `run-t4b.mjs --sha 716a72c… --tasks T3b,T4b1,T4b2 --replace-tests`: pass 1, two knob passes, `seed:lti-activity`, pass 2. |
| Isolation | The Author's stack was not touched by QA. After each run: 0 QA containers, 0 volumes, 0 networks. (Another team stack, `cogniate-codex`, appeared on the host during the runs; QA did not touch it.) |
| Evidence roots | T4a: `tests/host/artifacts/qa-t4b-r1-716a72c9-2026-10-18T06-06-45-063Z/`. T3b + T4b1 + T4b2: `E` = `tests/host/artifacts/qa-t4b-r1-716a72c9-2026-10-18T06-13-44-984Z/` (`container-pass1`, `container-knob-REF_TTL_SECONDS`, …) |

## 1. Results per acceptance criterion

All T4b1 tests passed in the T4b run (`E/container-pass1/playwright-results.json`, `E/container-knob-REF_TTL_SECONDS/`).

| AC | Result | What QA saw |
| --- | --- | --- |
| AC-T4-07 | PASS | `POST /app-api/connections` (dynamic) → 201 `pending`, with a registration URL of the LTI service and a 43-character ref. |
| AC-T4-08 | PASS | The confirm page shows in Moodle's frame (site URL, Moodle version, library, privacy text). A real click on "Connect" closes the dialog and registers a Pending tool. The connection becomes `registered`. |
| AC-T4-09 | PASS | A used registration URL → `REF_INVALID`. A connection for `https://other.test` used from Moodle → `SITE_MISMATCH`. Knob pass (`REF_TTL_SECONDS=20`): a URL used at TTL + 3 s → `REF_EXPIRED`. |
| AC-T4-10 | PASS | Library B's manual connection: the 16 tool-configuration rows (§4.1), a manual Moodle tool, the six values back → `registered`. A JWKS URL on `evil.test` → 422. |
| AC-T4-12 | PASS | Publish → 201 `available`. Again → 200 with the same id. Withdraw, then publish → `available`. |
| AC-T4-14 | PASS | Publish to a pending connection → 409 `CONNECTION_NOT_READY`. |
| AC-T4-30 | PASS | Library B chooses "update" of Thanh's tool → the frame shows `UPDATE_NOT_ALLOWED` with "Go back in Moodle and choose Register as a new tool". Thanh's tool and connection do not change. "Register as new" → library B gets its own tool. |
| AC-T4-33 | PASS | Register page headers are correct. `POST /tool/register` with a foreign, `null` or missing `Origin` → 403. An unknown ref shows `REF_INVALID` in the frame. |
| AC-T4-34 | PASS | Tenant matrix: library B gets 404 for Thanh's connection, publication and course-version endpoints. |
| AC-T4-36 | PASS | (1) `PUT …/platform` with the six values of the seed tool "Cogniate (seed)" on a new pending library-B connection → 409 `PLATFORM_IN_USE`. The connection stays `pending`, the seed platform stays active, and a seed launch still works. (2) The same with Thanh's tool values → 409 `PLATFORM_IN_USE`; Thanh's connection and platform do not change, and Thanh's platform stays active. (3) Library B's own AC-T4-10 `PUT` again → 200, with the same platform. |

### Regression in the same round

| Suite | Result |
| --- | --- |
| T4a (`run-t4a.mjs`) | PASS, AC-T4-01 to -06 and AC-T4-35. Folders in `/data/packages`: 4 before and 4 after the rejects. No `evil.html` or `abs.html`. |
| T3b registration ACs (pass 1 of the T4b run) | PASS: AC-T3-01, -02, -03, -04, -05, -25, -26, -28. |

### Notes for this round

| Note | QA result |
| --- | --- |
| The app refuses every registration update with `UPDATE_NOT_ALLOWED` | Agrees (AC-T4-30). The LTI service still allows `updatePlatformId` (AC-T3-26 PASS in the same run). |
| AC-T4-36, `409 PLATFORM_IN_USE` | PASS (above). |
| Connection `lastError` (contract §4) | No T4b1 AC names it. Not covered. |
| `platform_orphan_deactivated` | No T4b1 AC names it. Not covered. |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.

### Q-T4b1-01 — NIT — PUT on a registered connection: the contract row and AC-T4-36 (3) disagree (owner: Architect)

- **Location:** `cogniate-app-api.md` §4, the `PUT …/platform` row ("Only for a `pending` manual connection, else `409 CONNECTION_NOT_PENDING`"), and `tasks/T4b1.md` AC-T4-36 (3) / security §2.6 ("a repeat of the same call, `200`").
- **Observation:** The product follows AC-T4-36 (3): a repeat of library B's own `PUT` gives 200 with the same platform.
- **Suggested fix:** Change the contract row to "else `409 CONNECTION_NOT_PENDING`, except a repeat of the call that bound this connection's platform (`200`)".

## 3. QA-side changes in this round

1. **`run-t4a.mjs`:** `npm run test:acceptance` switches the acceptance profile on and off, which recreates the `cogniate-app` container. The runner now looks the container up again after the rejects pass. The first T4a run (`…06-04-41-047Z`) failed only because its container id was stale.
2. **`run-t4b.mjs`:** a `--tasks` option (the T3b registration ACs in pass 1) and an `--only` option (one focused pass: the setup chain plus the named ACs).
3. **`lib/moodle-reg.ts`:** after saving an edited tool, Moodle 5.2.4 returns to `admin/settings.php?section=modsettinglti`, not to `toolconfigure.php`. The helper accepts both pages, then reads the saved values back from the form. This failure stopped the first T4b run (`…06-08-17-072Z`) in `SETUP-T4b2`.
