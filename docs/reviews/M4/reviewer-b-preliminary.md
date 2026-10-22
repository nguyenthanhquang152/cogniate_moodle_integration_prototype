Verdict: CHANGES_REQUESTED (static content of the pinned candidate: 0 BLOCKER, 2 MAJOR, 2 MINOR, 3 NIT). Final-pack approval: PENDING.
Round: 1 (preliminary, static)

# M4 guides — Reviewer-B preliminary review (lens B: can another team own it?)

## 1. Identity, scope and independence

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B for documentation. Claude Opus 5.5, effort xhigh. No subworkers. |
| Orca | Run `run_ebe671ad72a9`, task `task_d2d16487d89f`, dispatch `ctx_a709b179a224`. |
| Time | 2026-10-22, about 11:59–12:15 UTC (measured with `date -u`). |
| Target | Provisional guide candidate `f18526014c602b4b74484b819097ed9b8b598c20`. Workspace `HEAD` was this commit. |
| Changed prose since `fd87bf7` | `docs/guides/canvas-admin.md`, `docs/guides/operator.md`, `docs/guides/troubleshooting.md`, `docs/human_review/deferred.md`, `infra/README.md`. The other five held files are byte-identical to `fd87bf7`. |
| Method | Static reading only, from `git show f185260:<path>`. No Docker, npm, install, runtime test, browser QA, commit or push. No source or guide edit. |

I read all ten held files in full at the pinned commit. Each file matches the Lead's SHA-256 value:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `README.md` | 8263 | `814c32dca7134ff2fff6b2a8c099aadbfd5559b672da8de7da20dd3e11469026` |
| `docs/guides/blackboard-admin.md` | 7294 | `6b4c0185f58765e835ccb60c6f419925dc71db7837dbd9acbb918c52532e8efb` |
| `docs/guides/canvas-admin.md` | 10869 | `b4d28c5088994609aed28d2533cdcb0ec5308fa5e21dfcca7bf6133b4154ff12` |
| `docs/guides/operator.md` | 18502 | `b3c65c4c9c14b509c7e1afa682359898d529836d8fbf23649d802c02ab235fe4` |
| `docs/guides/teacher.md` | 10284 | `35ec285743b3febd80ecd47084e95ff4f2ce1695e901175fb21ee0b4f200dcda` |
| `docs/guides/troubleshooting.md` | 14066 | `d74bcbc78b2cde3ef3d37bf5620b68b8282d5a9a9b410fe7ca7d6a02bad5d039` |
| `docs/human_review/START-HERE.md` | 6527 | `c50777cf678c69c79b4c3e7c73ecdfd42d63b8f3fc63b11347f5ee17d4060718` |
| `docs/human_review/canvas-blackboard.html` | 22070 | `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa` |
| `docs/human_review/deferred.md` | 25305 | `f8a15a691babc9504392e24a2031fe542936926c62c8c2b74da15d041aaad493` |
| `infra/README.md` | 61141 | `7cdd7440a7428dc3cfd6487343d0fdb0ab77ae8d979e217e82aa911fb17ec087` |

Inputs that I read: charter, `tasks/M4.md`, `tasks/T9.md`, `tasks/M1.md` (AC-M1-07, -18, -37), both contracts (sections named in the findings), ADR-011 §14, ADR-012 §7, the Gemini guide QA `docs/reviews/M4/docs.md` (SHA-256 `a9b92890…`, 19224 bytes, unchanged at `f185260`), the AR-M4 rows of `docs/reviews/M4/architect-conformance.md`, the cited M1 review files, the operator CLI sources, `infra/scripts/lib.sh`, `infra/scripts/lti-bootstrap.sh`, `infra/compose.yaml`, and the QA test files named below.

Independence disclosure:

