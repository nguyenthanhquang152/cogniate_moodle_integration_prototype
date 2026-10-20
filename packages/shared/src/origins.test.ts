import { describe, expect, it } from 'vitest';
import { canonicalOrigin, checkSiteUrl, fixedHostsOf } from './origins.ts';

const OWN = ['lti.cogniate.test', 'app.cogniate.test', 'content.cogniate-content.test'];
const CANVAS_SIM_FIXED = ['canvas.sim.test', 'sso.canvas.sim.test'];

describe('canonicalOrigin (ADR-011 §6)', () => {
  it('lower-cases, drops :443 and the trailing slash, and converts IDN to punycode', () => {
    expect(canonicalOrigin('HTTPS://School-A.Canvas.Sim.Test:443/')).toEqual({ ok: true, origin: 'https://school-a.canvas.sim.test' });
    expect(canonicalOrigin('https://bücher.example.edu')).toEqual({ ok: true, origin: 'https://xn--bcher-kva.example.edu' });
    expect(canonicalOrigin('https://learn.example.edu:8443')).toEqual({ ok: true, origin: 'https://learn.example.edu:8443' });
  });

  it.each([
    'http://school-a.canvas.sim.test', 'https://school-a.canvas.sim.test/canvas', 'https://school-a.canvas.sim.test/?x=1',
    'https://school-a.canvas.sim.test/#f', 'https://school-a.canvas.sim.test?', 'https://u:p@school-a.canvas.sim.test',
    'school-a.canvas.sim.test', 'https:\\\\school-a.canvas.sim.test', 'ftp://school-a.canvas.sim.test', '',
  ])('refuses %s with rule 1', (input) => {
    expect(canonicalOrigin(input)).toEqual({ ok: false, rule: 1 });
  });
});

describe('checkSiteUrl: the AC-M1-05 table', () => {
  const canvasCloud = { ownHosts: OWN, profileFixedHosts: CANVAS_SIM_FIXED };
  const selfHosted = { ownHosts: OWN, profileFixedHosts: [], selfHosted: { refusedSuffixes: ['instructure.com', 'canvaslms.com'], allFixedHosts: [...CANVAS_SIM_FIXED, 'developer.blackboard.sim.test'] } };
  const blackboardSim = { ownHosts: OWN, profileFixedHosts: ['blackboard.sim.test', 'developer.blackboard.sim.test'] };

  it.each([
    ['http://school-a.canvas.sim.test', canvasCloud, 1],
    ['https://school-a.canvas.sim.test/canvas', canvasCloud, 1],
    ['https://school-a.canvas.sim.test/?x=1', canvasCloud, 1],
    ['https://school-a.canvas.sim.test/#f', canvasCloud, 1],
    ['https://u:p@school-a.canvas.sim.test', canvasCloud, 1],
    ['https://10.20.30.40', canvasCloud, 2],
    ['https://[::1]', canvasCloud, 2],
    ['https://localhost', canvasCloud, 2],
    ['https://a.localhost', canvasCloud, 2],
    ['https://intranet', canvasCloud, 2],
    ['https://lti.cogniate.test.', canvasCloud, 2],
    ['https://lti.cogniate.test', canvasCloud, 3],
    ['https://app.cogniate.test', canvasCloud, 3],
    ['https://content.cogniate-content.test:444', canvasCloud, 3],
    ['https://sso.canvas.sim.test', canvasCloud, 4],
    ['https://sso.canvas.sim.test:8443', canvasCloud, 4],
    ['https://developer.blackboard.sim.test', blackboardSim, 4],
    ['https://school.instructure.com', selfHosted, 5],
    ['https://sso.canvaslms.com', selfHosted, 5],
    ['https://sso.canvas.sim.test', selfHosted, 5],
  ] as const)('%s → rule %i', (input, rules, rule) => {
    expect(checkSiteUrl(input, rules)).toEqual({ ok: false, rule });
  });

  it('passes the positive cases in canonical form', () => {
    expect(checkSiteUrl('https://school-a.canvas.sim.test', canvasCloud)).toEqual({ ok: true, origin: 'https://school-a.canvas.sim.test' });
    expect(checkSiteUrl('HTTPS://Canvas-Self.Sim.Test:443/', selfHosted)).toEqual({ ok: true, origin: 'https://canvas-self.sim.test' });
    expect(checkSiteUrl('https://learn-a.blackboard.sim.test', blackboardSim)).toEqual({ ok: true, origin: 'https://learn-a.blackboard.sim.test' });
  });
});

describe('fixedHostsOf', () => {
  it('takes fixed hosts only; site- and service-built values have none; {clientId} in a path keeps the host', () => {
    expect(fixedHostsOf(['https://canvas.instructure.com', 'https://sso.canvaslms.com/api/lti/authorize_redirect', '{serviceUrl}/login/oauth2/token', 'https://sso.canvaslms.com/api/lti/security/jwks']))
      .toEqual(['canvas.instructure.com', 'sso.canvaslms.com']);
    expect(fixedHostsOf(['{siteUrl}', '{siteUrl}/api/lti/authorize_redirect', null])).toEqual([]);
    expect(fixedHostsOf(['https://developer.blackboard.com/api/v1/management/applications/{clientId}/jwks.json'])).toEqual(['developer.blackboard.com']);
  });
});
