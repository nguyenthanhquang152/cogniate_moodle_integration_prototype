Verdict: APPROVE
Round: 5

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

## Round 2

- Diff: `git diff f83a00e 0e65ab1 -- tests/sim docs/reviews/LA-E7-02/qa.md`. Commit `0e65ab1` holds the LA-E7-02 round-2 fixes and the LA-E7-05 simulator work (scenario options, the DR platform side). A later commit `19059aa` ("LA-E7-02 round-3 fixes": `server.mjs`, `loading.test.mjs`, `README.md`) is outside this dispatch, and I did not review it. `core/provider.mjs` and `core/runtime.mjs` at `HEAD` are the same as at `0e65ab1`.
- References: my round-1 findings above; A1 BD-A1-36 and LA-IC-16 (LA-ADR-04 D8); LA-ADR-04 D6; `tests/ltiaas/golden/README.md` §5; AC-LA-E1-05-09.
- I ran on the host (no Docker):
  - Simulator self-tests at `0e65ab1` (from `git archive`): baseline set 10/10, all five files 23/23.
  - `tests/ltiaas/golden/golden.k0.test.mjs`: 11/11 pass, with the LA-IC-16 case.
  - A probe of the default `/__sim/records` fields at `f83a00e` and at `0e65ab1` (one Blackboard login and one token request, the same inputs).
- Blind review as before.
- **Verdict (round 2): CHANGES_REQUESTED.** All three round-1 findings are closed. One new BLOCKER is open, and it comes from the LA-E7-05 part of `0e65ab1`. The LA-E7-02 changes alone (loader, manifest, generic and D2L providers) have no open finding. If the Lead moves A-LA-E7-02-04 to the LA-E7-05 review, read this round as APPROVE for LA-E7-02. New: **1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round-1 findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E7-02-01 (BLOCKER) | closed (the rule has landed; the K1-SIM proof waits for Docker) | BD-A1-36 chose a rule, not a frozen list: LA-IC-16 in LA-ADR-04 D8. Lead QA added it to the golden compare in `c953275`. `tests/ltiaas/golden/expected/LA-IC-16.json` has rule `sim-hosts-allowlist`: the `.sim.test` entries equal, as a set, the manifest allowlist hosts, and the other entries and the `default` profile stay strict. The K0 test of the rule passes. `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k1sim.test.ts:128-143` (AC-07) now compares with the rule, and the AC text names it. So nothing stays open until "the golden rule lands": it has landed. |
| A-LA-E7-02-02 (MINOR) | closed | The `qa.md` AC rows now use the spec ids. AC-02 has its own row (the `sakai-sim` scratch module). AC-03 is the generic and Moodle-shaped config. AC-04 is D2L. The six-provider load is a note. The AC-05 row names the direct `lib.sh` check of the committed `tests/sim/hosts.json` (17 aliases, 15 allowlist hosts), which matches my round-1 check. |
| A-LA-E7-02-03 (NIT) | closed | `runtime.mjs` runs `scenarios.delete(input.id)` before `scenarios.set(...)`, so a re-posted id moves to the newest position. `loading.test.mjs:45-74` posts A, B, then A again with a new `tokenAudience`, and expects A's new value. `tests/sim/README.md` "Scenario Options" lists each option with its default and the newest-scenario rule. |

### New finding

