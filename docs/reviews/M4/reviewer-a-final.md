Verdict: APPROVE
Round: 1 (final M4 guide gate)

# M4 Reviewer-A: final guide and evidence review

Reviewer-A, lens "Is it right and is it safe?": correctness, security and evidence honesty.
Model: `claude-opus-5-5` (Claude Opus 5.5), as the session reports it. I cannot observe the effort setting from inside the session. The dispatch names xhigh.
Task `task_33a035c18ae0`, dispatch `ctx_4daf7f8fdd17`, run `run_ebe671ad72a9`. Review time: 2026-10-23, about 17:03–17:15 UTC.

Blind: I did not read `reviewer-b-final.md`, its notes, its verdict, `reviewer-b-preliminary.md` or any Reviewer-B message.
Host only: I used read-only `git show`/`git diff` and inline checks. I ran no Docker, container, browser, install, network call or test. I wrote no file except this report. I made no guide edit and no commit.

This review gives no human approval and no live-LMS, production or enterprise claim. It also does not decide final pack closure. The Lead records that decision after all independent gates.

## 1. Reviewed identities

Candidate: `911219b04ba0c8195e935955094155deac0e9fbb` (HEAD; worktree clean except the preserved untracked `pnpm-workspace.yaml`).

Guide delta base: `958ee5c1225addff7dc3d5ea3417b7d17e157bbf`. The dispatch gave a 42-character form; it has two extra trailing characters and resolves to this commit. Only `911219b0` changes a guide path in this range (+130/−27 lines, 9 files).

| Path at candidate | Bytes | SHA-256 |
| --- | ---: | --- |
| `README.md` | 11,271 | `c6b67b6ef4d20003a9fe73ea4e9ad1233d1bcdd25c2d428b100e1b02a1f2638c` |
| `docs/guides/canvas-admin.md` | 11,757 | `9f4caf8a655a5d76c9978e7d607f8322606cf79d5aa05cb2810f28e876c91f23` |
| `docs/guides/blackboard-admin.md` | 7,486 | `863843713283d076a37c4ede04d8634779694c9be06e018ae7493598818a3f84` |
| `docs/guides/operator.md` | 20,306 | `b7cd5c27c7851eca31c9d9f3a5e823dc7ac28cc1a3b40e5a54f4018931239c41` |
| `docs/guides/teacher.md` | 10,992 | `6737820630667a6c54682c18d8359501f71700478567303b434ee44b8f19e04c` |
| `docs/guides/troubleshooting.md` | 15,041 | `cc8a93573271396d5225a01d7242cd5d07fdf7f3ef42bb1cb22fa7d817645a12` |
| `docs/human_review/START-HERE.md` | 7,384 | `b7d24a7d969717ee124e75088c66485c5811e02b3db4e9958912c30557ff78a4` |
| `docs/human_review/canvas-blackboard.html` | 24,366 | `836b6072b1ebbc08c2c388d6e7e5c3289d5d055d4f10fbba15a22860f8029d3d` |
| `docs/human_review/deferred.md` | 30,694 | `09b52ae1eac364d9de5db6bedcb21983d228c1a6f773565f40c1c822f4fe9390` |
| `infra/README.md` (unchanged since before the base) | 61,970 | `3c27066a3307922336fbc56c0b91d40f6584fc8793d6a0f1640c6739c103c577` |
| `docs/human_review/decisions-needed.md` (Lead) | 28,718 | `ca3f743088d8ec90260901e62cc04b946a919241f6cbdb3b5d6a493c4399891d` |
| `docs/reviews/M4/architect-conformance.md` (R7.8) | 80,674 | `71ee98ddd6301dbae0a9a23b49a21810defe6608616a33293aa687abe1553542` |
| `docs/reviews/T7/qa.md` | 92,706 | `a1ac1e7f60c1c593a9c6a4422fd54d5a948c1dbd3ed1d59b229c92a149b4cf8d` |
| `docs/reviews/M3/qa-e2e.md` | 79,705 | `0f500cd14b64005919f3c1b4044b90f44d4a20051b333b41242b37975e457855` |
| `ADR-011-multi-lms.md` | 64,970 | `816df890d510bcab99419d4404c328feaadb06dc2461dfbb09fd6cc87629c741` |
| `ADR-012-sqlite-volume-storage.md` | 118,343 | `27384950b5b641fd4d74f77d659fcf9ffbdcf90f9acbfc410967fa6e91baac24` |

