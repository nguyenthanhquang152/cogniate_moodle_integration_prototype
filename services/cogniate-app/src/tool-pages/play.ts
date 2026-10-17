// The player shell /play/{playId}, the embedded page /play/{playId}/embedded and GET /app-api/play/{playId}/status
// (app contract §6, security §4, §5, §7). The play id is the capability (no cookies, no ltik). The shell shows the
// course, a status text that it polls every 5 s, "Back to Moodle", and the runtime iframe on the content origin
// (the runtime itself is T5a).
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../app/api-errors.ts';
import type { Db } from '../domain/db.ts';
import type { Outcome, PlayView } from '../domain/launch.ts';
import { getPlay } from '../domain/launch.ts';
import { runtimeTokenFor } from './launch-rules.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders } from './page.ts';

export interface PlayPageDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  masterKey: Buffer;
  now: () => number;
}

export const OUTCOME_TEXT: Record<Outcome, string> = {
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', passed: 'Passed', failed: 'Failed',
};

/** Security §7 "Frames": the runtime iframe attributes (T5-spike: the minimal set that runs both exports). */
export const RUNTIME_SANDBOX = 'allow-scripts allow-same-origin';
export const RUNTIME_ALLOW = 'autoplay; fullscreen';

const NOT_FOUND = { code: 'PLAY_NOT_FOUND', heading: 'This course session is not available', action: 'This course session does not exist or it expired. Open the activity again in Moodle.' };

/** The shell polls the status API every 5 s (app contract §6). The play id comes from the page URL, not from the server. */
const POLL_JS = `(function () {
  var el = document.querySelector('[data-play-status]');
  var labels = ${JSON.stringify(OUTCOME_TEXT)};
  var url = '/app-api/play/' + encodeURIComponent(location.pathname.split('/')[2] || '') + '/status';
  setInterval(function () {
    fetch(url, { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      if (s && el) el.textContent = labels[s.outcome] || String(s.outcome);
    }).catch(function () {});
  }, 5000);
})();`;

type PlayParams = { Params: { playId: string } };

export function registerPlayPages(app: FastifyInstance, deps: PlayPageDeps): void {
  const { db, urls, masterKey, now } = deps;

  const notFound = (req: FastifyRequest, reply: FastifyReply) =>
    reply.code(404).headers(toolPageHeaders('error')).send(errorPage(NOT_FOUND.heading, NOT_FOUND.code, req.traceId, NOT_FOUND.action));

  const shell = (view: PlayView): string => {
    const back = view.returnUrl ?? (view.issuerOrigin ? `${view.issuerOrigin}/` : null);
    const details = [
      `<span data-activity-title>${escapeHtml(view.activityTitle)}</span>`,
      view.contextTitle ? `<span data-context-title>${escapeHtml(view.contextTitle)}</span>` : '',
      view.packageTitle !== null ? `Package: <span data-package-title>${escapeHtml(view.packageTitle)}</span>` : '',
    ].filter(Boolean).join(' · ');
    const runtime = `${urls.content}/rt/${runtimeTokenFor(masterKey, view.id)}`;
    return `<div data-page="play" data-format="${view.format}">
  <header class="shell-bar">
    <div>
      <h1 data-course-title>${escapeHtml(view.courseTitle)}</h1>
      <p class="muted">${details}</p>
    </div>
    <p>Status: <strong data-play-status>${OUTCOME_TEXT[view.outcome]}</strong>${view.preview ? ' <span class="badge" data-preview>Preview</span>' : ''}</p>
    ${back ? `<a href="${escapeHtml(back)}" rel="noopener noreferrer" data-back-to-moodle>Back to Moodle</a>` : ''}
  </header>
  <iframe class="shell-frame" title="${escapeHtml(view.courseTitle)}" src="${escapeHtml(runtime)}" sandbox="${RUNTIME_SANDBOX}" allow="${RUNTIME_ALLOW}"></iframe>
</div>`;
  };

  // ---------------------------------------------------------------- the player shell (top level only)
  app.get<PlayParams>('/play/:playId', async (req, reply) => {
    const view = getPlay(db, req.params.playId, now());
    if (!view) return notFound(req, reply);
    const nonce = newNonce();
    return reply.code(200).headers(toolPageHeaders('play', { content: urls.content, nonce }))
      .send(layout(view.courseTitle, shell(view), { nonce, js: POLL_JS }, 'shell'));
  });

  // ---------------------------------------------------------------- inside Moodle's iframe: open the player in a new window
  app.get<PlayParams>('/play/:playId/embedded', async (req, reply) => {
    const view = getPlay(db, req.params.playId, now());
    if (!view || !view.issuerOrigin) return notFound(req, reply);
    const body = `<main data-page="play-embedded">
  <h1 data-course-title>${escapeHtml(view.courseTitle)}</h1>
  <p>This course opens in a new window.</p>
  <a class="button" href="/play/${escapeHtml(view.id)}" target="_blank" rel="noopener">Open in a new window</a>
</main>`;
    return reply.code(200).headers(toolPageHeaders('embedded', { issuer: view.issuerOrigin })).send(layout(view.courseTitle, body));
  });
}

/** GET /app-api/play/{playId}/status: public (the play id is the capability). Unknown or expired: 404 NOT_FOUND. */
export function registerPlayStatusRoute(api: FastifyInstance, deps: { db: Db; now: () => number }): void {
  api.get<PlayParams>('/play/:playId/status', { config: { public: true } }, async (req) => {
    const view = getPlay(deps.db, req.params.playId, deps.now());
    if (!view) throw new ApiError('NOT_FOUND', 'Unknown play session.');
    // scoreSync.status is null until the first score sync row (T5a).
    return { outcome: view.outcome, scoreGiven: view.scoreGiven, scoreMaximum: view.scoreMaximum, preview: view.preview, scoreSync: { status: null } };
  });
}
