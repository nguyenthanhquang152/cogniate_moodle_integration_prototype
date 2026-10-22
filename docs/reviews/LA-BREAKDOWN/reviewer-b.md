Verdict: CHANGES_REQUESTED
Round: 1

# LA-BREAKDOWN review, Reviewer-B (lens: "Can a human team own it?")

Reviewer-B, milestone LA, gate G-BREAKDOWN, task LA-RB-B1. The verdict above is for Part 1 only. Part 2 (A1's specs, `epics.md`, `tasks/README.md`) follows in a later dispatch. I did not open `reviewer-a.md` or `qa.md`.

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
