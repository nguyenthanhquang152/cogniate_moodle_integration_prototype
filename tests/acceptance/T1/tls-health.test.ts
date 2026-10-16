// T1 in-container: TLS chain and health endpoints.
// Source: docs/architecture/tasks/T1.md AC-T1-03, AC-T1-04; Lead-approved change LC-T1-01 (CA + one leaf cert
// with four SANs); hook H3 (/healthz returns knobs: [] by default).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { describe, expect, it } from 'vitest';
import { hostnameOf, publicUrls } from '../lib/env';
import { httpsRequest, rootCaFile, rootCaPem, tlsPeer } from '../lib/https';

const urls = publicUrls();
const loginUrl = `${urls.moodle}/login/index.php`;
const hasCurl = spawnSync('sh', ['-c', 'command -v curl'], { encoding: 'utf8' }).status === 0;

describe('T1 TLS', () => {
  it('AC-T1-03 Moodle /login/index.php returns 200 with the login form, over TLS that verifies with root.crt', async () => {
    const res = await httpsRequest(loginUrl, { ca: rootCaPem() });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toMatch(/<form[^>]*\bid="login"/);
    expect(res.body).toMatch(/name="username"/);
    expect(res.body).toMatch(/name="password"/);
    expect(res.body).toMatch(/name="logintoken"/);
  });

  it('AC-T1-03 TLS verification fails without the stack CA (Node public roots only)', async () => {
    const err = await httpsRequest(loginUrl, { ca: [...tls.rootCertificates] }).then(
      () => null,
      (e: NodeJS.ErrnoException) => e,
    );
    expect(err, 'the request must fail when only public roots are trusted').not.toBeNull();
    expect(err?.code ?? '').toMatch(/CERT|SIGNATURE|ISSUER|SELF_SIGNED/);
  });

  it.skipIf(!hasCurl)('AC-T1-03 curl --cacert root.crt gives 200; curl with public roots only exits 60', () => {
    const ok = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--cacert', rootCaFile(), loginUrl], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout.trim()).toBe('200');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-public-roots-'));
    const publicRoots = path.join(dir, 'roots.pem');
    fs.writeFileSync(publicRoots, tls.rootCertificates.join('\n'));
    const bad = spawnSync('curl', ['-sS', '-o', '/dev/null', '--cacert', publicRoots, loginUrl], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    fs.rmSync(dir, { recursive: true, force: true });
    expect(bad.status, bad.stderr).toBe(60);
  });

  it('LC-T1-01 each public host presents a certificate for its name that chains to root.crt; SAN has all four names', async () => {
    const names = Object.values(urls).map(hostnameOf);
    for (const url of Object.values(urls)) {
      const peer = await tlsPeer(url);
      expect(peer.authorized, `${url}: ${peer.authorizationError ?? ''}`).toBe(true);
      for (const name of names) expect(peer.subjectAltName, `${url} SAN`).toContain(`DNS:${name}`);
    }
  });
});

describe('T1 health endpoints', () => {
  const cases = [
    { url: urls.lti, service: 'lti-service', knobsRequired: true },
    { url: urls.app, service: 'cogniate-app', knobsRequired: true },
    { url: urls.content, service: 'cogniate-content', knobsRequired: false },
  ];
  for (const c of cases) {
    it(`AC-T1-04 ${c.service}: GET /healthz returns 200 JSON {status: "ok", service: "${c.service}"} and no active knobs (H3)`, async () => {
      const res = await httpsRequest(`${c.url}/healthz`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = JSON.parse(res.body) as { status?: unknown; service?: unknown; knobs?: unknown };
      expect(body.status).toBe('ok');
      expect(body.service).toBe(c.service);
      // H3: the two Node services report their test knobs. The content listener may omit the field.
      if (c.knobsRequired || 'knobs' in body) expect(body.knobs).toEqual([]);
    });
  }
});
