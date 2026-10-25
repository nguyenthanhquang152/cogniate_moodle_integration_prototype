# LA-R2: LMS landscape for LTI as a service

Output file (the only file you write): docs/research/ltiaas/R2-lms-landscape.md

Target: public vendor documentation; plus our current profiles in services/lti-service/src/profiles/** and services/cogniate-app/src/providers/** to compare.

Change: for each LMS below, collect from public docs: LTI 1.3 / Advantage support; registration method (manual, Dynamic Registration, central developer portal app, developer key); issuer and client id / deployment id model (exclusive vs shared); the endpoints pattern (auth, token, JWKS); Deep Linking placements; AGS and NRPS support and known quirks; launch in a frame or a new window; cookie / Safari / platform-storage support; known claim quirks; how a vendor gets a test site (free sandbox, developer program, partnership; cost if public); market relevance (higher education, K-12, corporate).
LMS list: Moodle (4.x and 5.x, MoodleCloud), Canvas (Instructure cloud and self-hosted), Blackboard Learn (Ultra and Original, Anthology developer portal), D2L Brightspace, Schoology, Sakai, Open edX, itslearning, Google Classroom (LTI 1.3 add-ons, if any), Microsoft Teams / Learning Tools, and the corporate LMSs that act as LTI 1.3 platforms (check Docebo, Absorb, Cornerstone, SAP SuccessFactors, Workday Learning, TalentLMS). Mark any LMS without LTI 1.3 platform support clearly.

Then compare with our 3 current profiles: which facts in our profiles (issuer, endpoints, flags) still match the public docs; list anything that changed.

Then answer: (a) which properties a "generic LTI 1.3 profile" must make configurable; (b) which flags or quirks a profile needs beyond today's ProfileFlags (deepLinkingResponseSub, clientAssertionAudArray, minimizeClaims, serviceOriginCheck); (c) which new named LMS LA should add first (E2) and why (test-site access, market, distance from the generic profile).

Observable acceptance: one table row per LMS with URLs; the comparison with our profiles; answers (a)-(c); recommendations.
