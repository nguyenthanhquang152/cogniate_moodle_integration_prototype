Verdict: APPROVE
Round: 1 (final M4 guide gate)

# M4 final guide gate: Reviewer-B (lens B: can a human team own it?)

Reviewer: retained Reviewer-B. Task `task_f4547022cbfa`, dispatch `ctx_d669fcc0f1c2`, run `run_ebe671ad72a9`.
Date: 2026-10-23, about 17:03–17:15 UTC.
Scope: the frozen guide candidate `911219b04ba0c8195e935955094155deac0e9fbb` (10 authorized guide paths), the Lead file `docs/human_review/decisions-needed.md`, and the Lead's proposed status-only closure map (`msg_d0c351188340`).

APPROVE covers final documentation and evidence-claim accuracy only. It reruns no runtime check and reopens no accepted result.
It is not a human approval, a production or enterprise claim, or a live-LMS result. All 32 live rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.
Findings: 0 BLOCKER, 0 MAJOR, 2 MINOR, 6 NIT. The closure map is acceptable with the conditions in §6.

## 0. Model, independence and method

- Model: `claude-opus-5-5` (Claude Opus 5.5), as my session context states. The session environment has `CLAUDE_EFFORT=xhigh`. I cannot see the effort setting in any other way.
- I did not read `docs/reviews/M4/reviewer-a-final.md`, its notes or its verdict. At 17:12 UTC the file did not exist. At 17:13 UTC, after this report was written, a directory listing showed its name; I did not open it. `deferred.md` cites two earlier, settled C10 reviews (Reviewer-A and my own). I read only the `deferred.md` rows, not those review files.
- I read the charter, `docs/research/inputs.md` §7, `M4.md`, `T9.md`, the current phase-plan directive (16:55 UTC), all 10 guide paths at the candidate, `decisions-needed.md`, Architect conformance Round 7 (R7.1–R7.8), the ADR-011 and ADR-012 status lines, and E-R4, E-R6 and E-R8. I also read QA's STE method (`docs/reviews/M4/docs.md:54`), the B-SI-09 text and QA's capture closure (`docs/reviews/M3/tracker-repair-qa.md` §11).
- I used git objects only: `git show`, `git diff` and `git grep` at the candidate. I ran no Docker, browser, test, npm, network or install command. I changed no guide, product, test or team file. I did not touch `pnpm-workspace.yaml`.
- Private scripts and outputs: `/Users/quangnguyen/cogniate-review-runs/m4-final-reviewer-b-task_f4547022cbfa-20261023T1705Z/` (folders 0700, files 0600, scripts 0700). They contain a link and anchor checker, a T9-style STE measurement of the delta, and an in-memory simulation of the closure map.

## 1. Identities (verified by me)

| Item | Value |
| --- | --- |
| Candidate | `911219b04ba0c8195e935955094155deac0e9fbb` (= HEAD, parent `2033af54`). Worktree clean except the untracked `pnpm-workspace.yaml`. |
| Guide delta base | `958ee5c1225addff7dc3d5ea3417b7d17e157bbf`. The brief wrote 42 characters, with an extra `10` at the end; the prefix resolves to this commit. All nine changed guide files come from the candidate commit itself (130 insertions, 27 deletions). |
| `infra/README.md` | Unchanged from base to candidate. 61,970 B, `3c27066a3307922336fbc56c0b91d40f6584fc8793d6a0f1640c6739c103c577`. |
| `decisions-needed.md` | 28,718 B, `ca3f743088d8ec90260901e62cc04b946a919241f6cbdb3b5d6a493c4399891d` (matches the brief). |
| Architect report | 80,674 B, `71ee98ddd6301dbae0a9a23b49a21810defe6608616a33293aa687abe1553542` (matches the brief). R7.6 verdict APPROVE; R7.8 binds T7 `qa.md` `a1ac1e7f…cf8d` and M3 `qa-e2e.md` `0f500cd1…7855`. |

