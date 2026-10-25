# Frozen suite comparison: baseline-3 against D3 and D4

Baseline product `78971b03`, tests `1ae6716b`; candidate product `4f10c5fd`, tests `794f649c` in both runs. Each row compares the recorded outcome. Matching PASS outcomes do not mean unchanged response values: the approved LA-IC overlays apply to the candidate. Host IDs stay in the table and raw FAIL values are preserved. `MISSING` is never a match.

## Explicit T8 difference (AC-T8-03 and AC-T8-07)

The original baseline run 129 is never relabelled PASS. The Lead authorized one solo retry, 170, after both kits (msg_b0e9e22a424c). Both results are shown.

| Test ID | Baseline-3 original 129 | D1 | D2 | D3 | D4 | Baseline-3 solo retry 170 | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AC-T8-03` | FAIL | PASS | PASS | PASS | PASS | PASS | Original baseline result is **UNEQUAL**. Solo retry matches D1/D2/D3/D4; 129 is a baseline flake under TEST-STRATEGY §2.6 and the Lead ruling. Initial baseline cause is not proven. |
| `AC-T8-07` | FAIL | PASS | PASS | PASS | PASS | PASS | Original baseline result is **UNEQUAL**. Solo retry matches D1/D2/D3/D4; 129 is a baseline flake under TEST-STRATEGY §2.6 and the Lead ruling. Initial baseline cause is not proven. |

Source run IDs: `qalead-la-129-78971b03-2026-10-24T18-35-41-097Z`, `qalead-la-83-a8bbac53-2026-10-24T13-04-38-988Z`, `qalead-la-105-a8bbac53-2026-10-24T13-32-48-725Z`, `qalead-la-137-4f10c5fd-2026-10-24T20-17-38-466Z`, `qalead-la-160-4f10c5fd-2026-10-24T22-43-01-494Z`.

Solo retry: `qalead-la-170-78971b03-2026-10-24T23-06-37-809Z`, source `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/baseline-t8-retry/artifacts/qalead-la-170-78971b03-2026-10-24T23-06-37-809Z/summary.json`. No test was changed.

## Rejected D4 T5b attempt and solo recovery (WE-F14)

The original 158 outcome remains FAIL. The primary frozen-suite table uses the accepted solo recovery 163, as the Lead authorized in msg_aafbba130845.

| Test ID | Baseline-3 127 | D3 135 | D4 original 158 | D4 solo recovery 163 | Disposition |
| --- | --- | --- | --- | --- | --- |
| `AC-T5-30` | PASS | PASS | FAIL | PASS | Original 158 is **UNEQUAL**, retained as WE-F14; solo recovery matches baseline and D3. |
| `SUITE` | PASS | PASS | FAIL | PASS | Original 158 is **UNEQUAL**, retained as WE-F14; solo recovery matches baseline and D3. |

Source runs: `qalead-la-158-4f10c5fd-2026-10-24T22-00-35-103Z` and `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z`. The original assertion observed pending after Moodle showed 100; the same sync was logged sent about 14 ms later. No test was changed.

| Suite | Compared IDs | Same recorded outcome | Unequal |
| --- | --- | --- | --- |
| M1 sim | 400 | 399 | 1 |
| M2 | 71 | 70 | 1 |
| T7 × 3 | 18 | 18 | 0 |
| T2a, T2b, T3a, T3b | 64 | 64 | 0 |
| T3c | 28 | 28 | 0 |
| T4a | 15 | 15 | 0 |
| T4b1, T4b2 | 40 | 40 | 0 |
| T5a, T5b | 48 | 48 | 0 |
| T5a, T6 | 46 | 46 | 0 |
| T8 | 23 | 20 | 3 |

T7 cells show runs 1/2/3 separately. DEMO AC-T7-15 is an expected SKIP in all three runs; it is not test coverage. Legacy aggregate IDs use each runner’s worst-result rule across sub-passes. Full invocation records include the rejected 136, 151 and 158 attempts separately, so their failures are not hidden by recovery.

## M1 sim

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `G1-IDENTITY` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-01.blackboard.readiness` | PASS | PASS | PASS | Same recorded outcome |
| `M1-01.common.constants` | PASS | PASS | PASS | Same recorded outcome |
| `M1-02.common.default-profile` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.auth-origin` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.legacy` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reject-serviceurl` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reject-siteurl` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-blackboard` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-blackboard-sim` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-canvas` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-canvas-beta` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-canvas-sim` | PASS | PASS | PASS | Same recorded outcome |
| `M1-03.common.reserved-canvas-test` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.blackboard.fixed-endpoints` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.cloud-fixed` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.override-auth` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.override-jwks` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.override-token` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.override-url` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.self-hosted` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.service-url-blackboard` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.service-url-standard` | PASS | PASS | PASS | Same recorded outcome |
| `M1-04.canvas.split-hosts` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.app` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.canonical` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.content` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.fixed-host` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.fixed-host-port` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.fragment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.http` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.ipv4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.ipv6` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.localhost` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.localhost-subdomain` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.path` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.query` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.tool` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.blackboard.userinfo` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.canonical` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule1-fragment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule1-http` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule1-path` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule1-query` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule1-userinfo` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule2-ipv4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule2-ipv6` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule2-localhost` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule2-sub-localhost` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule3-app` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule3-content` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule3-lti` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule4-service-sso` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule4-sso` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule4-sso-port` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.rule5-instructure` | PASS | PASS | PASS | Same recorded outcome |
| `M1-05.canvas.self-positive` | PASS | PASS | PASS | Same recorded outcome |
| `M1-06.blackboard.cli` | PASS | PASS | PASS | Same recorded outcome |
| `M1-06.blackboard.singleton` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.blackboard.alphabet` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.blackboard.crud` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.blackboard.fencing` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.blackboard.staging-generation` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.conditional-delete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.deactivate-reactivate` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.deployment-add` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.deployment-site-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.parallel-conditional` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.patch-site-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.platform-diff` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.canvas.staged-platform` | PASS | PASS | PASS | Same recorded outcome |
| `M1-07.common.standard-generation` | PASS | PASS | PASS | Same recorded outcome |
| `M1-08.canvas.deep-link` | PASS | PASS | PASS | Same recorded outcome |
| `M1-08.canvas.login-redirect` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.best-html` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.best-scorm12` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.browser-framed` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.browser-top-level` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.embedded-page` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.html-incomplete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.html-seven-of-ten` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.html-zero` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.moodle-static-control` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.scorm-incomplete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.scorm-seven-of-ten` | PASS | PASS | PASS | Same recorded outcome |
| `M1-09.canvas.scorm-zero` | PASS | PASS | PASS | Same recorded outcome |
| `M1-10.blackboard.deep-link-isolation` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.best-html` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.best-scorm12` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.html-incomplete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.html-seven-of-ten` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.html-zero` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.scorm-incomplete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.scorm-seven-of-ten` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.scorm-zero` | PASS | PASS | PASS | Same recorded outcome |
| `M1-11.blackboard.second-site` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.blackboard.ags-lineitem` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.blackboard.ags-lineitems` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.blackboard.dl-return` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.blackboard.nrps` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.canvas.ags-lineitem-evil` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.canvas.ags-lineitems` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.canvas.dl-return` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.canvas.nrps` | PASS | PASS | PASS | Same recorded outcome |
| `M1-12.common.standard-origin-control` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.blackboard.inactive` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.blackboard.login-token-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.blackboard.unknown-deep-link` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.blackboard.unknown-resource` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.canvas.inactive-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.canvas.login-token-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.canvas.no-client-id` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.canvas.unknown-deep-link` | PASS | PASS | PASS | Same recorded outcome |
| `M1-13.canvas.unknown-resource` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.blackboard.claims` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.blackboard.runtime-identity` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.canvas.browser-runtime-name` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.canvas.claims` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.canvas.runtime-identity` | PASS | PASS | PASS | Same recorded outcome |
| `M1-14.common.standard-name-control` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.blackboard.dto` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.blackboard.not-ready` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.default-profile` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.dto` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.dynamic-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.lms-providers` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.lms-unknown` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.profile-mismatch` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.canvas.split` | PASS | PASS | PASS | Same recorded outcome |
| `M1-15.common.moodle-default` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.graded-vs-preview` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.institution-admin` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.instructor` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.learner` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.learner-and-instructor` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.learner-institution-instructor` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.simple-instructor` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.simple-learner` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.student-view` | PASS | PASS | PASS | Same recorded outcome |
| `M1-16.canvas.teaching-assistant` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.other-library-conflict` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.register` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.repeat` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.strict-client-secret` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.strict-issuer` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.strict-jwks-url` | PASS | PASS | PASS | Same recorded outcome |
| `M1-17.canvas.strict-missing-code` | PASS | PASS | PASS | Same recorded outcome |
| `M1-18.blackboard.disconnect` | PASS | PASS | PASS | Same recorded outcome |
| `M1-18.blackboard.unredeemed-revoked` | PASS | PASS | PASS | Same recorded outcome |
| `M1-18.canvas.disconnect` | PASS | PASS | PASS | Same recorded outcome |
| `M1-18.canvas.grant-revoked` | PASS | PASS | PASS | Same recorded outcome |
| `M1-18.canvas.pending-score` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.blackboard.configuration` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.canvas.blackboard-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.canvas.inline-key` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.canvas.json` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.canvas.jwk-other` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.canvas.rows` | PASS | PASS | PASS | Same recorded outcome |
| `M1-19.common.moodle-configuration` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.add` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.capability-blackboard` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.capability-moodle` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.initial-grant` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.missing-code` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.pending` | PASS | PASS | PASS | Same recorded outcome |
| `M1-20.canvas.repeat` | PASS | PASS | PASS | Same recorded outcome |
| `M1-21.blackboard.capabilities` | PASS | PASS | PASS | Same recorded outcome |
| `M1-21.canvas.course-shell` | PASS | PASS | PASS | Same recorded outcome |
| `M1-21.canvas.registration-url` | PASS | PASS | PASS | Same recorded outcome |
| `M1-21.canvas.web-services` | PASS | PASS | PASS | Same recorded outcome |
| `M1-21.common.moodle-grant-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.blackboard.site-check` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.blackboard.text` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.canvas.back-to-canvas` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.canvas.browser-status-text` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.canvas.inactive-text` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.canvas.role-text` | PASS | PASS | PASS | Same recorded outcome |
| `M1-22.canvas.unknown-deployment-text` | PASS | PASS | PASS | Same recorded outcome |
| `M1-24.canvas.browser-secrets` | PASS | PASS | PASS | Same recorded outcome |
| `M1-24.common.event-shapes` | PASS | PASS | PASS | Same recorded outcome |
| `M1-24.common.secrets` | PASS | PASS | PASS | Same recorded outcome |
| `M1-25.blackboard.site-metadata` | PASS | PASS | PASS | Same recorded outcome |
| `M1-25.canvas.self-hosted-metadata` | PASS | PASS | PASS | Same recorded outcome |
| `M1-25.canvas.site-metadata` | PASS | PASS | PASS | Same recorded outcome |
| `M1-25.common.standard-site-control` | PASS | PASS | PASS | Same recorded outcome |
| `M1-26.canvas.deep-link` | PASS | PASS | PASS | Same recorded outcome |
| `M1-26.canvas.grade` | PASS | PASS | PASS | Same recorded outcome |
| `M1-26.canvas.no-cloud-hosts` | PASS | PASS | PASS | Same recorded outcome |
| `M1-26.canvas.page-host-ags` | PASS | PASS | PASS | Same recorded outcome |
| `M1-26.canvas.register` | PASS | PASS | PASS | Same recorded outcome |
| `M1-27.blackboard.rebind` | PASS | PASS | PASS | Same recorded outcome |
| `M1-28.blackboard.positive` | PASS | PASS | PASS | Same recorded outcome |
| `M1-28.blackboard.replacement` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.b` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.c` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.d` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.e` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.f` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.g` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.h` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.j` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.k-client` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.k-library` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.k-registered` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.k-site` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.k-ttl` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.l-delete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.l-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.l-get` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.l-put` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.blackboard.m` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.a-foreign-code` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.a-no-code` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.c` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.d` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.e-client` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.e-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.f` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.g` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.h` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.i-other-library` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.i-redeemed` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-add-client` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-add-pending` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-initial-registered` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-library` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-service-url` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-site` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-site-canonical` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.k-ttl` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.l-delete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.l-get` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.l-post-deployments` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.l-put` | PASS | PASS | PASS | Same recorded outcome |
| `M1-29.canvas.m` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.blackboard.portal-routes` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.blackboard.publication-fields` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.canvas.other-lms` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.canvas.publication-fields` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.canvas.routes` | PASS | PASS | PASS | Same recorded outcome |
| `M1-31.canvas.signed-out` | PASS | PASS | PASS | Same recorded outcome |
| `M1-32.canvas.ags-on-page-host` | PASS | PASS | PASS | Same recorded outcome |
| `M1-32.canvas.deep-link` | PASS | PASS | PASS | Same recorded outcome |
| `M1-32.canvas.dl-on-service-host` | PASS | PASS | PASS | Same recorded outcome |
| `M1-32.canvas.grade` | PASS | PASS | PASS | Same recorded outcome |
| `M1-32.canvas.idtoken` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.blackboard.mapping-400` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.blackboard.mapping-422` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.blackboard.status-400` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.blackboard.status-422` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.canvas.mapping-400` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.canvas.mapping-422` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.canvas.status-400` | PASS | PASS | PASS | Same recorded outcome |
| `M1-33.canvas.status-422` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.altered-signature` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.expired` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.future-iat` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.hs256` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.multi-aud-no-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.multi-aud-wrong-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.no-cookie` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.none` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.replay` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.unknown-key` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.unknown-kid` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.wrong-audience` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.wrong-issuer` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.blackboard.wrong-nonce` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-altered-signature` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-expired` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-future-iat` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-hs256` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-multi-aud-no-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-multi-aud-wrong-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-no-cookie` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-none` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-replay` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-unknown-key` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-unknown-kid` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-wrong-audience` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-wrong-issuer` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.cloud-wrong-nonce` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-altered-signature` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-expired` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-future-iat` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-hs256` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-multi-aud-no-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-multi-aud-wrong-azp` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-no-cookie` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-none` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-replay` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-unknown-key` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-unknown-kid` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-wrong-audience` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-wrong-issuer` | PASS | PASS | PASS | Same recorded outcome |
| `M1-34.canvas.self-wrong-nonce` | PASS | PASS | PASS | Same recorded outcome |
| `M1-35.common.acceptance-off` | PASS | PASS | PASS | Same recorded outcome |
| `M1-35.common.default-off` | PASS | PASS | PASS | Same recorded outcome |
| `M1-35.common.default-on` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.blackboard.encoded-dot` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.blackboard.encoded-slash` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.blackboard.origin` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.blackboard.path` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.blackboard.query` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.canvas.encoded-dot` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.canvas.encoded-slash` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.canvas.origin` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.canvas.path` | PASS | PASS | PASS | Same recorded outcome |
| `M1-36.canvas.query` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.a` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.b` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.d` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.e` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.f` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.g` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.i` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.j` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.k-after-a` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.k-after-b` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.l` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.m` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.n` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.o` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.q` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.r` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v11` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v12` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v5` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v7` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.v9` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.x1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.x2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.y1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.z1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.z2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.z3` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.z4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.blackboard.z5` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.c` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.c2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.d` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.e` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.f` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.g` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.h` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.i` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.j` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.m` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.n` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.p-activate` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.p-create` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.q` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.r` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.s-compensation` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.s-dead` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.s-retry` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.t` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.u-after-c` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.u-after-c2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v10` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v12` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v3` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v6` | PASS | PASS | PASS | Same recorded outcome |
| `M1-37.canvas.v8` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.a` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.b` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.c` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.e` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.g-absent` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.g-existing` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.i3` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.blackboard.i4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.a` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.b` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.d` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.e` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.f` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.f-held-delete` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.g-late-create` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.i1` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.i2` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.canvas.i4` | PASS | PASS | PASS | Same recorded outcome |
| `M1-38.common.i5` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.canvas.blackboard-family-on-canvas` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.canvas.operator-order` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.canvas.residual-race` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.canvas.squat-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.canvas.upper-case-family` | PASS | PASS | PASS | Same recorded outcome |
| `M1-39.common.missing-family-control` | PASS | PASS | PASS | Same recorded outcome |
| `M1-40.canvas.a-dl-third-host` | PASS | PASS | PASS | Same recorded outcome |
| `M1-40.canvas.b-frame-refused` | PASS | PASS | PASS | Same recorded outcome |
| `M1-40.canvas.c-return-fallback` | PASS | PASS | PASS | Same recorded outcome |
| `M3-ISOLATION` | PASS | FAIL | FAIL | **UNEQUAL** — raw host global-state row; see named resource evidence and the Lead disposition in the run reports. |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-120-78971b03-2026-10-24T17-12-27-675Z/summary.json`; `qalead-la-140-4f10c5fd-2026-10-24T21-07-50-922Z/summary.json`; `qalead-la-162-4f10c5fd-2026-10-24T20-41-29-861Z/summary.json`.

## M2

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `M2-01.cards` | PASS | PASS | PASS | Same recorded outcome |
| `M2-01.isolated-newest` | PASS | PASS | PASS | Same recorded outcome |
| `M2-01.moodle-card` | PASS | PASS | PASS | Same recorded outcome |
| `M2-02.not-ready` | PASS | PASS | PASS | Same recorded outcome |
| `M2-02.ready` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.profile-labels` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule1-fragment` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule1-http` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule1-path` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule1-query` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule1-userinfo` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule2-ipv4` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule2-ipv6` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule2-localhost` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule2-sub-localhost` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule3-app` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule3-content` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule3-lti` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule4-service-sso` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule4-sso` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule4-sso-port` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.rule5-instructure` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.valid-default-service` | PASS | PASS | PASS | Same recorded outcome |
| `M2-03.valid-split` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.clipboard-denied` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.copy-json` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.download-failure` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.download-json` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.inline` | PASS | PASS | PASS | Same recorded outcome |
| `M2-04.rows` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.grant-invalid` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.grant-mismatch` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.invalid-values` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.lti-service-error` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.platform-in-use` | PASS | PASS | PASS | Same recorded outcome |
| `M2-05.success` | PASS | PASS | PASS | Same recorded outcome |
| `M2-06.deployment-in-use` | PASS | PASS | PASS | Same recorded outcome |
| `M2-06.retry-after-error` | PASS | PASS | PASS | Same recorded outcome |
| `M2-06.second-deployment` | PASS | PASS | PASS | Same recorded outcome |
| `M2-06.success` | PASS | PASS | PASS | Same recorded outcome |
| `M2-07.badges` | PASS | PASS | PASS | Same recorded outcome |
| `M2-07.canvas-detail` | PASS | PASS | PASS | Same recorded outcome |
| `M2-07.no-add-elsewhere` | PASS | PASS | PASS | Same recorded outcome |
| `M2-08.blackboard-no-moodle-features` | PASS | PASS | PASS | Same recorded outcome |
| `M2-08.canvas-no-moodle-features` | PASS | PASS | PASS | Same recorded outcome |
| `M2-08.moodle-controls` | PASS | PASS | PASS | Same recorded outcome |
| `M2-09.blackboard-dialog` | PASS | PASS | PASS | Same recorded outcome |
| `M2-09.canvas-dialog` | PASS | PASS | PASS | Same recorded outcome |
| `M2-09.moodle-dialog` | PASS | PASS | PASS | Same recorded outcome |
| `M2-10.canvas-results` | PASS | PASS | PASS | Same recorded outcome |
| `M2-10.publish-dialog` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.add-deployment-keyboard` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.axe-blackboard` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.axe-canvas` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.axe-canvas-detail` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.blackboard-keyboard` | PASS | PASS | PASS | Same recorded outcome |
| `M2-11.canvas-keyboard` | PASS | PASS | PASS | Same recorded outcome |
| `M2-12.blackboard` | PASS | PASS | PASS | Same recorded outcome |
| `M2-12.canvas` | PASS | PASS | PASS | Same recorded outcome |
| `M2-13.cross-library` | PASS | PASS | PASS | Same recorded outcome |
| `M2-13.cross-provider` | PASS | PASS | PASS | Same recorded outcome |
| `M2-13.form-state` | PASS | PASS | PASS | Same recorded outcome |
| `M2-13.no-stale-values` | PASS | PASS | PASS | Same recorded outcome |
| `M2-13.routes-open` | PASS | PASS | PASS | Same recorded outcome |
| `M2-STACK` | PASS | PASS | PASS | Same recorded outcome |
| `M3-06-M2` | PASS | FAIL | FAIL | **UNEQUAL** — raw host global-state row; see named resource evidence and the Lead disposition in the run reports. |
| `M3-07-M2` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-121-78971b03-2026-10-24T17-43-47-815Z/summary.json`; `qalead-la-138-4f10c5fd-2026-10-24T20-34-52-623Z/summary.json`; `qalead-la-152-4f10c5fd-2026-10-24T20-38-16-340Z/summary.json`.

## T7 × 3

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `A1-A2 / AC-T7-02,AC-T7-14` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `A3 / ` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `A4 / AC-T7-03,AC-T7-02` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `A5 / AC-T7-07,AC-T7-04` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `A6 / AC-T7-07` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `AC-T7-04 / AC-T7-04` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `AC-T7-05 / AC-T7-05` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `AC-T7-06 / AC-T7-06` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `B1-B2 / ` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `B3 / ` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `B4 / AC-T7-08` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `B5 / AC-T7-08` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `B6 / AC-T7-09,AC-T7-07` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `C1 / AC-T7-10` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `C2 / AC-T7-10` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `DEMO / AC-T7-15` | SKIP/SKIP/SKIP | SKIP/SKIP/SKIP | SKIP/SKIP/SKIP | Same recorded outcome |
| `T7-END / AC-T7-13` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |
| `T7-START / AC-T7-13` | PASS/PASS/PASS | PASS/PASS/PASS | PASS/PASS/PASS | Same recorded outcome |

Sources: `qalead-la-122-78971b03-2026-10-24T17-46-37-886Z/summary.json`; `qalead-la-130-4f10c5fd-2026-10-24T19-31-11-287Z/summary.json`; `qalead-la-153-4f10c5fd-2026-10-24T21-33-32-449Z/summary.json`.

## T2a, T2b, T3a, T3b

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T2-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-11` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-14` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-15` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-18` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-19` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-20` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-21` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-25` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-26` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-27` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-28` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-29` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-30` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-31` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T2-32` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-11` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-14` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-17` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-18` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-25` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-26` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-28` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-29` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-30` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `H14` | PASS | PASS | PASS | Same recorded outcome |
| `H6` | PASS | PASS | PASS | Same recorded outcome |
| `KNOB` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-123-78971b03-2026-10-24T17-55-33-990Z/summary.json`; `qalead-la-131-4f10c5fd-2026-10-24T19-40-50-199Z/summary.json`; `qalead-la-154-4f10c5fd-2026-10-24T21-42-54-517Z/summary.json`.