- I did not open `docs/reviews/M4/reviewer-a-preliminary.md` or any M4 Reviewer-A message. Its file name and line count showed in `git diff --stat` and `ls`, and nothing more.
- I did not read the author's finding-by-finding note or the commit message body of `f185260`. I used only the file diff `fd87bf7..f185260`.
- From `docs/team/multi-lms-plan.md` I read only the heading list and one 07:50 UTC sentence (the round-1 phase counts), to check README counts.
- A grep for the CLI working-folder repair also printed two old lines from `docs/reviews/M2/reviewer-a.md:112` and `docs/reviews/M3/reviewer-a.md:160`. They are not M4 reviews. They agree with the QA records that I cite for B-M4-01.

## 2. Verdicts

| Verdict | Result |
| --- | --- |
| Static content, pinned candidate | **CHANGES_REQUESTED.** Two MAJOR findings: an operator command example that fails as written (B-M4-01), and one recovery step that can switch off a working Canvas connection (B-M4-02). Both are small text corrections. |
| AC-T9-04 / AC-M4-03 STE on the changed prose | **Confirmed PASS** (section 5). |
| Final-pack approval | **PENDING.** The intentional pending stamps are not content defects. Section 6 lists the final evidence. |

## 3. Findings

| Id | Severity | File:line | Problem |
| --- | --- | --- | --- |
| B-M4-01 | MAJOR | `docs/guides/operator.md:14-15` (also `:9`, `:18`, `:62-64`, `:102-103`; same root in unchanged `infra/README.md:69-70`) | The Compose `exec` examples run `npm run <script> -w services/<service>` from the container start folder. npm then finds no workspace and exits 1. |
| B-M4-02 | MAJOR | `docs/guides/troubleshooting.md:82` (Fix cell) | "Ask the operator to suspend the connection" switches off a registered Canvas connection and its working deployment, in the only Canvas case that gives `deployment_not_approved`. |
| B-M4-03 | MINOR | `docs/guides/troubleshooting.md:82` (Code, Cause, Evidence cells) | The cited case `AC-M1-37 (c2)` proves `reason: unknown_platform`, not `deployment_not_approved`. The Canvas first-Save case has no matching row. |
| B-M4-04 | MINOR | `docs/guides/canvas-admin.md:127-128` (and `:134`) | A portal library user gets a raw API request and a response-header check, with no origin, no connection-id source, no visible header and no action for a mismatch. |
| B-M4-05 | NIT | `docs/guides/troubleshooting.md:76` (Evidence cell) | The new `PLATFORM_NOT_ACTIVE` row says "disconnected or suspended", but the cited cases do not disconnect or suspend. |
| B-M4-06 | NIT | `docs/guides/operator.md:137-153`; `docs/guides/canvas-admin.md:142` | Section 3a omits the new-connection precondition. "Repeat the order" can replace the code that the library holds. The Canvas disconnect text still offers "release first" for self-hosted Canvas. |
| B-M4-07 | NIT | `docs/guides/operator.md:167`, `:176`, `:180`, `:223` | Four operator steps name an action but no command. |

### B-M4-01 — MAJOR — the in-container command form fails

- **Problem.** Lines 14-15 run `docker compose … exec cogniate-app npm run app:grant -w services/cogniate-app -- …` (and the same for `lti-service`). The container starts in `/repo/services/<service>`. npm resolves `-w services/<service>` from that folder and stops with `No workspaces found`. Lines 62-64 and 102-103 are run "inside their service container" (line 9), so they have the same problem. Line 18 labels the form "source inspection only".
- **Evidence.**
  - `infra/compose.yaml:123` and `:156`: `working_dir: /repo/services/lti-service` and `/repo/services/cogniate-app`.
  - `docs/reviews/M2/qa.md:174` (Q-M2-CLI): this exact form gave exit 1, "`No workspaces found: --workspace=services/cogniate-app`".
  - QA repair `41ee174`, `tests/host/m1-control.mjs:23-26`: "Both containers start in their service directory. Resolve npm's workspace selector from the mounted /repo/package.json" and `exec -T --workdir /repo <service> npm run <script> -w services/<service>`. Also `docs/reviews/M1/qa.md:160-162`.
  - Every M1 operator CLI row (for example `[SIM AC-M1-28]`, `M1-38.*`) ran through this repaired form, not through the guide form.
  - Same root, unchanged M1 text (owner `infra/**`): `infra/README.md:69-70` says `docker compose exec lti-service npm run lti:shared-platform -w services/lti-service -- …`. It also omits the project and file flags.
