Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed `a390edb` at merge `dc98c43` against LA-E3-07, LA-ADR-05 D4, LA-ADR-04 D8/LA-IC-04 and plan §6.1. Lens: do the Moodle setup rows and Canvas JSON give an administrator the right instructions? **No findings.** Blind review; no other reviewer's report opened.

The three baseline manifests now ask for exactly the four AGS scopes in the specified order. Canvas uses its manifest list for both `jwk=url` and `jwk=inline`, so maintainers have one source for its requested scopes. Moodle row 13 says **“Do not use this service”** and keeps its label and position. Private before/after checks confirmed that the other 15 Moodle rows and all other Canvas response fields stay equal. This matches the intended LA-IC-04 change; the live Moodle option label still needs QA confirmation.

The unchanged `tool-pages/register.ts:139` forwards the channel's scope capability to `completeRegistration`; the client already accepts that field. The updated connection-flow test checks the actual captured complete-call body against a literal four-scope list. The Canvas export test also keeps a literal expected document, rather than deriving its expected scopes only from the production manifest.

Verification used a fresh private `git clone --no-hardlinks` at the merge SHA, its own `npm ci`, and a cleared Vitest cache before each run:

- **87 tests in five files passed:** channel configuration, Moodle adapter, pinned Canvas export, connection flow and registry tests. Typecheck, full ESLint, F1 and F5 passed.
- **Five private checks passed:** the app and LTI registries expose the four scopes for all three baseline channels; only Moodle row 13 changes; only Canvas scopes change in each key format.
- Restoring the five old production files caused **ten intended assertion failures**, covering scope values, row 13 and the captured registration request. After restoring the fix and removing the private probes, all **87 tests passed** again. Logs: `/tmp/reviewer-b-e307-{focused,output-parity,old-behavior,restored}.log`.

There are no UNIT-labelled ACs in this task; these author tests and private checks support the separately owned K0, K1-SIM and MOODLE-LIVE criteria. No frozen QA assertion was edited. The production diff stays within lane K's scope: the Canvas JSON is in `app/configuration.ts` after LA-E1-08, as the dispatch clarifies. No LTI service, profile, portal or core LMS branch changed.

No Docker, stack or stack-starting runner was used. The private clone was restored, checked clean and removed. Only this report changed in integration; no commit was made. **Still pending with QA:** the LD-9 LA-IC-04 test-change list and its review, frozen golden/regression updates, and the required K0/SIM/live evidence. This approval covers the implementation, not that unwritten list or those gates.
