Verdict: APPROVE
Round: 1

# LA-E7-03 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff fbec03d 6d201e2` (lane `la-s1`; merged as `211ff31`). The dispatch named `fbec03d a67d44f`, but that range stops one commit early: it holds only the two B-LA-E5-08-03 commits (`04900cc`, `a67d44f`). The LA-E7-03 commit `6d201e2` sits on top of them. I reviewed all three commits. `git diff 4cb0376 211ff31` gives the same diff for these files, and the files at `HEAD` are the same.
- References: `docs/architecture/ltiaas/tasks/LA-E7-03.md`; LA-ADR-02 D7; README F7.4. A1's ratification is not committed yet: the new README §4b "Simulator host manifest" (BD-A1-01) and one new design note in the spec. `build-decisions-A1.md` does not exist yet. I read §4b after my own findings, and I mark where the code differs from it.
- I ran the tests on the host (no Docker): `sim-hosts.test.mjs` passes 20 of 20 with the host `bash` 3.2.57. `main.test.ts` and `cli/bootstrap.test.ts` pass 5 of 5. The tree stayed clean.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 3 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| No behaviour change when the file is absent | Correct. The fallback lists are today's lists (`infra/scripts/lib.sh:88-91`): 8 allowlisted hosts and 10 aliases (`lms-sim.test`, the 8 hosts, `canvas.school-a.sim.test`). These 10 are the same set as the old compose aliases. `gen-certs.sh:24` gets the same SAN list. The base compose loses the alias list, but `lms-sim` is `profiles: ["acceptance"]`, and in that profile `dc()` always adds the generated override (`lib.sh:191-196`). So the `default` profile had no simulator alias before and has none now. Only a file that does not exist selects the fallback (`[[ ! -e && ! -L ]]`). A dangling symlink, a folder or an unreadable file fails (test "unreadable manifest path"). |
| Fail-closed validation | Yes, for every case in the code. Bad JSON, `version` ≠ 1, no `providers` array, a non-object entry, an empty or duplicate `id`, empty `aliases`, a missing `allowlist`, a host that is not a string, not lower-case DNS form or not under `.test`, a reserved host, and an `allowlist` host that is not in its own `aliases` all fail with exit 1. Each failure prints one line before any compose call and leaves an old override unchanged. Each case has a test. The `.test` rule matches the dev CA name constraint (`permitted;DNS:test`). Gaps against §4b: A-LA-E7-03-01. |
| Shell safety | Yes. Host names enter the shell only after the strict label pattern check. They pass to `node` as argv, `printf ',%s'` joins them, and `JSON.stringify` writes the override (atomic rename). The test case `$(touch unsafe).test` is refused. |
| Who can reach the allowlist | Partly limited. An allowlisted host must be one of the provider's own aliases, so its name resolves to `lms-sim`. The reserved list (`STACK_HOSTS`, `evil.test`, `qa-platform.test`, `lti-gate.test`) covers every other `.test` alias in compose today (proxy ×4, sink, qa-platform, lti-gate). Two gaps remain. The control alias `lms-sim.test` can enter the allowlist. And the reserved list is written by hand, so a future compose alias is not reserved by default. See A-LA-E7-03-01. |
| `default` profile (AC-03, logic) | Yes. `default` gets no override and empty `ACCEPTANCE_*` values, also after an `acceptance` call in the same shell with an old override on disk (test). |
| SANs (AC-01, AC-02, logic) | Yes. `gen-certs.sh` re-issues the QA leaf when the name set changes, keeps it when the set is the same, and never changes the public stack leaf (tests). |
| Entry-guard fix (B-LA-E5-08-03) | Correct for the two files it touches. `import.meta.main` (Node ≥ 24.2; root `engines` ≥ 24.11, image 24.22) is true for the entry module after Node resolves the symlink. The old `resolve(argv[1]) === fileURLToPath(import.meta.url)` compares the link path with the real path, so it was false and the process ended with exit 0 and no output. Both new tests spawn the real file through a symlink, and both fail on the old code: `main.ts` must exit 1 with the config error, and `bootstrap.ts` must print its JSON line. Under vitest, `import.meta.main` is false, so the imports in other tests do not start a service. Two other entry points keep the old guard: A-LA-E7-03-03. |
| AC-04 and the old behaviour | The override is under `.tmp/` (git-ignored, `.gitignore:15`). The test "adds and removes hosts" fails on the old `lib.sh`, and it checks that no infra source file changes. AC-01..03 are K1-SIM and wait for LA-E7-02 and Docker. |
| "Must not edit" and ownership | `tests/sim/**` and `fitness-scope.json` are unchanged (the fixture lives in the infra test's temporary checkout). `main.ts` and `cli/bootstrap.ts` are product source, outside the LA-E7-03 list, but they are the named B-LA-E5-08-03 fix of lane S1. |
| No LMS name in core paths | Yes. The fallback host names moved from compose into `lib.sh`; infra is not core. |

## Findings

- **A-LA-E7-03-01 (MINOR): the validator lets the control alias and non-simulator names into the LTI allowlist, and it accepts unknown keys.**
  - Where: `infra/scripts/lib.sh:98-139` (the `node` validator; `reserved` = `STACK_HOSTS`, `evil.test`, `qa-platform.test`, `lti-gate.test`).
  - Problem:
    - `lms-sim.test` is not reserved. A provider may list it in `aliases` and `allowlist`. Then the LTI service may call it in the `acceptance` profile. The simulator serves its control API only on that host (`tests/sim/server.mjs:63`, `runtime.control`). So a tenant-registered platform URL such as a token endpoint on `https://lms-sim.test/__sim/…` would let the LTI service drive the simulator's control routes. Today `lms-sim.test` is an alias only and is never in the allowlist.
    - Any non-reserved `.test` name passes, not only `*.sim.test`. Today all such names resolve only to `lms-sim`, so they reach nothing new. But the reserved list is written by hand. A later QA or stack service with a new `.test` alias is not reserved by default. A manifest host with the same name would then resolve to two containers, and the allowlist would let the LTI service call the other one on a private address.
    - Unknown keys pass at both levels (`{"version":1,"providers":[…],"extra":true}`). The same host may be in two providers (the test "deduplicates" accepts it).
  - Evidence: I ran the validator from `lib.sh` at `6d201e2` on `{"version":1,"providers":[{"id":"a","aliases":["lms-sim.test","cogniate.test"],"allowlist":["lms-sim.test","cogniate.test"]}],"extra":true}`. Exit 0, output `allow lms-sim.test` and `allow cogniate.test`.
  - Why MINOR: only the `acceptance` profile is affected (no `production` or `default` path). It needs a wrong QA-owned file. The spec text the Author built against did not state these rules. A1's §4b now does: "Lower case, DNS form, ending in `.sim.test`. A host is in one provider only"; "`lms-sim.test` … never in an allowlist, never in the file"; "an unknown key … stops `stack:up`".
  - Suggested fix (S1, at the latest in the `lib.sh` commit that removes the fallback after LA-E7-02):
    - Require the `.sim.test` suffix, so the rule no longer depends on a list written by hand.
    - Refuse `lms-sim.test` anywhere in the file.
    - Refuse unknown keys and a host that two providers share.
    - Add one test case for each rule in the existing table.
- **A-LA-E7-03-02 (MINOR): a bad manifest stops every infra script in every profile, also `stack:down`, `stack:reset` and the `default` stack.**
  - Where: `infra/scripts/lib.sh:151` (`load_sim_hosts || exit 1` when the file is sourced). About 30 scripts source `lib.sh`, among them `stack-up.sh`, `stack-down.sh`, `stack-reset.sh`, `stack-doctor.sh` and `gen-certs.sh`.
  - Problem: the `default` profile never uses a simulator host (AC-03). But one bad edit of `tests/sim/hosts.json` (QA-E2E is building LA-E7-02 now) stops every developer's `default` `stack:up`. It also stops the commands that tear a stack down. This is fail-closed, so it is not unsafe. But the blast radius is wider than the rule needs. §4b says that a bad file stops `stack:up` "in the `acceptance` profile", and that the `default` profile "reads no manifest".
  - Suggested fix: load and check the manifest only where it is used: in `apply_profile acceptance` (before `dc` writes the override) and in `gen-certs.sh` (QA leaf SANs). Use the fallback, or skip the QA leaf, for `default`, or let A1 say that `gen-certs` may read it in every profile. Keep the exit 1 for `acceptance`. Add one test: with a bad file, `apply_profile default` and `dc config` succeed with no simulator host.
- **A-LA-E7-03-03 (MINOR): two more CLI entry points keep the old guard, so through a symlinked path they exit 0 and do nothing.**
  - Where: `services/lti-service/src/cli/operator.ts:64` and `services/lti-service/src/cli/shared-platform.ts:47` (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`).
  - Evidence: `node services/lti-service/src/cli/operator.ts bogus` gives exit 2 and the usage line. The same file through a symlink in a temporary folder gives exit 0 and no output.
  - Problem: this is the bug that B-LA-E5-08-03 fixed for `main.ts` and `bootstrap.ts`. It happens when a host run uses a path with a symlink, for example a clone under macOS `/tmp` or `$TMPDIR` (both symlinks to `/private/…`). `lti-bootstrap.sh` fails closed for `operator.ts`, because an empty output does not match the key pattern. But `lti:shared-platform` would report success with no platform. The container paths (`/repo/services/…`) have no symlink, so the stack is not affected today.
  - Suggested fix: use `if (import.meta.main)` in both files (S1 owns `operator.ts`; the Lead routes `shared-platform.ts` to its owner). Add the same symlink spawn test as `main.test.ts`, with the `operator.ts` usage exit 2 as the check.
- **A-LA-E7-03-04 (NIT): `infra/README.md:340` still lists the fixed `lms-sim` aliases as compose aliases.**
  - Problem: the aliases now come from the manifest through `.tmp/compose.sim-hosts.yaml` in `acceptance` only. A reader who adds a host from that table would edit the wrong place.
  - Suggested fix: point the row to `tests/sim/hosts.json` and README §4b (S1, or Docs at the end).

## Notes (no finding)

- `dc()` rewrites the override at every compose call in `acceptance` (atomic rename), so two scripts at the same time cannot read a half-written file.
- A compose command typed by hand without `dc()` (for example `docker compose -f infra/compose.yaml up -d` in `acceptance`) would recreate `lms-sim` without aliases. The tasks README allowances use only `docker compose exec`, which does not recreate a container, so this is acceptable.
- The fallback notice prints once per process tree (`SIM_HOSTS_FALLBACK_WARNED`), and the fallback goes away after LA-E7-02 (§4b "No file").