- **Impact.** The operator's only interface for grants, suspend and release fails on first use. The guide gives no recovery.
- **Minimal correction.** Add `--workdir /repo` after `exec` in lines 14-15. In line 9, add: "Inside the container, run from `/repo`." Replace the line-18 label with the QA-run form (`tests/host/m1-control.mjs:25`; used by the M1 CLI rows, for example `[SIM AC-M1-28]`). The Lead routes `infra/README.md:69-70` to its owner, or records a deferral.

### B-M4-02 — MAJOR — the escalation step can switch off a working Canvas connection

- **Problem.** The new row says: "If the error stays, ask the operator to suspend the connection." For Canvas, `deployment_not_approved` comes only from an added deployment ("Add deployment ID") on a registered connection. A Canvas first Save gives `unknown_platform` (B-M4-03). `suspend` switches off the whole Canvas platform, so the first, approved deployment also stops. A suspend is not reversible: a new connection needs new publications and new course items (D-7, `troubleshooting.md:76`). A plausible path: the add fails, the code expires before the retry, and the error stays.
- **Evidence.**
  - App contract §6.1 launch routing (`cogniate-app-api.md:682`): `deployment_not_approved` needs a Canvas or Blackboard connection that owns `platform.id` or holds a reservation. Otherwise the reason is `unknown_platform`.
  - `tests/acceptance/M1/canvas/51-canvas-races.test.ts:67-78` and `:249-262` (`M1-37.canvas.p-activate`), `:285-294` (`s-retry`): the added deployment gives `deployment_not_approved`.
  - `61-canvas-containment.test.ts:33-42` (`M1-38.canvas.a`): `suspend` sets the Canvas platform `active: false`. The launch then gives `PLATFORM_NOT_ACTIVE`.
  - `M1-37.canvas.p-activate` (`:249-262`): `app:grant revoke` prints `fenced`, switches off only the unapproved deployment, and the first deployment works before and after (`firstWorks`). Contract `cogniate-app-api.md:483` and `:594`: revoke cleanup leaves approved deployments and their keys unchanged.
- **Minimal correction.** Replace the second sentence with: "If it still fails, ask the operator to run `app:grant revoke --grant <grt_id>` for that code. It switches off only the record without approval. Approved deployments keep working `[SIM M1-37.canvas.p-activate]`. Then ask for a new code." Keep `suspend` for a wrong binding (operator section 3).

### B-M4-03 — MINOR — the evidence of the new `deployment_not_approved` row shows another reason

- **Problem.** The row cites `[SIM AC-M1-37 (c2)]`. Case c2 is a Canvas first Save with a lost activation answer. Its launch is logged with `reason: unknown_platform`. The row also says "Click Save again"; in the Canvas added-deployment case the button is "Add deployment ID". A support person who sees `unknown_platform` after a lost Canvas Save finds no row: line 81 names only `site_mismatch` and `lms_mismatch`.
- **Evidence.** `tasks/M1.md:135` (c2: "`launch_rejected {reason: "unknown_platform"}` (no connection owns it)"). `51-canvas-races.test.ts:54-65` (`unapprovedInitial` asserts `unknown_platform` at `:63`), `:126-131` (c2 uses it). `tests/acceptance/M1/blackboard/50-races.test.ts:47` and `:147-155` (`M1-37.blackboard.i`: `deployment_not_approved`, then the same code gives 200). `51-canvas-races.test.ts:285-294` (`M1-37.canvas.s-retry`).
- **Minimal correction.** Evidence `[SIM M1-37.blackboard.i, M1-37.canvas.s-retry]`. Fix text: "Repeat the same action ("Save", or "Add deployment ID") with the same code." Add to line 81, or as a new row: "Canvas first Save after a lost answer: `reason: unknown_platform`. Click "Save" again with the same code `[SIM M1-37.canvas.c2, M1-37.canvas.i]`."

### B-M4-04 — MINOR — Procedure 6 is not executable for a portal user

