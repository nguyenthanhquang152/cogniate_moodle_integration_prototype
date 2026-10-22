# Milestone LA: deferred findings

Only the Lead edits this file. A finding here is MINOR or NIT, or a deferral that the reviewer accepted (charter-LA §5). Each row names where the work goes.

## G-DESIGN (closed 2026-10-22)

| Id | Severity | Finding | Decision | Goes to |
| --- | --- | --- | --- | --- |
| B-LAD-15 | MINOR | Library staging of manual typed values | Deferred; Reviewer-B accepted (round 2) | E6 with D-3 |
| B-LAD-17(b) | NIT | Rename of the `binding.authority` capability | Deferred; Reviewer-B accepted (round 2) | No rename in LA |
| A-LAD-12 | MINOR | Hot-file sequencing between lanes | Deferred to P3; Reviewer-A accepted (round 2) | P3 ownership matrix (README §6a) |
| A-LAD-17 | MINOR | App CLIs and the operator API | Lead decision OC-9 (E5 Must 3 = LTI service CLIs only) | Closed |
| RA build note | — | `stop()` deletes its heartbeat row only after in-flight runs end | Accepted as an AC | P3 task LA-E4-01 |
| RB note 2 | — | The add-channel guide finds affected Moodle `standard` connections (`platform.productFamilyCode`) | Accepted | E8 guide task |
| RB note 3 | — | A runner that hits `job_instance_conflict` could keep waiting instead of turning off | Design note or Could AC | E4 job-runner task |

## G-BREAKDOWN (closed 2026-10-22)

Open MINOR and NIT items after round 2. The ones marked "before build" are one-line spec edits that the owner makes at the start of P4.

| Id | Severity | Finding | Owner | When |
| --- | --- | --- | --- | --- |
| A-LAB-19 | MINOR | The LA-E4-02 AC-04 rewrite dropped the P2 step of the D5 migration test | A1 | Before build |
| A-LAB-20 | MINOR | Pending AC of LA-E6-02 while LA-E6-06 is deferred | Lead | Closed by LD-16 (deferred-by-default counts as cut) |
| A-LAB-21 | MINOR | No AC proves that the retention job calls the storage_check cleanup | A2 | Before build |
| A-LAB-22 | NIT | Form (g) does not delete the backup folder, which holds secrets | A1 | Before build |
| B-LAB-17 | MINOR | No rule for a partner's pending ACs when its companion is cut | Lead | Closed by LD-16 |
| B-LAB-18 | MINOR | The capacity model leaves out review turnaround (about +7 days) | Lead | Closed: plan LD-17 says about 58 days |
| B-LAB-19 | NIT | LD-13 run sentence replaced by LD-17 | Lead | Closed in plan |
| Q-LAB-19 | MINOR | LA-E5-04 AC-08 has no valid key for its fresh account in B1 | A2 | Before build |
| Q-LAB-20 | MINOR | LD-13 and charter-LA QA rows did not match LD-17 | Lead | Closed in plan and charter |
| Q-LAB-21 | MINOR | tasks README :35/:37 name only QA's own projects | A1 | Before build |
| Q-LAB-22 | NIT | Three evidence labels | A2 | Before build |
| B-LAB-06 (part) | MINOR | Two cross-account cases stay in LA-E5-13, with a reason | A2 | Accepted by Reviewer-B |
