# LA-RA: Reviewer-A (lens "Is it right and is it safe?")

Your review file: docs/reviews/LA-DESIGN/reviewer-a.md
Focus: correctness against plan v1 and the 1EdTech specs (LTI Core 1.3, Security Framework, DL 2.0, AGS 2.0, NRPS 2.0, DR 1.0, Platform Storage); security (launch checks, JWT and key lifecycle, nonce/state with platform storage, CSRF, XSS, SSRF, secrets and KeyProvider, rate limits, tenant isolation for many channels and tool accounts, audit); data integrity (additive migrations, outbox leases and fairness, ADR-010 grade policy, retry and confirmation guarantees); "no behaviour change" for Moodle, Canvas and Blackboard.
Warm-up code areas: services/lti-service/** (lti/*, platform/*, store/*, http/routes/*), services/cogniate-app/src/app/redemption.ts, connections.ts, binding-*.ts, domain/score-syncs.ts, worker/score-sync.ts, domain/migrations/*.sql, packages/shared/** (crypto, outbound client).
