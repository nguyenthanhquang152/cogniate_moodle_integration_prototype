QA-K (same Claude session; new dispatch; QA-3 has the other Docker slot, so the Lead gives this run to you): LA-E8-02 AC-LA-E8-02-03, the K1-SIM kit run for the walkthrough channel acme-lms. Append "Round 2" to docs/reviews/LA-E8-02/qa.md. Keep Round 1 unchanged.

Source: a fresh `git clone --no-hardlinks` of the la-walk worktree, detached at d6196d52 (337b807d plus the walker's log; base 3880a1b7 holds the final product a8bbac53). Then replace `tests/ltiaas/kit/**` with the final kit tree from integration d9a4f482 (tree 8ad870fa1b33c93268bb0cdfb11dd86289a650c4, your round 7 fix), but keep the walker's `tests/ltiaas/kit/channels/acme-lms.json`. Record both tree hashes, and record `git status` of the clone after the copy.

Run: your own Round 8 host procedure (docs/reviews/LA-E7-06/qa.md R8.3, `tests/ltiaas/kit/run-k1sim.mjs`). Use the same commands, with QA_KIT_CHANNELS=acme-lms and retries 0. If the runner needs frozen-suite wave sources only for Moodle, say that acme-lms does not use them. If it needs them for every run, stop and tell the Lead.

DOCKER-YES for 75 minutes from this dispatch: one stack, project prefix `qa4-la-walk-r1` (a new number for each run), PUBLIC_PORT 9443, STACK_SUBNET 172.20.0.0/16. QA-3 runs the other stack at the same time (qa3-la-e404-*, 9473, 172.23.0.0/16). Write before/after Docker records (umask 077), clean up only what you own, and run your own ps and docker events watchers. Never touch qa3-la-*, qalead-la-*, qa-e2e-*, la-g1-diag-* or sto-*. Do not read product source.

Expected: every applicable kit case for acme-lms PASS, plus K-HYG and the fault matrix for that channel. If a case fails, classify it:
(a) The walker's channel or fixture is wrong, and the guide did not tell them how to do it correctly: this is a finding for LA-E8-01 (F-LA-E8-01-K1-n), with the guide step.
(b) A kit defect: a finding for LA-E7-06, with the evidence.
(c) A product defect: stop and tell the Lead.
Do not fix files on the walk branch. Do not change the kit while its round 8 reviews run: report a kit defect to the Lead. Leave your files uncommitted in la-qa, as before; the Lead commits them. QA-3 also works in la-qa on other files, so do not touch its files. One rerun is allowed only for a host flake (the deferred host-runner inspect race), and you must say so.

Done report (one worker_done, --outcome succeeded even when the verdict is FAIL): three sentences: what you ran, the verdict and counts, what is left. --files-modified, --report-path. Then stop.
