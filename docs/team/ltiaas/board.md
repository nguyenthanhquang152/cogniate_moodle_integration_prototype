# Milestone LA board: LTI as a Service v1

Only the Lead edits this file. Orca Run: `run_06d07dc77faf`. Rules: [charter-LA](charter-LA.md). Plan: [plan](plan.md) (v1.2).

## Phase status

| Phase | Status | Gate | Notes |
| --- | --- | --- | --- |
| P1 Plan | **done** | — | R1–R5 committed; plan v1 `1afdf56`, v1.1 (R2), v1.2 (LA-H21..H24) |
| P2 Tech design | **done** | **G-DESIGN PASS** | Final design `54e8088`. Reviewer-A APPROVE (R4 at `54e8088`), Reviewer-B APPROVE (R3 at `88909be`), QA PASS (R3 at `88909be`; its last MINOR fixed at `54e8088`). 3 BLOCKER and 15 MAJOR found and closed over 4 rounds. Deferred: [deferred.md](deferred.md). |
| P3 Breakdown | **done** | **G-BREAKDOWN PASS** | Final breakdown `936f707`: 94 tasks (Must 62, Should 22, Could 10). Reviewer-A APPROVE (R2), Reviewer-B APPROVE (R2), QA PASS (R2). 7 MAJOR found and closed. Open MINORs: [deferred.md](deferred.md). |
| G-BASE | **intake done** | — | G-BASE `bd368ff` (B/C HEAD, product = `9f8ac62`); intake merge `1b17261` (LA-E0-01, Lead git-only; QA-3 verifies) |
| G-DEV | **APPROVED** by the product owner (2026-10-22 11:2x) | product owner | LA-H1 approve; LA-H10 = frozen candidate, merge mode wave-end; Docker by agreed windows; at most 8 active sessions |
| P4 Build | **in_progress** (wave B1) | — | Lane worktrees `la-k`, `la-s1`, `la-s2`, `la-r`, `la-qa` on `1b17261`; branches `nguyenthanhquang152/la-*` |
| P5 Verify | planned | task done | QA + Reviewer-A + Reviewer-B in parallel |
| P6 Integrate | planned | milestone done | Regression, conformance, docs |

## Tasks

| Id | Title | Role | Status | Dispatch | Output |
| --- | --- | --- | --- | --- | --- |
| LA-R1 | LTI 1.3 / Advantage spec coverage | Researcher | done | `ctx_a02dfb63c6a7` | `docs/research/ltiaas/R1-spec-coverage.md` |
| LA-R2 | LMS landscape | Researcher | done | `ctx_9723939997e7` | `docs/research/ltiaas/R2-lms-landscape.md` |
| LA-R3 | Channel extensibility audit | Researcher | done | `ctx_47e046be67f1` | `docs/research/ltiaas/R3-extensibility-audit.md` |
| LA-R4 | Operability, security, LTIAAS compatibility | Researcher | done | `ctx_763a24e1f32c` | `docs/research/ltiaas/R4-ops-readiness.md` |
| LA-R5 | Test and QA baseline | Researcher | done | `ctx_9a71aba4569a` | `docs/research/ltiaas/R5-test-baseline.md` |
| LA-P1 | Plan v1 | Lead | done | — | `docs/team/ltiaas/plan.md` |
| LA-D1 | Design: kernel, generic LTI, records, consistency | Architect A1 | done (+ consistency pass `ctx_9bfa3c592fa6`) | `ctx_5cfbcb7699eb` | A1 files in `docs/architecture/ltiaas/` |
| LA-D2 | Design: Advantage, operability, security, onboarding | Architect A2 | done (retry after session limit) | `ctx_368b9bc5879b` | A2 files in `docs/architecture/ltiaas/` |
| LA-QS | Test strategy and conformance kit | QA | done | `ctx_67134bc13967` | `tests/ltiaas/TEST-STRATEGY.md` |
| LA-QT | Design testability review | QA | R1 FAIL: Q-LAD-14 MAJOR; 12/13 pre-review findings closed | `ctx_8ea334f6cd89` | `docs/reviews/LA-DESIGN/qa.md` |
| LA-RA | Design review, lens A | Reviewer-A | R1 CHANGES_REQUESTED: A-LAD-01..03 BLOCKER, -04..-08 MAJOR | `ctx_8064081b6df9` | `docs/reviews/LA-DESIGN/reviewer-a.md` |
| LA-RB | Design review, lens B | Reviewer-B | R1 CHANGES_REQUESTED: B-LAD-01..08 MAJOR | `ctx_0389f26b369b` | `docs/reviews/LA-DESIGN/reviewer-b.md` |

