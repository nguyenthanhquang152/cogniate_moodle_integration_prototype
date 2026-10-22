Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-01 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: commit `2c1b1e0` (from `la-qa` `2806140`): `tests/ltiaas/k0/contract.test.ts` and `tests/ltiaas/canary/{zz-canary,zz-canary-admin}/**`. The kit files at `HEAD` are the same.
- References: `docs/architecture/ltiaas/tasks/LA-E7-01.md`; TEST-STRATEGY §1.2 and §2.7; LA-ADR-01 D3 (capability catalog and guard column), D4 (extra root) and D5 (`ConnectionSetup` port sketch); the lead QA's proof `docs/reviews/LA-E7-01/qa.md`.
- I ran on the host (no Docker):
  - `vitest run --config tests/ltiaas/k0/vitest.config.mts tests/ltiaas/k0/contract.test.ts`: 67 of 67 pass.
  - One scratch Vitest file outside the repo, to check that an empty `describe.each` table passes. It does.
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 1 MAJOR, 2 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Discovery (AC-02) | Correct for added channels. Product and canary channels come from `loadChannelFolders` and `buildChannelRegistry` at collection time, and `describe.each` makes one suite per channel. A broken channel makes `buildChannelRegistry` throw at the top level, so the whole K0 file fails (a loud failure). Gap for a missing product set: A-LA-E7-01-03. |
| Legacy projection (AC-03) | Good oracle. `K-LEGACY` recomputes the six flags from the capabilities, independently of `legacyProjection`, and compares the baseline channels with hard-coded M1 objects. A wrong projection or a wrong capability value of a baseline channel fails. It checks only the default profile of `registration[0]`. |
| Canary isolation (AC-05) | Correct. The one-root product registry does not list `zz-canary` or `zz-canary-admin`. The two-root registry lists both, and only `zz-canary` has `app.ts`. |
| Negative control (AC-06) | It fails for real: if the kernel accepted the broken copy, `caught` would be `undefined`, and `toBeInstanceOf(RegistryError)` would fail. It writes a copy with `names.label: ""` to a temporary root and checks `channel`, `check: 1` and `names.label` in the error. It proves the kernel check that makes K0 fail at collection, not a K0 run itself (A-LA-E7-01-05). |
| Product source use | The kit imports the allowed entry points (`@cogniate/channel-kernel`, `services/lti-service/src/profiles/index.ts`) and reads `services/cogniate-app/src/kernel/ports.ts` only for existence. Two `existsSync` switches can turn checks off silently: A-LA-E7-01-03. |
| Scope and ownership | Only `tests/ltiaas/k0/**`, `tests/ltiaas/canary/**` and QA documents change. No product file. |

## Findings

- **A-LA-E7-01-01 (BLOCKER): the K-CAP guard cases compare the kit's own table with itself, and three rows of that table contradict LA-ADR-01 D3. So the AC-04 PASS is a false pass.**
  - Where: `tests/ltiaas/k0/contract.test.ts:149-253` (`CAPABILITY_GUARD_TABLE`) and `:461-486` (the guard case).
  - Problem:
    - AC-04 needs, for each false or absent guarded capability, "the documented status, code and `details.capability`".
    - The case builds `guardContract` from the row's own `status`, `code` and `detailsCapability`, then checks it against the same row (`:475-484`). That check can never fail, and no product code runs. So a channel or an app route with a wrong guard passes.
    - The rows themselves are not the documented ones:
      - `registration.dynamic`: the kit expects `409 DYNAMIC_REGISTRATION_NOT_SUPPORTED`. D3 (LA-ADR-01 line 149) says `POST /app-api/connections` with `method: dynamic` → `422 CAPABILITY_NOT_SUPPORTED` ("unchanged codes"). The product does that (`services/cogniate-app/src/app/connections.ts:207`, `details.capability: 'dynamicRegistration'`). The code `DYNAMIC_REGISTRATION_NOT_SUPPORTED` exists nowhere in product or design.
      - `export.packages.mbz` and `export.packages.common-cartridge-1.3`: the kit expects `409 CAPABILITY_NOT_SUPPORTED`. D3's guard is behaviour ("the exporter route of another channel's exporter is not shown"), not an error answer.
      - `content.ungraded`: the kit expects `400 PLACEMENT_NOT_GRADED` with `details.capability`. D3's guard is "ungraded placement is not offered". `PLACEMENT_NOT_GRADED` is a picker page code (LA-ADR-05 AP-05-18), not an API body with `details.capability`.
    - qa.md says that each case "verif[ies] status …, error code … and `details.capability`", which no case does. A later K1 or kit step that reuses this table would push the product toward an undocumented code (D3 says the codes do not change).
  - Evidence: the code lines above; `git grep DYNAMIC_REGISTRATION_NOT_SUPPORTED -- services packages docs/architecture` gives no hit.
  - Suggested fix:
    - Copy the rows from D3 exactly: `registration.dynamic` → `422 CAPABILITY_NOT_SUPPORTED`, `details.capability: dynamicRegistration`.
    - Mark the behaviour guards (`export.packages`, `content.ungraded`, `content.multiple`, `launch.*`) as `kind: 'behaviour'` with their D3 text, not as fake error codes.
    - Add `site.serviceOrigin` (`400 INVALID_REQUEST`, D3).
    - In K0, assert only what K0 can prove: that the capability is false, and that the row matches the D3 table (for example a frozen copy with its source line). Put the status-and-code check where a route runs: a K1 case per row, or the E7 kit.
    - Correct the AC-04 row of qa.md.
