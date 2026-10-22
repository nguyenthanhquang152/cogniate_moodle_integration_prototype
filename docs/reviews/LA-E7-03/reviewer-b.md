Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-03 review (+ B-LA-E5-08-03 fix), Reviewer-B (lens: "Can a human team own it?")

Diff: lane `la-s1` commits `04900cc`, `a67d44f` and `6d201e2` (merged as `211ff31`). The dispatch names `git diff fbec03d a67d44f`, but the LA-E7-03 commit `6d201e2` is the child of `a67d44f`. So I reviewed `git diff fbec03d 6d201e2`, which holds all three named commits. Spec: `docs/architecture/ltiaas/tasks/LA-E7-03.md` (working tree, with A1's new design notes). Design: README §4b and BD-A1-01 (`build-decisions-A1.md`, uncommitted A1 work), LA-ADR-02 D7. I did not open the other reviewer's file. I did not run Docker.

Counts: **1 BLOCKER, 0 MAJOR, 1 MINOR, 4 NIT.**

The manifest consumer is short, and its tests are strong: 20 host-only cases with a temp checkout, fake Docker and real certificates. They cover fallback, add and remove, the default profile and 14 refusals. The BLOCKER is A1's required change 1, which is not in the code yet. I report it so that the Lead can track it, and the Lead can merge it with the other reviewer's finding. My own-lens finding is that a bad test manifest blocks even `stack:down` and `stack:reset`.

## How I checked

- Scratch clone of `6d201e2` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `node --test infra/scripts/sim-hosts.test.mjs`: **20 of 20 passed**, with `/bin/bash` 3.2.57 (the only `bash` on `PATH` here, so the tests ran on bash 3.2).
- `vitest run services/lti-service/src/main.test.ts services/lti-service/src/cli/bootstrap.test.ts`: 5 of 5 passed.
- Two probes in the scratch clone. The `docker` on `PATH` was a fake script, and no probe reached it.
  - (1) A manifest with the host `School-A.canvas.sim.test`, then `bash -c 'source infra/scripts/lib.sh; echo "lib loaded"'`. Result: exit 1 and the line `Invalid simulator host manifest tests/sim/hosts.json: providers[0] has an invalid or reserved .test host.`
  - (2) A manifest `{"id":"x","aliases":["lms-sim.test"],"allowlist":["lms-sim.test"]}`, then `apply_profile acceptance`. Result: exit 0 and `ACCEPTANCE_LTI_ALLOWLIST_EXTRA=,lms-sim.test`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `infra/compose.yaml`, `infra/scripts/lib.sh`, the new `infra/scripts/sim-hosts.test.mjs`. No change in `tests/sim/**`, `packages/channel-kernel/fitness-scope.json` or product source for LA-E7-03. The B-LA-E5-08-03 commits change `services/lti-service/src/{main,cli/bootstrap}.ts` and their tests, and `infra/scripts/stack-up.sh` (one comment line). |
| Ownership (epics §5) | S1 owns `infra/compose.yaml` in B1, `lib.sh` and other `infra/**` in every wave, and the LTI `main.ts` and `cli/**` (S1 shared files). OK. |
| No behaviour change outside the spec | With no manifest, the fallback gives the same 10 aliases and 8 allowlisted hosts as before (test 1). `lms-sim` gets its aliases only through `.tmp/compose.sim-hosts.yaml` in `acceptance`. The default profile gets no override (test 4). `.tmp/` is git-ignored, so AC-04's "no tracked infra change" holds. |
| README §4b rules | Version, `providers` array, empty or duplicate `id`, empty `aliases`, missing `allowlist`, `allowlist` ⊆ `aliases`, duplicates merged, empty `providers`, a dangling symlink treated as a bad file (not as "absent"), one output line with the file and the entry. All of these match. **Not met:** "Host names … ending in `.sim.test`" and "Control alias `lms-sim.test` … never in an allowlist": see B-LA-E7-03-01. |
| Error messages | One line, the file and the entry index; the fallback notice is printed once, also across nested scripts. See B-LA-E7-03-03 for the missing host value. |
| Bash 3.2 | No bash-4 features. Empty-array expansion is guarded (`"${SIM_LTI_HOSTS[*]:-}"`, `lib.sh:172`). `SIM_ALIASES` always holds `lms-sim.test`. The tests pass on 3.2.57. |
| UNIT/K0 ACs fail on the old behaviour | AC-04 (K0): on the old tree, the add-a-host test fails, because the aliases and the allowlist came from fixed lists in tracked files. AC-01 to AC-03 are K1-SIM and wait for LA-E7-02 and a Docker slot. |
| B-LA-E5-08-03 fix | `import.meta.main` replaces the path guard in `main.ts` and `cli/bootstrap.ts`, as I suggested. Each file has a new test that runs the real entry file through a symlink and expects real output (exit 1 with the config error; one JSON line). On the old guard both tests fail: exit 0 and no output. `cli/operator.ts:64` (S1) and `cli/shared-platform.ts:47` keep the old guard; my earlier finding allowed that, but the same one-line change in `operator.ts` costs nothing in S1's next commit. |

## Findings

### B-LA-E7-03-01 — BLOCKER — Required rule not met: a manifest can add `lms-sim.test` or any non-simulator `.test` host to the LTI allowlist

- **File:** `infra/scripts/lib.sh:103-104` (`dnsName` accepts any host that ends in `.test`), `:125` (reserved list).
- **Problem:** The spec's design notes require: "the consumer applies the format and the infra fail-closed rules of README §4b (BD-A1-01): `lms-sim.test` stays the fixed control alias; every host ends in `.sim.test`". README §4b requires: "Host names: … ending in `.sim.test`" and "Control alias `lms-sim.test` … never in an allowlist, never in the file". The code accepts any `.test` host that is not in the reserved list, and the reserved list does not include `lms-sim.test`.
- **Evidence:** Probe (2) gives exit 0 and `ACCEPTANCE_LTI_ALLOWLIST_EXTRA=,lms-sim.test`. The LTI service would then be allowed to call the simulator control API in `acceptance`. A1 already routed this change to S1 as BD-A1-01 "Change 1 (S1, LA-E7-03) … Add one negative test row". A required rule fails in a reachable path, so this is BLOCKER under charter §5 (Lead rule for required controls), even though only a QA-owned file in the `acceptance` profile can trigger it.
- **Suggested fix:** In `dnsName`, require `host.endsWith('.sim.test')`. The reserved list then only matters for future `.sim.test` stack hosts, so keep it. Add negative rows `lms-sim.test` (in `aliases`, and in `allowlist`) and `new.test` to the refusal table in `sim-hosts.test.mjs:165-180`.

### B-LA-E7-03-02 — MINOR — A bad test manifest also stops `stack:down`, `stack:reset`, `stack:logs` and `stack:doctor`

- **File:** `infra/scripts/lib.sh:151` (`load_sim_hosts || exit 1` at source time).
- **Problem:** 33 scripts source `lib.sh`, also the scripts that stop, reset or inspect a stack. A typo in `tests/sim/hosts.json` (QA-E2E edits it during LA-E7-02, maybe while a stack runs) blocks the person from stopping or resetting that stack, and `stack:doctor` cannot run either. Those commands do not use the simulator hosts.
- **Evidence:** Probe (1): a plain `source infra/scripts/lib.sh` exits 1 before the next line. README §4b says "reads the file when it loads, in every profile … stops the stack scripts before any compose call". So the code follows the design text. But the intent is that no bad host reaches the aliases, SANs or allowlist, and `down`, `reset`, `logs` and `doctor` start no container with them.
- **Suggested fix:** Ask A1 to narrow the rule to "every script that starts or configures the stack". Code shape: `stack-down.sh`, `stack-reset.sh`, `stack-logs.sh` and `stack-doctor.sh` set `SIM_HOSTS_OPTIONAL=1` before they source `lib.sh`. With that flag, a bad file prints its one line as a warning, and `dc` leaves out the override (`docker compose down` and `logs` do not need the aliases). Every other script stays fail-closed. Add one test row: a bad file and `stack-down.sh` with fake Docker reaches `docker compose … down`.

### B-LA-E7-03-03 — NIT — The error line names the entry index, not the bad host or the provider id

- **File:** `infra/scripts/lib.sh:118`, `:122`, `:125`, `:129`.
- **Problem:** Probe (1) says `providers[0] has an invalid or reserved .test host`. The person must check every host of that entry by hand (here one capital letter). "needs a non-empty, unique id" does not say which of the two failed. Host names and ids are not secret.
- **Suggested fix:** Put the value into the line, JSON-quoted and cut to about 80 characters. For example: `providers[0] ("canvas-sim-cloud") host "School-A.canvas.sim.test": lower-case DNS name ending in .sim.test`, or `duplicate id "x"`. README §4b keeps "one line"; this still is one line.

### B-LA-E7-03-04 — NIT — The validator is a 45-line JavaScript program inside a bash heredoc

- **File:** `infra/scripts/lib.sh:98-139` (and `:155-164` for the override writer).
- **Problem:** ESLint and the type checker do not see code inside a heredoc. You can test it only through `bash` with a temp checkout (2 to 7 s per case). The next two required edits (BD-A1-01 change 1 now, change 2 after LA-E7-02) both go into this block. `lib.sh` already uses `node -e` one-liners, but this block is a real parser with allowlist rules.
- **Suggested fix:** Move the parse and the checks to `infra/scripts/sim-hosts.mjs`. Export a pure `parseSimHosts(text, reserved)` that returns `{ aliases, allowlist }` or throws one message, and keep a small CLI part that prints the `alias`/`allow` rows. `lib.sh` then calls `node "$INFRA_DIR/scripts/sim-hosts.mjs" "$manifest" …`. The refusal table can test the function directly, and keep two or three bash cases for the wiring.

### B-LA-E7-03-05 — NIT — The override file is rewritten, with one Node start, on every `dc` call

- **File:** `infra/scripts/lib.sh:191-196` (`dc`, `:194`, calls `write_sim_compose` each time in `acceptance`).
- **Problem:** `seed.sh`, `lti-bootstrap.sh` and the e2e scripts call `dc` many times (`exec`, `ps`, `logs`). Each call starts Node and writes the same file again. The atomic rename keeps this safe, but it is extra work, and one more thing to read in the hottest helper.
- **Suggested fix:** Write the override once: in `apply_profile` when the profile is `acceptance` (after `load_sim_hosts`). `dc` then only adds `-f "$SIM_HOSTS_COMPOSE_FILE"` in `acceptance`. Test 4 ("default never includes the old override") still holds, because `dc` adds the file only in `acceptance`.

### B-LA-E7-03-06 — NIT — The test fixture uses other provider ids than the real manifest

- **File:** `infra/scripts/sim-hosts.test.mjs:17`, `:22`, `:27` (`blackboard`, `canvas-cloud`, `canvas-self`).
- **Problem:** BD-A1-01 and README §4b fix the ids as `blackboard-sim`, `canvas-sim-cloud` and `canvas-sim-self`. The simulator will refuse an entry whose id has no loaded provider (README §4b, simulator rule). A reader who copies this fixture as the first `tests/sim/hosts.json` gets a file that the simulator refuses.
- **Suggested fix:** Use the three real ids. Then the fixture is a byte-for-byte reference for LA-E7-02 and for the AC-01 compare.

## Not checked

- K1-SIM AC-01 to AC-03 (Docker, LA-E7-02 file). The certificate rotation details beyond the two "leaf unchanged" asserts of the tests. The `d1f7d42` e2e tmpfs commit (Reviewer-A's finding; only the `a67d44f` comment line is in this range).
