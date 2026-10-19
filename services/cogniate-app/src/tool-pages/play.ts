// The player shell /play/{playId}, the embedded page /play/{playId}/embedded and GET /app-api/play/{playId}/status
// (app contract §6, security §4, §5, §7). The play id is the capability (no cookies, no ltik). The shell shows the
// course, a status text that it polls every 5 s, "Back to Moodle", and the runtime iframe on the content origin
// (the runtime itself is T5a).
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { PlayStatus } from '@cogniate/tracking';
import { playStatusText } from '@cogniate/tracking';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../app/api-errors.ts';
import type { Db } from '../domain/db.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlayView } from '../domain/attempts.ts';
import { getPlay } from '../domain/attempts.ts';
import { latestSyncStatus } from '../domain/score-syncs.ts';
import { runtimeTokenFor } from './launch-rules.ts';
import { errorPage, escapeHtml, layout, newNonce, toolPageHeaders } from './page.ts';

export interface PlayPageDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  masterKey: Buffer;
  now: () => number;
  /** apps/player build folder (shell.js). */
  playerDir: string;
}

/** The status of a play session (status API and the first shell render). Previews never have a score sync. */
function statusOf(db: Db, view: PlayView): PlayStatus {
  const sync = view.preview ? null : latestSyncStatus(db, view.resourceLinkId, view.userSub);
  return { outcome: view.outcome, scoreGiven: view.scoreGiven, scoreMaximum: view.scoreMaximum, preview: view.preview,
    scoreSync: sync ?? { status: null, scoreGiven: null, scoreMaximum: null } };
}

/** Security §7 "Frames": the runtime iframe attributes (T5-spike: the minimal set that runs both exports). */
export const RUNTIME_SANDBOX = 'allow-scripts allow-same-origin';
export const RUNTIME_ALLOW = 'autoplay; fullscreen';

const NOT_FOUND = { code: 'PLAY_NOT_FOUND', heading: 'This course session is not available', action: 'This course session does not exist or it expired. Open the activity again in Moodle.' };

type PlayParams = { Params: { playId: string } };

export function registerPlayPages(app: FastifyInstance, deps: PlayPageDeps): void {
  const { db, urls, masterKey, now } = deps;

  const notFound = (req: FastifyRequest, reply: FastifyReply) =>
    reply.code(404).headers(toolPageHeaders('error')).send(errorPage(NOT_FOUND.heading, NOT_FOUND.code, req.traceId, NOT_FOUND.action));

  const shell = (playId: string, view: PlayView, nonce: string): string => {
    const back = view.returnUrl ?? (view.issuerOrigin ? `${view.issuerOrigin}/` : null);
    const details = [
      `<span data-activity-title>${escapeHtml(view.activityTitle)}</span>`,
      view.contextTitle ? `<span data-context-title>${escapeHtml(view.contextTitle)}</span>` : '',
      view.packageTitle !== null ? `Package: <span data-package-title>${escapeHtml(view.packageTitle)}</span>` : '',
    ].filter(Boolean).join(' · ');
    const runtime = `${urls.content}/rt/${runtimeTokenFor(masterKey, playId)}`;
    return `<div data-page="play" data-format="${view.format}">
  <header class="shell-bar">
    <div>
      <h1 data-course-title>${escapeHtml(view.courseTitle)}</h1>
      <p class="muted">${details}</p>
    </div>
    <p>Status: <strong data-play-status>${escapeHtml(playStatusText(statusOf(db, view)))}</strong>${view.preview ? ' <span class="badge" data-preview>Preview</span>' : ''}</p>
    ${back ? `<a href="${escapeHtml(back)}" rel="noopener noreferrer" data-back-to-moodle>Back to Moodle</a>` : ''}
  </header>
  <iframe class="shell-frame" title="${escapeHtml(view.courseTitle)}" src="${escapeHtml(runtime)}" sandbox="${RUNTIME_SANDBOX}" allow="${RUNTIME_ALLOW}"></iframe>
</div>
<script type="module" nonce="${escapeHtml(nonce)}" src="/_player/shell.js"></script>`;
  };

  // ---------------------------------------------------------------- the player shell (top level only)
  app.get<PlayParams>('/play/:playId', async (req, reply) => {
    const view = getPlay(db, req.params.playId, now());
    if (!view) return notFound(req, reply);
    const nonce = newNonce();
    return reply.code(200).headers(toolPageHeaders('play', { content: urls.content, nonce }))
      .send(layout(view.courseTitle, shell(req.params.playId, view, nonce), undefined, 'shell'));
  });

  // ---------------------------------------------------------------- the shell script (apps/player build), app origin
  // It polls GET /app-api/play/{playId}/status every 5 s and shows the same status text as the first render.
  app.get('/_player/shell.js', async (_req, reply) => {
    let js: Buffer;
    try {
      js = await readFile(join(deps.playerDir, 'shell.js'));
    } catch {
      return reply.code(404).type('text/plain; charset=utf-8').send('The player is not built. Run npm run build (or npm run dev:web).');
    }
    return reply.code(200).headers({ 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }).send(js);
  });

  // ---------------------------------------------------------------- inside Moodle's iframe: open the player in a new window
  app.get<PlayParams>('/play/:playId/embedded', async (req, reply) => {
    const view = getPlay(db, req.params.playId, now());
    if (!view || !view.issuerOrigin) return notFound(req, reply);
    const body = `<main data-page="play-embedded">
  <h1 data-course-title>${escapeHtml(view.courseTitle)}</h1>
  <p>This course opens in a new window.</p>
  <a class="button" href="/play/${escapeHtml(req.params.playId)}" target="_blank" rel="noopener">Open in a new window</a>
</main>`;
    return reply.code(200).headers(toolPageHeaders('embedded', { issuer: view.issuerOrigin })).send(layout(view.courseTitle, body));
  });
}

/** GET /app-api/play/{playId}/status: public (the play id is the capability). Unknown or expired: 404 NOT_FOUND. */
export function registerPlayStatusRoute(api: FastifyInstance, deps: { db: Db; now: () => number }): void {
  api.get<PlayParams>('/play/:playId/status', { config: { public: true } }, async (req) => {
    const view = getPlay(deps.db, req.params.playId, deps.now());
    if (!view) throw new ApiError('NOT_FOUND', 'Unknown play session.');
    // scoreSync.status: the newest row of this learner and activity, null before the first one (and for a preview).
    return statusOf(deps.db, view);
  });
}