The dispatch hashes for `decisions-needed.md`, the conformance report, `T7/qa.md` and `qa-e2e.md` all match. The ADR hashes equal the values that the Architect records in R7.5.

## 2. Acceptance criteria (AC-M4-01 to AC-M4-08)

| Criterion | Result | Evidence |
| --- | --- | --- |
| AC-M4-01 evidence labels | PASS | Every live step in the Canvas, Blackboard, operator and teacher guides has its `L-… UNVERIFIED` tag and the exact "Not yet tested on a real Canvas site" or "Not yet tested on a real Blackboard site" note. The changed lines are status headers and notes, not steps; they cite E-R4/E-R6/E-R7/E-R8 and the conformance report. `canvas-admin.md:121` says that a self-hosted result never proves hosted Canvas. |
| AC-M4-02 no overclaim | PASS | A grep of all 10 paths finds no "works with Canvas/Blackboard", certification, production-ready or enterprise-ready claim, and no "488 fresh" claim. `README.md:25-27` says "signed simulation only". `START-HERE.md:34` lists 1EdTech certification as not proven. |
| AC-M4-03 STE | PASS (changed lines) | My spot check of the 130 added lines found 343 sentence segments, none over 20 words (procedure) or 25 words (description), and no paragraph over 6 sentences (T9 method). The independent Docs QA measures the full files; I do not replace it. |
| AC-M4-04 no DataCamp value, no copied prose | PASS | No DataCamp value is in the guides. The only DataCamp word is the Lead's Q3 privacy comparison (`decisions-needed.md:17`). Provider steps use `DOC F-…` tags and link to the research file. |
| AC-M4-05 offline page | PASS (static) | The HTML has no external script, style, image, font, frame or fetch. `url(#tip)` is an internal SVG marker. The four issuer URLs (`canvas-blackboard.html:174-178`) are `<code>` text only. The one inline script only steps through a list. Sections 1–5 exist (tenancy, grant and trust boundary, profiles, evidence and live status, decisions D-1 to D-12). B-1, B-2 and B-3 have one sentence each (`:216-218`). The new rows and paragraphs (`:191-206`) add only text and relative links. |
| AC-M4-06 final conformance | PASS | R7.6 is **APPROVE** for C6, with no open BLOCKER or MAJOR. Its scope is "signed-simulation and local real-Moodle prototype scope only". R7.7 keeps the limits, and R7.8 binds the final QA reports. The guides link to `#r76-verdict` and claim no more than R7.6. |
| AC-M4-07 decisions | PASS | `decisions-needed.md:74-117` lists Q19–Q22 with recommendations and D-1 to D-12 with the ADR-011 §15 defaults. The G1 current-status checkpoint (`:126-147`, 2026-10-23) matches E-R8, R7.7 and the ADR-012 status line. |
| AC-M4-08 D-12 (A-M0-10) | PASS | The `deferred.md:114-125` entry gives race, scope, impact, order, "does not prevent" and the enterprise design need. `operator.md:139-159`, `troubleshooting.md:65`, `canvas-blackboard.html` "D-12 in plain words" and `decisions-needed.md:111-117` say the same, with no stronger claim. |

All 275 relative links and `#anchors` in the 10 paths and `decisions-needed.md` resolve at the candidate (GitHub heading rules). These include `#final-t7-acceptance--1643-utc`, `#r76-verdict`, `#r68-…` and `#g1-storage-design-blocking-design-findings-closed`.

## 3. Evidence identities and honesty

- **Product and tests:** C6 `4008afb9…`; M1 tests C9 `9eb504f5`; M2 actual C8 `5561e8f7`; T7 actual C10 `97b68af4…` with tests tree `ec2d86f5…`; carried C4 `bf09cda`. These match R7.1 (`README.md:11-13`).
- **M1:** "two equal fresh rounds of 394 … another 94 rows are carried from C4" and "This is not 488 fresh cases" (`README.md:15`, `:38`; `START-HERE.md:7`; HTML evidence table). This matches R7.2.
- **M2:** 64/64, 13 criteria and seven gates at actual C8/C6. Attempt 3 stays NOT ACCEPTED. The missed prelaunch hold and the 256-event limit are disclosed (`README.md:52`).
- **Legacy:** 304 raw PASS. "Per-subrun unique-ID counts sum to 251. This is not a global distinct count." The failed exclusive-host condition is stated (`README.md:15`, `:52`).
- **T7 C10:** the guide text matches E-R8 §"Final T7 acceptance" and R7.2–R7.3:
  - three cycles, each 17 PASS with 0 failures and only the demo skip;
  - demo preparation 11.45 s;
  - four confirmation/refusal checks;
  - 15/15 criteria;
  - 162 scan values and 0 shared hits;
  - 51 tests with no viewport retries, and 12 PNGs.

  The C8 attempt and its failed scan stay FAILED history (`README.md:35`, `:54`; `teacher.md:21`; `START-HERE.md:9`). The shared-host, non-exclusive status and the between-capture blind spot are stated (`README.md:58`; HTML `:206`; `deferred.md:238-241`).
