Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-05 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E7-05.md`. Design: TEST-STRATEGY §2.8; LA-ADR-02 D7; LA-ADR-05 D1, D3, D4; LA-ADR-08.

Diff: `git diff 0e65ab1^ 0e65ab1 -- tests/sim docs/reviews/LA-E7-05/qa.md`. I reviewed only the LA-E7-05 parts of this commit; the same commit also holds LA-E7-02 round-2 fixes.

Method: I read the diff and checked the frozen M1 and M2 users of the changed defaults (`git grep`). For one finding, I ran one browser probe with a local headless Chrome through Playwright (`channel: 'chrome'`): a page on a localhost-only server did a same-origin `fetch` POST, as the storage frame does. I used no Docker and no network, and I changed no repository file except this one.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E7-05-01 | BLOCKER | In a real browser, the storage frame keys the storage by its own origin and answers to that origin, so every `lti.put_data` and `lti.get_data` reply is dropped (AC-06 fails; LA-E3-02 K2 U4 depends on it) |
| A-LA-E7-05-02 | MINOR | Two defaults changed: an empty Deep Linking answer is now accepted, and a scenario's `deep_linking_settings` claim now merges instead of replacing |

## Findings

### A-LA-E7-05-01 — BLOCKER — the storage frame uses the wrong sender origin in a browser

- **Files:** `tests/sim/core/provider.mjs:572` (the frame script: `fetch('/__storage', { headers: { 'x-storage-origin': event.origin } })`), `:577` (`event.source.postMessage(payload.response, payload.targetOrigin)`), `:608` (`const senderOrigin = String(request.headers.origin ?? request.headers['x-storage-origin'] ?? '')`).
- **Problem:** the frame script runs on the auth host and forwards each message to `/__storage` on its own origin. A browser adds `Origin` to a same-origin `POST`, and that value is the frame's origin (the auth host), not the tool. `storageMessage` prefers `Origin` over `x-storage-origin`. So:
  - every tool shares one storage partition (`<provider>::<auth host origin>`), not one per sender origin;
  - `targetOrigin` is the auth host origin, so `event.source.postMessage(…, 'https://<auth host>')` to the tool window (origin `https://lti.cogniate.test`) is dropped by the browser;
  - the product's login and storage-check pages get no reply, wait 1.5 s, and post an empty value. The storage path then always ends in `STATE_COOKIE_MISSING`.
- **Evidence:** a headless Chrome probe: a page at `http://127.0.0.1:<port>` sent `fetch('/__storage', {method: 'POST', headers: {'x-storage-origin': 'https://tool.example'}})`, and the server received `{"origin":"http://127.0.0.1:<port>","xso":"https://tool.example"}`. The host-only test (`tests/sim/generic/protocol.test.mjs:585-627`) posts to `/__storage` with an `origin: TOOL` header directly, so it never runs the frame script, and it passes.
- **Required outcome:** AC-LA-E7-05-06: "the auth host's frame answers `lti.put_data` and `lti.get_data` only for the sender origin and `message_id` that it got". In a browser, the frame answers with the wrong origin. LA-E3-02 AC-08 (K2 U4, a Must browser case) runs through this frame.
- **Suggested fix:** take the sender from `x-storage-origin` first (the frame's script sets it from `event.origin`, which the browser fills), and use `Origin` only when that header is absent (the host-only harness), for example `request.headers['x-storage-origin'] ?? request.headers.origin`. Or move the partition logic into the frame script (the local `Map` fallback that the script already has) and keep `/__storage` only for records. Add one test that runs the frame script against a fake `window` (as the product's storage-page tests do) or in the K2 browser case.

### A-LA-E7-05-02 — MINOR — two defaults are not today's behaviour

- **Files:** `tests/sim/core/provider.mjs:325` (`items.length === 0` → `required(scenario.dlAllowCancel !== false, …)`), `:97-104` (the `deep_linking_settings` of `scenario.claims` is now merged into the computed settings).
- **Problem:** the spec says every new behaviour is "a scenario option whose default is today's behaviour".
  - Before this task, the Deep Linking return refused an empty `content_items` ("DL item count"). Now it accepts it unless a scenario sets `dlAllowCancel: false`. So a product fault that sends an empty answer outside a Cancel is no longer caught by the M1 Deep Linking rows.
  - Before, `scenario.claims[DL + 'deep_linking_settings']` replaced the computed object. Now it merges, so a test can no longer remove a member (for example `accept_multiple` or `data`) by overriding.
  - I checked the frozen users: no M1 or M2 test sends an empty answer, and the two overrides (`M1/blackboard/20-protocol.test.ts:48`, `M1/canvas/constants.ts:47`) keep their result, because `deep_link_return_url` still wins and Canvas `dlData` is `query` (no `data` member is added). So AC-01 is not at risk today.
- **Suggested fix:** make Cancel opt-in (`dlAllowCancel: true`, with the E3 cases setting it), and keep the old replace rule for `scenario.claims` with a new `dlSettings` option for merging. Or record both changes in qa.md as reviewed deviations.

## Checks that pass

| Item | Result |
| --- | --- |
| M1, M2 and self-tests unchanged by default (lens focus) | Signing keys: one key unless `secondKey` or the `jwksKeys` options. `target_link_uri`: the same unless `ungradedPlacement`. Roles: the scenario default is still Learner (`runtime.mjs`). `aud`: unchanged unless `extraAud`. Deep Linking settings: the same default members. Token, NRPS and score answers: unchanged unless the answer lists are set. Records gain only extra fields (`kid`, `status`, `memberCount`, `itemCount`, `cancelled`). The frozen M1 `deepEqual` checks on records compare filtered lists with `[]`, so extra fields do not change them. The exceptions are A-LA-E7-05-02. |
| The DR platform side cannot be confused with a real platform (lens focus) | Configuration documents and registration endpoints are served only on the simulator's `.sim.test` hosts. Issuer, endpoints and `authorization_server` overrides are test data, and the LTI service reaches only allow-listed simulator hosts. A `moodle-scope-jwt` token is verified against the simulator's own keys, with the `reg`, `reg-create` or `reg-update` scope. Opaque tokens are recorded, and they are strict when `strictOpaque` or `enforceToken` is set. The bearer token is added to the record redaction (`rememberSecret`). A registration with no scenario makes a clearly marked `auto-dr-*` scenario. |
| Throttling options (lens focus) | Score, token and memberships answers come from per-scenario lists (`persistent` keeps a token answer). `Retry-After` is sent only when the option gives it, and every record carries `status` and `retryAfter`. The `403 Rate Limit Exceeded` body is an option. There is no hidden retry or delay in the simulator. |
| Storage message checks (apart from -01) | `lti.put_data` and `lti.get_data` need a subject, a non-empty `message_id` and a key; the value must be a string; and the answer echoes the same `message_id`. The partition and the reply target are correct when the sender origin is right (see -01). |
| Scope | Only `tests/sim/**` and the qa.md e2e section change. No product file, `infra/**` file, or M1 or M2 test file is touched. |
