// Static portal only. API, tool and player paths never fall through to the SPA.
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../domain/db.ts';
import { sessionOf } from './session.ts';

const buildDir = fileURLToPath(new URL('../../../../apps/portal/dist/', import.meta.url));
const types: Record<string, string> = {
  js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  woff: 'font/woff', woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png',
};

export function registerPortal(app: FastifyInstance, deps: { channels: ChannelRegistry; db: Db; now: () => number }): void {
  app.get<{ Params: { file: string } }>('/portal/assets/:file', async (req, reply) => {
    const name = req.params.file;
    const type = types[name.split('.').at(-1) ?? ''];
    if (!/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(name) || !type) return reply.code(404).send();
    try {
      const bytes = await readFile(join(buildDir, 'assets', name));
      return reply.type(type).header('cache-control', 'public, max-age=31536000, immutable').send(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reply.code(404).send();
      throw error;
    }
  });
  // App API delta §4 (LA-ADR-01 D9): one route pair for every registry channel. A channel id that is not in the registry
  // keeps the answer of an unknown path, before the session check.
  const channelRoutes = ['/integrations/:channelId/connect', '/integrations/:channelId/:connectionId'];
  const routes = ['/', '/signin', '/integrations', ...channelRoutes,
    '/libraries/courses', '/libraries/courses/:courseId', '/libraries/courses/:courseId/publish',
    '/publications/:publicationId/results', '/prototype/:page'];
  for (const path of routes) {
    app.get(path, async (req: FastifyRequest<{ Params: { channelId?: string } }>, reply: FastifyReply) => {
      if (channelRoutes.includes(path) && deps.channels.channel(req.params.channelId ?? '') === null) return reply.callNotFound();
      reply.header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'")
        .header('referrer-policy', 'same-origin').header('cache-control', 'no-store');
      if (path !== '/signin' && !sessionOf(deps.db, req.headers.cookie, deps.now())) return reply.redirect('/signin');
      try { return reply.type('text/html; charset=utf-8').send(await readFile(join(buildDir, 'index.html'), 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return reply.code(503).type('text/plain').send('The portal is not built. Run npm run build, then reload.');
      }
    });
  }
}
