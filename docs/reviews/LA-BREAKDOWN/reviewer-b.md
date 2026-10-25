Verdict: APPROVE
Round: 2

# LA-BREAKDOWN review, Reviewer-B (lens: "Can a human team own it?")

Reviewer-B, milestone LA, gate G-BREAKDOWN, tasks LA-RB-B1 (Part 1) and LA-RB-B2 (Part 2). The verdict above is the combined verdict of Part 1 and Part 2. Combined Round 1 counts: **0 BLOCKER, 4 MAJOR, 10 MINOR, 2 NIT** (Part 1: 3 MAJOR, 5 MINOR, 1 NIT; Part 2: 1 MAJOR, 5 MINOR, 1 NIT). I did not open `reviewer-a.md` or `qa.md`.

## Part 1 (A2 specs at ec1afc5927ea34f55bd3f433f550df624e40f111)

Scope: `docs/architecture/ltiaas/tasks/A2-lanes.md` and the 40 specs `LA-E3-01..13`, `LA-E5-01..24`, `LA-E6-01..03`, at `ec1afc5`. The worktree copies of these files are equal to `ec1afc5`; A1's untracked Part-2 files were not read. Rules: `docs/team/ltiaas/briefs/_common-P3.md`. Final design: `54e8088`. A2 wrote against `88909be`; I checked the diff `88909be..54e8088`, and it changes nothing in A2's tasks (the app-edge limit values and A1's K1 negative case are A1's).

Counts: **0 BLOCKER, 3 MAJOR, 5 MINOR, 1 NIT.**

### What is good

- Coverage is complete: all 88 acceptance points of LA-ADR-05..08 (AP-05: 32, AP-06: 35, AP-07: 11, AP-08: 10) appear in an A2 AC, or `A2-lanes.md` §2 note 6 hands them to A1's E1 and E2-K tasks.
- The ACs are observable and use public routes, pages, logs or the simulator records. Unit ACs use a controlled clock or a temporary database. Every spec has a regression section with a named subset.
- The file tables are precise. Wave windows (`A2-lanes.md` §2 note 1) and mount-line rules (note 2) keep same-wave lanes apart. I found no file that two lanes own in one wave inside A2's scope.
- Must, Should and Could are marked in every header, and every Should or Could task says "cut candidate". No Must task depends on a Should task, except conditional ACs that say "when built" (`LA-E5-13`).
- The sizes are plausible (S, M and L match the AC count and the scope), and the specs are short (40–75 lines).
- **E5 granularity (24 tasks).** 15 Must tasks of 6–12 ACs each, split by file ownership and dependency order, plus 9 Should tasks that are clean cut units. I do not ask for fewer tasks; see B-LAB-06 for the one task that duplicates others. The real problem is lane load (B-LAB-02), not the task count.

### B-LAB-01 — MAJOR — Real work in other lanes hides in "Needs" lines, with no task, size or cut partner

