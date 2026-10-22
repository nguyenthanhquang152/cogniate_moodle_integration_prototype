# LA-E2-03 Kernel admin-value setup adapter and the `lti-generic` channel: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E2-03.md` (at `f01bfcd`). Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D2 (`FieldSpec.default`), D4, D5 (kernel admin-value setup adapter); `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D2, D2a, D3, D8; `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D1 rule 1a, D3b, D4; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §1–§3; `tests/ltiaas/TEST-STRATEGY.md` §2.7, §3.3, §8 E2. QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E2-03-01 | K0 | ready | `lti-generic.k0.test.ts > AC-LA-E2-03-01` | The `lti-generic` manifest passes the schema; its capability set equals the LA-ADR-02 D3 table plus the E3 values of AC-09 and AC-10; its legacy flags are `dynamicRegistration` true, `operatorApproval` true, `addDeployment` true, `webServices`, `courseShell` and `canvasConfiguration` false. |
| AC-LA-E2-03-02 | K0 | ready | `lti-generic.k0.test.ts > AC-LA-E2-03-02` | E2-K exit check (LA-ADR-02 D8): a canary folder with an admin-value profile and no `app.ts` (`tests/ltiaas/canary/zz-canary-admin`) passes K0. |
| AC-LA-E2-03-03 | K1-SIM | pending: Docker window | `lti-generic.k1sim.test.ts > AC-LA-E2-03-03` | `GET /app-api/lms-providers` lists `lti-generic` after the three baseline entries with `channelName: "your LMS"` and `registration` `[{dynamic, self}, {manual, operatorGrant}]`; baseline entries unchanged. `GET /api/providers` lists `lti-generic` after the baseline real profiles and before the simulation profiles. |
| AC-LA-E2-03-04 | K1-SIM | pending: Docker window | `lti-generic.k1sim.test.ts > AC-LA-E2-03-04` | `POST /app-api/connections {lms: "lti-generic", method: "manual", siteUrl}` with an IP literal, `localhost` or one of our hosts gives `422 INVALID_SITE_URL` with `details.rule`; a valid https origin gives `201` with `channel: "lti-generic"`, `profile: "lti-generic"` and authority `operatorGrant`. |
| AC-LA-E2-03-05 | K1-SIM | pending: Docker window | `lti-generic.k1sim.test.ts > AC-LA-E2-03-05` | `GET …/tool-configuration` of an `lti-generic` connection gives the rows `tool_name`, `login_url`, `redirect_uri`, `target_link_uri`, `jwks_url`, `deep_linking_url`, `scopes`, `privacy` in this order, with the values of app API delta §3.3. |
| AC-LA-E2-03-06 | UNIT | ready | `lti-generic.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-03-"`) | Admin-value strict body: an unknown or missing field is refused; an `issuer` whose origin differs from `siteUrl` is refused; a `FieldSpec.default` with `{siteUrl}` gives the filled value, and a posted value replaces it. |
| AC-LA-E2-03-07 | K1-SIM | pending: Docker window | `lti-generic.k1sim.test.ts > AC-LA-E2-03-07` | Through the LTI service, an active `POST /api/platforms` with profile `lti-generic` and the token endpoint on another host gives `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`, and the staged create of the same values gives an inactive platform (proves LA-E2-01 end to end). |
| AC-LA-E2-03-08 | UNIT | ready | `lti-generic.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-03-"`) | Load check 6: an `lti-generic` manifest variant with `manual` → `self` stops the start (the channel is not in `MANUAL_SELF_LEGACY_CHANNELS`). |
| AC-LA-E2-03-09 | K0 | ready | `lti-generic.k0.test.ts > AC-LA-E2-03-09` | `capabilities('lti-generic')` has `content.multiple: true` (the precondition of A2's AC-LA-E3-05-01). |
| AC-LA-E2-03-10 | K0 | ready | `lti-generic.k0.test.ts > AC-LA-E2-03-10` | `capabilities('lti-generic')` has `registration.scopes` equal to the four AGS scopes `lineitem`, `lineitem.readonly`, `result.readonly`, `score`, and no NRPS scope. |
| AC-LA-E2-03-11 | K0 | ready | `lti-generic.k0.test.ts > AC-LA-E2-03-11` | The `lti-generic` profile has `platformStorage` = `{ targetFrame: 'from-login', origin: 'authOrigin' }` (A2 LA-ADR-05 D1 rule 1a). |

## K0 and UNIT-row run (AC-01, AC-02, AC-06, AC-08, AC-09, AC-10, AC-11; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-03/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e2-03-check-clean.log`, `e2-03-ac01-09-10-manifest.json`, `e2-03-ac11-profile.json`, `e2-03-ac02-k0-canary.log`, `e2-03-unit-rows.log`.

## K1-SIM run (AC-03, AC-04, AC-05, AC-07; pending: Docker window)

Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2).
