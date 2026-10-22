# LA-E1-03 channel build model and the import fence F3: QA-3 acceptance tests (K0)

Spec: `docs/architecture/ltiaas/tasks/LA-E1-03.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D1 (build model, import table); `docs/architecture/ltiaas/README.md` §4 F3; `tests/ltiaas/TEST-STRATEGY.md` §3.4, §3.5 item 3. QA-3 wrote the tests from these files only (test-first). No Docker.

| AC | Label | Test (`build-model.k0.test.ts`) | Oracle |
| --- | --- | --- | --- |
| AC-LA-E1-03-01 | K0 | `AC-LA-E1-03-01: a type error in packages/channels/zz-probe/manifest.ts …` | Scratch `packages/channels/zz-probe/manifest.ts` (QA form (k)) with a type error makes `npm run check` exit non-zero at the `typecheck` step and name the probe file before `test:unit` starts; clean-up removes `zz-probe/`. |
| AC-LA-E1-03-02 | K0 | `AC-LA-E1-03-02: a failing test packages/channels/zz-probe/probe.test.ts …` | Scratch `packages/channels/zz-probe/probe.test.ts` makes `npm run check` exit non-zero at the `test:unit` step, name the failing test and stop before `test:infra`; clean-up removes `zz-probe/`. |
| AC-LA-E1-03-03 | K0 | `AC-LA-E1-03-03: F3 probes with eslint --stdin …` | `eslint --stdin --stdin-filename <path> --format json` gives a severity-2 import-rule error for each D1 rule: (1) core imports a channel folder; (2) channel imports another channel folder; (3) `manifest.ts` imports anything other than `@cogniate/channel-kernel` types; (4a) `app.ts` and (4b) `<id>/app/*` import `services/**/domain/**` (AP-07-03); (5) `<id>/portal/*` imports portal code outside `apps/portal/src/sdk/`. Positive control: `manifest.ts` importing a `@cogniate/channel-kernel` type gives 0 import-rule errors. |
| AC-LA-E1-03-04 | K0 | `AC-LA-E1-03-04: the clean tree passes F3 inside npm run check with 0 errors` | `npm run check` on the clean tree exits 0 and includes the `lint` step. |
| AC-LA-E1-03-05 | K0 | `AC-LA-E1-03-05: a scratch channel folder is typechecked, linted and tested …` | Scratch `packages/channels/zz-probe/{manifest.ts,lti-profiles.ts,probe.test.ts}` (diff touches only `packages/channels/zz-probe/**`) is run by the root Vitest, linted by ESLint (not ignored), and checked by `npm run typecheck` with no edit of a root build file; clean-up leaves `git status --porcelain` empty. |

## Run (no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-03/vitest.config.mts
```

- `LA_SCRATCH_CLONE` must equal the clone root, and `git status --porcelain` must be empty before the run (`requireScratchClone` refuses to write scratch files in a dirty or shared worktree).
- Artifacts in `LA_RUN_DIR` (umask 077): `e1-03-check-clean.log`, `e1-03-check-type-error.log`, `e1-03-check-failing-test.log`, `e1-03-ac03-eslint.log`, `e1-03-ac05-vitest.log`, `e1-03-ac05-typecheck.log`.
- Regression R0: the clean-tree `npm run check` run of AC-04 (`e1-03-check-clean.log`); qa.md records the Vitest and infra counts next to the LA-E0-01 numbers.
