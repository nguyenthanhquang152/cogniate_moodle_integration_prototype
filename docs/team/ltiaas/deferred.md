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