## T3c

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T3-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-11` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-14` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-15` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-17` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-18` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-19` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-20` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-21` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-27` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T3-31` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `HOSTCTL` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-124-78971b03-2026-10-24T18-03-57-336Z/summary.json`; `qalead-la-132-4f10c5fd-2026-10-24T19-49-42-938Z/summary.json`; `qalead-la-155-4f10c5fd-2026-10-24T21-51-35-350Z/summary.json`.

## T4a

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T4-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-35` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `FIXTURES` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |
| `UNMAPPED` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-125-78971b03-2026-10-24T18-05-47-088Z/summary.json`; `qalead-la-133-4f10c5fd-2026-10-24T19-51-40-982Z/summary.json`; `qalead-la-156-4f10c5fd-2026-10-24T21-53-34-038Z/summary.json`.

## T4b1, T4b2

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T4-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-14` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-15` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-17` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-18` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-19` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-20` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-21` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-25` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-26` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-27` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-28` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-29` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-30` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-31` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-32` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-33` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-34` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T4-36` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `FIXTURES` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `HOSTCTL` | PASS | PASS | PASS | Same recorded outcome |
| `KNOB` | PASS | PASS | PASS | Same recorded outcome |
| `P1` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SEED` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T4b` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T4b2` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-126-78971b03-2026-10-24T18-07-15-391Z/summary.json`; `qalead-la-134-4f10c5fd-2026-10-24T19-53-27-991Z/summary.json`; `qalead-la-157-4f10c5fd-2026-10-24T21-55-12-922Z/summary.json`.

## T5a, T5b

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T5-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-11` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-14` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-15` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-17` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-18` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-19` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-20` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-21` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-27` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-28` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-29` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-30` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-31` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-32` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-33` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-34` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-35` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-36` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-37` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `FIXTURES` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `HOSTCTL` | PASS | PASS | PASS | Same recorded outcome |
| `KNOB` | PASS | PASS | PASS | Same recorded outcome |
| `P11` | PASS | PASS | PASS | Same recorded outcome |
| `P5` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T5a` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T5b` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-127-78971b03-2026-10-24T18-12-22-967Z/summary.json`; `qalead-la-135-4f10c5fd-2026-10-24T19-59-20-067Z/summary.json`; `qalead-la-163-4f10c5fd-2026-10-24T22-18-06-366Z/summary.json`.

## T5a, T6

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T5-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-15` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-16` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-17` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-20` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-21` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-22` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-23` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-24` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-34` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-35` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T5-37` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-01` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-03` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-07` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-10` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-11` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-12` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-13` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T6-14` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `FIXTURES` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `HOSTCTL` | PASS | PASS | PASS | Same recorded outcome |
| `KNOB` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T5a` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T6` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | PASS | PASS | PASS | Same recorded outcome |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-128-78971b03-2026-10-24T18-28-47-946Z/summary.json`; `qalead-la-142-4f10c5fd-2026-10-24T20-27-15-669Z/summary.json`; `qalead-la-159-4f10c5fd-2026-10-24T22-35-26-435Z/summary.json`.

## T8

| Test ID | Baseline-3 | D3 | D4 | Comparison / disposition |
| --- | --- | --- | --- | --- |
| `AC-T8-02` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-03` | FAIL | PASS | PASS | **UNEQUAL** — baseline HOLD observation failure and FAIL_AT cascade; first cause not proven. D1/D2 AC-T8-03/07 also PASS. No LA-IC or B/C cause is claimed. |
| `AC-T8-04` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-05` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-06` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-07` | FAIL | PASS | PASS | **UNEQUAL** — baseline HOLD observation failure and FAIL_AT cascade; first cause not proven. D1/D2 AC-T8-03/07 also PASS. No LA-IC or B/C cause is claimed. |
| `AC-T8-08` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-09` | PASS | PASS | PASS | Same recorded outcome |
| `AC-T8-10` | PASS | PASS | PASS | Same recorded outcome |
| `C-T8-01` | PASS | PASS | PASS | Same recorded outcome |
| `C-T8-02` | PASS | PASS | PASS | Same recorded outcome |
| `CLONE` | PASS | PASS | PASS | Same recorded outcome |
| `DOCTOR` | PASS | PASS | PASS | Same recorded outcome |
| `FIXTURES` | PASS | PASS | PASS | Same recorded outcome |
| `H1` | PASS | PASS | PASS | Same recorded outcome |
| `HOSTCTL` | PASS | PASS | PASS | Same recorded outcome |
| `KNOB` | PASS | PASS | PASS | Same recorded outcome |
| `PRE` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T5a` | PASS | PASS | PASS | Same recorded outcome |
| `SETUP-T8` | PASS | PASS | PASS | Same recorded outcome |
| `SUITE` | FAIL | PASS | PASS | **UNEQUAL** — baseline HOLD observation failure and FAIL_AT cascade; first cause not proven. D1/D2 AC-T8-03/07 also PASS. No LA-IC or B/C cause is claimed. |
| `TEARDOWN` | PASS | PASS | PASS | Same recorded outcome |

Sources: `qalead-la-129-78971b03-2026-10-24T18-35-41-097Z/summary.json`; `qalead-la-137-4f10c5fd-2026-10-24T20-17-38-466Z/summary.json`; `qalead-la-160-4f10c5fd-2026-10-24T22-43-01-494Z/summary.json`.
## Baseline T8 solo retry against D3 and D4

This table supplements the original baseline comparison above. It does not erase any original FAIL.

| Test ID | Original 129 | Solo retry 170 | D3 | D4 | Disposition |
| --- | --- | --- | --- | --- | --- |
| `AC-T8-02` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-03` | FAIL | PASS | PASS | PASS | Retry and candidate outcomes match; original 129 remains a different recorded result |
| `AC-T8-04` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-05` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-06` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-07` | FAIL | PASS | PASS | PASS | Retry and candidate outcomes match; original 129 remains a different recorded result |
| `AC-T8-08` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-09` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `AC-T8-10` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `C-T8-01` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `C-T8-02` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `CLONE` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `DOCTOR` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `FIXTURES` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `H1` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `HOSTCTL` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `KNOB` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `PRE` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `SETUP` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `SETUP-T5a` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `SETUP-T8` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |
| `SUITE` | FAIL | PASS | PASS | PASS | Retry and candidate outcomes match; original 129 remains a different recorded result |
| `TEARDOWN` | PASS | PASS | PASS | PASS | Retry and candidate outcomes match |