- **File:** `tasks/LA-E3-08.md:24-26`, `:45-49`; `tasks/LA-E6-02.md:28-30`; `tasks/LA-E6-03.md:29-30`; `tasks/LA-E6-01.md:28`; `tasks/LA-E3-09.md:24`; `tasks/LA-E3-05.md:26`; `tasks/A2-lanes.md:58` (§2 note 3).
- **Problem:** Several tasks need feature work in files of another lane, and the breakdown lists that work only as a "Needs" line. So no lane schedules or sizes it, the task's own Author cannot meet its ACs, and a Should or Could cut does not remove the work from the other lane.
- **Evidence:**
  - `LA-E3-08` (Should, lane L) may edit only `tool-pages/picker.ts`. It needs R to build the D5 placement rule (`graded = 0` or `1`), `appliesTo = graded`, and the results row "Not graded in {LMS}". It also needs K to set `content.ungraded` and to add the `link_selection` placement to the Canvas JSON (`:25-26`). Its ACs test exactly that work: AC-02 (record, no dispatch, "Not graded in Canvas"), AC-03 (dispatch after a later graded launch), AC-06 (Canvas JSON `link_selection`) (`:45`, `:46`, `:49`). The header names "E4 extras (R)" as a dependency, but plan §3 E4 lists only progress states and submission times as E4 Should extras. So no R task owns the D5 rule.
  - `LA-E6-02` (Could, lane P) needs L to add a writer call at each launch refusal in `tool-pages/launch.ts` (B3), and K to write `artifact_key_kid` at the Canvas `jwk=inline` export (`:28-29`). AC-01 and AC-02 test both.
  - `LA-E6-03` (Could, lane K) needs P's portal verify panel (`:29`). No P task exists, and no AC covers the panel.
  - Smaller value changes in K files have no K task either: `content.multiple: true` for `lti-generic` (`LA-E3-05:26`; it is the precondition of the Must AC `AC-LA-E3-05-01`), the Canvas `dynamic` method (`LA-E3-09:24`), and `setup.connectionCheck` (`LA-E6-01:28`). `A2-lanes.md` §2 note 3 says "sent to K", and "Only LA-E3-07 is a K task".
  - Brief rule: "Output: task specs that Authors and QA can build from with no other context, in parallel lanes, with disjoint file ownership" (`docs/team/ltiaas/briefs/_common-P3.md`). The check list of this review asks that "Must/Should/Could tasks are separable so the Lead can cut Should/Could".
