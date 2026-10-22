import { buildChannelRegistry, EXTENSION_GUARDS } from '@cogniate/channel-kernel';
import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { TEST_CHANNELS, TEST_URLS, testApp } from '../testkit.ts';
import type { PortContext, PublicationView } from './ports.ts';
import { publicationExtensionFields, registerExtensionRoutes } from './extensions.ts';
import type { ExtensionDeps } from './extensions.ts';

const publication = { channel: 'moodle' } as PublicationView;
const ctx = {} as PortContext;
function registry(fields: Record<string, unknown>) {
  const manifest = TEST_CHANNELS.channels().find((m) => m.id === publication.channel)!;
  return buildChannelRegistry([{ folder: '/test/moodle', manifest, appAdapter: {
    publishHooks: [{ option: 'createMoodleCourse', capability: 'publish.createCourse', dtoFields: () => fields }],
  } }], { simulations: true });
}

it('AC-05: refuses hook DTO fields outside the frozen list, including core field overrides', () => {
  for (const fields of [{ extra: 1 }, { id: 'replacement' }, JSON.parse('{"__proto__":{}}') as Record<string, unknown>]) {
    expect(() => publicationExtensionFields(registry(fields), publication, ctx)).toThrow(expect.objectContaining({
      name: 'ChannelDtoFieldError', message: `channel_dto_field_not_allowed: ${Object.keys(fields)[0]}`,
    }));
  }
});

it.each([
  ...Object.keys(EXTENSION_GUARDS).map((path) => [path, true] as const),
  ['x/reports', true], ['reports', false], ['deployments', false], ['constructor', false],
  ['x/../reports', false], ['x/reports/more', false], ['x/', false], ['/web-services', false],
] as const)('mounts only a frozen path or x/<name>: %s allowed=%s', async (path, allowed) => {
  const api = Fastify();
  const manifest = TEST_CHANNELS.channel('moodle')!;
  const channels = buildChannelRegistry([{ folder: '/test/moodle', manifest, appAdapter: {
    extensionRoutes: [{ method: 'GET', path, capability: 'siteApi.token', handle: async () => ({ status: 200, body: {} }) }],
  } }], { simulations: true });
  // Mounting needs only discovery; request-time dependencies must not be accessed here.
  const mount = () => registerExtensionRoutes(api, { channels } as ExtensionDeps);
  try {
    if (allowed) {
      mount();
      expect(api.hasRoute({ method: 'GET', url: `/connections/:id/${path}` })).toBe(true);
    } else {
      expect(mount).toThrow(expect.objectContaining({ name: 'ChannelExtensionPathError', message: 'channel_extension_path_invalid' }));
      expect(api.hasRoute({ method: 'GET', url: `/connections/:id/${path}` })).toBe(false);
    }
  } finally { await api.close(); }
});

it('AC-05: keeps the frozen publication fields and defaults for channels without a hook', () => {
  const fields = { moodleCourse: { id: 42, idnumber: 'course', url: 'https://school.test/course/view.php?id=42' }, shellStatus: 'created', shellError: null };
  expect(publicationExtensionFields(registry(fields), publication, ctx)).toEqual(fields);
  expect(publicationExtensionFields(TEST_CHANNELS, { channel: 'blackboard' } as PublicationView, ctx))
    .toEqual({ moodleCourse: null, shellStatus: null, shellError: null });
});

it('AC-06: the frozen extension and export paths are mounted in the authenticated app scope', async () => {
  const t = await testApp();
  try {
    for (const [method, url] of [
      ['GET', '/app-api/connections/:id/canvas-configuration'],
      ['PUT', '/app-api/connections/:id/web-services'],
      ['POST', '/app-api/connections/:id/deployments'],
      ['POST', '/app-api/courses/:courseId/versions/:versionId/mbz'],
      ['GET', '/app-api/courses/:courseId/versions/:versionId/mbz'],
      ['GET', '/app-api/courses/:courseId/versions/:versionId/download'],
    ] as const) {
      expect(t.app.hasRoute({ method, url }), `${method} ${url}`).toBe(true);
      const answer = await t.app.inject({ method, url: url.replace(/:[A-Za-z]+/g, 'missing') + (url.endsWith('download') ? '?kind=mbz' : ''), headers: { origin: TEST_URLS.app } });
      expect(answer.statusCode).toBe(401);
    }
  } finally { await t.app.close(); }
});
