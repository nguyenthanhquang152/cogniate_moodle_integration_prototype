Verdict: FAIL — no complete M1 round and no final-SHA legacy yet: attempt 1 FAIL at `aff4882`; attempts 2 (INTERRUPTED) and 3 (FAIL: one host-gate assertion, zero suite rows) at `8138097`
Round: Claude continuation `ctx_8d5f8d3984d0`, attempt 3 default-gate failure, 2026-10-20

The T2/T3 group below passed at its exact frozen candidate. The later harness
repair is preparation only and does not replace that run or close M3.

## Historical preparation checkpoint

Verdict: PREPARATION ONLY — product and provider verification NOT RUN
Round: target-snapshot accounting, 2026-10-20
Owner: retained independent common/Blackboard QA

This report records the common/Blackboard preparation extension for applied
contract `ccdd9ef67cdd2be4c6af374136777fda4e081943`. It does not close M3.
The [M1 report](../M1/qa.md) contains the prepared files, checks and hold.

| Evidence | Current state |
| --- | --- |
| Harness self-checks | 27 passed; independent oracle checks only |
| Common/Blackboard inventory | 166 API cases plus 17 host rows; discovery/typecheck passed |
| Full new snapshot inventory | Held: Canvas 37 v1/v3/v4/v6/v8/v10/v12/aa and 38 i1/i2/i4 pending |
| `SIM` acceptance | Prepared, not run against a product |
| `MOODLE-LIVE` regression / upgrade / rollback | Existing required routes preserved, not run |
| `CANVAS-LOCAL` | Not attempted; separate feasibility after SIM passes |
| `CANVAS-HOSTED`, `BLACKBOARD-LIVE` | Not run; tenant access unknown |

Both future full rounds must use the same frozen product/test SHAs and
include `sim`, `snapshot-isolated`, `snapshot-upgrade` and `migration`.
Every new criterion is a separate required result. The populated 011→012
route is `SIM`, even though it uses real local databases and a real backup:
its LMS peers are QA simulations. It is distinct from the released-v10
Moodle route labeled `MOODLE-LIVE`. Missing, skipped, blocked, duplicate,
wrong-phase, mixed-SHA or mixed-label rows fail accounting.

No production provider DNS or certificate was spoofed. No SSRF rule was
changed. The extension uses the existing QA domains and simulator, independent
public fixtures, public APIs, CLI and gate controls. No stack, signup, tunnel
or Docker Desktop change was attempted. The execution lane remains held
until the Lead freezes the integrated tests and candidate and dispatches
the clean runs.


## Execution checkpoint 1 — T2/T3 legacy, 2026-10-20

Status: the executed T2/T3 group is PASS; M3 remains incomplete.
Active dispatch: `task_ed3b08aa45ea` / `ctx_8d51e8033a8a`.
Product and test SHA: `eb43247d02df622d5da72dafac41d919f65a91fe`.
Run: `qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z`.
Window: 12:21:21–12:30:03 UTC. Lane: `qa-multi-r1`, port `8443`,
subnet `172.29.0.0/16`.

The exact frozen tree was cloned outside integration. No test, product or
infra correction was made. The fixture hashes match the two required ZIPs.
The retained common/Blackboard QA executed this run. The existing independent
QA tests supply the expected results; author self-checks are not this evidence.

Command (from the external frozen source):

```sh
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default QA_M1_LEGACY_GUARD=1 \
QA_PRODUCT_SHA=eb43247d02df622d5da72dafac41d919f65a91fe \
QA_TEST_SHA=eb43247d02df622d5da72dafac41d919f65a91fe \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
node tests/host/run-t2.mjs --sha eb43247d02df622d5da72dafac41d919f65a91fe \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source \
  --tasks T2a,T2b,T3a,T3b
```

[Case evidence](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/legacy-case-evidence.json) contains each passed
observation's source file, command, SHA, run, label, phase, time, duration and
redacted report path. The [host summary](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/summary.json) preserves
all main, TTL and reset results. [Image identities](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/legacy-image-identities.json)
include the five services and the E2E image. The [main command log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/10-test-acceptance-passA.log),
[TTL log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/12-test-acceptance-knob.log) and
[reset-pass log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/18-test-acceptance-passC.log) record the actual executions.

