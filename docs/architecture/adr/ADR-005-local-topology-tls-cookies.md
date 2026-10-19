# ADR-005: Local topology, TLS, cookies and launch container

Status: Accepted (round 2; topology approved by the Lead and in build in T1). Date: 2026-10-16. Details: [`local-stack.md`](../local-stack.md), [`security.md`](../security.md) §3, §5.

## Context

The E2E must run against a real Moodle 5.2 in Docker, with cookie behaviour close to production and no "dev mode".

Facts:

- In production, Moodle and Cogniate are different sites, both on https.
- Moodle 5.2 sets `MoodleSession` with `SameSite=Lax` (fixed in code) and handles its own cross-site POSTs (`repost_crosssite_page`).
- Moodle `auth.php` sends the `id_token` with a cross-site POST, so our state cookie needs `SameSite=None; Secure`.
- Moodle 5.2 has no LTI client-side storage. In an iframe, our cookie is a third-party cookie.
- Moodle curl blocks private IPs and allows only ports 80 and 443 by default.
- The spike layout (`http://localhost:8080`, `http://localhost:3000`) is same-site and does not test the cross-site path. `*.localhost` names map to loopback in Chromium and musl.
- Chrome warns on an auto-submitted form from https to http, so a mixed setup breaks the deep-linking return.

## Options

| Option | Cookie realism | Cost |
| --- | --- | --- |
| A. Spike layout: http, `localhost`, socat sidecar | Low | Lowest |
| B. http with `*.localhost` names | Medium, breaks with containers | Medium |
| C. https behind a TLS proxy, four `.test` names on three sites, all services in compose | High | Medium: proxy, CA trust in three clients, Moodle curl change |

## Decision

Option C.

- Names: `moodle.test`, `lti.cogniate.test`, `app.cogniate.test`, `content.cogniate-content.test`, as Docker network aliases on the proxy.
- Every public URL comes from `PUBLIC_MOODLE_URL`, `PUBLIC_LTI_URL`, `PUBLIC_APP_URL`, `PUBLIC_CONTENT_URL`. No URL literal in code. `PUBLIC_PORT` changes all four.
- TLS: `gen-env` makes a dev CA (Name Constraints `permitted DNS:test`, life ≤ 1 year) and one leaf certificate (SAN = the four names) with `openssl`, before any container starts. The name constraint limits the harm if a human trusts the root and `ca.key` leaks. They live in `infra/.certs/`, and `stack:reset` keeps them. Caddy loads the static files (no `tls internal`). So Moodle, Node and the browser always trust the same CA, also on the first run and after a reset.
- Trust: Moodle through `moodleorgca.crt`; Node through `NODE_EXTRA_CA_CERTS`; e2e Chromium through NSS; a human through `npm run demo:browser` (a throwaway Chrome profile that maps the names and accepts only our leaf).
- Moodle: `SITE_URL = PUBLIC_MOODLE_URL`, `SSLPROXY=true`. Dev-only curl change: cut only `STACK_SUBNET` out of the default blocked hosts; allow port 443 only (plus `PUBLIC_PORT`).
- Fallbacks: local-stack §4. F1 keeps HTTPS (Node TLS proxy, same certificates). F3 (http, same-site) needs a Lead decision and changes the ACs listed there.

**Cookies:** security §3. One state cookie per login (`__Host-`, `Secure`, `HttpOnly`, `SameSite=None`, `Partitioned`). No cookies on tool pages after the launch, and none on the content origin.

**Launch container: New window** for learner launches. The connect wizard tells the admin to set it after a dynamic registration (Moodle sets "embed" first). Until then, an embedded launch shows `/play/{playId}/embedded` with an "Open in a new window" button.

**Page headers:** security §5. Each tool page that Moodle frames allows only the Moodle origin as frame ancestor. `Referrer-Policy: same-origin`, so that form POSTs carry a real `Origin`.

## Consequences

- The dev stack tests the same cross-site paths as production.
- Deep Linking is the exception to "New window": Moodle always opens "Select content" in an iframe, and its return page needs `parent`. The teacher flow depends on the partitioned state cookie. QA verified Chromium only; other browsers, including Firefox, remain unproven. It can fail in Safari (Q16).
- A human needs `npm run demo:browser` or a manual host mapping and CA trust (infra README). The E2E needs nothing on the host.
- Images to pull: `caddy`, `node:24-alpine`, plus the three pre-pulled images.
