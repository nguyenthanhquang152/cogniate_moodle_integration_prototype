# D-T6L: bounded legacy label maintenance

Date: 2026-10-22. Lead decision based on Claude Opus 5.5 xhigh plan msg_cbc082d5601b.
Planning task task_f7fcf4a126e0 succeeded in msg_93a681f00ee9; its worker was released.
This decision applies only to the current prototype verification. It does not approve the product.

## Correction and ownership

Common QA, Antigravity Gemini 4 Argon (High), owns one correction batch:
- tests/acceptance/T6/3-courses.spec.ts:129: two opener label expressions.
- tests/acceptance/T6/5-xss-a11y.spec.ts:44,79,91: six opener label expressions; :97: one diagnostic label.
- tests/acceptance/T8/2-shell.spec.ts:30: two opener label expressions; :33: the connection label; :34: the option prefix.

Use "Publish to an LMS", "LMS connection" and the approved option format "<name> (Moodle, <site host>)".
There are 13 literal changes across eight lines. Keep every assertion, timeout, fallback, test id, setup, security and accessibility check.
The affected criteria are AC-T6-07, AC-T6-13, AC-T6-09 and both AC-T8-10 cases.
Authority: M2.md lines 46-56 and AC-M2-10; AC-M3-02 permits M2 label maintenance.
Codex owns product implementation and diagnostics; it does not edit tests.
Two blind Claude reviewers check the diff and bounded launcher variant. Neither is this planner or the test editor.
Canvas QA judges the T6/T8 runtime results independently.

## Explicit evidence decision

The new test-only commit C5 does not form a new full-gate candidate for rows with byte-identical inputs.
The product candidate remains C4, bf09cdad91ca548e1ecbc14428b55180d35d5360.
This is an explicit, bounded exception to storage-full-round-triage.md section 9 steps 6-8.
AC-M3-01's rule against assigning earlier evidence to a new candidate remains in force.

1. The tests diff from C4 to C5 must contain exactly the three paths above.
2. Every product run uses --sha bf09cdad91ca548e1ecbc14428b55180d35d5360.
3. Full2's two 488-case rounds and Canvas's two 233-case judgments retain their original C4 SHA and tests tree 8283d90dc669feb72eeb7ec43f5dbf80a156f0d4. They fill AC-M3-01 without relabeling.
4. No migration, storage, M1, product or build input changes. Their accepted diagnostic and full-round evidence remains at C4.
5. All 12 legacy groups run fresh in one qualified --phase legacy invocation, with product C4 and --test-sha C5.
6. M2 and T7 run on C4 with their unchanged tests/e2e inputs. Existing accepted preparation remains valid after its required binding checks.
7. Any product change, any other test change, or any fresh failure voids this exception and returns to the formal repair and verification cycle.

No row, assertion, source review, isolation check, cleanup or scan is waived.
Full2 remains FAILED. Its ten passing legacy groups are historical evidence, not substitutes for this fresh legacy run.
T8 remains NOT RUN until the fresh run reaches it. Unreached T6 assertions remain unverified.

## Execution gates

QA performs the tests typecheck and shows unchanged T6/T8 title inventories.
QA prepares one reviewed launcher variant from the frozen full2 launcher.
Its changes are limited to separate product/test bindings, a strict three-path diff check, and the --phase legacy command.
W1-W3, sampler, guard, strict ten-volume W4 comparison and the secret scan remain unchanged.
The Lead freezes C5 by exact paths, accepts two blind reviews, then grants one legacy Docker window.
Canvas QA judges structured T6/T8 results independently before M2 and T7 receive separate windows.
No Docker run is authorized by this decision itself.

All 32 real LMS rows remain UNVERIFIED. Local Canvas remains DEFERRED.
Final conformance, guide finalization, independent Docs QA and two blind final reviews remain required.