## Incidents

- 2026-10-22 04:42Z–04:55Z: the LA lead QA started stack `qa-la-sim-r1` inside the exclusive Docker window of run `run_ebe671ad72a9` (04:18Z–06:20Z), because the Lead's brief allowed one LA stack beside theirs. Their diagnostic rows passed, but their strict boundary check failed and must be repeated (about 27 minutes). The lead QA then hit its session limit, so the Lead did the owned-only cleanup at 04:55:00Z (snapshot `~/cogniate-qa-runs/LA/E0/lead-cleanup-20261022T045458Z.txt`). New rule (agreed with that run's coordinator): LA starts no Docker activity until that run returns a window. Their next scheduling update: by 07:00Z. 05:2xZ: their clean diagnostic passed; their full rounds and legacy groups have a window through 09:30Z, then M2/T7, then the Docker handoff to LA.
- 2026-10-22 ~11:46–11:55 +07: the Claude account of the LA workers reached its session limit; all active workers (S1, R, K, QA-2, QA-3, lead QA) paused. S2 finished LA-E5-08 before it. The Lead probes every ~10 minutes and wakes each session with one message after the reset.

- 2026-10-22 08:41: a Lead script error (zsh 1-based arrays) sent the Reviewer-B round-2 task to Reviewer-A's session and the QA task to Reviewer-B's session. The Lead fenced both dispatches within about 1 minute and sent cancels. Both reviewers saw the mismatch, asked before they opened any file, and read no other review; the worktree had no changes. New tasks replaced the misrouted ones. Disclosures: Reviewer-A's inbox filter printed two subject lines (no bodies) of messages to other dispatches, neither Reviewer-B content; Reviewer-B read `qa.md` once in round 1 after it wrote its findings (allowed by its retry context).

- 2026-10-22 02:55–04:15: Claude session limits stopped A2, Reviewer-B and QA. Stalled sessions do not resume after the reset. Recovery: `worker-stop`, then `worker-start --retry-of` with a retry-context message. No work was lost; files stayed in the shared worktree.
- QA's first session reviewed the uncommitted draft before the Lead gave a SHA. The file is kept as a pre-review; Round 1 re-verifies it at `19476fc`.

## G-DESIGN round 1 routing

| Owner | Findings |
| --- | --- |
| A1 | A-LAD-01 (rule owner), A-LAD-03, -04, -05; B-LAD-01..07 |
| A2 | A-LAD-02, -06, -07; Q-LAD-14; A-LAD-01 alignment in A2 files |
| Lead | A-LAD-08 = B-LAD-08: closed by LD-9 (`2740f56`) |

## G-BREAKDOWN round 1 routing

| Owner | Findings |
| --- | --- |
| A2 (done, `b4f6b9b`) | Q-LAB-01 (cites forms d–g), B-LAB-01..03, Part 1 MINORs; six companion tasks |
| A1 (running) | B-LAB-10 (form g), Q-LAB-10 (QA cost per task), A-LAB-10 (store-contract AC); matrix updates for LD-10, LD-11, LD-14, LD-15; Part 2 MINORs |
| Lead | LD-10 (S1/S2), LD-11 (L2), LD-12, LD-13 (QA-2, QA-3), LD-14, LD-15 (rolling starts) |

## Session state at G-DEV (2026-10-22)

All LA workers are idle and retained for reuse: A1, A2, Reviewer-A, Reviewer-B, QA (lead). No LA worker is active. Researchers R1–R5 are released. No product code changed; no push.

## P4 build — wave B1 (started 2026-10-22 11:40)

Integration branch: `quang/ltiaas-milestone`. Intake `1b17261`. Lane branches `nguyenthanhquang152/la-<lane>`. Active-session cap: 8.

