# LA-E1-04 fitness tools F1, F2 and the F5 rule runner: QA-3 acceptance tests (K0)

Spec: `docs/architecture/ltiaas/tasks/LA-E1-04.md`. Design: `docs/architecture/ltiaas/README.md` §4 (F1, F2, F5); `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D10; `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D8; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D1; `tests/ltiaas/TEST-STRATEGY.md` §3.1–§3.3, §3.5, §3.6. QA-3 wrote the tests from these files only (test-first). No Docker.

| AC | Label | Test (`fitness.k0.test.ts`) | Oracle |
| --- | --- | --- | --- |
| AC-LA-E1-04-01 | K0 | `AC-LA-E1-04-01: the clean tree passes F1 inside npm run check …` | `npm run check` exits 0 and runs the F1 step (`fitness:lms-names`); `infra/scripts/fitness/f1-baseline.json` holds positive integer counts per core path with a hit, and `e1-04-f1-baseline-summary.json` records `{ files, total }` for qa.md. |
| AC-LA-E1-04-02 | K0 | `AC-LA-E1-04-02: probes at core paths fail …` | `--stdin --as <core path>` fails and prints `path:line:col "<token>" banned "<word>"` for an identifier (`createMoodleWsClient`), a string (`"canvas"`), a template part (`/blackboard/`), JSX text (`Moodle`), an import source (`moodle-client`) and a new migration column (`moodle_x`). |
| AC-LA-E1-04-03 | K0 | `AC-LA-E1-04-03: comment-only text, a <canvas> element, HTMLCanvasElement and "generic" pass` + `AC-LA-E1-04-03 (lti-generic part)` | Comment-only text, `<canvas>`, `HTMLCanvasElement` and `"generic"` alone pass with 0 hits. The `ltiGeneric` and `"lti-generic"` probes run when `packages/channels/lti-generic` exists (else pending E2; AC-04 proves the same multi-part folder rule with `zz-lms`). |
| AC-LA-E1-04-04 | K0 | `AC-LA-E1-04-04: a new scratch folder packages/channels/zz-lms/ bans zzLms …` | Scratch `packages/channels/zz-lms/manifest.ts` (QA form (k)) makes `zzLms` and `"zz-lms"` fail with no edit of the banned list, while `"lms"` or `"zz"` alone passes; clean-up removes `zz-lms/`. |
| AC-LA-E1-04-05 | K0 | `AC-LA-E1-04-05: ratchet: a higher count exits 1 …` | Raising a baseline file's count by 1 exits 1 and prints `+1`; lowering the count to 0 exits 0 and prints `-<n>`. |
| AC-LA-E1-04-06 | K0 | `AC-LA-E1-04-06: a frozen wire name passes in legacy-wire.ts …` | `canvasConfiguration` passes at `packages/channel-kernel/src/legacy-wire.ts` and fails at any other core path. |
| AC-LA-E1-04-07 | K0 | `AC-LA-E1-04-07: F2 --paths-from …` | `npm run fitness:channel-diff -- --base <sha> --channel canvas --paths-from <file>`: a core path (`core`) and another channel folder path (`core`) exit 1; `channel:canvas`, `sim`, `tests` and `docs` paths exit 0; every path is listed with its class. |
| AC-LA-E1-04-08 | K0 | `AC-LA-E1-04-08: F2 on a scratch branch that renames a core file …` | A temporary scratch branch that `git mv`s a core file into `packages/channels/canvas/` exits 1 and classes the old core path as `core` (`--no-renames`); clean-up deletes the branch and restores the detached HEAD. |
| AC-LA-E1-04-09 | K0 | `AC-LA-E1-04-09: F5: a new migration with a listed SQL statement fails …` | `npm run fitness:rules -- --stdin --as <path>` fails on a new migration path with a SQL portability statement (default `INSERT OR REPLACE`; override with `LA_SQL_PROBE` and `LA_SQL_PROBE_NAME` if needed) and names the statement; the same text at an applied migration path passes. qa.md also copies the statement list from `infra/scripts/fitness/rules/sql-portability.mjs`. |
| AC-LA-E1-04-10 | K0 | `AC-LA-E1-04-10: F5: a probe rule file in rules/ runs in npm run check …` | Scratch `infra/scripts/fitness/rules/zz-qa-probe.mjs` (copied from `zz-qa-probe-rule.mjs`, QA form (k)) runs by folder discovery in `npm run check` with no runner edit and fails the check naming `zz-qa-probe`; clean-up removes the probe rule and leaves `git status --porcelain` empty. |

## Run (no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-04/vitest.config.mts
```

- Shared helper file: `fitness.ts` in this folder wraps `fitness:lms-names`, `fitness:rules` and `fitness:channel-diff` (tasks README §3). Other QA-3 task suites (`LA-E1-02`, `LA-E1-03`, `LA-E1-06`) import `fitness.ts` rather than copying it (TEST-STRATEGY L11).
- Artifacts in `LA_RUN_DIR` (umask 077): `e1-04-check-clean.log`, `e1-04-f1-baseline-summary.json`, `e1-04-ac02-probes.log`, `e1-04-ac05-ratchet.log`, `e1-04-ac07-f2.log`, `e1-04-ac08-rename.log`, `e1-04-ac09-f5.log`, `e1-04-check-probe-rule.log`.
- Closing the pending F1 part of `AC-LA-E1-01-04`: when LA-E1-04 lands, also run `f1Text` on the three LA-E1-01 files (`services/cogniate-app/src/clients/lti-client.ts`, `services/cogniate-app/src/providers/index.ts`, `services/cogniate-app/src/app/connections.ts`) at G-BASE (`bd368ff`) and at the LA-E1-01 SHA (`20648c2` / `3d20c71`) and record in `docs/reviews/LA-E1-01/qa.md` that none rose.
