# LA-E1-12 F1 ratchet at zero, F2 report mode and E1 fitness verification: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-12.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D10 (F1–F5); `tests/ltiaas/TEST-STRATEGY.md` §3.1–§3.6. QA-3 wrote these tests from the spec and design only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E1-12-01 | K0 | ready | `e1-done.k0.test.ts > AC-LA-E1-12-01` | `infra/scripts/fitness/f1-baseline.json` has count `0` for every core file except `packages/channel-kernel/src/legacy-wire.ts` and the applied migrations, and F1 passes in `npm run check`. |
| AC-LA-E1-12-02 | K0 | ready | `e1-done.k0.test.ts > AC-LA-E1-12-02` | `packages/channel-kernel/fitness-scope.json` equals README §4: the exception list has only `packages/channel-kernel/src/legacy-wire.ts` and the applied migrations (`packages/shared/src/config.ts` removed). |
| AC-LA-E1-12-03 | K0 | ready | `e1-done.k0.test.ts > AC-LA-E1-12-03` | F4: K0 (`npm run test:k0`) passes on the QA canary channel (`tests/ltiaas/canary/`), loaded as the extra root, with no core edit. |
| AC-LA-E1-12-04 | K0 | ready | `e1-done.k0.test.ts > AC-LA-E1-12-04` | F3 (`eslint .`) has `0` errors and the full F5 run (`npm run fitness:rules`) has `0` hits on the clean tree. |
| AC-LA-E1-12-05 | K0 | ready | `e1-done.k0.test.ts > AC-LA-E1-12-05` | The commit message of the task names the E1-done SHA, and F2 against it lists `0` core paths (`core = 0`, exit `0`) for a scratch channel `packages/channels/zz-probe/**` and fails (`core > 0`, exit `1`) when a core file is also touched. |

## K0 run (AC-01..AC-05; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-12/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-12-check-clean.log`, `e1-12-ac01-f1.log`, `e1-12-ac01-baseline-summary.json`, `e1-12-ac02-fitness-scope.json`, `e1-12-ac03-k0-canary.log`, `e1-12-ac04-f3-eslint.log`, `e1-12-ac04-f5-rules.log`, `e1-12-ac05-f2-pure.log`, `e1-12-ac05-f2-base.log`, `e1-12-ac05-f2-leaky.log`.
