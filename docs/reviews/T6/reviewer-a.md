Verdict: APPROVE
Round: 1

# T6 review: Reviewer-A (correctness and security)

Scope: the changes that T6 brings into the branch, `git diff 7bf48b6^1 7bf48b6`:
- `apps/portal/**` (built by Author-2, Codex);
- `services/cogniate-app/src/app/portal.ts`, `app/courses.ts` (original-zip download, publication summaries) and `app/server.ts`;
- `infra/compose.yaml` and the root scripts.

Spec: `tasks/T6.md`, app contract §2–§5, §12, security §5 (portal CSP), §6 (Origin rule), §8 (tenant isolation).

Method:
- I read the server files in full.
- I swept the SPA (`App.tsx`, `api.ts`, `ui.tsx`, `Connect.tsx`, `Courses.tsx`, `Results.tsx`) for raw HTML, URL sinks, external loads, storage and secrets.
- I read the download test.
- I scanned the committed evidence (3 JSON files, 2 reports, 2 screenshots) and the built bundle `apps/portal/dist`.
- Read-only live checks on the Author's stack (`curl --resolve app.cogniate.test:443:127.0.0.1 --cacert infra/.certs/root.crt`), without a session.
- I did not read `reviewer-b.md`.

## What is right (checked, no finding)

- **XSS.**
  - The SPA has no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `eval` or `new Function`.
  - Course titles, manifest titles, reject reasons (`reason.title`, `reason.action`, and `reason.path`, which the uploader controls), `lastError` (`syncError` returns plain text and never markup), error descriptions and trace ids are all React text nodes.
  - Only two `href` values are built from data. One is the download link, built from ids with `encodeURIComponent`. The other is `connection.siteUrl + '/mod/lti/toolconfigure.php'`. The server accepts `siteUrl` only as an https origin (`isHttpsOrigin`), so a `javascript:` URL cannot reach that link, and it has `target="_blank" rel="noopener noreferrer"`.
- **CSRF and Origin.**
  - All portal writes go to `/app-api`. Their hook refuses `POST`, `PUT`, `PATCH` and `DELETE` unless `Origin` is `PUBLIC_APP_URL`.
  - The SPA uses same-origin `fetch` (`credentials: 'same-origin'`) and same-origin XHR for the upload, so the browser sends `Origin` on every write.
  - Logout is `DELETE /app-api/session`. The server deletes the session and sends `Max-Age=0` for the `__Host-` cookie. A later `GET /app-api/me` gives `401`, and the SPA routes redirect to `/signin`.
- **SPA headers (security §5).**
  - Live: `/signin` gives `200`, and `/integrations` and `/publications/x/results` without a session give `302 /signin`.
  - All three send `default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`, `Referrer-Policy: same-origin`, `nosniff` and `no-store`.
  - The asset route accepts only `^[A-Za-z0-9_-]+\.[a-z0-9]+$` with a type from a small list, and reads only `dist/assets`.
- **No CDN and no secrets in the bundle.**
  - The DM Sans fonts are bundled (`dist/assets/dm-sans-*.woff2`), and the CSS has no external `@import` or `url()`.
  - The JS has only two literal external URLs: placeholder text (`https://moodle.test.`) and a React Router message (`reactrouter.com`). Neither is loaded.
  - The bundle has no API key, `Bearer` or private key, and no source map.
  - The SPA never uses `localStorage`, `sessionStorage` or `document.cookie`.
- **Original-zip download.** Library scope is applied three times: `courseOf` (library), `getVersion(lib, course, version)`, and `package … AND library_id = ?`.
  - The file path is `uploads/<sha256>.zip` with `^[a-f0-9]{64}$`, so path traversal is not possible. The uploads store is content-addressed, but the lookup stays scoped by library.
  - `Content-Disposition: attachment; filename="course-v<integer>.zip"` cannot carry an injected header. The type is `application/zip`.
  - The read stream closes the file at the end or on an abort.
  - Live: no session gives `401` with `no-store` and `nosniff`. The test covers `401`, another library (`404`), an unknown version (`404`) and another `kind` (`400`), and checks the SHA-256 of the body.
- **Course list.** `publications` summaries come from the library-scoped `listPublications`.
- **Evidence and reports.** There are no tokens, session cookies, ltiks, `ref` tokens, auth headers, passwords or keys. The screenshots show only anonymous learner labels. The evidence files are in `apps/`, which the container mounts read-only, but the server never serves them.
- **Scripts.** `npm run dev:web` now runs `vite build --watch` for both the portal and the player, so the T5a player rebuild still works.

## Findings

### A-T6-01: NIT: a `404` from Resend or Refresh shows "not available yet"

- Location: `apps/portal/src/results/Results.tsx` `actionError` (status `404` or `501`).
- Problem: Resend and Refresh exist since T5b. A `404` now means "this score sync or publication is not in your library", but the portal says "Resend is not available yet. Your saved results have not changed."
- Fix: map only `501` to that text. Show the server's own description for `404`.

## Counts

0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (A-T6-01).