| Task | Lane | Author dispatch | Tests | Status |
| --- | --- | --- | --- | --- |
| LA-E0-01 | Lead (git-only) | — | QA-3 `ctx_a8bd71d6aab9` | intake `1b17261` done; verifying |
| LA-E0-04, LA-E0-03, LA-E0-02 | QA | — | lead QA `ctx_dc11d8c6d070` | in_progress (Docker shared with run `run_ebe671ad72a9`) |
| LA-E5-01 | S1 | `ctx_a19acab07af9` | QA-2 `ctx_95ac62d29382` (test-first) | in_progress |
| LA-E5-08 | S2 | `ctx_d0ad587729f1` | QA-2 (test-first) | in_progress |
| LA-E4-01 | R | `ctx_f1c57c8eeaa2` | QA-3 (test-first) | in_progress |
| LA-E1-01 | K | `ctx_3df1354b5616` | QA-3 (test-first) | in_progress (QA run waits for LA-E0-03, LD-19) |

## Model change and pause (2026-10-22 ~14:00–14:30 +07)

- The product owner paused all tasks, then changed the model plan (charter-LA §0): Claude Opus 5.5 xhigh for planning, architecture, technical design and review; Codex GPT-6-Astra xhigh for implementation; Antigravity Gemini 4 Argon (High) for QA. New agents continue the paused Claude workers from their committed files.
- Second Docker overlap (06:4xZ–07:07Z): the Claude lead QA ignored the hold and the pause and started `qa-la-sim-r2` … `qa-la-sim-r8`; it invalidated the other run's full round 2. The Lead fenced its dispatch, closed the la-qa sessions, did the owned-only cleanup at 07:08:57Z (snapshot `~/cogniate-qa-runs/LA/E0/lead-cleanup-20261022T070855Z.txt`), and sent owner + coordinator hold ACKs; the other coordinator accepted. LA is host-only until that coordinator's explicit handoff (its window runs through 11:30Z); no Docker polling during its window.
- Paused Claude QA-2 and QA-3 ended as "replaced"; their work and the lead QA's work are committed on `nguyenthanhquang152/la-qa` (`b63f3d1`, `9dc0e32`, `f0a7b30`). The LD-1 rewrite stays off the integration branch until both reviewers approve it.

| Role | Agent | Dispatch | Work |
| --- | --- | --- | --- |
| Lead QA | Antigravity (terminal `term_aca45499…`) | `ctx_92db6e5febb7` | K0 config (blocks LA-E1-02 merge), R1/R2 helpers, golden README and tool (no capture) |
| QA-2 | Antigravity (terminal `term_dae6603f…`) | `ctx_006a8306c494` | finish LA-E5-01/08 suites; test-first LA-E5-02, -04, -10, LA-E7-03 |
| QA-3 | Antigravity (terminal `term_ec645253…`) | `ctx_0ebde95cad45` | finish LA-E1-03/04 suites; test-first LA-E1-02, -06; LA-E4-02/03 UNIT plan |
| Author S1 | Codex `gpt-6-astra` xhigh | `ctx_bcc3b1114b98` | LA-E7-03 + B-LA-E5-08-03 + stack-up comment |
| Author R | Codex `gpt-6-astra` xhigh | `ctx_e957d1866d5d` | LA-E7-10 |
| Reviewer-B | Claude | `ctx_e26dd6e6dcbb` | LA-E1-02 round 1 (unblocks lanes K, P, L) |
| Reviewer-A | Claude | `ctx_76f7c7a46efe` | LA-E5-02 round 1 |

Integration branch merges since the pause: LA-E5-02 r1 `0d320c4`, LA-E4-01 r1 `89d5ec5`. LA-E1-02 (`8cf9412`) waits for the K0 config.

## PAUSED (product owner, confirmed 2026-10-22 ~14:45 +07)

