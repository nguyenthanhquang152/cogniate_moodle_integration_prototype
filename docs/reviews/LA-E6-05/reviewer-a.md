Verdict: APPROVE
Round: 1

# LA-E6-05 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session).
- Diff: `git diff 5b01fbd0^1 5b01fbd0` (lane K, `95227684`). It changes `kernel/ports.ts`, `kernel/extensions.ts`, `domain/connections.ts` (`setArtifactKeyKid`), `packages/channels/canvas/app/configuration.ts`, and two tests.
- References: `docs/architecture/ltiaas/tasks/LA-E6-05.md`; LA-ADR-08 D5 (BD-A2-100); data model §5a (`016_connection_health.sql:17`, `artifact_key_kid TEXT`).
- I ran these in a private clone at `5b01fbd0`. I deleted the Vitest cache before each run. No Docker.
  - `npm run test:unit`: 3263 tests pass, 5 skipped.
  - `npm run test:k0`: 145 tests pass.
  - F1 and F5 PASS; `npm run typecheck`: exit 0; ESLint on the changed folders: clean.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

| Check | Result |
| --- | --- |
| No write for a foreign connection | Holds. The mount loads the connection with `getConnection(db, <session library>, id)` and answers `404` before the route runs. `setArtifactKeyKid` adds `AND library_id = ?` to the update. The test checks that another library's connection gives `404` and keeps its stored `kid-other-library`. |
| No write for a failed answer | Holds. An `{ error }` result returns before the write, and a thrown route error never reaches it. Test: a refused export (`502`, no key) keeps the earlier `key-active`. NIT A-LA-E6-05-01 covers a success-shaped result with a non-2xx status. |
| `jwk=inline` / `jwk=url` | Inline writes the `kid` of the key that the JSON embeds (`key.kid`, the first JWKS key, the same key as `public_jwk` and `x-cogniate-key-id`). URL writes `NULL`. A route without the field (`undefined`) does not change the stored value. AC-01 and AC-02 have a unit test that fails on the old code (old code: the value stays `NULL`). |
| Canvas JSON bytes unchanged (LD-9) | `artifactKeyKid` is a sibling of `body` and `headers` in the route result. The kernel never sends it. The test compares the inline answer with the frozen export (`public_jwk` the first key, all other members equal) and the URL answer with `expectedExport()`, and checks that the body text has no `artifactKeyKid`. The headers are the existing ones. The K1-SIM golden (AC-03) is QA's. |
| Kernel port change minimal and typed | One optional member on the success branch of `ExtensionRoute.handle`, with a comment: absent = not a setup artifact, no change. One line in the mount. No new route or capability. No LMS name in core (F1 PASS). |
| Must-not-edit list | `app/connection-health.ts`, `domain/connection-events.ts` and `apps/portal/**` are not touched. The repository function sits beside the other connection writers in `domain/connections.ts`, as the Files row asks ("through the connection repository"). |

### Finding

- **A-LA-E6-05-01 (NIT): the mount writes the kid for any success-shaped result, also one with a non-2xx `status`.**
  - Where: `services/cogniate-app/src/kernel/extensions.ts:111`.
  - The kernel's failure form is `{ error }`, and the Canvas route always answers `200` in the success shape. So this is only a guard against a future route that returns, for example, `{ status: 409, body, artifactKeyKid }`.
  - Suggested fix (optional): write only when `result.status` is 2xx.

### Verdict

APPROVE for lens A. The value is written only for the session library's own connection and only after a success answer. The Canvas JSON does not change, and the port change is one typed optional field.