- **Import closure:** "The M1, M2 and legacy import closures exclude all four C10 repair files. M1 and M2 typecheck globs include E2E files. Typecheck passed at C10." (`README.md:56`). This is the precise wording that my C10 NIT A-T7C10-02 requested.
- **Evidence basis `31f4d0bb`:** at that commit, E-R4/E-R6/E-R7, the E-R8 final T7 acceptance and conformance R7.6 already exist. The later commits `351eee07` and `253ff824` (R7.8) only bind the QA reports. Every guide claim is traceable inside the stated basis.
- **ADR status:** ADR-011 is "Accepted design … Prototype conformance: AC-M4-06 APPROVE", and ADR-012 is "Accepted for the prototype, revisions 3.3–3.7", with the G-1, generation-id, fault-branch, unit-only and fault-injection limits. The guides say the same (`README.md:19`, `operator.md:165`).

## 4. Limits, warnings and security

- **Limits kept.** Each required limit is present:
  - G-1 measured identities only, and no volume generation id;
  - `c-host-negative` proves fault detection, not bind-mount locking;
  - `content_check_failed` unit-only, and the lost-lock exit fault-injection-only;
  - `operation_lock_invalid` STOP/escalate, with no validated manual recovery (`operator.md:167-169`, `:220-223`; `troubleshooting.md:91`; `infra/README.md:132`; `deferred.md:243-248`; `decisions-needed.md:140-144`);
  - L-C14 unverified (`canvas-admin.md:67`, `:125-139`; `operator.md:233-239`);
  - the portal `GRANT_IN_USE`, `DEPLOYMENT_FIXED` (unit-only) and `ISSUER_RESERVED` texts unverified (`troubleshooting.md:63`, `:67`, `:82`);
  - the D-12 setup-denial race, with no Canvas access because check 14 comes before storage, and "narrows, does not prevent";
  - the tracker `pagehide`, retention and WindowProxy limits, and the nominal 10/150 ms timers;
  - AR-M3-T609-01/02;
  - possible app-log loss after SIGKILL, and the unmeasured Docker restart behavior (`deferred.md:210-236`).
  - All 32 live rows stay UNVERIFIED, and local Canvas stays DEFERRED.
- **C10 findings and old failures.** The C10 deferrals A-T7C10-01/02/03 and B-C10-01/02 are recorded as nonblocking (`deferred.md:192-208`). Old failures stay historical.
- **Reset and recovery warnings kept:**
  - `e2e:reset` deletes data (`README.md:75`);
  - never use `stack:reset` as recovery (`operator.md:210`; `infra/README.md:164`);
  - rollback loses writes and re-validates revoked codes (`operator.md:195`);
  - backups and traces hold secrets (`operator.md:182`; `troubleshooting.md:97`).
- **Security.** No secret value, key, token or DataCamp identifier is in the 10 paths. One pattern hit (`infra/README.md:322`) describes `ltik=` redaction; it is not a value.

## 5. Findings

No BLOCKER. No MAJOR.