## Carried frozen phases

M1 migration (12 rows) and snapshot-upgrade (6 rows) are carried under GATE-RUN-PLAN §10(c), not rerun on baseline-3 or 4f10c5fd. Their source runs are qalead-la-18/-19 on 1b17261 and qalead-la-61/-62 on a8bbac53. No new baseline-3/D3/D4 outcome is claimed for these phases. The storage command diff is empty; the report records this carry rule separately from fresh execution.

### Migration (carried, not fresh execution)

| Test ID | Earlier baseline | Earlier candidate | Baseline-3 / D3 / D4 disposition |
| --- | --- | --- | --- |
| `M1-23.common.backup` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-23.common.backup-running` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-23.common.baseline` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-23.common.upgrade` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.postwrite` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.reject-backup-id` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.reject-bytes` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.reject-missing` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.reject-project` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.restore` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-30.common.rollback` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-41.common.j-migration` | PASS | PASS | Carried under §10(c); no new result claimed |

Sources: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT7/artifacts/qalead-la-18-1b17261b-2026-10-23T18-55-39-609Z/m1-case-results.json` and `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3F/artifacts/qalead-la-61-a8bbac53-2026-10-24T05-33-10-379Z/m1-case-results.json`.

### Snapshot upgrade (carried, not fresh execution)