- **A-LA-E7-02-04 (BLOCKER): the default simulator records get new fields, so the golden G2 compare is no longer equal.**
  - Where (`tests/sim/core/provider.mjs` at `0e65ab1`):
    - `:134-136`: every `auth` record adds `kid`.
    - `:192-193`: every successful `token` record adds `status: 200`.
    - `:343-346`: every `deep-link` record adds `itemCount` and `cancelled`.
    - `:231`: every `nrps` record adds `status` and `memberCount`.
  - Problem:
    - These fields are written on the default path, with no scenario option set.
    - My probe with the same inputs gives these key lists:

      | Record | `f83a00e` | `0e65ab1` |
      | --- | --- | --- |
      | `auth` | `clientId,deploymentId,host,kind,method,path,provider,scenario` | the same plus `kid` |
      | `token` | `audience,clientId,host,kind,method,path,provider,scopes,tokenRef` | the same plus `status` |

    - G2 stores whole record objects (`tests/ltiaas/golden/capture.golden.ts:165`, filtered by provider only). G-BASE G2 has 30 `auth`, 2 `token` and 2 `deep-link` records without these keys. The drop list does not remove them (`kid` only becomes an id placeholder), and `diff` reports each new key as `added`.
    - Required outcomes:
      - AC-LA-E1-05-09: "the golden compare is equal".
      - LA-ADR-04 D6: "A golden difference or a frozen-test failure without an id is a FAIL".
      - The LA-E7-02 design note: "Every new behaviour is a scenario option with today's default, so M1, M2 and the simulator self-tests see no change".
    - The M1 and M2 tests read single record fields, so they still pass. Only the golden gate fails, and it will fail at the next K1-SIM capture.
  - Suggested fix (LA-E7-05 lane, QA-E2E): keep today's record shape when no option is set.
    - Add `kid` only when a scenario uses a second key or a key fault.
    - Add `status` on `token` and `nrps` only for an answer from `tokenAnswers` or `nrpsAnswers`.
    - Add `itemCount` and `cancelled` only for an LA-E7-05 Deep Linking option or an empty item list.
    - Add one self-test that pins the default key list of each record kind.
    - The other route is an A1 LA-IC for additive simulator record fields, but the design note above prefers the first route.

### Notes (no finding)

- For LA-E7-05: the JWKS route now also serves any path that ends with the configured path (`provider.mjs:663`, `path.endsWith(config.jwks.path)`). Also, the key set (`publicKeys`) changes for every scenario of a provider while any one of its scenarios asks for a second key. No M1 test checks a wrong JWKS path today. Both items need a look in the LA-E7-05 review.
- Every scenario now makes a registration token and adds it to `/__sim/secrets`. The token goes nowhere unless a DR flow runs, so the end-of-run leak scan only gets more values to look for.

## Round 3

- Reviewer: Reviewer-A2 (same session), lens A. Date: 2026-10-23.
- Diff: `git show 19059aa` (QA-E2E round-3 fixes: `tests/sim/server.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/README.md`, qa.md). The Lead moved A-LA-E7-02-04 to the LA-E7-05 review, and I closed it there (LA-E7-05 round 2).
- References: README §4b (BD-A1-01 v1.1, and BD-A1-53, recorded later in `6c806c1`); A1 BD-A1-53.
- I ran on the host (no Docker), in throwaway `git archive` copies (`tests/sim` and `infra`):
  - At `19059aa`: the simulator self-tests give 56/56, as qa.md says.
  - At `d40826d` (the integration head for this dispatch): 58 tests, 56 pass. The shared table case "accepts and merges repeated alias and allowlist host inside one entry" fails, so its parent test fails too.
  - The `19059aa` tests with the `d40826d` `lib.sh`: the same case fails. Run alone, `lib.sh` exits 1 with "providers[0] (id "dup-in-entry-sim") repeats alias "a.dup.sim.test"; each alias must occur once in the file."
- Blind review as before.
- **Verdict (round 3): CHANGES_REQUESTED.** -01 to -03 were closed in round 2, and -04 is closed in LA-E7-05. New: **1 BLOCKER (A-LA-E7-02-05), 0 MAJOR, 0 MINOR, 0 NIT.** The `19059aa` commit itself was right under the rule of its time. This BLOCKER comes from a later ruling, and the fix is the QA-E2E work item of that ruling.

### `19059aa` (lens A)

