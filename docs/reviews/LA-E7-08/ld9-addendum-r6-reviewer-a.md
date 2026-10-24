Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Lens: is it right and is it safe?

Reviewed `a2dc6270`, `ld9-addendum-r6.md`, its exact patch against `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`), both cited G-1 reports, ADR-012 §17, BD-A1-120, BD-A2-113 and LA-ADR-04 D8. One MAJOR finding; no BLOCKER, MINOR or NIT findings. The identity patch is correct. The addendum's account of the safety evidence needs correction before approval.

### A-LA-E7-08-LD9-R6-01 — MAJOR — The diagnostic summaries claim measurements that the reports exclude

**File:** `docs/reviews/LA-E7-08/ld9-addendum-r6.md:49` and `:50`; also the description at `:45` (lines at `a2dc6270`).

**Problem:** The approval record expands the measured process-group scope to plain `docker run` and `/bin/sh`, and describes a 30-second orphan-hold trial instead of the whole-group-kill test that actually supports G-1.

**Evidence:** Row 49 claims both `docker compose run --rm` and `docker run --rm` under `/bin/sh` and `/bin/bash`. Both linked reports §3 and §7 instead say `/bin/bash` with a `perl setpgrp` group leader and `docker compose run` only; other callers and shells are unmeasured. Row 50 claims `sh -c 'sleep 30'` with orphan observations at `t+2s` and `t+15s`. Both reports instead use a target running `sleep 300`, held before creation by a dependency health gate. Their 30-second observations follow **whole-group SIGKILL**, with no surviving client and no target container. Report 1 observes 29 samples through 30.94 seconds; report 2 observes 28 samples through 30.49 seconds. They also test parent-only SIGKILL and positive controls. These are not interchangeable experiments: an orphan that keeps its group does not by itself prove the whole-group-kill condition. The incorrect summaries could lead a later maintainer to treat unmeasured commands or shells as measured safety evidence.

**Suggested fix:** Replace both result summaries and the “orphan-hold” description with the actual protocol and results in ADR-012 §17 “G-1 result 2.” State that these are independent repetitions of the same gated-before-creation Compose protocol. Include the whole-group-kill result and the measured scope, and retain the distinction between design-gate evidence and acceptance. The cited reports already satisfy §17; this finding needs a documentation correction, not another diagnostic or a code change.

### Verification

- Independently read both Docker binaries as files, without invoking them. At `2026-10-24T12:16:56Z`, their SHA-256 values matched the patch and both reports: CLI `6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3`; Compose `31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def`. `sw_vers -productVersion` and `uname -m` returned `27.0.1` and `arm64`. The reports supply CLI `29.9.2` and Compose `v5.6.1`; no Docker version command was run in this review.
- Independently hashed the two reports. They match the addendum and ADR: `38b98da6b576c0b3e63395c0d115143745193d5f19959be684192efdaf8aa283` and `ebfbcd14c09f790979faacf947c553c77f53b132190340cb85b7501f8be2da48`.
- Both reports meet §17: every recorded client stays in the stub's own group; parent-only kill leaves clients visible in that group; whole-group kill before creation leaves no client and no container through more than 30 seconds, using all four filters and event checks; the positive controls detect the target. The reported scope remains one host, these identities and the specified Compose protocol. This is design-gate evidence, not runtime acceptance.
- Extracted the diff from the pinned addendum. It equals the artifact byte for byte, with SHA-256 `051af77f1aa074e328d879a576435ba9848daaeffed222c6e7a39663f83eff2e`. In a private `git clone --no-hardlinks` at the pinned base, `git apply --check -v` passed, then the exact patch applied.
- Checked every changed line against explicit literal substitutions. Only `tests/host/storage-docker.mjs` (2 additions / 2 deletions) and its self-test (5 / 5) change. The comparison and read logic, OS binding, guard behavior, container rules and product files are unchanged. The negative Compose-version fixture moves to `5.6.0`, so it remains a mismatch. This is the environment identity change authorized by D8, not an LA-IC.
- Ran `node --test tests/host/storage-docker.selftest.mjs` in the private clone: **6 passed, 0 failed**. All Docker-facing calls use the inspected fake functions. With only the implementation restored temporarily to the old binding, the updated test suite failed the A-S-14 test (**5 passed, 1 failed**). Restored the patched implementation afterward. All six single-field mismatch assertions remain present.

Local evidence: `/tmp/la-reviewer-a-ctx-7bfc9aefe96f-evidence/` (`identity-hashes.json`, `round1.patch`, `apply-check.txt`, `scope-check.txt`, `storage-docker-selftest.txt`, `old-binding-new-selftest.txt`). Private clone: `/tmp/la-reviewer-a-ctx-7bfc9aefe96f`. No install, Docker invocation, stack, live acceptance run or commit. The frozen source remains at the pinned SHA with no tracked changes. Only this review file was added in integration. D1/D2 runtime evidence remains a separate requirement after the reviewed binding is adopted.
