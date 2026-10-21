# LA-R3: Channel extensibility audit (code seam map)

Output file (the only file you write): docs/research/ltiaas/R3-extensibility-audit.md

Target: services/**, apps/**, packages/** (product code, not tests), docs/architecture/adr/ADR-011*.md (§6 profiles, §7 registration, §11 capabilities, §17), docs/architecture/data-model.md, docs/architecture/contracts/cogniate-app-api.md §4.

Change:
1. Seam map: list every place in product code that branches on an LMS name, an LMS type, a profile id prefix, or an LTI-only concept (resource link, line item, AGS) outside services/cogniate-app/src/providers/** and services/lti-service/src/profiles/**. Columns: file:line | what it does | class (A: move into the adapter, B: make a generic capability, C: core concept that must become channel-neutral, D: keep) | note. Count per file. Include the portal (apps/portal/**).
2. Paper dry run: "add D2L Brightspace as a 4th LTI LMS today". List every file that would change, with the reason. Then "add a non-LTI channel (for example an SFTP CSV exporter)": say where it would plug in today, or that it cannot.
3. Map the 6 DataCamp patterns in docs/research/ltiaas/inputs-datacamp.md §3 to the current code: present / partial / missing, with evidence.
4. Propose candidate ports (interfaces) and a channel manifest shape that would make (2) a one-folder change. Include how Moodle-only extras (web services course shell, .mbz, Dynamic Registration) and Canvas/Blackboard extras (developer-key JSON, shared platform, operator approval grant) fit as capabilities. Keep it a proposal; the Architect decides.
5. Data model: which tables are channel-specific today (connection, connection_deployment, approved_deployment, binding_*, resource_link, attempt, score_sync, ...) and what a channel-neutral shape could be, with migration risk notes.

Constraints: do not write code. Use git grep / grep; give exact counts.

Observable acceptance: the seam table with counts; both dry runs; the pattern map; the port proposal; the data-model section; recommendations.
