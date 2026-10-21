# LA-B1: A1 breakdown - epic plan, ownership matrix, and task specs for E0, E1, E2, E4, E7, E8

Your files:
- docs/architecture/ltiaas/epics.md (you own it): epic -> feature -> task table for ALL epics E0-E8 (include A2's task ids for E3, E5, E6); the task DAG (mermaid); waves B1-B4 with the lanes of plan v1.1 §5.3 (adjust lanes if the design needs it, and say why); the FILE-OWNERSHIP MATRIX (every product path that LA changes -> exactly one lane per wave; shared files get one owner and a request rule); Docker slot needs per task (none / SIM / MOODLE) for the Lead's booking (plan LD-2); the critical path; a size total per lane.
- docs/architecture/ltiaas/tasks/LA-E0-*.md, LA-E1-*.md, LA-E2-*.md, LA-E4-*.md, LA-E7-*.md, LA-E8-*.md.
Inputs from A2: A2 writes LA-E3-*, LA-E5-*, LA-E6-* specs at the same time. The Lead relays A2's lane and file list to you. Before worker_done, read A2's specs and make the matrix and DAG complete and consistent; list conflicts you could not solve in epics.md "Open ownership items".
Observable acceptance: epics.md has the DAG, waves, matrix and Docker needs; every Must feature of the design has a task; no product path has two owners in one wave.
