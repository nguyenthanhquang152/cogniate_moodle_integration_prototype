# E-R8: bounded shared-host T7 verification

Decision: ACCEPTED FOR THE BOUNDED T7 ROUTE by the Lead, 2026-10-23 15:05 UTC.
This document selects a verification route; a separate per-attempt grant is still required.

## Qualified inputs

The route follows Claude's failure plan sections 16–17, SHA-256 5253e839118a22e867457005c7735fe23c85a270e675dfb996adb6244a6c257f. It qualifies copied tools only. Product C6 remains 4008afb92fe983d52db33442e060210b929966c8. Runtime source/tests C8 remain 5561e8f72a83de36a68877c6b26ffc8288ade735. C9 dependency equivalence does not relabel a C8 execution.

Candidate r2 manifest: notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256, 8,577 bytes, 42 entries, SHA-256 e4f6030009ff02c2f15cd9a79b7eca1e76ff7088b8b9a81fdae12a3706ecb05c. The Lead verified every entry by size, hash and mode.
Implementation report: 952ba5e0ad7b1fb47c6c99836e2a467949d44b088db2bc9acde044d720bc8c70.
Independent Gemini QA: PASS, message `msg_08594c4fae3c`, [report](../reviews/M3/t7-shared-host-tools-qa.md). Its final result is 20,238 bytes, SHA-256 `02e03e920aa6238d450e055332b32887316f55c476d894661c4a725393d43a52`; runner SHA-256 `ab1e17d9430c760583924dcc098c8c0bda6268b27d8285b019f6778f798832aa`. All 55 suite controls and four regressions pass with zero sentinel Docker calls.
Focused Claude review: APPROVE, message `msg_03e9d3665f35`, [report](../reviews/M3/t7-shared-host-focused-review.md), 50,668 bytes, SHA-256 `4d3850783461a14ebe5c9eb17e59354612d533a73cb8759ee0d0cf2d9116b44f`.
Original tools and manifests remain preserved. The initial candidate failure and excluded unfrozen probe remain disclosed. Gemini's first r2 output was overwritten; its reconstructed record is labeled as such. Final acceptance uses only the bound final execution. Attempts 2–4 remain preserved. Claude accepted the five QA adapters as consistent with the unchanged contract.

Two report NITs are accepted: the private disclosure mislabels the old r4 manifest hash (actual `1b6be474b5a972b5b028e064985486ea6a2f5e43767ce48f2ac63a676af27fef`), and the unsuffixed r2 result is attempt 2. Always use the `-final` result above. The Lead authorized correction of QA's report manifest-size transcription in `msg_cba511d19849`; the actual manifest is 8,577 bytes. All 17 source-table bindings passed the Lead's independent metadata comparison.

## Narrow amendment to E-R6

E-R6 still governs product behavior, runner arguments, deadlines, cleanup, secrets, protected resources, operational closure and separate grants. For T7 alone, the qualified boundary-r2, lane-watch-r5, reconcile-32vol-v2 and wrapper-v3 replace the earlier copies at their held hashes. No other accepted M1, M2 or legacy evidence is reopened.

Savoy's owner will not pause. A global exclusive host window is therefore not claimed. Only foreign resources positively classified by the full section 16 predicates may coexist. Names alone never prove ownership. Excluded and protected resources remain excluded, full 32-volume records remain strict, and unknown metadata blocks acceptance.

Every present foreign container, non-built-in network and extra volume must qualify in each capture. This includes unchanged objects whose dependency records have changed. OUTER W3/W4 and LANE start/end are independent pools from the same invocation. No pool may borrow metadata from preflight, another pool, attempt or invocation. A start-capture vanished object remains UNKNOWN. Only a sufficient earlier same-ID record in that pool permits a not_found end-capture attribution; the SV predicate still applies.

Raw errors, counts and capture-specific attribution remain visible. This route does not observe objects created and removed wholly between captures. It does not prove exclusive access or remove the existing C8 allContainers false-FAIL risk. Such a failure remains FAIL.

## Preflight and invocation