- **Problem.** Steps 1-2 now assign the actions to the library user. Step 1 gives only a path (`GET /app-api/connections/<connection id>/canvas-configuration?jwk=inline`). Step 2 asks the user to read the response header `X-Cogniate-Key-Id`. The guide does not say:
  - which host to use (`PUBLIC_APP_URL`, signed in);
  - where the user finds `<connection id>`;
  - how to see a response header, because a browser download hides it;
  - what to do when the ids differ.
- **Evidence.** App contract `cogniate-app-api.md:9` (`/app-api/*` on `PUBLIC_APP_URL`, session cookie) and `:321-359` (attachment `cogniate-canvas-lti.json`; `public_jwk` has `kid`; the header carries the same `kid`). `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:164-172` (`M1-19.canvas.inline-key` asserts header = `public_jwk.kid`). The portal shows the id in the page address: `apps/portal/src/App.tsx:129` (`integrations/canvas/:connectionId`).
- **Minimal correction.** "1. Open the connection in the portal. The connection id is the last part of the page address. 2. In the same browser, open `{PUBLIC_APP_URL}/app-api/connections/<connection id>/canvas-configuration?jwk=inline`. The browser saves `cogniate-canvas-lti.json` `[SIM M1-19.canvas.inline-key]`. 3. Compare `public_jwk.kid` in the file with the key id from the operator `[SIM M1-19.canvas.inline-key; L-C14 UNVERIFIED]`. If they differ, stop and ask the operator." Keep the L-C14 notes.

### B-M4-05 — NIT — indirect evidence for the new `PLATFORM_NOT_ACTIVE` row

- **Problem.** The cause says "disconnected or suspended". `AC-M1-07` is an LTI API staging case. `M1-38.canvas.g-late-create` is a late create after a release. Both prove "inactive Canvas platform → `PLATFORM_NOT_ACTIVE`", but not the stated cause. Direct cases exist.
- **Evidence.** `tests/acceptance/M1/canvas/41-canvas-grades.test.ts:157-164` (`M1-18.canvas.disconnect`). `61-canvas-containment.test.ts:33-42` (`M1-38.canvas.a`).
- **Minimal correction.** Evidence `[SIM M1-18.canvas.disconnect, M1-38.canvas.a]`.

### B-M4-06 — NIT — D-12 order details

- **Problem.**
  - (a) Section 3a step 1 ("Issue the rightful grant") needs an existing new connection. Only `:108` and the troubleshooting rows say "the library makes the new connection first", and `canvas-admin.md:121` links directly to 3a.
  - (b) `:153` says "Then repeat the order". A new grant revokes the unused code that the library holds (`operator.md:78`). QA redeemed the same code after the second release.
  - (c) `canvas-admin.md:142` (unchanged) still says "or an operator release first" for every Canvas type. For self-hosted Canvas the grant comes first.
- **Evidence.** App contract recovery table `cogniate-app-api.md:546-550` (step 1: "The library makes a new connection C1"). `61-canvas-containment.test.ts:191-203` (`M1-39.canvas.residual-race`: the same grant gives 200 after the second release).
- **Minimal correction.** Add step 0 to 3a: "The library makes the new connection with the right values." In `:153`, say: "The unused code stays valid until it expires. Ask the library to redeem it at once after the release `[SIM M1-39.canvas.residual-race]`." In `canvas-admin.md:142`, add: "(self-hosted Canvas: grant first, operator guide section 3a)".

### B-M4-07 — NIT — steps without commands

- **Problem.** These steps give no command:
  - `:167` and `:180`: "Install and build". ADR-011 §14 rollback step 3 names `npm ci` and `npm run build`.
  - `:176`: "Stop the Cogniate app and the LTI service". Use `npm run stack:down`, as in `:163`.
  - `:223`: "Restart the LTI service". QA used `npm run stack:restart -- lti-service` (`tests/host/m1-control.mjs:35`). This command is forbidden in rollback mode (`:194`).
- **Minimal correction.** Add each command in brackets. At `:223`, add "not in rollback mode".