There are 55 passing criteria and 61 passed test observations. The main pass
had 58 reported cases: 57 passed and the documented TTL case was deferred.
The TTL case passed in its required knob phase; reset then rechecked launch
and seed state. Twelve unselected observations across the three phase reports
remain in the evidence as unselected, never as PASS. Every required criterion
in this group has an executed passing observation. No failing or skipped
required criterion was hidden by aggregation.

All rows below share that exact SHA, command and run. The evidence index gives
the individual times and paths. `SIM` covers synthetic protocol and metadata
checks; `MOODLE-LIVE` covers the real Moodle launch, registration and grade flows.

| Criterion | Result | Label | Passing phase |
| --- | --- | --- | --- |
| AC-T2-01 | PASS | SIM | passA |
| AC-T2-02 | PASS | SIM | passA |
| AC-T2-03 | PASS | MOODLE-LIVE | passA, passC |
| AC-T2-04 | PASS | MOODLE-LIVE | passA |
| AC-T2-05 | PASS | MOODLE-LIVE | passA |
| AC-T2-06 | PASS | MOODLE-LIVE | passA |
| AC-T2-07 | PASS | MOODLE-LIVE | knob |
| AC-T2-08 | PASS | MOODLE-LIVE | passA |
| AC-T2-09 | PASS | MOODLE-LIVE | passA |
| AC-T2-10 | PASS | MOODLE-LIVE | passA |
| AC-T2-11 | PASS | MOODLE-LIVE | passA |
| AC-T2-12 | PASS | SIM | passA |
| AC-T2-13 | PASS | SIM | passA |
| AC-T2-14 | PASS | MOODLE-LIVE | passA |
| AC-T2-15 | PASS | MOODLE-LIVE | passA |
| AC-T2-16 | PASS | MOODLE-LIVE | passA |
| AC-T2-18 | PASS | MOODLE-LIVE | passA |
| AC-T2-19 | PASS | MOODLE-LIVE | passA |
| AC-T2-20 | PASS | SIM | passA |
| AC-T2-21 | PASS | SIM | passA |
| AC-T2-22 | PASS | MOODLE-LIVE | passA |
| AC-T2-23 | PASS | MOODLE-LIVE | passA |
| AC-T2-24 | PASS | SIM | passA |
| AC-T2-25 | PASS | SIM | passA |
| AC-T2-26 | PASS | SIM | passA |
| AC-T2-27 | PASS | SIM | passA |
| AC-T2-28 | PASS | SIM | passA |
| AC-T2-29 | PASS | SIM | passA |
| AC-T2-30 | PASS | SIM | passA |
| AC-T2-31 | PASS | MOODLE-LIVE | passA, passC |
| AC-T2-32 | PASS | SIM | passA |
| AC-T3-01 | PASS | MOODLE-LIVE | passA |
| AC-T3-02 | PASS | MOODLE-LIVE | passA |
| AC-T3-03 | PASS | MOODLE-LIVE | passA |
| AC-T3-04 | PASS | MOODLE-LIVE | passA |
| AC-T3-05 | PASS | SIM | passA |
| AC-T3-06 | PASS | MOODLE-LIVE | passA |
| AC-T3-07 | PASS | MOODLE-LIVE | passA |
| AC-T3-08 | PASS | MOODLE-LIVE | passA |
| AC-T3-10 | PASS | MOODLE-LIVE | passA |
| AC-T3-11 | PASS | MOODLE-LIVE | passA |
| AC-T3-12 | PASS | MOODLE-LIVE | passA |
| AC-T3-13 | PASS | MOODLE-LIVE | passA |
| AC-T3-14 | PASS | MOODLE-LIVE | passA |
| AC-T3-16 | PASS | MOODLE-LIVE | passA |
| AC-T3-17 | PASS | MOODLE-LIVE | passA |
| AC-T3-18 | PASS | MOODLE-LIVE | passA |
| AC-T3-22 | PASS | MOODLE-LIVE | passA |
| AC-T3-23 | PASS | MOODLE-LIVE | passA |
| AC-T3-24 | PASS | MOODLE-LIVE | passA |
| AC-T3-25 | PASS | MOODLE-LIVE | passA |
| AC-T3-26 | PASS | MOODLE-LIVE | passA |
| AC-T3-28 | PASS | MOODLE-LIVE | passA |
| AC-T3-29 | PASS | MOODLE-LIVE | passA |
| AC-T3-30 | PASS | MOODLE-LIVE | passA |