| Change | Result |
| --- | --- |
| Host rule `isSimHost` | Each host must be a string of at most 253 characters, end in `.sim.test`, not be `lms-sim.test`, and have only DNS labels `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`. So `sim.test`, an empty label, a label that starts or ends with `-`, `_`, upper case and labels longer than 63 characters are refused. The same rule now checks the module host lists in `loadProviders`. |
| Providers | A blank `id` is refused, and a host in two providers is still refused. `providers: []` is accepted, and README §4b does not list it as a bad file. A missing file fails at `readFileSync`, so it is a bad file, as §4b "No file" says. |
| Error texts | The startup errors now name the exact host difference and the unloaded manifest id. They show only host names and ids. |
| Shared table test | 27 cases run both `loadHostManifest` and `lib.sh` (`require_sim_hosts acceptance`, with a fake `docker` and a scratch folder), and each case asserts both results and that they agree. The test does not touch the shared stack. |

### New finding

- **A-LA-E7-02-05 (BLOCKER): after BD-A1-53, the simulator loader still accepts a host repeated inside one entry, so the two readers disagree and the shared table test fails at the integration head.**
  - Where: `tests/sim/server.mjs` (`loadHostManifest`). In `19059aa` the `aliasSet.has(host)` and `allowSet.has(host)` refusals were removed, and the lists are merged (`entry.aliases = [...aliasSet]`). Also `tests/sim/core/loading.test.mjs:126-133`, the case "accepts and merges repeated alias and allowlist host inside one entry", with expected `true`.
  - Problem:
    - `19059aa` matched the rule of its time: BD-A1-01 v1.1 let `lib.sh` merge a repeated host.
    - Then A1 BD-A1-53 (`6c806c1`) changed the rule: "a repeated host is refused by both". Its work list names QA-E2E: "the loader refuses a host repeated inside one list, if not yet". S1 made the `lib.sh` part in `6ae0ebe`.
    - So at `d40826d`, `lib.sh` refuses this file and the simulator loader accepts it, and the shared table case fails (56/58).
    - qa.md still says 56/56 and "27/27 agree", which held in the QA tree (`7623e61`) before the `lib.sh` change.
  - Required outcome: README §4b, row "Bad file (both readers; BD-A1-53)": "a host that appears twice … The infra (`infra/scripts/lib.sh`) and the simulator loader accept and refuse the same files; one shared table test (QA-E2E) proves it". Row "Host names": "Each host appears at most once in all `aliases` of the file (inside one list and across providers), and each `allowlist` entry appears once".
  - Risk today: low at run time. The committed `hosts.json` has no repeated host, and `stack:up` runs `lib.sh` before the simulator starts. But a required control of this task fails, and the simulator self-test suite is red at the integration head.
  - Suggested fix (QA-E2E, the BD-A1-53 work item):
    - In `loadHostManifest`, refuse a host that repeats inside one `aliases` list or one `allowlist`, as before `19059aa`.
    - Change the table case to "refuses repeated alias and allowlist host inside one entry", with expected `false`. Remove the merge lines.
    - Run the shared table test against the current `lib.sh`, and update the qa.md counts.

## Round 4

Reviewer: Codex GPT-6-Astra, xhigh; lens A. Reviewed the LA-E7-02 part of `1babba9` against the task spec, README §4b, BD-A1-53 and plan §6.1. Blind review; no Reviewer-B file read.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

- **A-LA-E7-02-05 closed.** `loadHostManifest` now refuses a repeated alias and a repeated allowlist host before returning the manifest. Both errors name the host and provider; the old merge assignments are removed. The table now expects refusal, and separate assertions exercise each duplicate check. README and the round-four QA record match the new rule.
- Private clone at `d768eec`: all **58 simulator self-tests pass**, including all **27 shared table cases** against the checkout's current `infra/scripts/lib.sh`. Two extra private table cases isolate alias-only and allowlist-only repetition; both readers refuse both (29/29 cases agree). The shell test substitutes a fake `docker` executable and sources only the manifest reader; it starts no stack.
- Restoring `1babba9^`'s loader in the private clone fails the changed repeated-host table case. Removing either new guard separately also fails its explicit assertion. All temporary edits were restored; logs are under `/tmp/la-review-a-e702-ic20.ewzZy1/`.
- The fix changes only invalid-manifest handling; the committed manifest and provider defaults are unchanged. No infra, product or frozen M1/M2 file changes in this fix. Earlier findings remain closed or transferred as recorded in round three. The companion LA-E7-05 changes in the batch are outside this item.
- Only this review file was edited for this item. No Docker, stack, host stack runner or commit was used. The task's K1-SIM ACs and live M1/M2 regression still need QA evidence; these host checks do not claim that gate.

