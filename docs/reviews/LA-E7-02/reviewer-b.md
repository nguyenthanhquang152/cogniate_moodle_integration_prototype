Verdict: APPROVE
Round: 1

# LA-E7-02 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff f83a00e^1 f83a00e` (QA-E2E, from `la-qa` `ae9cc80`, merged as `f83a00e`). Spec: `docs/architecture/ltiaas/tasks/LA-E7-02.md`. Design: README §4b (BD-A1-01 v1.1), LA-ADR-02 D7, TEST-STRATEGY §2.5, §2.8. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 3 NIT.**

The data-driven loading is simple and fails closed:
- `server.mjs` discovers each folder under `tests/sim/`, imports its `index.mjs`, and checks the providers against `tests/sim/hosts.json`. The old two-module list is gone.
- Most manifest errors name the file, the entry id and the host.
- The two new modules are short, readable config objects. The new README gives the "one module plus one manifest entry" rule in a few lines.

My MINORs:
- Two validators read one `hosts.json` with different rules: the simulator's (this task) and the infra's (LA-E7-03).
- The README leaves a newcomer without the config fields and without the step that makes a new host live.

## How I checked

- Scratch clone of `f83a00e` in a private `/tmp` folder (`--no-hardlinks`, root and `tests/` `node_modules` copied; removed after the run). The shared LA worktree did not change.
- The two README commands, `node --test` on `tests/sim/core/*.test.mjs` plus the four `protocol.test.mjs` files: **18 of 18 passed**.
- Three probes of the same `hosts.json` changes, run against the simulator's `loadHostManifest` and the infra `lib.sh` loader (fake `docker`, no stack). Results under B-LA-E7-02-01.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `tests/sim/**` (loader, `hosts.json`, `generic/`, `brightspace/`, README, tests) and `docs/reviews/LA-E7-02/qa.md`. No `infra/**`, no product code, no M1 or M2 file. OK. |
| Ownership | QA-E2E owns `tests/sim/**` changes named in its brief and the e2e sections of `qa.md`. OK. |
| No behaviour change outside the spec | New behaviour is new providers and the manifest check; Blackboard and Canvas modules load as before (self-tests 18/18). One visible change: the deployed simulator now loads every folder under `tests/sim/` (see B-LA-E7-02-02). |
| No LMS name in core | `tests/**` is not core. |
| ACs | All five ACs are K1-SIM (QA). The host-only part of AC-02 is in `core/loading.test.mjs` ("Add a new LMS = one module + one manifest entry"): a scratch module without an entry fails, and with an entry all 7 providers load. |

## Findings

### B-LA-E7-02-01 — MINOR — Two validators of one `hosts.json` disagree

- **File:** `tests/sim/server.mjs:8` (host regex), `:35` (non-empty `providers`), `:66` (duplicate alias in one entry); the infra loader in `infra/scripts/lib.sh` (LA-E7-03, lane S1); the rule source README §4b.
- **Problem:** The same file is checked twice, by two owners, with different rules. So a person who edits `hosts.json` can pass one check and fail the other, at different times (`stack:up` versus the simulator start inside the stack). README §4b is the one rule set, and it says "A host that is in the file twice is used once" and (BD-A1-01) "empty `providers` allowed".
- **Evidence:** My probes on the real file:

  | Change | Simulator (`loadHostManifest`) | Infra (`lib.sh`) |
  | --- | --- | --- |
  | add `-bad.blackboard.sim.test` (label starts with `-`) | accepts (the regex `[a-z0-9-]+` allows it) | refuses ("expected a DNS name ending in .sim.test") |
  | repeat one alias inside one entry | refuses ("Duplicate simulator alias host …") | accepts (merges it) |
  | `"providers": []` | refuses ("must be a non-empty array") | accepts |

- **Suggested fix:** Align both to README §4b. The simulator should use the DNS-label rule (each label `[a-z0-9]`, inner `-` only, at most 63 characters), and treat a repeated host inside one entry as one host. Keep "non-empty" in the simulator if A1 agrees, because a simulator with no provider has nothing to serve, and write it in §4b. Then add one shared table test that QA owns (tests may run the infra loader through `bash`, as `infra/scripts/sim-hosts.test.mjs` does). It feeds the same good and bad files to both loaders and expects the same yes/no. Route the infra half to S1 through the Lead.