## 4. Lens-B checks with no finding (later reviewers can reuse them)

| Check | Result and source |
| --- | --- |
| `lti:bootstrap` and `stack:*` on the host (`operator.md:9`, `:222`) | Correct. `services/lti-service/package.json` runs `bash ../../infra/scripts/lti-bootstrap.sh`. The wrapper needs a running `lti-service` and uses `dc exec` (`lti-bootstrap.sh:12`, `:25`). |
| `kid=` in the bootstrap output (`operator.md:224`) | Correct. `lti-bootstrap.sh:28` prints `kid=${o.kid}`. `bootstrap.ts:28-30` returns the rotated key id. |
| `<project-name>` from the root `.env` (`operator.md:11`) | Correct. `gen-env` writes `COMPOSE_PROJECT_NAME` (`.env.example`, `lib.sh:19-37`). The flags match `dc()` (`lib.sh:105-110`). The omitted knobs file does not change an `exec`. |
| Grant and binding flags, lines and messages | Match `src/cli/grant.ts:9-18`, `src/cli/binding.ts:7-9`, `binding-cleanup.ts:17`, `:195` ("a redemption may still run; retry after <n> s"), `operator.ts:127`. Moodle release gives `deleted` (unconditional delete, `binding-cleanup.ts:230-234`; matches the accepted AR-M4-06). |
| `operation_lock_invalid` STOP/ESCALATE (`operator.md:210`, `:213`; `troubleshooting.md:88`; `infra/README.md:128`) | The quoted text matches `infra/scripts/storage-oplock.sh:114`. All four places say stop, do not touch the lock folder, escalate, and "no validated manual recovery procedure exists". This agrees with the accepted AR-M4-05. |
| `storage_lock_lost` is not a refusal (`operator.md:204`) | Matches ADR-012 §7 (`:288`): the command ran, then the holder exits 1. |
| Rollback launch WARNING (`operator.md:187-189`) | Matches ADR-011 §14 (`:418`). It is marked as unmeasured, and no QA claim is added. WARNING fits inputs §7 ("risk to people/data"). |
| Split of `PLATFORM_NOT_ACTIVE` (Canvas) and `DEPLOYMENT_NOT_ACTIVE` (Blackboard) | Correct. LTI contract `:81`, `:465` ("checked after `PLATFORM_NOT_ACTIVE`"), `:479`. Only the evidence is indirect (B-M4-05). |
| Upgrade and rollback with both services stopped (`operator.md` §4.1, §4.2) | The order matches ADR-011 §14, including the rollback-mode command rule and the lost-write WARNING. |
| D-12 / A-M0-10 (AC-M4-08) | Operator §3a, `troubleshooting.md:63`, deferred §A-M0-10 and the HTML `#decisions` note give the same scope (`canvas-self-hosted` only), impact (setup blocked, no Canvas access, check 14), operator order, limit ("does not close / cannot prevent") and enterprise need. None makes a stronger claim. The changed lines `:108` and `:135` and troubleshooting `:74` and `:79` apply the grant-first order to self-hosted corrections. The contract recovery table supports this. |
| Deferred additions (`deferred.md:144-145`, `:166-172`, `:174-188`) | Each id, severity and link exists in its cited review: A-CR-01..05, B-CRR-01/02/06, B-BM-01, A-SOR-01 = B-SOR-01, B-SRP-03, A-SRR-01, AR-M4-01..06, Q-M4-P01/P02. |
| Completeness of deferred MINORs | A scan of all M0-M4 review files (not the M4 Reviewer-A file) found MINOR ids that are not listed. I checked the M1 and M3 ones (A-M1-01, A-M3-03/04, B-M3-03, A-T6L-02, A-D-*, B-M1-D-*, A-SRR-03/04/07, B-SR-*, A-SI-02, B-SI-02/03, B-SFT-11). Each is closed in its review. The rest are M0 design-round findings, closed through the review responses. I found no missing accepted MINOR. |
| Evidence and safety boundaries | All 32 live rows stay `UNVERIFIED` (README `:36`, HTML). Local Canvas L-C13 stays deferred. Every L-C14 rotation step carries `UNVERIFIED` and "Not yet tested on a real Canvas site". Portal texts of `GRANT_IN_USE`, `DEPLOYMENT_FIXED` and `ISSUER_RESERVED` stay "Not verified by QA" (`troubleshooting.md:61`, `:65`, `:80`). |
| Claims | No "works with", no certification claim and no DataCamp value in the ten files. "1EdTech certification" shows only as "Not proven" (`START-HERE.md:30`). No text implies human approval: every stamp says "draft" and "approval pending". |
| Unchanged files | `canvas-blackboard.html`, `START-HERE.md`, `README.md`, `teacher.md` and `blackboard-admin.md` are byte-identical to `fd87bf7`. I reuse Gemini's offline, accessibility, link and STE checks for them. Their content agrees with the changed guides: shared engine, Canvas page and service origins, the nine Blackboard values (ADR-011 `:258`), the grant trust boundary, Deep Linking with a new tab, Q19-Q22 and D-1..D-12. |
| Accepted items | AR-M4-04 (the portal gives `422 INVALID_PLATFORM_VALUES`, not `ISSUER_RESERVED`) also touches `operator.md:141` and `troubleshooting.md:80`. It is an accepted deferral; I add no finding. Q-M4-P01 and Q-M4-P02 stay accepted NITs. |

