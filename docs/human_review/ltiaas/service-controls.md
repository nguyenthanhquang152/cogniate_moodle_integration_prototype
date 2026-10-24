# LA service controls: proof map

2026-10-24. `a8bbac53` is the SHA of the first final runs; the new final product SHA is `4f10c5fd` (pending: re-gate on 4f10c5fd (LD-29)). The task results on this page stay valid as task evidence (LD-29). Back to [start-here.md](start-here.md) or [index.html](index.html).

This page maps each service-control claim of the review pack to the QA report that proves it. The AC numbers come from the summary table at the top of each QA report. Each report has the verdict PASS.

Labels:

- **SIM**: QA ran the check on a simulator stack (`K1-SIM` in the QA reports).
- **UNIT**: a unit test or a host contract test (`UNIT` or `K0` in the QA reports).
- **U1 route**: a SIM check that upgrades a stack of an older build to the candidate build. Each QA report names both builds: LA-E5-08 starts from the intake build `1b17261`; LA-E5-22 starts from `48bc1c9e`, the build before the app key ring.
- **MOODLE-LIVE**: the frozen Moodle suites on the local Moodle 5.2 site.

No row is a result on a real school LMS site.

| Claim | Task | QA report | SIM | UNIT | Other |
| --- | --- | --- | --- | --- | --- |
| **Rate limits:** a hard bucket gives `429 RATE_LIMITED` with `Retry-After`; the account classes only log; `/healthz` is not limited | LA-E5-03 | [qa](../../reviews/LA-E5-03/qa.md) | AC-01 to AC-09, AC-11, AC-12 | AC-10, AC-13 | — |
| **Platform throttling:** an LMS `429` gives `429 PLATFORM_RATE_LIMITED`; the record outbox waits | LA-E5-14; the outbox wait: LA-E4-03 | [qa](../../reviews/LA-E5-14/qa.md); [qa](../../reviews/LA-E4-03/qa.md) | LA-E5-14: AC-01 to AC-05; LA-E4-03: AC-03 (`[SIM E4-03-03]`: the row stays pending with its tries unchanged, and the next send waits) | LA-E5-14: AC-01 to AC-03, AC-05, AC-06 | — |
| **Tool accounts:** account status, tool URLs, account resolver | LA-E5-04 | [qa](../../reviews/LA-E5-04/qa.md) | AC-01 to AC-09 | AC-10 to AC-12 | — |
| **Tool accounts on the LTI pages:** resolver, status pages, session cap | LA-E5-06 | [qa](../../reviews/LA-E5-06/qa.md) | AC-01 to AC-07, AC-10 | AC-01 to AC-10 | — |
| **Isolation:** one tool account cannot read or change the data of another one on the new routes | LA-E5-13 | [qa](../../reviews/LA-E5-13/qa.md) | AC-01 to AC-03, AC-05 | AC-06 (static) | MOODLE-LIVE: AC-06 (the 6 frozen isolation checks) |
| **Operator API:** its own listener, operator keys, `lti:operator init` | LA-E5-01 | [qa](../../reviews/LA-E5-01/qa.md) | AC-01 to AC-10 | AC-11 | — |
| **Operator API:** the LTI CLIs call the operator API | LA-E5-05 | [qa](../../reviews/LA-E5-05/qa.md) | AC-01 to AC-08 | — | — |
| **Audit log (LTI service):** append-only, one event per request, operator read | LA-E5-02 | [qa](../../reviews/LA-E5-02/qa.md) | AC-01 to AC-06, AC-08, AC-10 | AC-07, AC-09 | — |
| **Audit log (app):** app audit writer, operator policy, `app:audit list` | LA-E5-11 | [qa](../../reviews/LA-E5-11/qa.md) | AC-08 | AC-01 to AC-07 | — |
| **Audit log (app):** `--operator`, evidence flags and audit events of the app CLIs | LA-E5-12 | [qa](../../reviews/LA-E5-12/qa.md) | AC-01 to AC-07 | AC-01 to AC-08 | — |
| **Key lifecycle: API keys:** scopes, two active keys, expiry, revoke | LA-E5-07 | [qa](../../reviews/LA-E5-07/qa.md) | AC-01 to AC-05, AC-07, AC-08, AC-11, AC-12 | AC-06, AC-09, AC-10, AC-12 (unit part), AC-13 | — |
| **Key lifecycle: key ring:** versioned envelopes for the LTI service master keys | LA-E5-08 | [qa](../../reviews/LA-E5-08/qa.md) | AC-01, AC-02 (on the U1 route from `1b17261`) | AC-03 to AC-09 | — |
| **Key lifecycle: key ring status and re-wrap:** status, re-wrap job, legacy refusal | LA-E5-09 | [qa](../../reviews/LA-E5-09/qa.md) | AC-01 to AC-05 | AC-06 to AC-08 | — |
| **Key lifecycle: app key ring** (`APP_MASTER_KEY`) | LA-E5-22 | [qa](../../reviews/LA-E5-22/qa.md) | AC-01 (on the U1 route from `48bc1c9e`) | AC-02 to AC-05 | MOODLE-LIVE: AC-06 |
| **Key lifecycle: signing keys:** states `next`, `active`, `retired`; JWKS; rotation | LA-E5-10 | [qa](../../reviews/LA-E5-10/qa.md) | AC-01 to AC-04, AC-06, AC-08, AC-09 | AC-05, AC-07, AC-10 to AC-14 | — |
| **Revoke:** service key revoke, re-issue epoch, write scope | LA-E5-15 | [qa](../../reviews/LA-E5-15/qa.md) | AC-01 to AC-03, AC-05 to AC-07 | AC-04 | — |
| **Safe retries:** `Idempotency-Key` | LA-E5-16 | [qa](../../reviews/LA-E5-16/qa.md) | AC-01 to AC-03, AC-05, AC-07 | AC-04, AC-06 | — |
| **Metrics and readiness:** `/metrics`, `/readyz`, production `/healthz` | LA-E5-17 | [qa](../../reviews/LA-E5-17/qa.md) | AC-01 to AC-03, AC-06, AC-07 | AC-04, AC-05 | — |
| **Strict production start rules:** production profile, secrets from files | LA-E5-21 | [qa](../../reviews/LA-E5-21/qa.md) | AC-01, AC-07 | AC-02 to AC-06 | — |
| **Backup and restore drill:** backup, key versions, restore, launch and score after the restore, restore time and backup age | LA-E5-24 | [qa](../../reviews/LA-E5-24/qa.md) | AC-01 to AC-06 | — | — |

Limits:

- The production start rules pass their tests, but the LA Docker stack cannot run in production mode. A production host setup is milestone LG.
- The tenant reads `GET /api/audit` and `GET /api/account` are not built ([spec-deviations §6](../../guides/ltiaas/spec-deviations.md#6-not-built-in-la)).
- The LTI service contract differences of these controls, with their reasons, are in [spec-deviations §2](../../guides/ltiaas/spec-deviations.md#2-differences-from-the-public-ltiaas-api-base-8-rows-d22d36).