Candidate guide files (bytes, SHA-256):

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `README.md` | 11,271 | `c6b67b6ef4d20003a9fe73ea4e9ad1233d1bcdd25c2d428b100e1b02a1f2638c` |
| `docs/guides/canvas-admin.md` | 11,757 | `9f4caf8a655a5d76c9978e7d607f8322606cf79d5aa05cb2810f28e876c91f23` |
| `docs/guides/blackboard-admin.md` | 7,486 | `863843713283d076a37c4ede04d8634779694c9be06e018ae7493598818a3f84` |
| `docs/guides/operator.md` | 20,306 | `b7cd5c27c7851eca31c9d9f3a5e823dc7ac28cc1a3b40e5a54f4018931239c41` |
| `docs/guides/teacher.md` | 10,992 | `6737820630667a6c54682c18d8359501f71700478567303b434ee44b8f19e04c` |
| `docs/guides/troubleshooting.md` | 15,041 | `cc8a93573271396d5225a01d7242cd5d07fdf7f3ef42bb1cb22fa7d817645a12` |
| `docs/human_review/START-HERE.md` | 7,384 | `b7d24a7d969717ee124e75088c66485c5811e02b3db4e9958912c30557ff78a4` |
| `docs/human_review/canvas-blackboard.html` | 24,366 | `836b6072b1ebbc08c2c388d6e7e5c3289d5d055d4f10fbba15a22860f8029d3d` |
| `docs/human_review/deferred.md` | 30,694 | `09b52ae1eac364d9de5db6bedcb21983d228c1a6f773565f40c1c822f4fe9390` |

## 2. AC-M4 criteria

| Criterion | Result | Evidence (my check) |
| --- | --- | --- |
| AC-M4-01 evidence labels | PASS | Every Canvas and Blackboard step has a label. Each live step marked `UNVERIFIED` carries "Not yet tested on a real Canvas site" or "Not yet tested on a real Blackboard site". `CANVAS-LOCAL` is never described as hosted (`canvas-admin.md:121`, `README.md:26`). |
| AC-M4-02 no overclaim | PASS | Searches for "works with", "certified", "production-ready", "enterprise-ready" and "488 fresh" found only negatives: `README.md:38` "This is not 488 fresh cases"; `START-HERE.md:34` lists certification as "Not proven yet". The README table says "signed simulation" (`:25-27`). |
| AC-M4-03 STE | PASS (2 style NITs) | My T9-style measurement of all added lines: longest prose sentence 16 words; 0 sentences over 20; densest paragraphs at the limit of 6 sentences (`README.md:15`, `operator.md:167`, `START-HERE.md:7`, HTML `:83`). See NIT B-M4F-06. |
| AC-M4-04 no DataCamp, no copied prose | PASS | 0 DataCamp hits in the nine files. Provider facts link to `docs/research/multi-lms.md`. |
| AC-M4-05 offline page | PASS | One inline script. No external script, stylesheet, font, image or frame. `url(#tip)` is in-page. The https strings at `:174-178` are table text, not links. The page has sections 1 tenancy, 2 grant with trust boundary, 3 profiles and 4 live status, plus D-1…D-12. B-1, B-2 and B-3 are one sentence each (`:216-218`). Live rows 13 + 1 + 18 = 32. |
| AC-M4-06 Architect conformance | PASS (as cited) | R7.6 says APPROVE for C6, with 0 BLOCKER and 0 MAJOR. The guides cite `#r76-verdict` correctly, and the anchor resolves. |
| AC-M4-07 decisions | PASS | `decisions-needed.md:83-86` lists Q19–Q22 with recommendations. `:100-111` lists D-1…D-12 with the ADR-011 §15 defaults. The HTML defaults (`:232-243`) are consistent short forms. |
| AC-M4-08 D-12 | PASS | `deferred.md:114-125` has the race, its scope (only `canvas-self-hosted`), its impact (blocked setup; no Canvas access because check 14 refuses before storage), the operator order, the statement that prompt redemption does not prevent it, and the need for a reserved-identifier or quarantine design. `operator.md:139-159` and `troubleshooting.md:65` say the same, with no stronger claim. |

Other checks:

- Links: my checker resolved all 276 relative links and anchors in the 10 guide paths plus `decisions-needed.md`. None is broken. The only external URLs are a text example and the historical `rea` link in START-HERE.
- Evidence claims match their sources:
  - E-R8 (`:111-130`): the run ID, 11.45 s, 162 values with 0 shared hits, 51 tests with no viewport retries, 12 PNGs, the shared host, and the watcher replay with no gap over 2 minutes.
  - E-R7 and R7.2: 394 × 2 plus 94 carried rows, not "488 fresh".
  - E-R6: 64/64, 13 criteria, 7 gates; attempt 3 NOT ACCEPTED.
  - E-R4: 304 raw PASS entries and 251 per-subrun unique IDs; the exclusive-host condition failed.
  - The stated evidence basis `31f4d0bb` already contains these E-R8 facts, the R7.6 verdict and the G1 checkpoint.
