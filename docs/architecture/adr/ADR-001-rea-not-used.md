# ADR-001: Do not use `rea`. Build an independent implementation with a written clean-room process

Status: Accepted (round 2; legal confirmation pending, open questions Q1). Date: 2026-10-16.

## Context

The product owner asked: can `github.com/morluto/rea` help us clone the LTIAAS API?

Facts (`docs/research/inputs.md` §3, §4):

- `rea` reverse-engineers artifacts that you have: binaries, apps, websites, HAR or pcap captures, firmware. Its README limits it to "software you own or are authorized to examine".
- LTIAAS is a hosted SaaS by GatherAct, LLC. We have no binary and no source. We can read the public API reference and the open 1EdTech specs.
- The LTIAAS terms forbid customers to "reverse engineer, reproduce ... or create derivative works from" the platform and its documentation.
- To observe LTIAAS traffic we would need an account. The team rules forbid sign-ups.
- The public API reference gives what an API-compatible service needs: paths, header schemes, field names, error shape.

## Options

| Option | Result |
| --- | --- |
| A. Use `rea` on LTIAAS (sign up, capture, analyse) | Breaks the ToS and the team rules. Gives behaviour that we must not copy. |
| B. Use `rea` on public LTIAAS web pages | Gives nothing new |
| C. Do not use `rea`. Independent implementation of the public interface, with a written process | Legal path. All needed facts exist. |

## Decision

Option C. We do not use `rea` for LTIAAS and do not install it for this project.

### Clean-room process

| Role | May read | Must not read |
| --- | --- | --- |
| Architect | `.research_cache/ltiaas_docs/` (public API reference), 1EdTech specs, Moodle source | LTIAAS code (we have none) |
| Author | Our contracts, ADRs, 1EdTech specs, Moodle source | `.research_cache/ltiaas_docs/`, `ltijs` source, the `ltiaas` SDK source |
| QA | Our contracts and task specs, 1EdTech specs. For the T3c compatibility test only: the public README of the `ltiaas` Python SDK, to call it. | `.research_cache/ltiaas_docs/`, `ltijs` source, SDK source beyond its public README |
| Reviewers | Everything, to check the claims | — |

Rules:

1. Only names cross from the LTIAAS reference into our contract: paths, header schemes, field names, error shape. We write our own text.
2. Behaviour comes from the 1EdTech specs and Moodle 5.2.
3. No LTIAAS prose or code goes into the repo. `.research_cache/` stays git-ignored.
4. Where the public reference is unclear, the Architect chooses and records the choice (ADR-003, contract §8 "Differences").
5. Provenance log: the LTI service contract states which names come from the public reference (its header and §8).
6. The MIT `ltiaas` Python SDK (0.0.4, PyPI) is used **only** as a black-box test client in a container in T3c. Its code is never copied into the product or the tests. If its license or install blocks this, QA writes a small client from the public endpoint names in our contract instead.

We say "independent implementation of the public LTIAAS interface". We say "clean-room" only together with the process above.

## Consequences

- We can say: "implements these endpoints with the paths, header schemes and field names of the public LTIAAS API reference, except the listed differences, and passes a test with an independent client". We do not say "a copy of LTIAAS".
- Undocumented LTIAAS behaviour is not copied.
- Q1 asks legal to confirm the process and the test-only use of the SDK.
- CAUTION: The `rea` repository shows about 283k stars six months after creation. It runs as an MCP server with wide local access. Review its code and supply chain before any later use.
