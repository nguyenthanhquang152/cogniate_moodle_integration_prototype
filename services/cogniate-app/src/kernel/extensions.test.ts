import { buildChannelRegistry } from '@cogniate/channel-kernel';
import { expect, it } from 'vitest';
import { TEST_CHANNELS, TEST_URLS, testApp } from '../testkit.ts';
import type { PortContext, PublicationView } from './ports.ts';
import { publicationExtensionFields } from './extensions.ts';

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
    expect(() => publicationExtensionFields(registry(fields), publication, ctx)).toThrow('channel_dto_field_not_allowed');
  }
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