- The brief's preserved limits are all present in the guides or `deferred.md`:
  - G-1 measured identities only, and no volume generation id;
  - the negative host test proves fault branch only, not bind-mount locking;
  - `content_check_failed` unit-only; the lost-lock exit host-fault-only;
  - `operation_lock_invalid`: STOP and escalate, with no validated manual recovery;
  - Q19–Q22 and D-1…D-12; L-C14 unverified; the portal `GRANT_IN_USE`, `DEPLOYMENT_FIXED` and `ISSUER_RESERVED` texts unverified (`DEPLOYMENT_FIXED` is unit-only);
  - the tracker limits (pagehide before load, retention, WindowProxy/unit model, nominal timers); AR-M3-T609-01/02;
  - SIGKILL log loss and the unmeasured Docker restart policy;
  - T7 shared host, not exclusive; transients between captures not observable;
  - nonblocking C10 findings deferred; old failures kept as history.
- Recovery boundaries are consistent in the operator guide (§3, §3a, §4, §4.3), `troubleshooting.md:91` and `infra/README.md:132`. All use the same STOP-and-escalate wording.

## 3. A-SI-05 / B-SI-09 document closure

Covered by my inspection. The correction at `5a5453c` is in the candidate at `infra/README.md:150-161`. It matches the C6 source and QA's host-only captures:

- `storage_refusal_json` writes stdout (`infra/scripts/lib.sh:343`). The shell folder refusals `backup_folder_in_checkout` and `backup_folder_not_empty` redirect it to stderr (`infra/scripts/stack-data.sh:41-42`). QA captures C-01 to C-04 show the JSON line on stderr.
- The field is `container`, with `id`. It adds `mount` for `old_layout_container` (`lib.sh:414`), or `project`, `service` and `state` for `volume_in_use` (`stack-data.sh:117`).
- The text-only stops (service check, candidate guard, `stop now:`, `INCOMPLETE`, quarantine stops) match captures C-11 to C-13c. `reasons` for `prepare_failed` matches C-15.

One precision NIT (B-M4F-08) does not block closure.

## 4. Findings

### B-M4F-01 — MINOR — `README.md:35` (also `:13`, `:17`; `START-HERE.md:9`; `canvas-blackboard.html:195`; `teacher.md:21`)

- Problem: every C10 T7 claim links only to the Lead decision E-R8. No guide path links to QA's own C10 record in `docs/reviews/T7/qa.md` (append-only record from line 467, with the 15-criterion table). E-R8 itself links only to other QA files.
- Evidence: a `git grep` of the nine guide files finds T7 `qa.md` links only to historical sections (`#10-…`, `#m3-checkpoint-update…`, `#6-…`). AC-T9-02 asks for a QA AC id or a link to the qa.md row.
- Impact: the claims are accurate (E-R8 and R7.2/R7.8 confirm them), but a maintainer cannot navigate from the evidence table to the QA rows.
- Fix: at the next authorized docs change, link the README `MOODLE-LIVE AC-T7-…` row and the HTML T7 row to the C10 record in `docs/reviews/T7/qa.md` (and `docs/reviews/M3/qa-e2e.md`). Safe to defer.

### B-M4F-02 — MINOR — reader-facing pages carry undefined internal identity and process terms

- Locations: `START-HERE.md:7-11`; `canvas-blackboard.html:83`, `:197-206`; `teacher.md:21`, `:76`, `:118`; `canvas-admin.md:3`; `blackboard-admin.md:3`; `operator.md:3`; `troubleshooting.md:46`; `README.md:11-19`, `:50-58`.
- Problem: the product team and customer admins now read terms that the pages never define:
  - commit labels: C6/C9/C8/C10/C4, "M2 actual tests", "actual C8/C6", "r7";
  - QA process terms: "prelaunch hold", "bridge reconciliation", "256-event query limit", "LA watcher";
  - count terms: "per-subrun unique-ID counts".
- Evidence: inputs §7 and the M4 goal ask for short guides and a fast review. The facts are correct, and every page still puts its key message first ("signed simulation only", "Not yet tested on a real … site"). So this is not MAJOR.
- Fix: later, keep identities and run history in the README evidence table and the E-R records. In the customer guides, use one plain sentence plus a link. In the HTML, put the process detail in a `<details>` block. Define the C-labels once. Safe to defer.

### B-M4F-03 — NIT — `teacher.md:78`, `:120`; `troubleshooting.md:48`

Two consecutive sentences link the same evidence table ("See the [evidence table]… Tags: the [evidence table] gives…"). Drop one at the next edit.

### B-M4F-04 — NIT — `README.md:19`, `START-HERE.md:11`, `canvas-blackboard.html:202`, `deferred.md:178`, `:208`

