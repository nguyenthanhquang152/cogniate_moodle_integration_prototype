Verdict: PREPARATION IN PROGRESS — no product verification
Behavior baseline: `56591df0e71939d5d62c9042c630c841d01f84e8` (ADR-011 revision 6)
Owner: independent Codex QA, common engine and Blackboard

## Independence and scope

This plan and its tests come from the accepted contracts. QA has not read the
authors' implementation, audit notes or code reviews. Harness self-checks are
not product PASS. Product runs need a frozen product SHA, a frozen test SHA and
a Lead-reserved stack. No stack is launched by this preparation task.

Canvas QA owns `tests/sim/canvas/**`, `tests/acceptance/M1/canvas/**` and all M2
browser tests. This worker owns simulator core/Blackboard, common/Blackboard M1
API cases, the host runner, migration and legacy non-browser checks.

## First checkpoint: simulator interface for Canvas QA

The simulator uses Node built-ins only. It imports no product module.

`tests/sim/core/runtime.mjs` exports `createRuntime(options)`. Options are
`{ publicLtiUrl, fetchJwks, log }`. `fetchJwks(url)` returns public JWKS using
verified TLS. `log(record)` receives redacted M3 `sim_hit` records.

`tests/sim/core/provider.mjs` exports `createProvider(runtime, config)`.
Configuration is plain independent fixture data:

```js
{
  id, issuer, family,
  auth: { host, path, methods: ['GET', 'POST'] },
  jwks: { host, path }, // path can be a RegExp with the client id as group 1
  token: { hosts: [], path, audience: 'string' }, // Blackboard uses 'array'
  sites: [{
    host, lineitems: '/api/lti/courses/course-1/line_items',
    nrps: '/api/lti/courses/course-1/names_and_roles',
    dlReturn: '/courses/course-1/deep_linking_response'
  }],
  pageHosts: [],
  dlData: 'query', // Blackboard uses 'claim'
  dlSubject: false, // Blackboard requires true
  documentTarget: 'iframe'
}
```

`createProvider` returns `{ id, hosts, handle(request) }`. `handle` resolves to
`null` for an unmatched route, or `{ status, headers, body }`.
The request is `{ method, host, url, headers, body }`; `url` is a URL and `body`
is a UTF-8 string. Provider modules export `createProviders(runtime)` returning
an array. Blackboard supplies one provider. Canvas supplies cloud and
self-hosted providers in `tests/sim/canvas/index.mjs`. Canvas owns its constants
and self-tests; shared protocol changes go through the Lead.

`runtime` owns scenarios, in-memory signing keys, tokens and record cursors.
The provider helper supplies auth, JWKS, token verification, AGS, NRPS, frame
and signed DL response verification. Scenario overrides can change claims,
roles, deployment, endpoints, crypto faults and ordered score answers.
Canvas uses query-only DL data and an iframe document target. The page-only
host never exposes token, AGS or NRPS routes.

Control endpoints on `lms-sim.test`:

- `GET /__sim/ready`: registered provider IDs.
- `POST /__sim/scenarios`: replace/create one scenario; returns its ID and
  login initiation fields. Fields: `id`, `provider`, `clientId`, `deploymentId`,
  `siteHost`, optional `pageHost`, `messageType`, `roles`, `claims`, `omit`,
  `fault`, `scoreAnswers`, `resource`, `subject`, `contextId`, `resourceLinkId`.
- `GET /__sim/records?since=N`: `{ cursor, records }`, excluding token values.
- `POST /__sim/reset`: clear scenarios, token/jti state and records; keys stay.

The default server requires both provider modules. A missing Canvas module is
a startup error. An explicit Blackboard-only harness self-check is separate
from full preparation or product acceptance.

## Case IDs and handoff

Every case has a stable ID `M1-NN.owner.variant`, where owner is `common`,
`blackboard` or `canvas`. The case title includes `AC-M1-NN`, its evidence label
and that stable ID. Each owner supplies a `manifest.json` in its acceptance
folder with `{ id, ac, environment, title, kind, file }` entries. `environment`
is one of the six M3 labels. `kind` is `api`, `host` or `browser`.

Each listed M1-37 and M1-38 letter and named variant is a separate ID, not one
large aggregate assertion. For example: `M1-37.blackboard.a`,
`M1-37.canvas.c2`, `M1-38.blackboard.g-existing`,
`M1-38.blackboard.g-absent`, `M1-38.canvas.g-late-create`.
Both-provider requirements have separate rows. Canvas QA supplies every
Canvas-specific branch, including shared criteria on Canvas. Common QA
supplies common metadata, default-profile gates, standard/Moodle controls,
migration and log checks, plus Blackboard cases.

The full runner reads all three manifests, rejects missing/empty suites,
duplicate IDs, absent test files, skipped/missing results and mixed SHAs.
Provider readiness means common plus that provider at one candidate SHA.
Harness-only checks never satisfy an M1 criterion.

## Environment and evidence

Use `SIM` for signed simulations. M1-23/M1-30 and real Moodle regressions use
`MOODLE-LIVE`. Documentation checks use `DOC`. Local Canvas, hosted Canvas and
Blackboard tenant checks remain separate and unverified without authorization.
No vendor DNS/certificates, production SSRF exceptions or relaxed TLS are used.
Private signing keys stay in memory. Shared evidence contains no grant codes,
ltiks, service keys, bearer tokens or client assertions.

Later product runs use a reserved `qa-multi-rN` lane, port 8443 and
`172.29.0.0/16`, one stack preferred. No Docker Desktop setting changes.
The migration/rollback runner needs a separate clean clone and the old SHA
named in M1. It must preserve the baseline containers and volumes.

The final inventory covers M1-01..40 (all variants), M2-01..13 (Canvas QA),
M3-01..07 (shared evidence/independence/live matrix), and M4-01..08 (Docs and
review gates). Preparation will append exact commands and unresolved harness
dependencies here before handoff.
