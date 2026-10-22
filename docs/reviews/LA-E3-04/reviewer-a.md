Verdict: APPROVE
Round: 1

# LA-E3-04 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E3-04.md`. Design: LA-ADR-05 D3a (service), D3c (service), D3d; contract delta §4.1, §4.2; LA-ADR-04 D8 LA-IC-12.

Diff: `git diff 3344520^1 3344520 -- services/lti-service/src/lti/deep-linking.ts services/lti-service/src/lti/idtoken.ts` and their tests, plus `services/lti-service/src/http/routes/compat.test.ts`.

Method: a throwaway `git archive 36f70d8` copy under `/private/tmp` (it contains `3344520`, and these two files do not change between the two commits), with a clone of the integration `node_modules`. I ran the LTI service tests (71 files, 906 passed) and 4 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

**Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

## Checks that pass

| Item | Result |
| --- | --- |
| Signed JWT on every route (lens focus) | `checkContentItems` is the one check for `POST /api/deeplinking`, `/message` and `/form`, and all three sign through the existing `deepLinkingResponse` and `signToolJwt` path. The new compat test verifies the JWT of each route against the account's published JWKS (issuer = the client id, audience = the platform issuer). For an empty list, `content_items` is `[]` and the `data` claim is echoed, with `accept_multiple` `true` and `false`. No outbound call is made (`calls` stays empty). |
| No unsigned or forged content path (lens focus) | Nothing new builds a response outside `checkContentItems` and the signer. A non-list (`null`, an object) is still `400 INVALID_CONTENT_ITEM`. The old compat case that used `[]` as the bad input now uses `null`, as LA-IC-12 asks. |
| A refused line item never writes (lens focus) | With `accept_lineitem === false`, an item with `lineItem` throws `400 INVALID_CONTENT_ITEM` ("the platform does not accept line items") before anything is signed. The service never creates line items itself (the platform does that from the signed response), so a refusal leaves no state. The same item without `lineItem` signs with no change on all three routes. An absent `accept_lineitem` or `true` keeps today's behaviour. |
| Bounds (AC-03) | 0 to 20 items; with `accept_multiple: false`, 0 or 1 (2 is refused); 21 is refused for `undefined`, `true` and `false`. |
| Shaped token (AC-05, AC-06) | `acceptLineItem` and `acceptMediaTypes` go through `compact`, so they appear only when the platform sends them, with exactly its values (`true`, `false`, the media type string). The whole-object check of a launch without them is unchanged. |
| Mutants | D1 (empty list refused) fails 4 tests; D2 (no line-item guard) 2; D3 (no `accept_multiple` bound) 1; D4 (no shaped members) 2. |
| Ownership | Only `deep-linking.ts`, `idtoken.ts` and tests change. `launch.ts`, `login.ts`, `http/app.ts`, `http/auth.ts` and the app are untouched. |