One gate has three names: "guide QA", "Docs QA" and "document QA" (inputs §7: same word for the same thing). The closure map in §6 replaces all of them with one sentence, so applying it resolves this NIT.

### B-M4F-05 — NIT — `README.md:5`, `:79`

The top status line and "8.64 seconds for `demo:prepare`" are Moodle-release figures at `c5683f8`, but they carry no identity label. `README.md:17` gives 11.45 s for C10. Label the older figures, for example "(Moodle release, `c5683f8`)".

### B-M4F-06 — NIT — `README.md:52`, `teacher.md:21`, `canvas-blackboard.html:200`, `:205`, `deferred.md:241`

The new text uses "despite" and "retain(s)". STE prefers "but" or "although", and "keep". Style only.

### B-M4F-07 — NIT — `START-HERE.md:63-69`

"How this was built" names only the Moodle-release teams. The pack does not say which roles and models built and checked the Canvas and Blackboard phase (Codex Lead and Docs, Claude Opus architecture and review, Gemini QA). `START-HERE.md:13` scopes the rest of the page to Moodle, so the text is not wrong. Add one line later.

### B-M4F-08 — NIT — `infra/README.md:151`

The exception says the two folder codes write their JSON line to stderr. That is right for the shell commands (captures C-01 to C-04). The Node-level checks of the same codes write stdout (C-05 to C-07). "So read both streams" already covers this. An optional precision fix: "the shell folder checks". It does not block A-SI-05/B-SI-09 closure. Only the infra README owner can edit this file, under a later grant.

## 5. Not findings (observations)

- `architect-conformance.md:1` still says "Verdict: PENDING (… Round 1 …)". The guides link straight to `#r76-verdict`, so no guide claim depends on that line. It is the Architect's file and outside this gate.
- `troubleshooting.md:82` and `operator.md:143` give `ISSUER_RESERVED` at the API level and mark the registration-page text as not verified. AR-M4-04 already records the different portal answer.

## 6. Proposed closure map (`msg_d0c351188340`)

I simulated the exact map in memory on the nine candidate files:

- 18 occurrences:
  - `README.md`: 2.
  - `canvas-admin.md`, `blackboard-admin.md`, `operator.md`, `troubleshooting.md`: 1 each.
  - `teacher.md`: 2. `START-HERE.md`: 2. `canvas-blackboard.html`: 3. `deferred.md`: 5.
- No key is a substring of another key. Each replacement reads correctly in its sentence.
- **A-SI-05/B-SI-09** (`deferred.md:257`): covered by my inspection (§3). The substitution may be applied.
- **A-T7C10-03** (`deferred.md:202`): covered. The guides bind T7 to C10 and keep M2 at C8 (`README.md:11-13`, `:35-37`). The substitution may be applied.

Assessment: **acceptable, on these conditions.**

1. Apply it only after Gemini's final PASS and two APPROVE verdicts, all on exactly `911219b0`.
2. Add exact entries for the four "draft" labels that the map misses. Without them, the closed pages would show "Draft" next to "passed independent QA and both reviews":
   - `README.md:87`: "Connect a Canvas site (draft; not yet tested on a real Canvas site)" → "Connect a Canvas site (not yet tested on a real Canvas site)";
   - `README.md:88`: "Connect a Blackboard Learn site (draft; not yet tested on a real Blackboard site)" → "Connect a Blackboard Learn site (not yet tested on a real Blackboard site)";
   - `README.md:89`: "upgrade and rollback (draft)" → "upgrade and rollback";
   - `canvas-blackboard.html:82`: `<span class="badge">Draft</span>` → `<span class="badge">Prototype</span>` (or remove the badge).
   - `canvas-blackboard.html:138` ("It is pending.") is a connection state. Do not change it.
3. Before commit, the Lead checks that `git diff 911219b0 <closure commit>` contains only these substitutions in the nine files. No other bytes may change, and `infra/README.md` stays untouched.
4. Charter §5 lists deferred MINOR findings in `deferred.md`. The status-only map adds no rows for this gate's MINOR findings (B-M4F-01, B-M4F-02, and any QA or Reviewer-A MINOR). Either authorize those rows in the same closure commit, or record in the Lead closure where they are listed.

The map makes `README.md:9` and `:19` the same sentence. This is harmless; the Lead may drop the second.

## 7. Ownership and what remains

- I own only this file. The Lead commits it by path. I made no guide fix and no commit.
- Remaining: Gemini's final Docs QA verdict, Reviewer-A's independent verdict, the conditional closure substitution, and Lead closure.
- No push, main merge, live-LMS, certification, production or enterprise claim follows from this review.
