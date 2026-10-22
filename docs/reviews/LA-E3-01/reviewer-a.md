Verdict: APPROVE
Round: 2

# LA-E3-01 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E3-01.md`. Design: LA-ADR-05 D1 rules 1–4 and 9; LA-ADR-02 D2 (the trait); contract delta §2.1; security delta §2, §5; BD-A1-33, BD-A1-34, BD-A2-35.

Diff: `git diff 5ec8a69^1 5ec8a69` (13 files).

Method: a throwaway `git archive 5ec8a69` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service and kernel unit tests (70 files, 852 passed) and 6 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

**Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

## Checks that pass

| Item | Result |
| --- | --- |
| No XSS or script injection (lens focus) | Request values reach the page only inside the `<script type="application/json">` block. `scriptJson` escapes `<`, `>`, `&`, U+2028 and U+2029 on the whole JSON text (BD-A2-35), so `</script>` and line separators cannot break out. The script text is a constant, and it reads the block with `JSON.parse(textContent)`. The nonce is a fresh base64url token per answer. The JSON block holds only the percent-encoded auth URL, the random state, a validated target, a validated origin, the key and a random message id. The hostile `login_hint` test (`</script><script>alert(1)</script>` and U+2028) keeps the exact auth URL after `JSON.parse` and shows no request `<` outside the block. Mutant P1 (no `<` escape) is killed. |
| `postMessage` only to O (lens focus) | `target.postMessage(…, data.origin)`. O is the origin of the platform's stored `authenticationEndpoint` (`authOrigin`) or the trait's fixed origin, and the schema accepts only a canonical `https` origin with no path. The page never posts to `*`: mutant P2 is killed. |
| Reply checks, rule 9 (lens focus) | A reply counts only from `event.origin === O`, with subject `lti.put_data.response`, the same `message_id`, and no `error` member. Anything else is ignored until the 1.5 s timer, and then the page goes to the auth URL. The listener is removed once. Mutants P3 (no origin check) and P4 (accept an `error` reply) are each killed. The tests run the real page script against a stubbed window. |
| Frame names and origins validated (lens focus) | `lti_storage_target` must match `^[A-Za-z0-9_-]{1,64}$`, else the login is the `302` (65 characters and `a b` are tested; mutant P5 is killed). A trait frame name and a trait origin are checked by the strict schema. A fixed trait frame ignores the request parameter. `_parent` targets `window.parent`; any other name targets `window.parent.frames[name]`. A numeric name could select another child frame, but the browser then drops the message, because its target origin is O. A top-level page skips the storage step, and a missing frame continues at once. |
| `302` path unchanged (lens focus) | With a `null` or absent trait, `storageTarget` is `null`, so there is no page, and the answer is today's `302` with the same `Location` and `Set-Cookie`. AC-01 compares this with the old builder under the same random values. The page and the `302` use the one `auth.href` (AC-04). The route change is one line in the login handler only (BD-A1-34). The registry turns an absent trait into `null`, and no baseline `lti-profiles.ts` changes. |
| State cookie and state row (lens focus) | The page sends the same state cookie as the `302` (AC-03). The state row stays single use: `consumeState` is the same conditional `UPDATE … RETURNING`, and it now also returns `storage_target` and `storage_origin`. A storage login writes both columns, and a `302` login writes `NULL` (AC-08). The page is `no-store` and `no-referrer`, with CSP `default-src 'none'`, so the state in the page has no path to leave except the `postMessage` to O. |
| Migration | `014_platform_storage.sql` adds two nullable columns. Old rows read `NULL` (AC-09). |
| Ownership and "Must not edit" | `lti/launch.ts`, the rest of `protocol.ts`, `packages/channels/**`, `http/app.ts`, `http/auth.ts`, `config.ts` and the app are untouched. `packages/channel-kernel/src/profiles.ts` (the trait type) is the Lead's RQ-2 (BD-A1-33). No LMS name is added to core. |

Note (no finding): the key `cog_state_<d>` gives 16 slots per tool origin (design, LA-ADR-05 D1 rule 3). Two parallel logins with the same first digit overwrite each other's stored value. The launch side (LA-E3-02) must treat a missing or other value as "no storage" and fall back to the cookie.

## Round 2

- Reviewer: Reviewer-A2 (same session as round 1). Date: 2026-10-22.
- Diff: the lane L fix commits `23a736e`, `5fecc58`, `db1038f` and `f09c3ea` (in merge `3344520`). Rulings: A2 BD-A2-41 (static page text) and BD-A2-44 (cookie priority, no fallback on the storage check).
- I ran on the host (no Docker), in a throwaway `git archive 36f70d8` copy (it contains `3344520`): the LTI service tests give 71 files and 906 passed.
- Blind review: I did not open the other reviewer's file.
- **Round 2 counts: 0 findings (round 1 had none).**

| Commit | Lens-A check |
| --- | --- |
| `23a736e` (BD-A2-41) | The login page gets the static text "Opening the activity. Please wait." and a `<noscript>` line. They hold no request data. The request values still enter only the escaped JSON block, and the CSP is unchanged. The test pins the text. |
| `5fecc58` (S1 file, RQ-2) | `buildApp` takes an optional `profileRegistry` and passes it into the protocol profile options. Product start passes none, so the discovered registry is used. No environment variable or request can set it, so it is a test and embedding seam only (the same rule as the LA-ADR-01 D4 extra root). |
| `db1038f` | `storageBindingOf` keeps the round-1 logic. No trait gives cookie-only. `from-login` reads `lti_storage_target`, or the trait gives the frame. An absent, empty or non-matching target counts as no target, through the one shared `FRAME_NAME` grammar, which the schema also uses. The origin is `authOrigin` (the stored auth endpoint origin) or the schema-checked fixed origin. The state record fields are now required (`string \| null`), so no caller can forget them. |
| `f09c3ea` (BD-A2-44) | The collision test makes a real second login whose state has the same key digit, so the storage slot is overwritten. With the matching cookie present, the launch answers `303 binding: cookie` and writes no `storage_check` row. Without the cookie, the storage check fails closed with `storage_mismatch` and no launch row, even when a cookie is added to the storage-check request (ambient credentials are ignored, security delta §6). This closes my round-1 note: the "fallback to the cookie" happens at the launch step. |
