# P4 dispatch: Author lane S2 (same Codex session), LA-E5-10 fix round 1, part 2

Worktree la-s2 (your lane; part 1 is in your branch, see your worker_done msg_601efab18c94). This finishes the same fix round (no new round).

1. Reading reviews: YES. In a fix round you may read both review files of YOUR task (docs/reviews/LA-E5-10/reviewer-a.md and reviewer-b.md); the "do not read" rule is for reviewers, not for the Author's fix round. Take the exact NIT texts from there.
2. Runbook step 7 (docs/architecture/ltiaas/operability.md) is not yours: I route it to Architect A2. Skip it.
3. Architect A2 ruled the 409 items (BD-A2-23, BD-A2-24; A2 records them in the contract delta, the LA-E5-10 spec and build-decisions-A2.md). Build exactly this in one more commit:
- Additive details on each signing-key 409 (public facts only; ISO 8601 times): SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH {kid, activatableAt} (= publishedAt + lead time); SIGNING_KEY_NEXT_EXISTS {kid, publishedAt} of the waiting key; SIGNING_KEY_WRONG_STATE {kid, keyStatus} (name keyStatus, not status); SIGNING_KEY_ACTIVE {kid}. None carries retryAfter (that adds a Retry-After header, 429 only). KeyError takes (code, {description?, details?}) and passes them to ApiErrorBase. The audit writer does not change (a refused event keeps the code only).
- BD-A2-24: "no active key" is no longer an error. POST .../signing-keys on an account with NO active key makes the new key ACTIVE at once (published_at = activated_at = now): 201 {kid, status: "active", publishedAt}; the audit event signing_key.create has details {status: "active"}. Activate of a next key when no active key exists (corrupt data only): it activates, with retired: null. SIGNING_KEY_WRONG_STATE keeps one meaning (a key-state conflict).
- AC-LA-E5-10-13 gets two rows: create on an account with no active key gives 201 active; the 409 bodies carry the details above.
- NIT B-LA-E5-10-03 text: a retire without immediate: true gives 400 INVALID_REQUEST (field immediate) with description 'retire needs {"immediate": true} (removes the key at once). A key becomes retired when the next key is activated.'
Then merge quang/ltiaas-milestone again, self-check npm run check green, and send ONE worker_done for the whole fix round with all SHAs.
