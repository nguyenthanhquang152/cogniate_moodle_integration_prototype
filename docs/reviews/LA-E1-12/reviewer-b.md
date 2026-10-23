Verdict: APPROVE
Round: 2

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it? Reviewed `3979743`, `4eaba01`, `eb7b717`, `b216f86`, `7cbb898`, `0bdbf4f`, `8e061ce` and `19678a6` against the task, README §4, LA-ADR-01 D2/D10/D12, BD-A1-63..65/-69/-73 and plan §6.1. Source and test verification used the declared E1-done snapshot `b216f8658a22d28943e502804a615bb0f42543e7` in a private clone. The other reviewer's file was not read.

No BLOCKER or MAJOR finding. One MINOR documentation cleanup remains.

### B-LA-E1-12-01 — MINOR — Remove the obsolete infrastructure exception from the scope data

- **File:** `packages/channel-kernel/fitness-scope.json:28`.
- **Problem:** `sharedBuild.except` still says that generated files under `infra/**` are exempt. The authoritative README §4 says every **tracked** infrastructure file is core for F2; generated outputs are git-ignored. A new channel team reading the machine-readable scope can wrongly expect an infrastructure edit to pass. This is the remaining metadata mismatch in AC-02, already identified by BD-A1-73.
- **Evidence:** the field is present at E1-done and at integration `1babba9`. F2 does not read it: a path-list probe containing the new channel file and `infra/scripts/probe.mjs` correctly exits 1 with `core = 1`. There is no gate bypass.
- **Suggested fix:** lane K removes `sharedBuild.except`, as BD-A1-73 directs. Keep the `infra/**` glob and the current F2 behavior. No new runtime test is needed.

### Ownership and usability

The implementation has clear ownership boundaries. The kernel defines the five error keys and validates their nonempty values with `{LMS}` as the only placeholder. Each channel supplies its own text; `provider-errors.tsx` holds the generic defaults and code-to-key mapping. `Connect` sets the channel scope once, and the SDK explains how an isolated module supplies that scope. Invalid text errors identify `texts.errors.<key>` and the placeholder rule. The registration text map remains separate, with its own defaults and no-context rule; its later DR consumers belong to E2.

The architecture and task notes identify both maps and the F1/F2 commands. The full newcomer walkthrough remains LA-E8-01/02; this review does not claim that walkthrough has run. A scratch `zz-probe` manifest with both error and registration overrides passed the schema and F1 without a core edit.

Operator names come from three small registry queries: grant authority, multiple-deployment capability and service-URL support. Connection-specific messages use the connection's text name. The added tests preserve the baseline sentences and demonstrate a new grant channel joining the list in registry order. Frozen publication names are imported from the kernel; the Results change removes an implicit default without changing the known-publication behavior.

The K-to-P kernel edits and the R variable rename are the explicitly authorized RQ-2 changes; baseline reductions follow RQ-3. The named commits edit no QA-owned `tests/**` files. No new LMS-name exception or hard-coded channel selection was added. The portal fallback changes follow LA-IC-20/BD-A1-69; approval of its LD-9 scan list is a separate review.

### Verification

| Check | Result |
| --- | --- |
| AC-01 | All 35 baseline entries are zero; full F1 reports 0 files/0 hits. The pre-`3979743` operator source fails the current ratchet with 12 hits and actionable locations. |
| AC-02 | The core exception list contains only the frozen-wire file and migration paths; the earlier config exception is gone. The obsolete infrastructure metadata is the MINOR finding above. |
| AC-03 | All 121 K0 tests pass, including both second-root canaries, product-root isolation and the broken-canary negative control. F2 classifies all eight canary paths with `core = 0`. |
| AC-04 | Full repository lint/F3 and `npm run typecheck` pass. Full F5 passes all six rules with 0 hits. |
| AC-05 | `7cbb898` explicitly records the E1-done SHA. A staged add-only diff from that SHA, passed to F2 via `--paths-from`, reports one `channel:zz-probe` path and `core = 0`; adding a core, other-channel or infrastructure path fails with `core = 1`. No scratch commit was made, so this is path-list verification, not a new committed-branch run of `--base`. |

The focused unit run passed **343 tests in 18 files** (kernel, affected app areas, portal and channel portal modules); the fitness test run passed **52 tests**. Old-source controls failed for the intended behavior: old operator plus its matching helper, **1 test**; old provider error mapper, **8 tests**; old register text filler, **2 tests**. The last control and the passing `A<tool>B` page/stored-error checks close **B-LA-E1-09-02**. Results tests are compatibility checks; the zero F1 ratchet and required TypeScript prop enforce removal of the old default.

All mutations were restored in the private clone. No Docker, stack, full wave-end regression, commit or push was run. QA retains the R1/R2 wave-end gate.

## Round 2

Verdict: **APPROVE — 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT this round.** Same Reviewer-B lens, Codex GPT-6-Astra xhigh. Reviewed `70b41f4` and `bd988df` in merge `ac1c339`, using the private `bd32e05` clone. No other reviewer's file was read; no Docker or stack was run.

- **B-LA-E1-12-01 closed.** `sharedBuild.except` is removed, while `infra/**` remains core. Independent F2 path-list checks accept a new-channel-only path (`core = 0`) and reject that path plus `infra/.certs/probe.crt` (`core = 1`). The obsolete metadata is gone; the gate behavior remains correct.
- **The dispatched portal-text follow-up is fixed.** `channelErrorText` selects only the five manifest error keys. `ChannelErrorNotice` changes their description while retaining the server action, code, trace and details, and passes all other errors through unchanged. The default wizard, default binding form and both Moodle create/manual forms use the helper. `ProviderErrorNotice` keeps its broader existing behavior. The SDK comments explain which notice to use, and both reuse the same mapping and context source.
- The new route tests cover a data-only channel with its own text, one using the generic fallback, Moodle's manual refusal and its approval form. They also preserve the server's `INVALID_PLATFORM_VALUES` text. In the private clone, disabling replacement caused **5 failures**, and using the broader provider replacement caused **4 failures**, across the shell and helper tests. This proves both the missing-text fix and the limit on its behavior change. All mutations were restored.
- Shared verification for this dispatch: **1,316 tests in 100 files passed**, including all affected portal tests, plus root type checking, ESLint on the 30 changed TypeScript files, F1 (0 hits) and F5 (six rules, 0 hits). This focused follow-up does not repeat the full E1-done K0/add-channel exercise or QA's wave-end regression.
- The scope-data edit is the explicit K-to-P RQ-2 commit. The portal SDK, shell and baseline channel portal files belong to P under matrix §5. No QA-owned frozen test, server error default or core LMS-name exception was changed. The only new visible replacement is within LA-IC-20's five keys.
