Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-02 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff f83a00e^1 f83a00e` (lane QA-E2E, from `la-qa` `ae9cc80`). The `tests/sim/**` files at `HEAD` are the same as at `f83a00e`.
- References: `docs/architecture/ltiaas/tasks/LA-E7-02.md`; README §4b; LA-ADR-02 D7; A1 BD-A1-01 (v1.1) and BD-A1-08; LA-ADR-05 D8 and LA-ADR-01 D3 (`launch.windowHint`); LA-ADR-04 LA-IC table; TEST-STRATEGY §2.5, §2.8 and the G1 row.
- I ran on the host (no Docker):
  - `node --test` on the baseline set (`core/*.test.mjs`, `canvas`, `blackboard`): 10/10 pass. The same set at `f83a00e^1` (from `git archive`) is also 10/10.
  - All five simulator test files: 18/18 pass.
  - `node --test infra/scripts/sim-hosts.test.mjs`: 31/31 pass.
  - `lib.sh` (`HEAD`) sourced in a temporary copy with the committed `tests/sim/hosts.json` and a fake `docker`: no error, 17 aliases (with `lms-sim.test`) and 15 LTI allowlist hosts.
  - Two probes in temporary copies (outside the repo). See "Checks".
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| A bad manifest cannot route a real host | Correct. `loadHostManifest` (`server.mjs:11-89`) refuses: an unknown top or entry key; `version` ≠ 1; an empty `providers` array; a bad or duplicate `id`; empty `aliases`; no `allowlist` array; a host that is `lms-sim.test` or does not match `^[a-z0-9-]+(\.[a-z0-9-]+)*\.sim\.test$`; a duplicate alias; a host in two entries; an `allowlist` host that is not in `aliases`. `loadProviders` checks each module's hosts with the same pattern, a second time, and the host set must equal the entry's `aliases`. `main()` serves only `lms-sim.test` and these hosts (`421` for any other `Host`). Probe: a module with token host `moodle.test` is refused ("Invalid simulator host"), the same host in the manifest is refused, and a second claim of `school-a.canvas.sim.test` is refused ("Duplicate simulator host"). The infra side is separate: `lib.sh` keeps its own `.sim.test` rule (LA-E7-03). |
| BD-A1-01 change 3 (refuse start) | Correct. A loaded provider with no entry: "Unlisted simulator provider". An entry with no loaded provider: refused when `selection` is `undefined`, and `main()` always calls `loadProviders(runtime)` with no selection (`server.mjs:179`). A host in two providers: refused in the manifest and again over the module hosts. Two providers with the same id: `runtime.register` throws. Module names must match `^[a-z0-9][a-z0-9-]*$` and be a discovered folder, so a name cannot leave `tests/sim/`. |
| D2L token check really verifies `aud` | Yes. The token route verifies the signature with the tool JWKS, then requires `JSON.stringify(claims.aud) === JSON.stringify(aud)` (`core/provider.mjs:93`). For `brightspace-sim`, `aud` is the configured string `https://api.brightspace.sim.test/auth/token`, not the request URL. The test refuses `aud` = token URL and `aud` = `[audience]`, and accepts the configured value with the same other claims. Probe: with line 93 removed, the Brightspace, generic, Canvas and Blackboard token tests fail (4 of 16). Family `desire2learn`, three UUID deployment ids, and the UUID rule in `runtime.scenario` (a scenario must set `allowNonUuidDeployment` to skip it) are in place. |
| M1/M2 unchanged by default | Yes, for the simulator. Every new option falls back to the provider config: `issuer`, `family`, `documentTarget`, `dlData`, `dlSubject`, `dlWindowHint` (default `true`, as before), `tokenAudience`. The `aud` checks moved out of `verifyJwt`, but they keep the same comparison. The token `host` binding has a new formula, and I checked that it gives the same value for the three M1 providers: Blackboard `null`, Canvas cloud and Canvas self-hosted the request host. No M1, M2 or LA test sends one of the new option names in a scenario body. The only new refusal is an empty `deploymentId`, and no test sends one. The infra side changes: see A-LA-E7-02-01. |
| Moodle-shaped config | `moodle-sim` (issuer = site origin, `/mod/lti/*.php`, no `window` member) fits the Moodle-shaped *standard* channel of the design (LA-E4-03, LA-E0-03): `launch.windowHint` is false for Moodle (LA-ADR-01 D3, LA-ADR-05 D8). |
| Generic provider (AC-03) | Issuer `https://generic.sim.test/lti`, token on `token.generic.sim.test` and on the site host, three deployments. A token from the site host is bound to that host. A token from the token host is not bound (the same rule as Blackboard). |
| "Must not edit" and ownership | Respected. Only `tests/sim/**` and `docs/reviews/LA-E7-02/qa.md` changed. `tests/sim/**` is QA-E2E's. There are no core paths, so F1 does not apply. |

## Findings

- **A-LA-E7-02-01 (BLOCKER): the committed manifest adds 7 hosts to the `acceptance` LTI `/healthz` `outbound_allowlist`. The golden G1 pins the old list, and no LA-IC explains the change. So AC-LA-E1-05-07 and the G1 compare fail at the next K1-SIM run.**
  - Where:
    - `tests/sim/hosts.json:42-76` (new entries `generic-sim`, `moodle-sim`, `brightspace-sim`; their 7 allowlist hosts)
    - `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json:128-142` (`acceptance.ltiHealth.outbound_allowlist`: 3 stack hosts and the 8 old simulator hosts)
    - `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k1sim.test.ts:139-143`
  - Problem:
    - LA-E7-03 makes the `acceptance` LTI allowlist from the manifest. That is AC-05 of this task. With this file, the list has 15 simulator hosts instead of 8, and `/healthz` shows it (`outbound_allowlist`).
    - Required outcome, AC-LA-E1-05-07: "… and `/healthz` equals the golden (LA-IC-02: the allowlist still comes from `MOODLE_HOST`)". TEST-STRATEGY, row LA-IC-02: "G1 `/healthz` stays equal (it shows `outbound_allowlist` …)".
    - `profiles.k1sim.test.ts:141-143` diffs the live `acceptance` `/healthz` against `G1.acceptance.ltiHealth`. `diff` (`golden/lib/compare.mjs:29`) is strict on arrays, so 7 `added` entries make the test fail. The normalize drop list has no `outbound_allowlist` rule.
    - The G1 compare of every later capture shows `DIFF` lines under `G1 acceptance.ltiHealth.outbound_allowlist` (7 added hosts). No LA-IC in LA-ADR-04 or LA-ADR-05 covers it, and `tests/ltiaas/golden/expected/` has no file. So the compare exits 1.
    - The LA-E7-03 runner already handles more than 3 providers (it captures its own baseline with a 3-provider file). The LA-E1-05 test and the G1 gate do not.
    - The code in `tests/sim/**` is correct. The design gives no rule for this growth, and this commit is the first one that makes it real.
  - Suggested fix (a design ruling first, then two small test changes; `tests/sim/**` needs no change):
    - A1 or the Lead records the intended change. A rule is better than a frozen list: in `acceptance.*Health.outbound_allowlist`, the `.sim.test` entries must equal the allowlist hosts of `tests/sim/hosts.json`, and every other entry must equal G-BASE. Then each new simulator LMS needs no new LA-IC, which is the aim of F7.4. LA-E7-03 AC-05 already checks that the manifest hosts are in the allowlist.
    - The golden owner adds this rule to the compare (or an expected-delta file for the 7 hosts). The LA-E1-05 test calls the compare with this rule.
    - If the Lead prefers a frozen list: one new LA-IC with the 7 hosts, and each later manifest entry adds its own.
- **A-LA-E7-02-02 (MINOR): the AC rows in `qa.md` do not match the spec's AC ids, and the AC-05 row cites a test that does not read the committed manifest.**
  - Where: `docs/reviews/LA-E7-02/qa.md:26-30`.
  - Problem:
    - Spec AC-02 is "a module plus one manifest entry is served after a restart, with no edit in `server.mjs` or `infra/**`". The `qa.md` AC-02 row has the generic provider (spec AC-03), the AC-03 row has the D2L provider (spec AC-04), and the AC-04 row ("all 6 providers load together") is not a spec AC. The proof for spec AC-02 (the `sakai-sim` scratch module) is in the AC-01 row.
    - The AC-05 row gives `node --test infra/scripts/sim-hosts.test.mjs (with tests/sim/hosts.json)` as its evidence. That test never reads the committed file: each case writes its own fixture into a temporary checkout (`infra/scripts/sim-hosts.test.mjs:41-60`). So its 31/31 says nothing about this manifest. I checked the committed file myself (17 aliases, 15 allowlist hosts, no error), and these numbers match the row's text.
    - At the Docker-window round, rows with the wrong ids can mark a spec AC as passed with the evidence of another AC.
  - Suggested fix: renumber rows AC-02 to AC-04 to the spec's ids and give spec AC-02 its own row (the scratch-module test now, the stack restart later). Move "all 6 providers" to a note. In the AC-05 row, name the real check of the committed file (for example `source infra/scripts/lib.sh` in a temporary copy, as in `e7-03-manifest-compat.log`) instead of the infra unit test.
- **A-LA-E7-02-03 (NIT): `tokenAudience` is a scenario option, but the token route takes it from "the newest scenario" of the client, and a re-posted scenario id is not the newest.**
  - Where: `tests/sim/core/provider.mjs:16`, `:85-87`; `tests/sim/core/runtime.mjs:68`.
  - Problem: a token request carries only the client id, so the route picks `[...runtime.scenarios.values()].reverse()` and takes the first match. `Map.set` on an existing id keeps the old position. Example: scenarios A, then B (same client, `tokenAudience` X), then A again with `tokenAudience` Y. The route uses X. No test does this today.
  - Suggested fix: document `tokenAudience` as a per-client value ("the most recently created scenario id of the client wins"), or `scenarios.delete(input.id)` before `scenarios.set(...)` so a re-post moves to the end. Also list the new scenario options and their defaults in `tests/sim/README.md`.

## Notes (no finding)

- The simulator is stricter than `lib.sh` in two cases: an empty `providers` array, and a duplicate alias in one entry. `lib.sh` accepts both (it merges duplicates). The simulator refuses to start. Both fail closed, and only in the `acceptance` profile.
- `SIM_HOST_RE` accepts a label that starts or ends with `-` and has no length limit, so it is wider than "DNS form" (README §4b). It still accepts only `.sim.test` names, so it cannot route a real host.
- Every folder under `tests/sim/` except `core` and dot folders is loaded as a module. A future helper folder without `index.mjs` stops the start (fail closed). The README can say this.
- The "Required … simulator is unavailable" text guesses the module name from the entry id. For `moodle-sim` it says "moodle", but the module is `generic`. This is a text-only issue.
- All five ACs are K1-SIM and wait for the Docker window. The host-only tests above cover their logic.
