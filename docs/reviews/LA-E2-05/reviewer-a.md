Verdict: APPROVE
Round: 1

# LA-E2-05 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `a3d9434` (merge `71f4ced`) against the task spec, LA-ADR-02 D1/D2a/D4/D6/D8, app API delta §3.3, BD-A1-78/-80/-85/-94/-95, BD-A2-84 and plan §6.1. Tests ran in private clone `/tmp/la-reviewer-a-ctx-2b78b5ca35f1`, pinned at `71f4ced`.

### Findings

None.

### Acceptance and safety checks

- **F2 / AC-01:** `fitness:channel-diff --base 678eb72 --channel brightspace` passes with **core = 0**. At the merge commit the report has **6 paths: 4 channel files and 2 allowed documentation files**. The dispatched author commit itself adds only `manifest.ts`, `lti-profiles.ts`, `README.md` and `channel.test.ts` under `packages/channels/brightspace`. No other product path, frozen acceptance file or applied migration changes.
- **UNIT AC-02:** the tests pin all four D2L defaults, issuer default, admin/per-tenant/any-HTTPS profile traits, stored audience, exclusive sharing and allowlist privacy. The loaded profile adds no fixed issuer or reserved-host exception. Changing the audience trait to the token endpoint fails both the public profile test and the private signed-assertion test; changing the authentication default fails the public constant test and app/portal probes.
- **Defaults and grants:** the actual Brightspace parser fills the declared defaults. Invalid posted values and invalid filled defaults are refused. A private app-route probe confirms that the real defaults require foreign-host confirmation, an audience different from the grant is refused with `422 GRANT_MISMATCH`, and equal values redeem. The real portal manual form prefills and submits those same values successfully through the strict parser. The manifest contains vendor constants and context placeholders, with no credential or tenant-specific value.
- **Issuer, endpoint and audience boundaries:** private tests use the loaded Brightspace profile through the real LTI platform route. Reserved endpoint/audience hosts (including capitals and a port), private-IP and own-service hosts are refused in active and staged modes; a reserved issuer and a non-HTTPS audience are also refused. The off-origin D2L values cannot create an active self-bound platform; an inactive create with a binding reference retains the distinct audience. A token-client probe checks the signed JWT: `aud` is the stored audience as a string, with the token URL used only when no audience is stored. BD-A2-84 remains enforced.
- **Channel data / AC-03/-05/-06/-09:** K0 passes with the new channel. The four AGS scopes, capability data and registration guard match the design. Private checks confirm the actual `desire2learn` guard refuses a standard-profile launch and new generic registration, logs an existing generic launch, and permits the named channel. The app configuration route returns the nine D2L rows in order with the kernel URLs and context filled; the manifest writes no protocol paths.
- **Sources / AC-08:** the README records the D4 facts with source/status notes, marks the family and frame name UNVERIFIED, and makes no live-test claim. No app or portal module was added. The manifest retains the authorized BD-A1-85 interim `toolConfiguration: 'none'`: the row endpoint works, but portal row display still awaits the K-ADAPTER update and subsequent `channel` setting. This is tracked companion work, not evidence of K2 completion.

### Verification

- Focused public channel, app, LTI profile/route, token-client, family-guard and portal suites: **164/164 tests in 10 files**.
- Private Brightspace probes: **7/7**. After both negative controls were restored, the five affected public/private files pass **12/12**.
- K0: **149/149**. Node and portal channel typechecks and full lint pass. F1: **0 hits**. F5: **6 rules, 0 hits**. F2: **core = 0**.

Probe sources are saved at `/tmp/la-reviewer-a-ctx-2b78b5ca35f1-probes`; test logs use the same prefix in `/tmp`. The private clone is clean. No Docker, stack, stack-starting runner or commit was used; no other reviewer's file was opened; only this review file was written in the integration worktree. K1-SIM, K2, R1 and live D2L confirmation remain QA gates. This verdict covers the channel-folder diff and does not close findings assigned to its core dependencies.