### B-LA-E7-02-02 — MINOR — The README does not give a newcomer the config fields, the id rule or the step that makes the host live

- **File:** `tests/sim/README.md:5-17`, `:30-37`; loader `tests/sim/server.mjs:91-96`; config use `tests/sim/core/provider.mjs:9-60`.
- **Problem:** The README tells the author to call `createProvider(runtime, config)`, but not what `config` holds. A newcomer cannot see that:
  - `id`, `issuer`, `family` and `deployments` are needed, and so are `auth`, `jwks`, `token` (`hosts`, `path`, `audience`), `sites[]` (`host`, `lineitems`, `nrps`, `dlReturn`), `pageHosts` and the `dl*` options;
  - `config.id` is the value that must equal the manifest `id`;
  - every folder under `tests/sim/` except `core/` is loaded as a module, so a helper folder fails the start.

  The README also stops at "add the entry". It does not say that the aliases, the QA certificate SANs and the LTI allowlist change only after `STACK_PROFILE=acceptance npm run stack:up` (which re-runs `gen-certs` and writes the alias override). It does not say that the tool side needs a matching LTI profile before a launch can pass.
- **Evidence:** AC-02 says "after a stack restart". `npm run stack:restart` does not issue a new QA leaf. The README test commands list five files by name, so a new module's `protocol.test.mjs` is not run unless someone also edits the README.
- **Suggested fix:** Add a short "Config fields" table (field, meaning, example from `generic/index.mjs`), and the sentence "copy `tests/sim/generic/index.mjs` to start". State the id rule and the folder rule. Add a step 3: "Run `STACK_PROFILE=acceptance npm run stack:up`; then …". Use one glob for the self-tests: `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'`.

### B-LA-E7-02-03 — NIT — Two startup messages do not say what to fix

- **File:** `tests/sim/server.mjs:141`, `:148`.
- **Problem:** "Simulator provider X hosts mismatch with hosts.json aliases" does not list the hosts that differ. For a manifest entry without a provider, the message guesses a module name from the id (`entry.id.replace(/-sim(?:-.*)?$/, '')`), so an id that does not follow the unwritten `<module>-sim[-variant]` pattern names a module that does not exist.
- **Suggested fix:** Print `missing in hosts.json: [...]; missing in the module: [...]`. For the second message, say "manifest entry X has no loaded provider; a module under tests/sim/<folder>/ must export a provider with id X", or write the naming pattern in the README.

### B-LA-E7-02-04 — NIT — All manifest rules are asserts inside one large test

- **File:** `tests/sim/core/loading.test.mjs:8-110`.
- **Problem:** Version, unknown keys, the reserved host, bad hosts, duplicates across providers, the hosts mismatch, a missing entry and the add-a-module flow are all asserts inside one `test(...)`. The first failure hides the rest, and the test name ("missing Canvas is a startup error…") does not say that it covers the manifest rules.
- **Suggested fix:** Split it into named cases (one `test` per rule, or `t.test` subtests) with names like "refuses the reserved control host". A future table test (B-LA-E7-02-01) can then reuse the rows.

### B-LA-E7-02-05 — NIT — The `hosts.json` comment trail

- **File:** `tests/sim/hosts.json` (and README step 2).
- **Problem:** JSON has no comments, so the reason for a browser-only alias (in `aliases` but not in `allowlist`, for example `canvas.school-a.sim.test`) is not visible where it is set. README step 2 explains the rule ("exclude browser-only `pageHosts`"), but not which entries use it today.
- **Suggested fix:** One README line: "Today the only browser-only alias is `canvas.school-a.sim.test` (the Canvas page host of M3)".

## Not checked

- K1-SIM AC-01 to -05 (QA runs them on the SIM slot). The `qa.md` e2e section (QA's evidence).
- Lens-A depth of the D2L audience check and the generic issuer-with-path signing beyond the host-only tests.