- **Suggested fix:** Keep "Needs" only for one-line items: a mount line, a catalog code, a redaction pattern, a script line. For every other cross-lane piece, either (a) add a companion task in the owning lane with the same priority, its own size and its own ACs, and state "cut together with LA-E3-08" (and so on); or (b) name the existing task id (from A1's Part 2) that carries it, with that priority. Concretely: an R task (Should) for the D5 placement rule and the "Not graded" row; one K task "E3 and E6 manifest values" (`content.multiple`, `content.ungraded`, the Canvas `dynamic` method and the `link_selection` JSON, `setup.connectionCheck`), with one AC per value; a P task (Could) for the verify panel; and the L writer calls and the K `artifact_key_kid` write as ACs of named tasks. Then move each AC to the task whose files make it true.

### B-LAB-02 — MAJOR — Lane S is the critical path for the Must scope, and the breakdown shows no capacity view

- **File:** `tasks/A2-lanes.md:26-49` (task table); charter-LA §1 ("Author lanes | 1 per lane"); plan §5.3 waves.
- **Problem:** With one Author per lane, lane S has about 14 days of serial Must work in B1 and 15 in B2, while A2's other lanes have a few days per wave. So B1 and B2 each last about three weeks because of one lane, and the breakdown does not show this.
- **Evidence:** I summed the stated sizes (S = 1 day, M = 2.5, L = 4.5; brief `_common-P3.md`):

  | Lane | B1 | B2 | B3 | B4 |
  | --- | --- | --- | --- | --- |
  | S (Must / all) | 14.0 / 14.0 (E5-01 M → 02 M → 04 L → 03 L) | 15.0 / 15.0 (05 S, 07 M, 08 L, 10 L, 11 M) | 5.0 / 16.0 | 0 / 2.5 |
  | L (Must / all, A2 share) | 2.5 / 2.5 | 10.0 / 10.0 | 3.5 / 15.0 | — |
  | K (A2 share) | — | 1.0 | 1.0 | 0 / 7.0 |
  | P | — | — | 0 / 5.0 | — |

  In B1 the four S tasks are serial (`LA-E5-02` depends on 01; `-04` on 01 and 02; `-03` on 01, 02 and 04). Eight S tasks share `services/lti-service/src/http/operator/**` (`A2-lanes.md:26-45`), so a second Author cannot take any of them today. But `LA-E5-08` (key provider, L size) has no dependency (`:33`), and the key work (`LA-E5-08`, `-09`, `-10`) mostly uses its own files (`packages/shared/src/key-provider.ts`, `store/tool-keys.ts`, `store/service-keys.ts`, `jobs/key-rewrap.ts`).
- **Suggested fix:** Choose one and record it in `epics.md`: (a) split `http/operator/**` into one module per endpoint group, with one mount file owned by `LA-E5-01`. Then give the key work (`LA-E5-08`, `-09`, `-10`; `config.ts` changes through the S owner) to a second S Author (lane "S2") from B1. This shortens B1 and B2 by about one to two weeks. Or (b) the Lead records that B1 and B2 take about three weeks each because of lane S, and plans G-DEV and the Should cut line with that. A per-lane, per-wave effort table like the one above belongs in `epics.md` either way.

### B-LAB-03 — MAJOR — The restore drill cannot pass: the restore refuses a backup of another compose project

- **File:** `tasks/LA-E5-24.md:27` (Scope), `:36` (AC-LA-E5-24-03); source design: `docs/architecture/ltiaas/operability.md:281-283` (§7.3 steps 1 and 3), `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md:395` (D14 "Restore drill").
- **Problem:** The drill restores the backup "into a scratch compose project with its own `COMPOSE_PROJECT_NAME`", but `stack:data-restore` refuses a backup whose compose project is not the current one, and the task may not change a storage command (LD-3).
- **Evidence:** `infra/scripts/stack-data.mjs:178`: `if (m.composeProject !== project) throw new Refused(…, 'project_mismatch')`. ADR-011 §14 rollback step 2 (`docs/architecture/adr/ADR-011-multi-lms.md:409`) lists "compose project equal to the current one" in the validation of every restore. `LA-E5-24` says "The task changes no product code and no storage command (LD-3)", and its Must-not-edit list includes "any storage command". So AC-03 ("After `npm run stack:data-restore -- --from <folder>` in the scratch project …, `/readyz` gives `200`") gives `project_mismatch` instead. The same steps are in operability §7.3, which is the source of the operator runbook (E8, F8.3, Must). The runbook would teach an operator a procedure that fails in a real incident drill.
- **Suggested fix:** Use a scratch target that keeps the compose project name and isolates the volumes: a second Docker context or host (another VM) with the same `COMPOSE_PROJECT_NAME`, its own port and subnet. Change `LA-E5-24` Scope and AC-03, and route the same change to A2 for operability §7.3 and LA-ADR-06 D14 (through the Lead). The other option needs a Lead decision against LD-3: a restore flag that accepts another project. I do not recommend it for LA.

### MINOR and NIT (brief)

| Id | Sev. | File | Problem and fix |
| --- | --- | --- | --- |
| B-LAB-04 | MINOR | `tasks/LA-E5-01.md:23-25`, `LA-E5-03.md:25`, `LA-E5-04.md:25`, `LA-E5-07.md:25`, `LA-E5-10.md:25`, `LA-E5-11.md:23`, `LA-E5-14.md:23` | The specs say "A2-lanes.md does not list" `api-errors.ts`, `logger.ts` and the `package.json` script lines, but `A2-lanes.md:26` (`LA-E5-01` row) lists them as lane S files. `LA-E5-01`'s own May-edit table omits them, although its AC-12 tests the `ltio_` redaction in `logger.ts`. Fix: put the three catalog files in `LA-E5-01`'s table, and remove the stale sentence from the other specs. |
| B-LAB-05 | MINOR | `tasks/LA-E5-19.md:24` | The LTI `job_lease` table has a conditional owner ("if R's runner does not create it for the LTI service"), and the LTI `job_instance` table of the Q-LAD-23 restart rule ("The same rule holds for the LTI service runner", LA-ADR-03 D7; data model §4) is not named. Fix: `LA-E5-19` adds both LTI tables in one LTI migration, and R's runner only uses them. |
| B-LAB-06 | MINOR | `tasks/LA-E5-13.md:46-47`; `LA-E5-02.md:57` | `LA-E5-13` (QA, B3) repeats per-task ACs (AC-04 = `AC-LA-E5-02-06`) and moves the isolation evidence of B1 and B2 routes to B3. Fix: give each new route its two-tenant AC in the task that builds it (one focused test per AC, LD-4), and keep `LA-E5-13` only for the frozen isolation regression of AC-06, or drop it. |
| B-LAB-07 | MINOR | `tasks/LA-E5-22.md` (Files), `LA-E5-23.md` (Files) | Two wide Should refactors run in B4 across files that other lanes own (`LA-E5-22`: "the paths may have moved into channel folders by B4"; `LA-E5-23`: every LTI store caller). B4 is the wave of the final full regression and the conformance check (plan §5.3). Fix: mark both "LG unless B3 ends early", or run them as the first B4 step with the full R2 and R3 regression after them. |
| B-LAB-08 | MINOR | every spec header "Depends on" | Dependencies name A1 steps ("E1 S3", "E1 S5, S7", "E4 placement task (R)", "E2-K", "job runner (R)"), not task ids. `A2-lanes.md` note 7 says A1 replaces them in `epics.md` only, so an Author reading one spec still has to map them. Fix: replace them with task ids in each spec header after Part 2. |
| B-LAB-09 | NIT | `tasks/A2-lanes.md:3` | The header says "Design SHA: `88909be`"; G-DESIGN passed at `54e8088`. The diff does not change A2's tasks (checked), but the header should name the final SHA. |

## Part 2 (A1 specs at 971f1b17c52c38d7825ef563f10905a3281852d5)

Scope: `docs/architecture/ltiaas/epics.md`, `tasks/README.md` and the 48 specs `LA-E0-01..04`, `LA-E1-01..12`, `LA-E2-01..07`, `LA-E4-01..08`, `LA-E7-01..12`, `LA-E8-01..05`, read from the commit `971f1b1` (the worktree holds A2's uncommitted Part 1 fixes, so I did not read the files there). Also the three post-gate design edits, and plan LD-10 to LD-12. Paths below are relative to `docs/architecture/ltiaas/` unless they start with `docs/`, `services/` or `infra/`.

Counts for Part 2: **0 BLOCKER, 1 MAJOR, 5 MINOR, 1 NIT.**

### What is good

- **Ownership matrix (`epics.md` §5).** It gives one lane per product path per wave and names the owner in every cell. Each adjustment to the design's hot-file table has a reason (adjustments 1–8). The request rules RQ-1 to RQ-6 (`tasks/README.md` §4) cover change requests, one-commit handovers, the F1 baseline, new modules in hot files, migration numbers, and owner changes only at a wave end. In the A1 specs I checked (LA-E1-05, LA-E1-08, LA-E1-10, LA-E1-11, LA-E1-12, LA-E2-05, LA-E8-01), the "May edit" lists match the matrix. LA-E1-05 and LA-E1-10 split S3 over B1 and B2 so that `http/routes/platforms.ts` stays with S1 in B1.
- **Part 1 follow-up in the plan.** LD-10 splits lane S into S1 and S2, with `http/operator/**` split per endpoint group (B-LAB-02). §10 names companion tasks for the cross-lane work (LA-E3-14, LA-E3-15, LA-E4-08, LA-E6-04..07; B-LAB-01), and §2.1 maps the A1 step names to task ids (B-LAB-08). OI-3 closes the LTI `job_lease` and `job_instance` owner (B-LAB-05). QA form (g) moves the restore drill into QA's own project (B-LAB-03; but see B-LAB-10). I will re-check A2's fixed specs in the next round.
- **Sizes and the critical path are explicit** (§8, §9), with the chain that sets each wave. Every spec has 4–12 ACs with valid evidence labels, and a regression tier. LA-E2-05 makes measure 1 one AC (F2 `core` = 0 against the E2-K-done SHA).
- **Measure 5.** LA-E8-02 has a walker who is new to the repo, named by the Lead. It records the time, the F2, K0 and K1 results, and each place where the walker left the guide. A failed measure is reported, not hidden (AC-LA-E8-02-04).
- **Post-gate design edits.** (1) App API delta §5a "same address after `Retry-After`": accepted, because QA has one client address. But the per-address property now needs its own unit AC (B-LAB-14). (2) `job_instance.role` (OI-6): accepted. It is one column and one start check for "web runner and worker both on" (LA-ADR-03 D7), and LA-E4-05 AC-03 tests it. The operator runbook (LA-E8-04) should say "stop the worker before you turn the web runner on", because the production web start then refuses. (3) README OC-7 and OC-11 closed: accepted. The forms are in `tasks/README.md` §2, but see B-LAB-10 for form (g).

### B-LAB-10 — MAJOR — QA form (g) puts `stack:reset` into the restore drill

- **File:** `tasks/README.md:33` (form (g)); used by `tasks/LA-E5-24.md` (AC-LA-E5-24-04 at `ec1afc5`).
- **Problem:** Form (g) runs "`stack:down`, `stack:data-backup`, `stack:reset`, `stack:data-restore --from <backup>`, `stack:up`". `stack:reset` deletes the content folders that the drill's learner launch needs, and the design forbids it as a recovery step.
- **Evidence:** ADR-011 §14 (`docs/architecture/adr/ADR-011-multi-lms.md:395`): "`npm run stack:reset` is never a recovery step while data is in the volumes: it also deletes the content folders, the legacy files, `infra/.data/backups` and the Moodle volumes. The non-destructive exit is `npm run stack:data-quarantine -- --out <folder>`". `stack:data-backup` copies only the two databases; the content folders are a separate copy (operability §7.1). So after form (g) the restored database points at course packages that no longer exist. Then AC-LA-E5-24-04 ("one simulator learner launch reaches the player and one final score reaches the simulator") cannot pass. The reset is also not needed: ADR-012 §8 restores a backup into the same project's `OK` pair directly (`docs/architecture/adr/ADR-012-sqlite-volume-storage.md:370`: "`volume`, `pairId` equal to the target | restore"). And the drill is meant to be the evidence of a procedure that the operator runbook (LA-E8-04, Must) teaches.
- **Suggested fix:** Change form (g) to "`stack:down`, `stack:data-backup -- --out <folder outside the checkout>`, one marker write after the backup (`stack:up`, a write, `stack:down`), `stack:data-restore -- --from <folder>`, `stack:up`", with no `stack:reset`. The drill then also proves that the marker write is gone. If a `FRESH` target is wanted, use `stack:data-quarantine -- --out <folder>`, which does not touch the content folders (ADR-012 §9). Align A2's LA-E5-24 and operability §7.3 in the same round.

### MINOR and NIT (brief)

| Id | Sev. | File | Problem and fix |
| --- | --- | --- | --- |
| B-LAB-11 | MINOR | `epics.md:590`, `:602`, `:638-646` (§6, §9); charter-LA §1 (Docs "end phase") | The Must path of 55 days comes mostly from the wave barrier ("a wave starts after the previous wave exit"), not from the DAG. The longest Must dependency chain is about 44.5 days (inferred from §3: LA-E0-01 → LA-E0-03 → LA-E1-01 → LA-E1-02 → LA-E1-06 → LA-E1-07 → LA-E1-08 → LA-E1-09 → LA-E1-12 → LA-E2-01 → LA-E2-02 → LA-E2-04 → LA-E2-05 → Docs 10 days). For example, K finishes LA-E1-06 at about day 11.5 of B1, but LA-E1-07 (the start of the B2 critical chain, on K files that K owns in both waves) waits until the B1 exit at day 17.5. Fix (Lead decision): (a) a lane may start a next-wave task when its dependencies have QA PASS and it owns the task's files in both waves; the task still lands after the wave-end gate; (b) Docs starts LA-E8-03 and LA-E8-04 in B3, when their dependencies have QA PASS (the charter rule "document only verified behaviour" still holds); (c) optional: give LA-E5-04 to S2 in B1, or LA-E7-03 to R or P, so B1 ends at about day 15. Together (a) and (b) save about 10 Author-days (about two weeks). |
| B-LAB-12 | MINOR | `tasks/LA-E1-08.md:10` (Size M) | LA-E1-08 moves about 750 product lines (`app/canvas-configuration.ts` 69, `canvas-deployments.ts` 32, `web-services.ts` 48, `mbz.ts` 154, `domain/mbz-builds.ts` 63, `clients/moodle-ws.ts` 72, plus the shell parts of `app/publications.ts` 118 and `domain/publications.ts` 87), adapts about 735 test lines (`canvas-configuration.test.ts`, `canvas-deployments.test.ts`, `native.test.ts`, `mbz-concurrency.test.ts`), and adds `kernel/extensions.ts`, `kernel/port-context.ts`, `ChannelSql` with its checks and a new F5 rule, with R1, R2-lite and the T8 subset as regression. A1 sizes the comparable LA-E1-07 (about 1,190 lines of refactor) as L. LA-E1-08 sits on the longest Must chain (B-LAB-11). Fix: size it L, or split it (kernel ports, `ChannelSql` and the Canvas extras; then the Moodle web services, course shell and `.mbz`), and update §8 and §9. |
| B-LAB-13 | MINOR | `docs/team/ltiaas/plan.md:206` (LD-11); `epics.md:656` (OI-1) | LD-11 gives lane L2 the files `tool-pages/launch.ts`, `tool-pages/picker.ts`, `domain/pickers.ts`, `domain/launch.ts` and `lti/{login,launch,claims,idtoken,deep-linking,service-keys}.ts` in B3, "on the E3 Should tasks". But the Must tasks LA-E3-03 and LA-E3-05 edit those files in B3, and OI-1 (b) lists them for L2. Fix in the coming matrix update: move LA-E3-03 and LA-E3-05 to L2 too, and say that L2 (with its files) stays in B3 even when the Lead cuts every E3 Should task. |
| B-LAB-14 | MINOR | `tasks/LA-E4-06.md:36`, `:39`; post-gate edit app API delta §5a | The black-box control changed from "another address still works" to "the same address after `Retry-After`". So no AC proves any more that the limit is per address (a global bucket would pass AC-02 to AC-04). AC-01 covers only the key form (the IPv6 /64, the trusted proxy). Fix: add one UNIT case to AC-01: two different addresses have separate buckets (an empty bucket for address A does not refuse address B). |
| B-LAB-15 | MINOR | `tasks/LA-E8-01.md:30`, `:38` | The Moodle step lists the `standard` platforms with family F "through the operator API, A2", but the operator API has no platform listing (contract delta §3). The data exists: the LTI service stores the family at each accepted launch (`services/lti-service/src/lti/launch.ts:121`), and the tenant `GET /api/platforms` and the app connection DTO (`platform.productFamilyCode`) show it. Fix: name the real command (for example `GET /api/platforms` with the admin key, filtered by `profile: standard` and `productFamilyCode`), and say that a platform with no launch yet has no family and must be checked by hand. AC-LA-E8-01-03 depends on it. |
| B-LAB-16 | NIT | `epics.md:3`, `:517`, `:539`, `:600` vs `:642`; `tasks/LA-E8-01.md:40` | Small text issues. The status line cites design `88909be` plus fixes, while `tasks/README.md:3` cites `54e8088`. The note "`key-provider.ts` … new in B2 (LA-E5-08)" is stale: LA-E5-08 is in B1. §6 says "S1 does LA-E7-03 first in B1", but the §9 chain has LA-E5-01 → LA-E7-03. Adjustment 8 ends with a stray `")`. AC-LA-E8-01-05 ("Both reviewers approve the guide") is a gate, not a check with evidence label K0. |

### Notes for the Lead (not findings)

- Measure 5 allows only one first walk. If the walk fails and Docs changes the guide, a second walk needs another walker who is new to the repo. Name two candidate walkers before B4.
- The §9 sums are Author days. The four wave-end gates (LA-E7-08, LA-E7-09: M each, about 1.5–2.5 h of Moodle-slot time per run) and the QA rounds add elapsed time. Plan with about 13–15 weeks for the Must scope at today's rules, or about 11–13 weeks with B-LAB-11 (a) and (b) (inferred).

## Round 2

Bounded re-check, task LA-RB-B3, at `936f707` (Part 1 was at `ec1afc5`, Part 2 at `971f1b1`). Inputs: `git diff 971f1b1 936f707 -- docs/architecture/ltiaas`, `git diff ec1afc5 936f707 -- docs/architecture/ltiaas/tasks`, `tasks/review-response-B1-A1.md`, `tasks/review-response-B1-A2.md`, plan §6.1 LD-10 to LD-17. I read the files from the commit. I did not open `reviewer-a.md` or `qa.md`.

**Verdict: APPROVE.** All 16 of my round-1 findings are closed. B-LAB-06 is partly fixed, and I accept the rest of it. The diff adds no BLOCKER or MAJOR. Open: 0 BLOCKER, 0 MAJOR, 2 MINOR (new, cheap), 1 NIT (new).

### Status of the round-1 findings

| Id | Sev. | Status | Evidence at `936f707` |
| --- | --- | --- | --- |
| B-LAB-01 | MAJOR | **Closed** | New companion tasks, each with its lane, size, ACs and a "cut together with" line: LA-E3-14 (K), LA-E3-15 (K), LA-E6-04 (K), LA-E6-05 (K), LA-E6-06 (L2), LA-E6-07 (P). The R part is LA-E4-08, and the course name "—" is LA-E4-02 AC-11. LA-E3-05 names LA-E2-03 for `content.multiple: true`. LA-E3-08 keeps only picker ACs, plus one end-to-end AC after LA-E3-14 and LA-E4-08. |
| B-LAB-02 | MAJOR | **Closed** | LD-10 (S1, S2; `http/operator/**` per endpoint group) and LD-14 (a). `epics.md` §8: S1 10.5 / 10.5 and S2 9 / 5 Must days in B1 / B2; the B1 critical chain is no longer lane S. |
| B-LAB-03 | MAJOR | **Closed** | LA-E5-24 restores into the same fresh QA project (AC-04: "no `project_mismatch`"). Operability §7.3 uses a second host or Docker context with the same project name, and it warns against `stack:reset`. LA-ADR-06 D14 is aligned (`review-response-B1-A2.md:12`). |
| B-LAB-04 | MINOR | **Closed** | LA-E5-01 file table lists `api-errors.ts`, `logger.ts`, the LTI `package.json`; the stale sentences are gone. |
| B-LAB-05 | MINOR | **Closed** | LA-E5-19 adds `job_lease` and `job_instance` in one LTI migration; the runner creates no table (OI-3). |
| B-LAB-06 | MINOR | **Partly fixed — rest accepted** | The duplicate AC-04 is gone. The storage-check and picker-cancel cases stay in LA-E5-13, because they need two tool accounts or two libraries with live data. The B1 audit read keeps its own isolation AC in LA-E5-02. Accepted. |
| B-LAB-07 | MINOR | **Closed** | LA-E5-22 and LA-E5-23: "LG unless B3 ends early", else the first B4 step with R2 and R3 after it. |
| B-LAB-08 | MINOR | **Closed** | A2 specs use A1 task ids; `epics.md` §2.1 maps the design names. |
| B-LAB-09 | NIT | **Closed** | A2-lanes header names `54e8088`. |
| B-LAB-10 | MAJOR | **Closed** | `tasks/README.md` form (g): a fresh QA drill project, backup, marker account, restore into the same project, no `stack:reset`, never another project. |
| B-LAB-11 | MINOR | **Closed** | LD-15 rolling starts and Docs from B3 (`epics.md` §6). §9 now shows the dependency chain (41.5 days), the lane model (47.5) and the LD-17 plan (51.5), with the handover tasks named. |
| B-LAB-12 | MINOR | **Closed** | LA-E1-08 size L, with the reason in the header; §8 and §9 updated. |
| B-LAB-13 | MINOR | **Closed** | LD-11 and `epics.md` §5 adjustment 9: LA-E3-03 and LA-E3-05 (Must) are L2, and L2 stays in B3 even if every E3 Should task is cut. |
| B-LAB-14 | MINOR | **Closed** | LA-E4-06 AC-01: "when the bucket of one address is empty, a second address … still gets its full burst". |
| B-LAB-15 | MINOR | **Closed** | LA-E8-01 design notes: `GET /api/platforms` with the admin key, filtered by `profile: standard` and `productFamilyCode`; a platform with no accepted launch is checked by hand. |
| B-LAB-16 | NIT | **Closed** | Status line `54e8088`; `key-provider.ts` new in B1; §6 and §9 agree; stray `")` gone; AC-LA-E8-01-05 removed in favour of the done rule. |

### Lead decisions LD-10 to LD-17 (my lens)

- **LD-10, LD-11, LD-12, LD-14:** consistent with the matrix. LD-14 moves LA-E5-03 into B2, where `lti/codes.ts` (L) and `http/auth.ts` (S2) have other owners. Adjustment 10 handles this with RQ-1 and a new S1 module `http/rate-limit.ts` (RQ-4). In B4, S2 owns S1's non-shared modules for LA-E5-23, while S1 keeps its shared files (adjustment 5). No conflict found.
- **LD-13, LD-17:** the QA test folders are disjoint (`tests/ltiaas/tasks-ops/`, `tasks-core/`, `tasks-lti/`), the shared helpers stay with QA, and the independence rule holds. See B-LAB-19 for one stale sentence.
- **LD-15:** a clear rule. Waves stay ownership windows and regression points, and §6 lists the handover tasks. See B-LAB-18 for reviewer time.
- **LD-16:** sound for the done order. See B-LAB-17 for a cut gap.

### New findings (cheap)

| Id | Sev. | File | Problem and fix |
| --- | --- | --- | --- |
| B-LAB-17 | MINOR | `tasks/README.md` §1 "Done rule per AC"; plan LD-16 | A partner task can be done with ACs "pending: <companion id>". No rule says what happens when the Lead later cuts that companion (Could or Should tasks, for example LA-E6-05 or LA-E6-06 with LA-E6-02). Then the pending ACs never close, and the milestone done rule ("All in-scope epics done", charter-LA §2) is unclear. Fix: one sentence. When a companion is cut, the partner's pending ACs become "removed: <cut decision>", and the partner's feature text in the guides states the gap. Or the partner is cut too. |
| B-LAB-18 | MINOR | `epics.md` §9 model; plan LD-15 ("done (QA PASS, both reviews)") | Under LD-15 every dependency edge waits for two reviews, and each lens has one reviewer instance (charter-LA §1). The §9 model counts no review time ("review rounds and repair rounds add elapsed time"). The Must chain has 15 steps, so a review turnaround of half a day per step adds about 7 days to the 51.5 (inferred). Fix: count a review turnaround per chain step in §9, and give tasks on the critical chain review priority. Optionally, let a dependent start on its predecessor's QA PASS while the reviews run; it lands only after both approvals. |
| B-LAB-19 | NIT | `docs/team/ltiaas/plan.md:208` (LD-13) | LD-13 still says "QA-2 and QA-3 hand their suites to QA, who runs them". LD-17 replaces this (QA-2, QA-3 and QA-4 write and run). Mark the sentence as replaced by LD-17. |

### Note for the Lead (not a finding)

- SIM slot load (inferred from `epics.md` §3 and §8): the task-suite runs of the Must scope are about 17 slot-days (39 tasks), plus R1 (about 3.5), migration runs (about 1), gate SIM parts and K2. In total about 28–31 SIM-slot days within 51.5 working days, and about 40 within 55.8 for everything that is not deferred. Rolling starts make the demand bursty at handovers and wave ends. The third simulator-only slot of LD-17 is the right lever; decide it at E0 from the memory record.