| Id | Severity | File:line | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-M4F-01 | NIT | `infra/README.md:156` (unchanged since `5a5453c`) | "They print text on stderr only, exit 1 and write no JSON line" is too broad. These stops write no `storage_refused` line. But the shell-wrapped commands still write `storage_lock_acquired`/`storage_lock_released` JSON lines on stdout. The INCOMPLETE and quarantine stops can also write `storage_backup`/`storage_quarantine_copy` lines, and the copy-failed stop follows a coded `source_unreadable` line. | QA captures C-11, C-11b, C-11c, C-12 and C-13a–c (`docs/reviews/M3/tracker-repair-qa.md` §11.2), and the §3 row for `:157` ("stdout: only `storage_lock_acquired` and `storage_lock_released` (no `storage_refused`)"). | Under a later infra README grant, say "write no `storage_refused` line". Keep A-SI-05/B-SI-09 open until then (§6). |
| A-M4F-02 | NIT | `README.md:87-89`; `canvas-blackboard.html:82` | The guide table still says "(draft; …)" and the page shows a `Draft` badge. The proposed closure map does not cover them. After closure they can conflict with "passed independent QA and both reviews". | `git grep` of the 10 paths (§6). | The Lead decides: add them to the status-only map, for example drop "draft;" and the badge, or keep them as an explicit "not live-tested" label. |
| A-M4F-03 | NIT | `docs/reviews/M4/architect-conformance.md:1-2` (Architect-owned) | The file still starts with "Verdict: PENDING … Round: 1". The final verdict is R7.6 APPROVE. A reader who opens the file sees PENDING first. | Charter §6 puts the verdict line at the top. The guides link straight to `#r76-verdict`, so they are not wrong. | Under an Architect grant, add a top line that points to the R7.6 APPROVE verdict. Keep the old rounds unchanged. |
| A-M4F-04 | NIT | `teacher.md:78`, `:120`; `troubleshooting.md:48` | Two sentences in a row link the same evidence table ("See the [evidence table]…. Tags: the [evidence table] gives…"). | Text of the three lines. | Optional cosmetic merge in a later grant. It changes no claim. |

All four are nonblocking and can stay deferred. None needs a guide change before closure.

## 6. Proposed status-only closure map (Lead `msg_ad8e7a862087`)

I assessed the exact nine-key map against the frozen candidate:

- **Occurrences:** the keys occur 18 times in 9 files. The 10 occurrences of "This guide candidate awaits …" are in the canvas-admin, blackboard-admin, operator, teacher (2), troubleshooting, START-HERE, HTML (`:10`, `:83`) and deferred guides. Each other key occurs once.
- **No conflicts:** no key is inside another key's occurrence. Applying the keys in either order gives identical bytes.
- **Grammar and STE:** both replacement sentences are 8–9 words and fit the surrounding text.
- **A-T7C10-03:** "Final document closure remains pending." (`deferred.md:202`) → "Document closure passed at guide revision 911219b0." is acceptable. The guides and R7.1 bind T7 to C10 and keep M2 at C8, which is that finding's disposition.

**Exclude** "Independent document closure is pending." (`deferred.md:257`, A-SI-05/B-SI-09). My inspection does not confirm closure:

- QA's own §3.6 lists the remaining old-build wrapper branches as needing raw command output: `wrapper_old_only`, `wrapper_command_not_allowed`, and the non-`hash_mismatch` `stop now:` checks at `storage-compat.sh:161,167,171,178`.
- The §11 captures C-01 to C-15 do not include them. `infra/README.md:159` names these stops.
- A-M4F-01 is still open. The `stack-data.mjs:915` text-only exit also stays a deferred NIT.

Leave that one cell "pending", unless the final independent Docs QA shows captured output for those branches and the Lead records it.

The map is **acceptable, with A-SI-05/B-SI-09 excluded**, on four conditions:

1. The actual final verdicts are independent Docs QA PASS, this Reviewer-A APPROVE and Reviewer-B APPROVE, all on `911219b0`.
2. The Lead verifies that the substitution commit changes only those exact strings (17 occurrences once the excluded entry is removed) and no other byte.
3. The Lead decides A-M4F-02.
4. No runtime, live-LMS or enterprise claim is added.

## 7. Ownership and limits of this review

- **My scope:** this report only. Guide owners: retained Codex Docs. `decisions-needed.md`: Lead. Conformance report and ADRs: Architect. `infra/README.md` rows: their granted owner.
- **Reused, not repeated:**
  - accepted runtime reports (E-R4, E-R6, E-R7, E-R8, R7.x, `T7/qa.md`, `qa-e2e.md`);
  - QA's captured CLI evidence in `tracker-repair-qa.md`;
  - the earlier Docs QA offline browser check of the HTML structure (`docs/reviews/M4/docs.md`).
- **Not done here:** I did not review the implementation or rerun any test, and I made no browser run.
- **Not decided here:** this verdict gives no final pack approval. The independent Docs QA verdict and Reviewer-B's verdict are separate, and the Lead records closure.
