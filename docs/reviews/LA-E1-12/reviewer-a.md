Verdict: CHANGES_REQUESTED
Round: 1

# LA-E1-12 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 1 MAJOR, 0 MINOR, 1 NIT.**

Reviewed K commits `3979743`, `4eaba01`, `eb7b717`, `b216f86`, the empty E1 marker `7cbb898`, and P commits `0bdbf4f`, `8e061ce`, `19678a6`. References: the task spec, README §4, LA-ADR-01 D10/D12, LA-ADR-04 D8 LA-IC-20, BD-A1-63..65/-73 and plan §6.1. Tests ran in private clone `/tmp/la-reviewer-a-ctx-6fcaeeac30dc`, pinned to E1-done `b216f8658a22d28943e502804a615bb0f42543e7`. No Docker, stack or stack-starting runner ran; no commit was made; no other reviewer's file was opened.

### Findings

**A-LA-E1-12-01 (MAJOR): the default wizard and Moodle manual form bypass the new channel error texts.**

- Where: `apps/portal/src/channels/ManifestWizard.tsx:141,152`, `packages/channels/moodle/portal/ManualSetup.tsx:150`; the new context is set at `apps/portal/src/connect/Connect.tsx:63`, but these consumers still call plain `ErrorNotice`.
- Problem: `ChannelScope` only helps consumers of `ProviderErrorNotice`. A channel without a custom wizard never reads its new `texts.errors`, and Moodle's manual binding form never takes the generic fallback. Both render the raw server description. This leaves BD-A1-63 and LA-IC-20 incomplete, including the explicitly named Moodle `PLATFORM_IN_USE` case; an added channel needs a custom UI or a core edit to use the new manifest field.
- Evidence: three private route probes fail by assertion on `b216f86`. On `/integrations/shell-canary/con_shell`, submit the default wizard's Deployment ID and approval code and return HTTP 409 with `details.message = PLATFORM_IN_USE` and the actual frozen app default description, `This Moodle tool is already registered with Cogniate.` The alert displays that sentence both when the channel defines `texts.errors.PLATFORM_IN_USE = "This {LMS} key is in use."` and when it has no override; it should display the filled own text or `This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library.` The same 409 after submitting all six valid platform fields on `/integrations/moodle/con_shell` also displays the frozen sentence instead of the generic fallback.
- The existing new route tests cover only Canvas and Blackboard custom wizards; the new helper tests bypass the default wizard and Moodle form. In the private clone, routing these three `ErrorNotice` call sites through `ProviderErrorNotice` makes all three probes pass, together with the shell and provider-helper suites (**47/47**). That experimental edit was restored.
- Suggested fix: use the channel-aware error selection at provider-refusal call sites in `ManifestWizard`, `ManifestBinding` and Moodle manual setup; check the other wizard callers too. Keep the server's frozen error defaults unchanged. Add route tests for an added channel with an own text, an added channel without one, and Moodle's manual refusal, so the test exercises the actual consumer rather than only the helper.

**A-LA-E1-12-02 (NIT): the scope metadata still advertises the removed generated-infra exception.**

- Where: `packages/channel-kernel/fitness-scope.json:28` (`classes.sharedBuild.except`).
- Evidence: it says `files under infra/** that the simulator host manifest generates`, while README §4 and BD-A1-73 require every tracked infra path to be core. The F2 implementation does not consume this property: an `infra/.certs/host-manifest-probe.crt` path fails with `core = 1`. Thus this is stale metadata, not a gate bypass; the operational D10 core-exception list is correct.
- Suggested fix: remove this obsolete property as BD-A1-73 already requests. Keep generated outputs git-ignored.

### Fitness and compatibility checks

| Check | Result |
| --- | --- |
| F1 / AC-01 | All **35** baseline entries are zero. `npm run fitness:lms-names -- --all` reports **0 files with hits, 0 hits**. The root `check` script invokes it. Negative probes in operator, portal, former config exception, a new core file and a new migration all fail; only the allowed frozen-wire file is skipped. No scanner, applied-migration list or new exception was added by the reviewed commits. The removed literals became registry/manifest values or imports from the existing frozen-wire file, not encoded strings or renamed hiding places. |
| Scope / AC-02 | `legacy-wire.ts` and the applied-migration rules remain the closed exceptions; `config.ts` is checked. The stale shared-build description is finding -02. |
| Canary / AC-03 | **121/121 K0 tests pass**, including product-only discovery, the extra canary root, channel contracts and the broken-canary negative control. F2 classifies the eight tracked canary paths as tests, with `core = 0`. |
| F3 / F5 / AC-04 | `npm run lint` exits 0; the full `fitness:rules` run reports **6 rules, 0 hits**. |
| E1 marker / F2 / AC-05 | `7cbb898` names the full `b216f86` E1-done SHA. `--base b216f86 --channel zz-probe` on the pinned clean tree gives `core = 0`. Channel-only path lists pass; another channel, tracked infra, a frozen-wire file, a migration and a core-to-channel rename fail. A real staged `git diff --cached --name-status --no-renames b216f86` adding only `packages/channels/zz-probe/manifest.ts` also passes via `--paths-from` with `core = 0, paths = 1`. No synthetic branch commit was created, in keeping with the no-commit instruction. |
| Frozen bytes | Four private probes compare the new helper directly with the pre-`8e061ce` source: all seven own baseline text mappings and all neutral code/site-rule mappings stay equal; missing mappings use the intended generic text. React renders markup and placeholder-like characters in the manifest name literally. The route integration gap is -01. `PUBLICATION_OPTION`, capability fields and publication fields retain the original names/types; operator refusal and redemption tests pin the baseline messages. |
| Register fill | `b216f86` inserts each value once and keeps the frozen pending-tool sentence. Restoring its parent implementation fails the two new placeholder-collision assertions. |
| Ownership | The P/K/R cross-lane edits are the dispatched RQ-2 changes. No frozen test or applied migration is edited, no second frozen-wire exception is added, and the authority, lease and tenant checks in the reviewed refactors stay unchanged. |

### Verification

- Focused kernel, portal, baseline channel UI, operator text, redemption, results and registration suites: **348/348 tests in 19 files**; operator policy/audit suites: **42/42** more.
- App and portal type checks pass. Fitness unit tests: **70/70**; K0: **121/121**.
- Private checks: **15 F1/F2 CLI probes**, **4 historical-text/escaping probes**; **3 failing route probes** that establish finding -01.
- Five mutants are detected: hard-coded operator channel list, missing route scope, always-generic provider text, open error-text keys, and the earlier register replacement. After restoring the product files, the five affected public suites pass (**63/63**) and F1 returns to zero. The private clone's tracked and untracked state is clean; probe source is saved separately at `/tmp/la-reviewer-a-ctx-6fcaeeac30dc-probes`.

This review ran the focused gates above, not the complete `npm run check` chain or live M1/M2/golden capture. The B2 wave-end regressions remain with QA; the LA-IC-20 list needs its normal LD-9 review. Only this review file was created in the integration worktree.
