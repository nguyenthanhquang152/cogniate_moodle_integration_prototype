// T4b1: publications. Source: tasks/T4b1.md AC-T4-12, AC-T4-14; contract cogniate-app-api.md §5.
// Uses Thanh's registered connection (1-connect.spec.ts) and the SCORM course (0-setup.spec.ts).
import { appApi, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { loadState, saveState } from '../lib/lti';
import { expect, test } from '../lib/pw';

const urls = publicUrls();

interface Publication {
  id: string;
  status: string;
  connectionId: string;
  courseId: string;
}

test.describe.serial('T4b1 publish', () => {
  test('AC-T4-12 publish the SCORM course → 201 available; again → 200 same id; withdraw, then publish → available', async () => {
    const st = loadState('T4b') as { thanhConnectionId?: string; thanhScorm?: { courseId: string } };
    expect(st.thanhConnectionId && st.thanhScorm, 'AC-T4-08 registered Thanh\'s connection; setup made the SCORM course').toBeTruthy();
    const s = await signIn(THANH);
    const body = { connectionId: st.thanhConnectionId, courseId: st.thanhScorm!.courseId };
    const first = await appApi<Publication>('POST', '/app-api/publications', { cookie: s.cookie, body });
    expect(first.status, first.body).toBe(201);
    expect(first.json.status).toBe('available');
    const again = await appApi<Publication>('POST', '/app-api/publications', { cookie: s.cookie, body });
    expect(again.status, again.body).toBe(200);
    expect(again.json.id).toBe(first.json.id);
    const withdrawn = await appApi<Publication>('POST', `/app-api/publications/${first.json.id}/withdraw`, { cookie: s.cookie });
    expect(withdrawn.status, withdrawn.body).toBe(200);
    expect(withdrawn.json.status).toBe('withdrawn');
    const back = await appApi<Publication>('POST', '/app-api/publications', { cookie: s.cookie, body });
    expect([200, 201], back.body).toContain(back.status);
    expect(back.json.id).toBe(first.json.id);
    expect(back.json.status).toBe('available');
    saveState('T4b', { thanhScormPublicationId: first.json.id });
  });

  test('AC-T4-14 publish to a pending connection → 409 CONNECTION_NOT_READY', async () => {
    const st = loadState('T4b') as { thanhScorm?: { courseId: string } };
    const s = await signIn(THANH);
    const pending = await appApi<{ id: string; status: string }>('POST', '/app-api/connections', { cookie: s.cookie, body: { name: 'QA pending', siteUrl: urls.moodle, method: 'dynamic' } });
    expect(pending.status).toBe(201);
    expect(pending.json.status).toBe('pending');
    const res = await appApi<{ details?: { message?: string } }>('POST', '/app-api/publications', { cookie: s.cookie, body: { connectionId: pending.json.id, courseId: st.thanhScorm!.courseId } });
    expect(res.status, res.body).toBe(409);
    expect(res.json?.details?.message).toBe('CONNECTION_NOT_READY');
  });
});