| Test ID | Earlier baseline | Earlier candidate | Baseline-3 / D3 / D4 disposition |
| --- | --- | --- | --- |
| `M1-38.common.h1` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-38.common.h2` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-38.common.h3` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-38.common.h4` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-38.common.h5` | PASS | PASS | Carried under §10(c); no new result claimed |
| `M1-41.common.j-snapshot` | PASS | PASS | Carried under §10(c); no new result claimed |

Sources: `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT7/artifacts/qalead-la-19-1b17261b-2026-10-23T19-01-20-155Z/m1-case-results.json` and `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3F/artifacts/qalead-la-62-a8bbac53-2026-10-24T05-38-09-094Z/m1-case-results.json`.

## Golden v2 response differences

Both captures have 297 approved differences from baseline-3, zero unexplained changes and zero missing expected changes. The change maps, including their before/after values, match between D3 and D4 after the documented port normalization. Every row below is a change from baseline-3; none is an equal baseline result. Full sanitized before/after values are in RUN-D3/logs/qalead-la-139-golden-compare.txt and RUN-D4/logs/qalead-la-150-compare.txt.

| Golden file / response path | D3 vs baseline-3 | D4 vs baseline-3 | Approved expected file |
| --- | --- | --- | --- |
| `G1 acceptance.lmsProviders.lms[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[0].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[0].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[0].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[0].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[1].capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 acceptance.lmsProviders.lms[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[1].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[1].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[1].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[1].methods[1]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-14.json` |
| `G1 acceptance.lmsProviders.lms[1].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[2].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[2].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[2].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[2].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[3]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.lmsProviders.lms[4]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.ltiHealth.outbound_allowlist` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-16.json` |
| `G1 acceptance.providers.profiles[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[0].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[0].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[0].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[1].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[1].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[1].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[2].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[2].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[2].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[3].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[3].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[3].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[3].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[4].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[4].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[4].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[4].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[5].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[5].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[5].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[5].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].accesstokenEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].authenticationEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].id` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].issuer` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].jwksUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].label` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].lms` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].sharedPlatform` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].sharing` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].simulation` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[6].siteUrlOn` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].accesstokenEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].authenticationEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].id` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].issuer` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].jwksUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].label` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].lms` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].serviceUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].simulation` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[7].siteUrlOn` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[8]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 acceptance.providers.profiles[9]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 canvasConfiguration["jwk=inline"].scopes[4]` | removed; UNEQUAL | removed; UNEQUAL | `LA-IC-04.json` |
| `G1 canvasConfiguration["jwk=url"].scopes[4]` | removed; UNEQUAL | removed; UNEQUAL | `LA-IC-04.json` |
| `G1 connectionList.connections[0].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[0].capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connectionList.connections[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[0].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[0].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[1].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[1].capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connectionList.connections[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[1].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[1].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[2].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[2].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[2].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[3].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[3].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[3].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[3].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[4].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[4].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[4].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[4].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[5].bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[5].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[5].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connectionList.connections[5].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-connected.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-connected.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-connected.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-connected.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-disabled.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-disabled.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-disabled.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-disabled.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-pending.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-pending.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-pending.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-pending.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-registered.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-registered.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-registered.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.blackboard-registered.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-connected.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-connected.capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connections.canvas-connected.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-connected.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-connected.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-disabled.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-disabled.capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connections.canvas-disabled.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-disabled.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-disabled.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-pending.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-pending.capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connections.canvas-pending.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-pending.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-pending.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-registered.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-registered.capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 connections.canvas-registered.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-registered.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.canvas-registered.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-connected.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-connected.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-connected.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-connected.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-disabled.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-disabled.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-disabled.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-disabled.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-dynamic-pending.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-dynamic-pending.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-dynamic-pending.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-dynamic-pending.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-manual-pending.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-manual-pending.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-manual-pending.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-manual-pending.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-registered.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-registered.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-registered.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 connections.moodle-registered.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[0].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[0].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[0].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[0].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[1].capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 default.lmsProviders.lms[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[1].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[1].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[1].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[1].methods[1]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-14.json` |
| `G1 default.lmsProviders.lms[1].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[2].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[2].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[2].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[2].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[3]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.lmsProviders.lms[4]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[0].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[0].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[0].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[1].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[1].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[1].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[2].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[2].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[2].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[3].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[3].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[3].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[3].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[4].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[4].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[4].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[4].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[5].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[5].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[5].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[5].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[6]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 default.providers.profiles[7]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[0].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[0].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[0].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[0].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[1].capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G1 lmsProvidersAfter.lms[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[1].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[1].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[1].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[1].methods[1]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-14.json` |
| `G1 lmsProvidersAfter.lms[1].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[2].channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[2].channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[2].family` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[2].registration` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[3]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 lmsProvidersAfter.lms[4]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[0].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[0].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[0].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[0].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[1].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[1].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[1].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[1].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[2].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[2].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[2].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[2].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[3].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[3].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[3].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[3].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[4].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[4].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[4].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[4].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[5].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[5].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[5].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[5].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].accesstokenEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].authenticationEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].id` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].issuer` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].jwksUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].label` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].lms` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].sharedPlatform` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].sharing` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].simulation` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[6].siteUrlOn` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].accesstokenEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].authenticationEndpoint` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].endpointOrigins` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].endpoints` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].id` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].issuer` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].issuerKind` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].jwksUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].label` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].lms` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].serviceUrl` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].simulation` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[7].siteUrlOn` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[8]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 providersAfter.profiles[9]` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G1 toolConfiguration.moodle[12].value` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-04.json` |
| `G3 blackboard.connection.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 blackboard.connection.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 blackboard.connection.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 blackboard.connection.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 blackboard.publications.B-conflict.results[0].scoreSyncs[0].lastError` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-15.json` |
| `G3 canvas.connection.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 canvas.connection.capabilities.dynamicRegistration` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-14.json` |
| `G3 canvas.connection.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 canvas.connection.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 canvas.connection.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 canvas.publications.B-conflict.results[0].scoreSyncs[0].lastError` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-15.json` |
| `G3 moodle.connection.bindingAuthority` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 moodle.connection.channel` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 moodle.connection.channelCapabilities` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G3 moodle.connection.channelName` | added; UNEQUAL | added; UNEQUAL | `LA-IC-01.json` |
| `G4 blackboard.pages.picker.text` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-12.json` |
| `G4 canvas.pages.picker.text` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-12.json` |
| `G4 moodle.pages.picker.text` | changed; UNEQUAL | changed; UNEQUAL | `LA-IC-12.json` |