## 5. AC-T9-04 / AC-M4-03 confirmation (changed prose)

I used the T9 method on every added line of `fd87bf7..f185260`:

- Remove the bracketed evidence tags and the link URLs.
- Count each inline code span as one word.
- Split sentences at `.`, `!` and `?`.
- Treat each table cell and each list item as its own block.

Results:

| Measure | Result | Limit |
| --- | --- | --- |
| Segments measured | 210 | — |
| Longest procedure or instruction sentence | 19 words (`troubleshooting.md:79` Fix cell). Numbered steps: max 17 (`operator.md:224`). | ≤ 20 |
| Longest descriptive sentence | 22 words with link text, 20 without (`canvas-admin.md:125`, a description of the operator's action, not a reader instruction) | ≤ 25 |
| Sentences per block | Max 6 (`infra/README.md:128`); `operator.md:210` has 5; `troubleshooting.md:88` has 5 | ≤ 6 |
| NOTE / WARNING / CAUTION | New WARNING at `operator.md:187` (data); other notes informational | inputs §7 |

**Confirmed PASS.** My counts agree with Gemini's limits. The fixes in section 3 can keep the limits; the delta check must measure them again.

## 6. Final evidence still needed (a later review checks only these deltas)

1. **Fix deltas.** Corrections for B-M4-01 to B-M4-04. B-M4-05 to B-M4-07 are optional. Then a focused delta check and an STE count of only the changed lines.
2. **Owner routing.** The Lead decides who corrects `infra/README.md:69-70` (B-M4-01, same root), or records a deferral.
3. **Runtime stamps.** Update the README, START-HERE, the HTML `#evidence` section and the guide stamps. Today they say "full2 round 1 … one round only" and "Draft basis `82aff91`". The update binds:
   - the two accepted 488-case engine rounds, the two independent 233-case Canvas judgments and exact equality at C4 `bf09cda`;
   - the D-T6L legacy result with C5 tests `e1a057b` (the full2 ATTEMPT stays FAILED);
   - the fresh M2 (64) and T7 results at C4.
   Until then, these are pending stamps, not defects.
4. **Source stamp and Architect conformance.** Final AC-M4-06 verdict and a final source stamp. Lead `decisions-needed.md` for AC-M4-07.
5. **Final QA.** An independent final Docs QA with a delta recheck. It appends the size correction of `docs/reviews/M4/docs.md` §1.1: `README.md` 8263 bytes and `infra/README.md` 61032 bytes at `fd87bf7` (the hashes match).
6. **Final reviews.** Two final reviews on the exact final hashes. After the fixes, the boundaries of section 4 must stay unchanged: 32 `UNVERIFIED`, L-C13 deferred, L-C14 and the portal texts unverified, no human approval.