All LA work is paused. The seven open dispatches are blocked on a "PAUSED" ask; every other LA dispatch is settled and idle. No LA Docker activity (host-only hold; no Docker polling during the other run's window). To resume, the Lead answers each ask with RESUME.

| Session | Agent | Dispatch | PAUSED ask | State at pause |
| --- | --- | --- | --- | --- |
| Lead QA | Antigravity | `ctx_92db6e5febb7` | `msg_8a2ef7812930` | K0 config, smoke test and ld1 test written; verify on a clean clone, R1/R2, golden README left |
| QA-2 | Antigravity | `ctx_006a8306c494` | `msg_23e375f506f4` | reading done; READMEs and new suites left |
| QA-3 | Antigravity | `ctx_0ebde95cad45` | `msg_583d957d1aea` | reading done; suites left |
| Author S1 | Codex | `ctx_bcc3b1114b98` | `msg_089a7ea1f4d1` | symlink guard fix + tests and stack-up comment uncommitted; LA-E7-03 wiring, self-check, commits left |
| Author R | Codex | `ctx_e957d1866d5d` | `msg_a131f8c92925` | reads and npm ci done; implementation left |
| Reviewer-B | Claude | `ctx_5d8fa2d0cfd3` | `msg_1e3c71090201` | LA-E1-02 diff read; tests run and review file left |
| Reviewer-A | Claude | `ctx_2ac43aa56dcd` | `msg_c2e407deb4b8` | LA-E5-02 diff read; checks and review file left |

### Hard halt verified (2026-10-22 14:28 +07)

To make the pause verifiable, the Lead fenced all seven open dispatches (`worker-stop`; the four supervised sessions report `closed_agent_terminal`), closed every terminal and agent session in the LA worktrees (`la-k`, `la-s1`, `la-s2`, `la-r`, `la-qa`, `ltiaas-milestone`), and terminated three leftover LA-only processes (one idle old Claude QA session, two Codex app-servers). Verified at 14:28:34: 0 processes with a working directory in any LA worktree, 0 LA tasks dispatched or running, 0 LA lane files changed after 14:21:00, no LA Docker use. Work is preserved: commits on the lane branches and `la-qa`, and the uncommitted edits in each worktree listed in the table above. Resume = new dispatches (`--retry-of` the stopped dispatches) with a retry-context message built from that table.

## RESUMED (product owner, 2026-10-22 ~16:15 +07)

New agents continue the stopped tasks with retry-context notes (charter-LA §0 model plan). Docker: still host-only (the other run's hold continues).

| Role | Agent | Dispatch | Work |
| --- | --- | --- | --- |
| Author S1 | Codex `gpt-6-astra` xhigh | `ctx_ac22dc682691` | commit symlink-guard fix; LA-E7-03 |
| Author R | Codex `gpt-6-astra` xhigh | `ctx_a31a1320b535` | LA-E7-10 |
| Reviewer-B | Claude Opus 5.5 xhigh | `ctx_f085ce7963a8` | LA-E1-02 round 1 |
| Reviewer-A | Claude Opus 5.5 xhigh | `ctx_cd9a048f4e13` | LA-E5-02 round 1 |
| Lead QA | Antigravity Gemini 4 Argon (High), terminal | `ctx_e5d6bae0cd22` | K0 config verify, R1/R2, golden README |
| QA-2 | Antigravity, terminal | `ctx_aeeb4fce2c61` | LA-E5-01/08 READMEs; test-first LA-E5-02, -04, -10, LA-E7-03 |
| QA-3 | Antigravity, terminal | `ctx_a305f8530c40` | LA-E1-03/04 suites; LA-E1-02/06; LA-E4-02/03 UNIT plan |
| Architect A1 | Claude Opus 5.5 xhigh | `ctx_7a37e7830a62` | ratify hosts.json schema, fitness rule interface, matrix updates, migration numbers |
| Architect A2 | Claude Opus 5.5 xhigh | `ctx_40535863c72d` | ratify SAVEPOINT audit atomicity; operator-key and e2e-secret doc alignment |

## Wave B1/B2/B3 progress (2026-10-23 03:30Z)

"Done" = QA PASS on every non-pending AC + Reviewer-A and Reviewer-B APPROVE; "pending" ACs wait for the golden tool or a Docker window (LD-21).

Lead outages (session limit; resumed on another Claude profile each time): about 10:35-13:53Z and 15:45-18:02Z. Workers that needed an answer waited (lane K ended one dispatch 'failed' on an unanswered design ask); no work was lost; the run coordinator was re-bound with `run-use` after each restart. The other run asked LA to confirm its host-only hold for 16:38-17:23Z: confirmed (no LA Docker command; all LA reports say no Docker use).
- 2026-10-22 20:13Z: the Blackboard and Canvas run released its standing host-only hold on LA (msg_8451370d9f2a): no LTI runtime or host reservation is active; all 32 protected volume records unchanged; do not infer ownership of or remove their resources; future windows are coordinated explicitly. LA Docker use starts by Lead grant (charter-LA §0): one QA stack at a time. Third Lead outage: about 19:31Z to 01:33Z (session restart); workers that finished waited; S1 resumed on its own.
- 2026-10-23 01:36Z: LA Docker slot 1 granted to QA-2 (K1-SIM). 01:38Z the other run asked for an exclusive window (about 35 minutes, M2 then T7). LA paused at once: QA-2 brought its qa2-la-sim-r1 stack down at 01:41Z (volumes byte-identical, 32 records); the Lead confirmed to the other run at 01:42Z. LA resumes after the other run returns the window.
- 2026-10-23 02:34Z: the other run returned the window (its M2 ran 02:19:58-02:23:54Z; LA started nothing). LA slot 1 resumed for QA-2 02:33Z-04:33Z on 7a60016.
- 2026-10-23 02:46Z: the other run asked for a second exclusive window (two M1 rounds, M2 rerun, T7; about 75 minutes). QA-2 was inside its LA-E5-08 batch and read the pause only after three notices and a terminal prompt; its stack had been down since 02:45Z. Window confirmed 03:07Z-04:22Z. QA-2 done so far: LA-E5-01 (batch 1a) PASS; left: batches 1b-4.
- 2026-10-23 02:37Z: the Codex Reviewer-A session CXA1 stopped during the LA-E2-01 review (its provider's content filter flagged a security probe). On the product owner's request it is replaced by a Claude Code Opus 5.5 xhigh Reviewer-A (dispatch ctx_96cc43902d89). Security-heavy reviews may go to Claude reviewers.
- 2026-10-23 02:40Z: integration red at ddfd4c6 (3 lane L unit tests): lane K's lti-generic opaque-capable profile, merged after lane L's LA-E2-02, loosens the DR start rule (Codex Reviewer-A A-LA-E2-02-05, and the profile boundary). Both lanes were green alone; the interaction shows only on the merged tree. Fix forward: lane L does it first in its fix round. Green again at 4d6eec9 for the three lane L tests; BUT two lane P portal card-count tests (multi-lms.test.ts, portal.test.ts) were red since ddfd4c6 and the Lead's checks hid them: a stale node_modules/.vitest-cache served the old import.meta.glob result (found at 02:55Z by a fresh-clone run after lane L reported it). Lane P makes the tests open-world now. Lead checks now delete node_modules/.vitest-cache and .vite first.
- 2026-10-23 02:00Z: integration red on F1 at b33c178: the Lead merged lane L's LA-E2-01 (48284a7) before L's report; the trait value 'moodle-scope-jwt' names an LMS in two core files. Fix forward: L renames it to 'scope-jwt' (provisional, A1 ratifies). Lead rule (again): merge only after the lane's status message with a green check.
- 2026-10-23 02:03Z: node_modules of the integration worktree was found empty (the Lead's check failed with 'eslint: command not found'); other ignored paths were intact, so most likely an npm ci started there by another session and stopped. The Lead ran npm ci again; check green at ac1c339 (2923 unit, F1 0). Codex reviewer intros now forbid npm ci, npm install, git clean, checkout and reset in the integration worktree.

Docker: host-only. The other run's legacy invocation ran 14:21-15:1xZ; an owner-requested Savoy Docker job follows (40-60 min); then its SIM and M2/T7 windows. The LA window is not confirmed. Protected baseline: 32 volume records.

Model plan (product owner, 18:25Z; charter-LA §0): reviews on Codex GPT-6-Astra xhigh, QA on Antigravity Gemini 4 Argon high, every other role on Claude Code Opus 5.5 xhigh. Running dispatches finished on their model. New Claude Authors: lanes K, S1, R, L2 (new lane, worktree la-l2). New Codex reviewers: CXA1-3 (lens A), CXB1-3 (lens B).

| Task | Lane | State | Evidence |
| --- | --- | --- | --- |
| E0: LA-E0-01 | Lead | **done** (AC-04/05 at wave end) | QA-3 R1 PASS |
| E1: LA-E1-01..12 | K, P, L | **done** (E1-done SHA b216f86; F1 0 hits; Docker / golden ACs pending) | QA PASS; A and B APPROVE (last rounds) |
| E3: LA-E3-01..04, -06, -11, -12, -13 | L, L2 | **done** except K1-SIM | A and B APPROVE; QA-4 PASS |
| E4: LA-E4-01..05 | R | **done** except K1-SIM | A and B APPROVE; QA PASS |
| E5: LA-E5-01..12, -14..21 | S1, S2, L, L2, K | **done** except K1-SIM (LA-E5-20/21 r2 APPROVE; QA-2 R1 PASS) | A and B APPROVE (last rounds) |
| E7: LA-E7-01..05, -10 | QA, S1, R | **done** (K1-SIM pending where listed) | A and B APPROVE |
| LD-9 lists LA-IC-12, -13, -15..-20 | QA | **approved** by A and B; LA-IC-03 record and LA-IC-20 update, LA-IC-21 with the lead QA | |
| LA-E2-01 | L | A, B r2 APPROVE; QA-4 R1 PASS; follow-ups (BD-A2-83/84, AC-09 test) merged next | E2-K |
| LA-E2-02 | L | A r2 APPROVE, B r2 MAJOR (BD-A1-93, fixed in f8fa4ff); L round 2 groups 1-4 done; flag removal waits for the lead QA K0 change | QA-4 R1 PASS |
| LA-E2-03 | K | A, B r2 APPROVE; QA-3 R1 PASS | E2-K |
| LA-E2-04 | K | A, B r1 CHANGES_REQUESTED (BLOCKER finalized repeat ignores changed bound values; MAJOR staged wizard IDs); fix round next | QA-3 R1 PASS (host) |
| E2-K follow-ups | K | merged e82808e (toolRows BD-A1-94; open-world core tests N10 BD-A1-95) | **E2-K-done SHA = 678eb72** (03:38Z; full check green, caches cleared: 3011 unit, 134 K0, F1 0) |
| LA-E2-05 (brightspace) | K | Author running: channel folder only, F2 core = 0 against the E2-K-done SHA | E2-N gate |
| LA-E3-03 | L2 | A, B r1 APPROVE; QA-4 R1 PASS | **done** except K1-SIM |
| Docker | QA | slot 1 (QA-2) ran LA-E5-01 PASS, paused for the other run's window 03:07-04:22Z; slots 2-8 per tests/ltiaas/GATE-RUN-PLAN.md after it | |
| Waiting for a human decision | — | LA-E3-10 (LA-H4), LA-E4-08 and LA-E3-08 (LA-H22) | plan §6.2 |

LTI migration numbers (Lead, RQ-5): 011 S2 `api_key`; 012 S1 `service_setting` + `registration_session.client_key`; 013 S1 `job_lease`/`job_instance` (LA-E5-19); 014 L (LA-E3-01, platform storage state); 015 L (LA-E3-02, storage_check); 016 S2 (LA-E5-15 service_key epoch); 017 S1 (LA-E5-16 idempotency); 018 L (LA-E3-12 trusted audiences); 019 S1 (LA-E5-20 tool_account.auto_rotate, A2 BD-A2-65); 020 L (LA-E2-01 platform client_assertion_aud, granted_scopes); 021 L (LA-E2-02 registration_session.token_kind). App migrations: 013 K, 014 R, 015 S1, 016 reserved for P (LA-E6-02, data-model §5a); 017 R (LA-E4-03 fix round 2, partition pause, if R chooses a migration).

Incident 2026-10-22 10:20Z: integration red on F1 at `b5069f6` (app migration 013 frozen LMS strings); A1 BD-A1-19, lane P fix `e5a687a`, merged `8a1ef2d`. Process fix: the Lead runs the full check on each merge SHA and tells all lanes about a known red line.


Incident 2026-10-22 14:1xZ: an early merge of lane K's types-only ports.ts turned K0 red (the kit switched baseline adapter cases on when the file existed); the Lead removed that local merge commit within minutes (no other branch had it). Also, the Lead stopped its own check with a name-pattern pkill that may have stopped other agents' vitest runs on the shared host; rule now: stop only your own job by id.

Integration branch: `e82808e`+; last full check green (caches cleared) at `0e6bace` (2998 unit, 254 infra, 134 K0, F1 0 hits, F5 6 rules). Host load reached about 135 at 19:14Z (many parallel checks); the sqlite-lock-probe flake rises with load. RQ-2 records: P commit 6894c86 holds one K line in vitest.config.ts (fileURLToPath); S2 LA-E5-09 store/registrations.ts key-provider lines (S2 in B1-B2); L commit c521136 changes one line of lti/service-keys.ts (L2 file in B3; Lead-authorized B-LA-E5-15-05 item while L2 had no session); L commit a6ea71e changes one fixture line of lti/idtoken.test.ts (L2 file, Lead-granted). Flake: infra sqlite-lock-probe (other run's ADR-012 code) failed once each for lanes K and P today; passes on rerun.
