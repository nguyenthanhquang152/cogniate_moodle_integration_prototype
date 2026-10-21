# LA-R1: LTI 1.3 / LTI Advantage spec coverage audit

Output file (the only file you write): docs/research/ltiaas/R1-spec-coverage.md

Target: services/lti-service/** (and the parts of services/cogniate-app/** that act as the tool), docs/architecture/contracts/lti-service-api.md, docs/architecture/security.md, ADR-002, ADR-003, ADR-011.

Change: produce a requirement-by-requirement coverage table of the current LTI service against the public 1EdTech specifications:
- LTI Core 1.3 and the 1EdTech Security Framework 1.0 (OIDC third-party login, id_token checks, JWKS, nonce/state, client_credentials token with signed JWT assertion).
- Deep Linking 2.0 (all content item types, accept_multiple, lineItem, window/iframe hints, data echo).
- Assignment and Grade Services 2.0 (line items CRUD, scores, results, scopes, paging, activityProgress/gradingProgress semantics).
- Names and Role Provisioning Services 2.0 (paging, rlid filter, role filter, differences).
- LTI Dynamic Registration 1.0 (openid configuration, registration, update flow).
- LTI Client Side postMessages and Platform Storage (lti.capabilities, lti.put_data, lti.get_data) for third-party-cookie-free launches.
- The public 1EdTech LTI Advantage certification test areas (what a tool must pass; cite the public page).
Columns: spec | requirement (MUST/SHOULD/MAY, short paraphrase, not a copy) | status YES/PARTIAL/NO/N-A | evidence path:line | gap | risk if missing | suggested epic (E1-E8) or backlog.
Then: a top-15 gap list ranked by value for an "LTI as a service" product, and a short note on what certification readiness needs.

Constraints: paraphrase spec text; do not paste long spec passages. Prefer the 1EdTech public spec pages (imsglobal.org / 1edtech.org).

Observable acceptance: the file exists; every row has a status and evidence or URL; the top-15 list and the recommendations section exist.
