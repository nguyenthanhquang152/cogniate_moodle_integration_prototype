# LA-RB: Reviewer-B (lens "Can a human team own it?")

Your review file: docs/reviews/LA-DESIGN/reviewer-b.md
Focus: simplicity and module boundaries of the channel kernel (is "new LTI LMS = one folder" real and simple?); naming and terms; over-engineering (does each port, table and capability earn its cost?); can the parallel build lanes own disjoint files; test quality and testability of each Must item; error handling, logs and operability; how a new developer adds a channel (plan measure 5); migration and rollback clarity; proportional evidence (charter-LA §5, plan LD-4).
Warm-up code areas: services/cogniate-app/src/providers/**, services/lti-service/src/profiles/**, services/cogniate-app/src/app/**, apps/portal/src/** (Integrations, connect/*), packages/**, tests/sim/** (read only, to judge testability), root package.json scripts.