- **A-LA-E7-01-02 (MAJOR): K-ADAPTER and the canary `app.ts` use a port shape that is not the D5 `ConnectionSetup`, and K-ADAPTER skips every method it does not find.**
  - Where: `tests/ltiaas/k0/contract.test.ts:568-658` (calls `toolConfiguration(input).rows`, `stageCreate(body, ctx)`, `bindingTarget(body, staged, ctx)`, each only `if (typeof … === 'function')`, `:603`, `:619`, `:629`); `tests/ltiaas/canary/zz-canary/app.ts` (the same three methods).
  - Problem:
    - LA-ADR-01 D5 (lines 250-265) defines `checkCreate`, `toolConfiguration(ctx): ToolRow[]` (an array, not `{rows}`), `parseBindingBody` (returns `{ ok: false, fields }`, does not throw), `selfCreate?`, `initialTarget?` and `createRequest?`.
    - So the canary passes the kit's own invented contract, not the port. The AC-07 "PASS on `zz-canary`" in qa.md proves nothing about the ports.
    - qa.md also says K-ADAPTER "automatically requires and tests" the baseline `app.ts` files once LA-E1-07 lands. With D5 adapters:
      - `toolConfiguration(...).rows` is `undefined` (a false failure).
      - `stageCreate` and `bindingTarget` do not exist, so the strict-body, binding-target and staged-create checks are skipped, and the case passes (a false pass).
    - The throwing `db` and `lti` stubs then never meet the methods that matter.
  - Suggested fix:
    - Write K-ADAPTER against the D5 names and return shapes.
    - Make the required methods required: `checkCreate`, `toolConfiguration` and `parseBindingBody`. Add `selfCreate` when a registration entry has authority `self` and typed values, and `initialTarget` plus `createRequest` when it has `operatorGrant`. A missing required method fails the case.
    - Use `{ ok: false }` (not "throws") as the strict-body refusal.
    - Make the canary `app.ts` implement D5. When LA-E1-07 lands, align it with the real `kernel/ports.ts` types (a type-only import is enough).
- **A-LA-E7-01-03 (MINOR): three paths make K0 pass with checks silently missing.**
  - Where: `contract.test.ts:307-309` (`ltiProfilesMod` is `null` when `services/lti-service/src/profiles/index.ts` does not exist), `:518` (all profile checks inside `if (ltiProfilesMod && profileReg)`), `:577-586` (the adapter requirement only `if (portsExist …)`), and `:328` with `:661` (product rows from the registry, no expected set).
  - Problem:
    - LA-E1-05 has landed. If the profile module is moved or renamed, K-PROFILE keeps only the manifest checks and passes. After LA-E1-07, the same happens for the adapter checks if `kernel/ports.ts` moves.
    - If product discovery returns no channel (a wrong root, or a loader change), `describe.each([])` makes no product case, and the file still passes on the canary and isolation cases. I checked this Vitest behaviour with a scratch file: an empty `describe.each` table gives `1 passed`, with no warning.
  - Suggested fix:
    - Import the profile module without a switch (it is a landed entry point).
    - Keep one explicit pending switch for `ports.ts`: `it.todo` until LA-E1-07, then a hard requirement.
    - Assert that the product channel ids equal the folder list of `packages/channels/` and include `moodle`, `canvas` and `blackboard`.
- **A-LA-E7-01-04 (MINOR): K-PROFILE covers only part of TEST-STRATEGY §2.7.**
  - Where: `contract.test.ts:488-566`.
  - Problem: §2.7 lists "fixed hosts, template fill, site rules 1–6, traits, reserved issuer, simulation gate". The case checks ownership, `wireLms`, the simulation gate and that the templates fill to https URLs. There is no site-rule case (the file has no `siteRules`, `reservedIssuer` or site-rule check), no reserved-issuer case and no trait check. So a profile with a wrong site rule or an issuer that should be reserved passes K0.
  - Suggested fix: through the profile registry API (`profiles/index.ts`), add per profile one accepted and one refused site URL for each site rule that the profile's traits enable, one reserved-issuer case, and the trait values against the manifest's declared sharing and endpoints.
- **A-LA-E7-01-05 (NIT): the negative control proves the kernel check, not a failing K0 run. Also, qa.md has one count error.**
  - Where: `contract.test.ts:697-744`; `docs/reviews/LA-E7-01/qa.md` (per-channel table, `blackboard` row).
  - Problem:
    - AC-06 says "makes K0 fail and name the canary and the field". The case shows that `buildChannelRegistry` throws the right `RegistryError`. That K0 then fails follows only from the top-level call.
    - In qa.md, the `blackboard` row says "8" guard cases but lists nine (the total 14 needs nine).
  - Suggested fix: optionally run the K0 config once in a child process, with an extra root that holds the broken copy, and assert a non-zero exit and the channel and field in the output. Correct the count in qa.md.

## Notes (no finding)

- `K-LEGACY` and `K-CAP.catalog` use the capabilities of the default profile of `registration[0]` only. A channel whose second registration entry or another profile changes a capability is not checked for that profile. This is enough for the baseline, but worth one more loop when E2 adds profiles.
- The canary `app.ts` keeps to its stated rule (pure functions, fixed data). Once it implements D5 (A-LA-E7-01-02), it becomes a real F4 proof that a new channel needs no kernel edit.