## Round 5 (open world)

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, Claude session; same lens A).
- Diff: `git show 92ac637c` (la-qa `30689140`). It changes `tests/sim/core/loading.test.mjs` (the new `verifyOpenWorldSimManifest`, `KNOWN_PROVIDERS` and the 7th-provider scratch canary; the "adding a new LMS" test now expects the manifest count) and `docs/reviews/LA-E7-02/qa.md` (Round 5, the K1-SIM row map).
- I ran these in the private clone at `92ac637c`. No Docker.
  - `node --test $(git ls-files 'tests/sim/**/*.test.mjs')`: 59 tests pass, 0 fail.
  - A negative probe: the test file's own `verifyOpenWorldSimManifest` run on scratch copies of `tests/sim`, with nine changes. The probe file is kept at `/tmp/ra-e201/e702/ra-openworld-neg.test.mjs`. `git status` stays clean afterwards.
- Blind review: I did not open the other reviewer's file.
- **Counts (this round): 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Check | Result |
| --- | --- |
| The 6 known providers keep every old check | Yes, and the checks are stronger. Before: the exact sorted set of 6 ids and the counts 6 / 16 / 15. Now: each of the 6 is present in `hosts.json` with its exact `aliases` and `allowlist` arrays (order included), it is loaded, and its loaded hosts equal its aliases. The counts are `6 + extra`, `16 + extra aliases` and `15 + extra allowlist`. The `canvas.school-a.sim.test` alias-but-not-allowlist check stays. Probes: dropping `learn-b.blackboard.sim.test` from `blackboard-sim`, or removing `brightspace-sim` (entry and folder), fails. |
| The open-world rule still fails on bad input | Yes. Probe results on scratch copies:<br>- an alias repeated across providers → `Duplicate simulator host moodle.sim.test across providers …`;<br>- a repeated allowlist host → fails;<br>- an entry with empty aliases → fails;<br>- a non-`.sim.test` alias (`lti.cogniate.test`) → `Invalid simulator alias host …`;<br>- a provider folder removed → `Manifest entry … has no loaded provider`;<br>- a folder without a manifest entry → `Unlisted simulator provider …`.<br>The unchanged copy passes. Each non-`core` folder must have an `index.mjs` that exports `createProviders`, and the folder provider set must equal the manifest set. The stack's own `load_sim_hosts` (`infra/scripts/lib.sh:86-140`) still refuses non-`.sim.test` and reserved stack hosts at start. So an open-world entry cannot alias a real stack host. |
| Canary on a scratch copy only | Yes. It uses `fs.mkdtempSync(os.tmpdir())`, `cpSync(SOURCE_DIR, scratch)` and `rmSync` in `finally`. The new `canary-lms` folder and the extra manifest entry exist only in the scratch copy. The canary also proves that the new provider answers its JWKS route. No committed file changes (clean `git status` after the full run and after my probes). |
| No check weaker for the existing set | Holds (see the first row). The only relaxed values are the fixed totals. The fixed id list of the known set is now a "6 known plus listed extras" rule, and each extra must pass the same validation. |

Note (not a finding on this harness diff): the qa.md row for AC-LA-E7-02-01 says PASS, but its own text gives `M1 sim 376/394` with 18 `WE-F1..F4` rows tracked under LA-E7-08. The Lead should treat AC-01's M1 part as closed only after that rerun.

### Verdict (round 5)

APPROVE for lens A. The open-world self-test keeps, and tightens, every check on the six known providers. It still fails on duplicate hosts, broken or non-simulator entries, and a missing or unlisted provider folder. The canary uses a scratch copy only.
