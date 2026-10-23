# LA-E5-22 app key provider (`APP_MASTER_KEY` blobs): QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-22.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D6 ("Scope in LA"), D10, D12; `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D5 (`PortContext.seal`/`unseal`); `docs/architecture/ltiaas/operability.md` §2, §4.4, §6.3; `docs/architecture/ltiaas/security-delta.md` §10; `docs/architecture/ltiaas/build-decisions-A2.md` §37 BD-A2-77..80, §44 BD-A2-91; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-72. QA-2 wrote these tests from the spec, contracts, ADRs and infra rules only (test-first).

## AC map

| AC | Test / Runner | Label | Status | What it checks |
| --- | --- | --- | --- | --- |
| `AC-LA-E5-22-01` | `u1.test.ts` + `run.mjs` (`QA_LA_PHASE=old` → `new`) | `K1-SIM` | `pending: Docker window` | Upgraded stack with only `APP_MASTER_KEY` starts, hides `infra/.secrets/app-keys` from `e2e`, and old sealed values still work: a launch, a pick and a score dispatch succeed (upgrade route U1). |
| `AC-LA-E5-22-02` | `app-key-provider.k0.test.ts` + Author unit tests (`sealing.test.ts`) | `UNIT` | ready (no Docker) | A value sealed after the change starts with the versioned `"cgk1"` header and opens; a legacy blob also opens (temporary database). |
| `AC-LA-E5-22-03` | `app-key-provider.k0.test.ts` + Author unit tests (`sealing.test.ts`) | `UNIT` | ready (no Docker) | A blob copied to the same column of a row of another library (or another row key / column / table) does not open (`app:<table>:<column>:<library_id>:<row key>`). |
| `AC-LA-E5-22-04` | `app-key-provider.k0.test.ts` + Author unit tests (`launch-rules.test.ts` / `sealing.test.ts`) | `UNIT` | ready (no Docker) | `runtimeTokenFor` gives the exact byte-identical value as before the change for a fixture `playId` (`macSync('runtime-token', 'legacy', ...)`). |
| `AC-LA-E5-22-05` | `app-key-provider.k0.test.ts` + Author unit tests (`config.test.ts` / `sealing.test.ts`) | `UNIT` | ready (no Docker) | `APP_MASTER_KEY_FILE` gives the same key as `APP_MASTER_KEY` with the same value; enforces secret-file mode (`0600`/`0400`, `fstat` on descriptor, `production` refuses group/world bits), case-insensitive hex compare, `APP_KEYRING_FILE` default `/run/secrets/app-keys/keyring.json`, ring rules (missing `legacy` refused), and `production` refusal `app_master_key_in_env`. |
| `AC-LA-E5-22-06` | Moodle live lane (`A-LAB-09`) | `MOODLE-LIVE` | `pending: Docker window` | On the Moodle lane, after the upgrade, one Moodle course shell call with the sealed web-services token succeeds. |

## Host-only K0 and UNIT checks (no Docker)

In a clean clone of the integration SHA (`rm -rf node_modules/.vitest-cache` before every Vitest run):

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-22/tsconfig.json
rm -rf node_modules/.vitest-cache
LA_LEVEL=k0 npx --prefix tests vitest run -c tests/ltiaas/tasks-ops/LA-E5-22/vitest.config.mts
```

## K1-SIM run on upgrade route U1 (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-22/run.mjs --sha <candidate-sha> --old-sha <pre-LA-E5-22-sha>
```
