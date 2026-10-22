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

## Wave B1/B2 progress (2026-10-22 14:01Z)

"Done" = QA PASS on every non-pending AC + Reviewer-A and Reviewer-B APPROVE; "pending" ACs wait for the golden tool or a Docker window (LD-21).

Lead outage: the Lead session was down from about 10:35Z to 13:53Z (session limit; resumed on another Claude profile). Workers that needed a Lead answer waited (L about 3 h, S2 about 2.5 h); no work was lost. The run's coordinator handle was re-bound with `run-use` at 13:55Z.

Docker: host-only. The other run's provisional LA window is now **15:00-17:00Z** (not granted). Its protected baseline is now **32 volume records** (the original ten included); LA cleanup stays owned-only.

| Task | Lane | State | Evidence |
| --- | --- | --- | --- |
| LA-E0-01 | Lead | **done** (AC-04/05 at wave end) | QA-3 R1 PASS |
| LA-E1-01, LA-E1-02 | K | **done** (golden / Docker ACs pending) | QA-3 PASS; A, B APPROVE |
| LA-E4-01 | R | **done** (r2) | QA-3 R2 PASS; A r2, B r2 APPROVE |
| LA-E1-04 | P | **done** (+ FU BD-A1-19, FU-1 BD-A2-13/22 merged `ae5315a`) | QA-3 R1 PASS; A r2, B r1 APPROVE |
| LA-E7-03 | S1 | **done** except K1-SIM (QA-2, Docker) | A r2, B r2 APPROVE |
| LA-E1-05 | L | r1 approved; fix round 1 (BD-A1-21/23, BD-A2-21) ready at `ead5edb`, merge waits for the lead QA kit change (RQ-1) | QA-4 R1 PASS (host-only); A2, B2 APPROVE |
| LA-E5-01, LA-E5-08 | S1, S2 | reviews APPROVE; K1-SIM pending Docker | |
| LA-E5-02 | S1 | A r2, B r1 APPROVE; K1-SIM pending Docker | |
| LA-E5-10 | S2 | A, B APPROVE r1; fix round 1 part 2 (A2 BD-A2-23/24) running | |
| LA-E5-04 | S1 | A r1 BLOCKER closed by S2 `98e40a2`; B APPROVE; fix round 1 (A2 BD-A2-25) running | |
| LA-E5-07 | S2 | A APPROVE (1 MINOR); B running | |
| LA-E5-14 | L | merged `3c7221d`; QA-4 R1 running; reviews queued | |
| LA-E5-03 | S1 | merged `9cbd043`; A r1 running; B queued | |
| LA-E1-03 | K | fix round merged `b3af690`; A r2 and QA-3 R2 running | QA-3 R1 PASS; B APPROVE |
| LA-E1-06 | K | merged `dc67c14`; A2 and B reviews, QA-3 R1 running | |
| LA-E7-10 | R | fix round 1 merged `b5069f6`; B r1 APPROVE; fix round 2 (B MINORs) running; then A r2, QA-3 R2 | |
| LA-E7-01 | QA | round 2 committed `3efa55a`; reviews r2 queued | |
| LA-E7-02 | QA-E2E | started 14:02Z (new Antigravity agent), host-only part | |
| LA-E1-07 | K | Author running | |
| LA-E1-11 | P | Author running | |
| LA-E5-19 | S1 | after the LA-E5-04 fix round (same dispatch) | |
| LA-E0-02/03/04 | QA | LA-E0-03 K0 PASS, K1-SIM pending Docker; LA-E0-04 waits for both reviewers on the LD-1 list | |

LTI migration numbers (Lead, RQ-5): 011 S2 `api_key`; 012 S1 `service_setting` + `registration_session.client_key`; 013 S1 `job_lease`/`job_instance` (LA-E5-19).

Incident 2026-10-22 10:20Z: integration red on F1 at `b5069f6` (app migration 013 frozen LMS strings); A1 BD-A1-19, lane P fix `e5a687a`, merged `8a1ef2d`. Process fix: the Lead runs the full check on each merge SHA and tells all lanes about a known red line.

Integration branch: `0670bf3`+; last full check green at `b3af690` (2013 unit, 118 K0 + 3 todo, F1 590 hits, F5 3 rules).
