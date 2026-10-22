# LA-E7-04: QA verification of the fitness checks F1–F5 (K0)

Spec: `docs/architecture/ltiaas/tasks/LA-E7-04.md`. Design: `docs/architecture/ltiaas/README.md` §4; `tests/ltiaas/TEST-STRATEGY.md` §3.1–§3.6; `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-07`, `BD-A1-09`, `BD-A1-15`, `BD-A1-16`, `BD-A1-18`, `BD-A1-19`, `BD-A1-21`); `docs/architecture/ltiaas/build-decisions-A2.md` (`BD-A2-11`, `BD-A2-13`, `BD-A2-22`). No Docker.

QA writes no second scanner. `fitness-probes.test.ts` reuses the shared helpers in `../tasks-core/LA-E1-04/fitness.ts` (TEST-STRATEGY §6 L11) to invoke `npm run fitness:lms-names` (F1), `npm run fitness:channel-diff` (F2), `npx eslint --stdin --stdin-filename` and `npm run typecheck` (F3), and `npm run fitness:rules` (F5).

## Acceptance criteria map

| AC | Label | Test (`fitness-probes.test.ts`) | Oracle |
| --- | --- | --- | --- |
| AC-LA-E7-04-01 | K0 | `AC-LA-E7-04-01: the clean tree passes F1, F3 and F5 inside npm run check` | `npm run check` exits 0 and runs `lint`, `typecheck`, `fitness:lms-names` and `fitness:rules`; `f1-baseline.json` holds positive integer counts on core paths only. |
| AC-LA-E7-04-02 | K0 | `AC-LA-E7-04-02: F1 probes (§3.2, §3.5 item 2, BD-A1-07/09/15/19, N6 legacy-wire, ratchet and dynamic channel folder)` | 22 failing token probes (identifier, vendor string, `BD-A1-09` camelCase / screaming-snake / route strings, `BD-A1-07` `lti-generic`, `d2l`, `desire2learn`, `brightspace`, template part, JSX text & attribute, import source, new migration column & string, `BD-A1-15` regex literals); 6 passing controls (TS/SQL/HTML comments, `<canvas>`, Canvas Web API tokens, `BD-A1-09` non-matching parts); `BD-A1-19` exact-token exception on `013_channel_kernel.sql`; `N6` `legacy-wire.ts` exception; ratchet `+1` fail and `-<n>` pass with decrease hint; scratch `packages/channels/zz-lms/` folder discovery (QA form (k)). |
| AC-LA-E7-04-03 | K0 | `AC-LA-E7-04-03: F3 probes of TEST-STRATEGY §3.4 fail with eslint --stdin --stdin-filename, controls pass, and root test typecheck fails on error` | 27 failing ESLint `--stdin` probes across D1 rows (1)–(8), `BD-A1-16` dynamic loading & closed file kinds, `BD-A1-18` / `BD-A2-11` `@cogniate/shared` root value imports and `fetch`/`WebSocket`/`process` globals; 4 positive controls (`manifest.ts`, `lti-profiles.ts` `BD-A1-21`, `app.ts`, `app/**`); root channel test typecheck probe (`packages/channels/zz-probe/probe.test.ts`, QA form (k)). |
| AC-LA-E7-04-04 | K0 | `AC-LA-E7-04-04: F2 probes (--paths-from core, shared-build, another-channel fail; channel-only and channel+sim+tests+docs pass; --no-renames catches core rename)` | `fitness:channel-diff -- --channel canvas --paths-from <file>` fails on core, shared-build and other-channel paths, passes on `channel:canvas` and `channel:canvas` + `sim` + `tests` + `docs`, and fails on a scratch branch rename of a core file (`--no-renames`). |
| AC-LA-E7-04-05 | K0 | `AC-LA-E7-04-05: F5 rules (sql-portability incl. BD-A2-13/22, connection-lms, audit-event-delete) fail on probes and pass on controls` + `it.runIf` pending rules | Failing `--stdin --as` probes and passing controls for `sql-portability` (all 9 statement forms, 4 `BD-A2-13` SQLite forms in migrations and inline TS SQL, `ADAPTER_ALLOW_LIST` including `014_learning_records.sql` `BD-A2-40`, `BD-A2-22` / `BD-A2-40` / `BD-A2-46` seven frozen `rowid` baseline entries across `attempts.ts`, `bindings.ts`, `results.ts` and `domain/mbz-builds.ts` or `packages/channels/moodle/app/builds.ts`), `connection-lms` (`LA-E1-06`) and `audit-event-delete` (`LA-E5-02`); `it.runIf` probes for `channel-sql-tables` (`pending: LA-E1-08`), `no-score-sync` (`LA-E4-02`) and `/lti/launch/` (`pending: LA-E5-06`). |
| AC-LA-E7-04-06 | DOC | `AC-LA-E7-04-06: the core globs inside fitness-scope.json, README §4, TEST-STRATEGY §3.1 and the checks are equal` | Parses the `| Class | Paths |` tables in `docs/architecture/ltiaas/README.md` §4 and `tests/ltiaas/TEST-STRATEGY.md` §3.1 and compares them with `packages/channel-kernel/fitness-scope.json`, `infra/scripts/fitness/common.mjs` and `eslint.config.js`. |
| AC-LA-E7-04-07 | K0 | `AC-LA-E7-04-07: (Could) F1 kit-neutrality check over tests/ltiaas/kit/suites/** gives 0 hits when present (and catches a planted hit)` | Verifies the F1 check-one-text kit-neutrality probe on neutral vs planted suite text, and scans every file under `tests/ltiaas/kit/suites/**` once `LA-E7-06` lands. |

## Run in a clean standalone clone (no Docker)

`assertDedicatedScratchClone()` in `fitness-probes.test.ts` (`A-LA-E7-04-01`) refuses to run inside `/orca/workspaces`, in any linked git worktree (`git rev-parse --git-dir` !== `--git-common-dir` or `git worktree list` > 1), or without `.git/la-qa-scratch-clone` matching `pwd -P`:

```sh
printf '%s\n' "$(pwd -P)" > .git/la-qa-scratch-clone
LA_SCRATCH_CLONE="$(pwd -P)" LA_RUN_DIR=<new-private-folder-outside-clone> \
  npx --no-install vitest run --config tests/ltiaas/fitness/vitest.config.mts --reporter=verbose
```