Private preparation root R is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`. The retained Gemini runtime task is `task_5bccef8e6029` / `ctx_73b31b9cc18d`. Host-only preparation is authorized. LA's planned 15:10 handoff in `msg_abf580342056` is not the actual handoff and is not a preflight grant.

LA must first provide actual stack-down evidence, full 32-volume/network records and a new bounded hold. The Lead then grants a separate external preflight using the qualified new tools. No Docker command, wake or runtime root is authorized before that grant.

The accepted predecessor is R/m2/window-attempt4/w4-end.json: 19,913 bytes, SHA-256 544142a119dedc4c77279e5c0078ceac7c53dd7c520558aeb156a768c13638fd. All 32 complete volume records must remain equal. Strict identity, settings and built-in records must match. Only an explicitly reviewed idle-VM bridge Id/Created replacement before launch is permitted; bridge options, labels and IPAM stay unchanged.

The Lead reviews the fresh hashed preflight before issuing one runtime grant. The grant must bind the expected preflight hash, actual message/delivery IDs, LA hold and both deadlines. No reconciliation after launch is allowed. Runtime W3 must pass the internal guard against that held preflight.

Each invocation uses a new absent direct t7-attempt-* child of R. The atomic root claim gives only the winning process write ownership. A pre-T4 failure after the claim consumes the root and exits 4 with private raw-stage evidence; a pre-path refusal exits 2. No automatic retry, overwritten artifact or reused grant/preflight is authorized. The Lead checks freshness explicitly; automatic historical reuse scanning remains deferred.

Use the unchanged detached launcher with outputs outside the absent attempt root. The byte-identical observer and existing helper create fresh C8 host source and a separate pristine runtime clone. B-TW-03 must pass before READY. No tool edits are permitted during a run.

## Required result and closeout

Use lane qa-e2e-m3-r3, port 8543, subnet 172.31.0.0/16 and unchanged T0–T14 order. Require all 15 criteria; three default runs with 17 PASS each; only the permitted demo-only skip; passing demo within 180 seconds; four confirmation/refusal checks; keep and teardown proof; trigger mapping; B-TW-02 with both lane snapshots; scans; W3/W4, sampler and all 32 full records.

A failed W4 capture retains its failure, stops the sampler and attempts each required comparison report once. The private T13 status keeps every exit code. Any required failure blocks T14 and acceptance. No deadline extension or delayed comparison to obtain PASS is permitted.

Preserve foreign resources. No prune, unrelated stop/removal, pull, account or Docker-setting change is authorized. Private directories use 0700, evidence 0600 and scripts 0700; the approved runner-child 022 remains. Obtain LA's whole-window confirmation and return the host after owned cleanup.

F-01–F-04, Q1–Q4 and M-1 are closed only at the qualified version. Other accepted nonblocking NITs remain documented. Final architecture conformance, guide evidence, independent Docs QA, two blind reviews and Lead closure remain after T7. All 32 live LMS rows stay UNVERIFIED, local Canvas stays DEFERRED, and no enterprise-readiness claim, push or main merge is authorized.

## Attempt record: 2026-10-23

LA handed over the host at 15:09:02 UTC (`msg_f6fa96e2f3e6`). The Lead checked the four handoff file hashes. LA later confirmed a hold through 15:50 UTC (`msg_c1c6a9d55c38`). Savoy continued under the qualified attribution rules.

The first external preflight, `notes/t7-external-preflight-r8-20261023T1510Z`, failed. Its shell used the private test home directory. Docker then selected the absent `/var/run/docker.sock`. QA retained every failed record and reported the cause in `msg_1ffd4fb3237e` and `msg_81fda6fc1bb5`. No T7 runtime started in that attempt. The next preflight used a new directory and an explicit grant (`msg_6ead93e7a896`). The qualified tools did not change.

The second external preflight passed at 15:23:41 UTC. Its directory is `notes/t7-external-preflight-r8-20261023T1521Z`. W1, W2, W3, the anonymous-volume check and the qualified 32-volume check all exited 0. W3 is 31,715 bytes, mode 0600, SHA-256 `c10f393829436a3d25dd3bef38c82f8489e7d0bd46339adf5cae0d7e21f07baf`. The Lead independently compared complete identity, Docker info, settings and all 32 protected volume records. They match the accepted M2 predecessor. Two extra volumes and two containers have full SV and SC attribution. There are no foreign networks, vanished records or read failures.

The Lead accepted the preflight in `msg_37daa6076f89`. The bridge differs only in Id and Created, within the permitted idle-VM class. Architect decision `msg_c8673725f23c` also permits one representation difference: the old collector changed null IPAM to `[]`; the new collector preserves null. This applies only to the old predecessor versus new preflight, only to the built-in host and none networks. Every other field must match. Runtime comparisons use the new schema exactly. The raw helper's `full32EqualToPrevW4=false` remains visible: it compares all 34 current volumes with 32 prior volumes. The qualified check and the Lead's check by name prove all 32 protected records equal.

Runtime grant `msg_0de90d08153d` authorizes one invocation, with a hard end at 15:48 UTC. Its root is `t7-attempt-r8-20261023T1510Z`; detached outputs use `notes/t7-runtime-r8-20261023T1510Z`. The worker must record its actual grant delivery ID. This grant does not establish a runtime PASS. Runtime and cleanup results remain pending.

The detached receipt confirms launch at 15:28:20 UTC, supervisor PID 59664, with a new session and no PTY. The wrapper reached the test runner at 15:28:39 UTC after its prelaunch guard and B-TW-03 checks. QA received the runtime grant in `delivery_16d648ba703c`; T0 records that delivery and every grant binding. The runner ID is `qa-e2e-m3-r3-5561e8f7-2026-10-23T15-28-39-798Z`. No final result is claimed.

### Failed runtime and accepted operational closeout

The invocation finished at 15:43:18 UTC with exit 1. It remains FAILED. Cycles 1, 2 and 3 recorded 17/0, 9/8 and 17/0 PASS/FAIL. Each had the permitted demo-only skip. All four confirmation/refusal checks passed. The demo passed with preparation in 12.41 seconds. Runner summary: 43,856 bytes, SHA-256 `ef37bee6dd69b657873a58f91b68b72570db6c0f9095cbb3bac634764c5a7a2b`.

All observer, capture, lane, sampler and T12–T13 checks exited 0. W4 has no problems: 29,582 bytes, SHA-256 `b59aba22f1d7509fe4a21bb454e93d824428945e02b46d7ac1c0d75c834f80ec`. Its comparison has no problems: SHA-256 `e3f9e3c589a4a46b23e0a766d6c663d98cefd4dc669acb2339c3173e57d459c4`. The qualified check confirms all 32 complete protected volume records match. The lane summary is 3,603 bytes, SHA-256 `52a81db2a0442aef5a6dae1ad8fc2764122026fb37157377e830a0bbcd680ef2`; isolation and teardown pass, with no owned containers, networks or volumes left. No owned process remains. The wrapper correctly omitted T14 because the functional runner failed. A separate failure scan does not turn that omission into a T14 PASS.

The Lead returned the host in `msg_99a8a0d7b296` at 15:44:55 UTC. LA acknowledged in `msg_21d8d2d54874`: its continuous watcher recorded 15,525 events from 15:09:02 through 15:43:19 UTC, with zero LA project/name events. LA reserved a new 16:15–16:40 slot, subject to readiness and a fresh handoff. No new Docker work is authorized by that reservation.

### Bounded repair ownership

Claude's read-only diagnosis (`msg_982acc54184d`) identifies one root and seven cascades. A4's Save and return click stayed outside the viewport after a full-page screenshot removed the observed sticky-footer body class. The class returned in the passing control. The screenshot interaction is supported by trace evidence; the exact Moodle mechanism remains inferred, and no product defect is demonstrated.

Lead instruction `msg_b8ba462766d0` assigns Gemini QA exactly `tests/e2e/lib/flows.ts` and `tests/e2e/2-scenario-b.spec.ts`. Add viewport-only capture at the activity form and B5 picker, with the same evidence names and attachments. Preserve assertions, titles, timeouts, deadlines and criteria. Do not edit shared helpers used by M2 or add forced clicks, submits, retries or sleeps. The next test identity is C9 plus these two files; product C6 stays unchanged. M1, M2 and legacy load neither file, so their accepted evidence remains at its recorded identity.

Instruction `msg_6078576331b5` assigns the retained Codex executor an identity-only copy of v3 after that commit exists. Preserve original tools, behavior and predecessor bindings. Independent source and identity review, a fresh preflight, a fresh attempt root and a new grant precede the next runtime. Require the unchanged three runs of 17 tests and every original operational condition. Also inspect each run's A4, B4 and B5 sticky-footer traces for viewport-click failures. Final conformance and guide claims remain held.

### Failure-closeout scan finding — 16:00 UTC

QA's separate scan also failed: one shared-log hit for the test `DB_PASS` value in `03-compose-config-name.log`. The raw file stays private. The scan is 34,697 bytes, SHA-256 `7160f9d0ab2d97c4dd230cbe595e53f4ffc54e886d581972844fa29acab8de4e`; 203 other shared text files and 473 shared binary files have no hit. This is a second repair item, separate from the eight browser-test failures. No secret value is copied into git or this record.

The T7-only host runner filters secret keys without matching `DB_PASS`, while the unchanged strict scanner detects it. The Lead held the C10 freeze and assigned the retained Claude Architect a bounded design decision (`task_0f40862541c6`, `ctx_74baaf1608bd`). Gemini keeps the same repair batch and prepares synthetic negative and positive controls. Source review must cover the final complete batch. The failed runtime and failed scan remain history; no acceptance is inferred from a proposed repair.

The Lead accepted Claude's decision `msg_ba13e8d4561a` and granted the same QA batch in `msg_df199ac75a9d`. Add exactly two more T7-only files: `tests/e2e/host/t7-env-secrets.mjs` and an import/condition change in `tests/e2e/host/run-t7.mjs`. The pure helper combines the previous secret rule with the existing scanner predicate. This preserves all earlier matches and adds the missing keys. The shared library and scanner stay unchanged. Private synthetic controls exercise the actual helper and redactor: reproduce the old leak, prove redaction, and prove deliberate leaks still fail. The complete C10 candidate has four test files; accepted M1, M2 and legacy dependencies remain unchanged.

LA supplied a fresh early handoff at 16:07:25 UTC in `msg_7b06bc025fc0`, holding through 16:40 UTC subject to readiness by 16:15. The Lead verified all four file hashes in `/tmp/la/handoff-1608/` and compared all 32 complete protected volume records with the accepted M2 predecessor. All match. The one extra anonymous volume is not added to the baseline. Fresh preflight and runtime grants still remain required.

### C10 repair, preflight and runtime grant

C10 is `97b68af439b6565f891042b20497b18aadca6a24`, with tests tree `ec2d86f590902ee99997d6ed2b78599dc3006072`. The exact four-file repair has 24 insertions and five deletions. Product files remain equal to C6. Gemini's checks passed: typecheck, the unchanged 18-test list, the old-leak reproduction, the repaired redaction and deliberate-leak controls. The complete QA report prefixes remain intact. M1, M2 and legacy import closures exclude these four files. Their typecheck globs include E2E files; C10 typecheck passed. The accepted M2 execution remains C8.

Both independent Claude reviews APPROVE:

- [Reviewer A](../reviews/M3/t7-c10-reviewer-a.md): 16,756 bytes, SHA-256 `bc58a4fc720579924cfd6eb8a30d750e0fa30075cdbb3575ceadb2cbd2de8912`.
- [Reviewer B](../reviews/M3/t7-c10-reviewer-b.md): 16,126 bytes, SHA-256 `50a5954a14daa378ff6ffef5e644b1512a9771c737a9ca30327ea8b379ce5d83`.

The Lead accepts A-T7C10-01 as a deferred MINOR. The remaining picker screenshot must be checked in each new trace. Required checks also cover all A4/B4/B5 sticky-footer clicks and the four named form/picker PNGs. All review NITs are nonblocking; no optional code change is made.

The new launcher is `notes/scripts/run-t7-window-v3-c10.sh`: 27,486 bytes, mode 0700, SHA-256 `a9ac8f5632ad67cdd9d0e25da07f61c143589944826e8e6bab68cc5ac1fb8f96`. Its seven approved identity substitutions reverse exactly to the original launcher. The finalization manifest has 12 entries, all verified by the Lead: SHA-256 `42a81af79df2e57f8298bb7c2ce8ccc371a1b83083df8f540b27e6fee1df2327`. Qualified operational tools and the detached launcher are unchanged.

Stage A grant `msg_554a615fa08f` authorized one fresh external preflight in `notes/t7-external-preflight-c10-20261023T1615Z`. All five commands exited 0. W3 at 16:19:46 UTC is 31,717 bytes, SHA-256 `474e50d9e39b9b7b9dd35f42a72a228390a22df8f49309bb52c91a9a4ba48694`. Reconciliation is 4,880 bytes, SHA-256 `8240ff76b4cdb7d031f74d132ed4dcd4e04ee0d781161dece3b4e7c622092244`. The Lead verified complete identity, settings and all 32 protected volume records. Only the permitted bridge Id/Created and old-collector host/none IPAM representation differ. Two foreign containers and two extra volumes have full SC/SV attribution. Lead acceptance: `msg_903b04fa87ab`.

The readiness response arrived after the earlier cutoff. LA explicitly revised the slot in `msg_0459f8a6f66d`: launch by 16:30 UTC and return by 16:50 UTC. No extension was assumed. Stage B grant `msg_28bc7b21d064` authorizes one invocation, with cleanup due by 16:48 UTC. QA consumed it in `delivery_df0be9bf28fa`.

The new root is `t7-attempt-c10-20261023T1615Z`. Detached outputs use `notes/t7-runtime-c10-20261023T1615Z`. The receipt records launch at 16:26:20 UTC, supervisor PID 30198, a new session and no PTY. It is 1,581 bytes, SHA-256 `e90218969c42346221264f160a0ae5c4563f5e1099d53805067b5ea08f481670`. T0 binds the real grant and delivery IDs. The prelaunch guard is 5,014 bytes, SHA-256 `ca4640aaa21e17d52abff2e44ab49b9eb72f3dd33438623e01ab2f1f6cfedfca`, with no problems. Both C10 checkouts are pristine. The runner started at 16:26:41 UTC as `qa-e2e-m3-r3-97b68af4-2026-10-23T16-26-41-657Z`. Final runtime and cleanup results remain pending.

### C10 runtime result and host return — 16:41 UTC

The wrapper completed at 16:39:03 UTC with exit 0. Each of the three default cycles passed 17 tests, with zero failures and the permitted demo-only skip. The four confirmation/refusal checks passed. Demo preparation took 11.45 seconds; both player launches passed. The runner summary is 39,317 bytes, SHA-256 `f98813044f0e03ad2b171a4424f06fdd93cf6360c69689afcbdc8969bd8887ab`. QA reported these results in `msg_acde9f9235ad`.

The operational checks all passed. The lane verified keep and teardown, with zero owned containers, networks, volumes or build runners left. The sampler recorded 48 samples, one bridge and no skew violation. W4 is 27,474 bytes, SHA-256 `3c6355d7defb765100724da696e70fb4a75791317c871075055bb91fe707cd92`. Its comparison is 2,939 bytes, SHA-256 `ed635c9b5fd55926933feb6a33384da678e887592ff681588ea433c412f38b10`, with zero problems. The Lead also compared every complete protected volume record with the accepted M2 predecessor: all 32 match. Every T12/T13 exit is zero. A fresh process snapshot found no attempt-owned process or supervisor 30198.

Foreign activity remains visible. OUTER recorded removal of `sto-proj-bef1221f7fb3` and its extra volume, with full SC/SV start attribution. LANE recorded removal of `sto-proj-e289e7e84d8f`, with full SC start attribution from its own pool. Neither pool has a read failure or vanished record. The window was not exclusive. The limitations of the qualified capture method still apply.

The strict secret scan passed with 162 captured values and zero shared hits, including `cmd/03-compose-config-name.log`. It checked 207 shared text files and 550 shared binary files; 1,196 hits stay confined to private raw traces. Scan: 38,847 bytes, SHA-256 `c477f68c343bed971f7f423c432d7f5db11e9d7d3333e4d1f6b207078e6bd844`. The T7 gate passed. The run binder is 382,147 bytes, SHA-256 `5a06fda52944b2a0ea13b776ab3e0debcae818cc5f0fc4498060bde3cd69118b`; the Lead verified all 897 hash, size and mode bindings.

The Lead returned the host at 16:40:25 UTC in `msg_d50a68ebaa8b`. LA acknowledged in `msg_82ece7cbc893`: no LA Docker start or mutation from 16:06:50 through 16:39:03 UTC. Its watcher recorded 7,248 events and zero LA project/name events. A restart around 16:18 replayed from 16:14; no gap exceeded two minutes. LA resumed its own work. No further LTI Docker activity is authorized.

Final T7 acceptance still waits for QA's complete 15-criterion report and the remaining run-3 trace/PNG judgment. All original failed evidence remains FAILED. Conformance and guide application remain held until that judgment.

### Final T7 acceptance — 16:43 UTC

Independent Gemini verdict `msg_cf25c0118e11` passes all 15 T7 criteria and AC-M3-02(a), AC-M3-04, AC-M3-06 and AC-M3-07. All 51 passing default-profile tests have zero outside-viewport click retries. QA inspected all 12 required PNGs. Each form shows the selected grade-completion requirement and visible footer buttons. Each B5 image shows the full picker. The residual full-page picker captures show no later footer degradation in any cycle; A-T7C10-01 stays a deferred MINOR.

The Lead ACCEPTS this exact C10 T7 invocation in `msg_c84789ebb2b4`. This combines QA's functional and visual verdict, the verified 897 bindings, complete protected records, operational closure and LA confirmation. The detailed QA appendices follow without changing the accepted artifacts. The failed C8 invocation and its failed separate scan remain FAILED history.

The same decision accepts ADR-012 revisions 3.3–3.7 for the prototype only. Its 72 AC-M1-41 rows remain carried within the separate 94-row C4 ledger. The measured G-1 identities, absent volume generation id, fault-branch-only and unit/host-fault evidence limits remain explicit. `operation_lock_invalid` still means STOP and escalate. This is not production or enterprise storage acceptance.

The Architect may now apply final conformance and the narrow DC-1/DC-2 status changes. Final guide application, independent Docs QA, two blind reviews and Lead closure remain. All 32 live LMS rows stay UNVERIFIED; local Canvas stays DEFERRED. No push or main merge is authorized.