Default restoration passed: both services reported `profile: default` and
`knobs: []`; LTI reported `simulation_profiles: []`. The default health bodies
are retained under `M3-LEGACY-DEFAULT` in the host summary. The build runner
was alive with a fresh heartbeat and `image: ready` during the acceptance
pass. Cleanup removed all owned containers, volumes and networks. An
independent post-cleanup check found zero containers and the same seven
volume metadata records as before startup; the baseline was not mounted or
modified by QA. [Boundary evidence](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/dispatch-baseline/post-t2-boundary.json).

The Lead accepted this checkpoint and gave Canvas QA the next exclusive
stack window. No M1 run or other stack starts until the Lead returns that
window. Both complete M1 rounds, the populated 011→012 route, the separate
released-v10 Moodle migration/rollback, and remaining legacy suites are still
required. M2 and the three T7 runs need Canvas QA's own report; they are not
claimed here. No live Canvas or Blackboard result is claimed.

## Repair checkpoint — 2026-10-20

The Lead then relayed Reviewer-A's blocking A-M3-01 capture finding and
Canvas QA's host CLI working-directory failure. The authorized owned repair
is recorded in [M1 QA](../M1/qa.md#repair-checkpoint--a-m3-01-and-host-cli-2026-10-20).
Specific faults now precede all seven method capture rules; opening and
post-reset windows are armed before their cursors. The actual gate-boundary
checks reproduce the old blind spot. No exact-trace or zero-call assertion
was weakened.

The shared host control now runs app and LTI npm workspace commands from
the mounted `/repo` directory. A local handler check covers both services,
literal arguments, error result propagation and the command whitelist.
Actual app/LTI CLI smoke is the first required check on the next frozen
stack. Harness-only subprocess stubs do not establish that smoke.

`node tests/host/run-m1.mjs --harness-only --provider all` passed 31
self-checks, typecheck and the unchanged 416-row discovery. This was an
uncommitted working tree; it supplies no product result. The [log and source
record](/Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/preparation.json)
are separate from the immutable `eb43247` T2/T3 artifacts.

Canvas QA reported its first M2 run as 35 PASS and 29 FAIL, with no skips or
retries; the Lead relayed that 28 failures stopped at the shared CLI route.
Those counts are Canvas QA's report, not this worker's execution or verdict.
Canvas QA cleaned its stack. No new stack is authorized until repairs are
committed and reviewed, the candidate is frozen again, and the Lead returns
the lane. Both complete M1 rounds, remaining legacy suites and Canvas QA's
M2/T7 results remain required; M3 has no overall PASS.

## Partial preflight checkpoint — 2026-10-20

The authorized 14-case PARTIAL SIM preflight passed at product/test
`ae130a3501f3a2502c6a34e36319629e3dcdfb09` with the approved external wrapper.
All 14 selected cases ran and passed; 152 unselected observations were
excluded, with no selected skip or retry. The
[M1 checkpoint](../M1/qa.md#partial-runtime-preflight--2026-10-20)
records the exact command, all IDs, per-case evidence, timing, real app/LTI
CLI outputs, image identities, health and wrapper hash.

Both services returned to the default profile with no knobs or simulation
profiles. The [final secret scan](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/post-cleanup-secret-scan.json)
found no captured secret in eight raw service logs or public artifacts.
The [independent cleanup check](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/independent-cleanup-boundary.json)
at 12:58:30 UTC confirmed zero containers, no owned network or volume,
and the same seven baseline volume metadata records. This is a separate
`ae130a3` checkpoint; the earlier T2/T3 `eb43247` evidence remains unchanged.

This partial PASS closes neither M1 nor M3 and provides no full-inventory
credit. The Lead now assigned the stack to Canvas QA for M2 and conditional
T7. Our two complete four-phase M1 runs and remaining legacy suites stay on
HOLD until that cleanup boundary and the source-review gates. No optional
upgrade smoke or other stack was started.

## A-M3-02 harness checkpoint — 2026-10-20

The two remaining owned Blackboard gate-capture gaps are repaired. Grant
refusal windows now observe all seven HTTP methods and all paths. Race
windows retain all-method capture after a one-shot fault is consumed, with
the specific fault first and the negative-window cursor read after setup.
No refusal, zero-call, cancellation or recovery assertion was removed.

The [M1 repair record](../M1/qa.md#capture-repair-checkpoint--a-m3-02-2026-10-20)
records the owned audit and two actual-caller checks. The checks use an
in-memory gate and inert product responses; they do not establish product
behavior. Their negative control fails both old callers from `ae130a3`
as expected. The final `node tests/host/run-m1.mjs --harness-only
--provider all` passed 33 self-checks, typecheck and unchanged 416-row
discovery. [Evidence and held hashes](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-02-20261020T1311Z/preparation.json).

At the Lead's request, the single shared secret recorder's accepted kind
union now includes `play_id` and `picker_id`. Its storage and redaction are
unchanged; Canvas QA owns the corresponding browser capture and diagnostics.
No stack or product acceptance was run for this repair. M3 remains
FAIL/incomplete. The two full M1 rounds, remaining legacy suites and
independent M2/T7 evidence remain required after the new source-review,
freeze and stack-handback gates.

## Legacy diagnostic checkpoint — A-M3-04, 2026-10-20

The Lead authorized a bounded repair after Reviewer-A found that the
`waitForFrame` timeout in `tests/acceptance/lib/t5.ts` printed full frame
URLs before successful-frame secret capture could run. The timeout now
uses the existing Canvas-owned `diagnosticUrl` helper. This repair changes
only the import and timeout formatting; frame matching, polling, deadline,
assertions and legacy cases are unchanged. Canvas QA retains ownership of
the helper; the final check records its current source hash.

A private scratch check executed the actual `waitForFrame` function,
extracted as exact TypeScript AST text without rewriting its body. The old
function from `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63` exposed all 14
synthetic values in runtime, play and picker paths, queries, fragments and
credentials. The repaired timeout exposed none. An exact expected-message
check retained useful safe route shapes, capability placeholders and
`about:blank`. Old and new controls both received raw URLs for matching,
returned the same frame on success, and used the same 200 ms polling step
and controlled deadline. These are local diagnostic checks with synthetic
inputs, not browser or product runtime evidence.

```sh
node /Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/timeout-branch-check.mjs
node tests/host/run-m1.mjs --harness-only --provider all
```

Both commands passed. The second included the full acceptance typecheck,
33 self-checks with no failures or skips, and unchanged discovery of 392 API
plus 24 host/browser rows. [Diagnostic result](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/timeout-branch-result.json)
and [held files, hashes and harness log](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/preparation.json)
preserve this working-tree checkpoint. No stack, rebuild or product
acceptance ran. M3 remains FAIL/incomplete, and full verification still
needs a new committed test freeze, review gates and the Lead's handback.

## Claude continuation — full-run attempt 1 at `aff4882`, 2026-10-20

Owner: a fresh, independent common/Blackboard QA session, Claude Code Opus 5.5
at xhigh effort (`task_ed3b08aa45ea`, `ctx_8d5f8d3984d0`). It continues from
the outgoing QA's durable handoff. All earlier sections stay as history. The
`eb43247` T2/T3 result stays old-SHA evidence. It gives no credit at the final
SHA.

The Lead opened the exclusive window in `msg_d26c1a003c73`. The complete M1
entry ran at product = test `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. It
stopped in round 1, phase `sim`, with 385 PASS and 9 FAIL of 394 rows. The
other three phases, round 2 and all legacy groups did not run. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-1-at-aff4882-2026-10-20)
records the command, identity, each failure, its classification, the
evidence paths and the held repair.

### M3 status after this attempt

| Criterion | Status | Owner of the evidence | Notes |
| --- | --- | --- | --- |
| AC-M3-01 | FAIL | This QA (common, Blackboard); Canvas QA judges the Canvas rows | 9 of 394 `sim` rows failed; no complete 416-row round exists. Six common/Blackboard failures are QA oracle, request or host-control defects. The repair is held. The three Canvas rows belong to Canvas QA. |
| AC-M3-02(a) | PASS, cited | Canvas QA (QA-E2E), not run by this QA | [M3 QA-E2E §8](qa-e2e.md#8-round-5--m2-and-t7-at-aff4882): three consecutive default T7 runs at `aff4882`, 17 PASS / 0 FAIL / 1 demo-only skip each, demo PASS, 4/4 confirm checks. Label `MOODLE-LIVE`. |
| AC-M3-02(b) | NOT RUN | This QA | The legacy groups T2a/T2b/T3a/T3b, T3c, T4a, T4b1/T4b2, T5a/T5b/T6 and T8 run only after both full M1 rounds pass. No legacy test was changed. |
| AC-M3-03 | PASS, cited | Canvas QA | [M2 QA](../M2/qa.md): 64/64 at `aff4882`, label `SIM`. |
| AC-M3-04 | Partial | This QA for the M1 run | In this attempt, 0 of 1,299 captured values appear in the simulator, gate or service logs. The simulator keys stay in memory. The full criterion needs the complete runs. |
| AC-M3-05 | UNVERIFIED, cited | Canvas QA | [Live matrix](live.md): all 32 rows UNVERIFIED; no live run is authorized. |
| AC-M3-06 | PASS for this attempt | This QA | One stack only, lane `qa-multi-r1`/8443/`172.29.0.0/16`. Zero containers after. All seven protected volume records are identical to the original baseline. No Docker setting changed. |
| AC-M3-07 | PASS for this attempt | This QA | Runner scan: 1,299 values, 633 files, 0 hits. Independent scan: 0 hits in 9 raw logs and 669 public files, 0 JWT-shaped strings. Raw values stay in the 0700 private run folder. |

A SIM result means only that the service matched the documented provider
behavior in a signed simulation. It does not prove interoperability with
Canvas or Blackboard.

The external observers added no stack action. Their tools and the 8/8
failure-path controls are pinned in the run provenance. They read only selected
container fields and never print child output or container environment.

M3 stays FAIL. It closes only after the Lead commits the held repairs and
Canvas QA's own repairs, a new reviewed freeze, two complete 416-row rounds
with identical outcomes, all legacy groups with default-profile restoration,
and Canvas QA's separate verdict on its rows.

## Attempt 2 at `8138097`: INTERRUPTED, 2026-10-20

The host stopped during round 1, phase `sim` (last activity 15:57:19Z), and
rebooted at 20:04:55Z. No row was evaluated, so the attempt gives no M3 credit.
The owned stack was removed after the reboot by label. All seven protected
volume records still match the original baseline. The Docker engine changed
from 29.8.2 to 29.9.1 when Docker Desktop restarted. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-2-at-8138097-interrupted-2026-10-20)
has the full record. The status table of attempt 1 is still current:
AC-M3-01, AC-M3-02(b) and AC-M3-04 are not complete. Attempt 3 needs a new
window.

## Attempt 3 at `8138097`: FAIL at the default gate, 2026-10-20

The runner's default-profile gate got HTTP 500 from `GET /api/providers`
before the suite started. One required host-gate assertion ran and failed
(`M1-02.common.default-profile`); zero suite rows ran. The same product and images passed this gate in attempt 1.
Docker Desktop updated itself to 4.96.0 (engine 29.9.1) after the reboot. The
cause is not classified. Cleanup passed, and all seven protected volume
records still match the original baseline. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-3-at-8138097-fail-at-the-default-gate-2026-10-20)
has the record. AC-M3-01, AC-M3-02(b) and AC-M3-04 stay incomplete.
