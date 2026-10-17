import { describe, expect, it } from 'vitest';
import { agsBaseUrl, isAllowedServiceUrl, lineItemSubUrl, withQuery } from './service-url.ts';

const LINEITEMS = 'https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1';

describe('line item URL rule (contract §3.4, security §8)', () => {
  it('allows line items of the claim: same origin, path inside, every claim query parameter with the same value', () => {
    expect(isAllowedServiceUrl('https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1', LINEITEMS)).toBe(true);
    expect(isAllowedServiceUrl('https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1&limit=10', LINEITEMS)).toBe(true);
    expect(isAllowedServiceUrl(LINEITEMS, LINEITEMS)).toBe(true);
  });

  it.each([
    ['another origin (evil.test)', 'https://evil.test/x'],
    ['another port', 'https://moodle.test:8443/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1'],
    ['http', 'http://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1'],
    ['another course (path)', 'https://moodle.test/mod/lti/services.php/3/lineitems/9/lineitem?type_id=1'],
    ['a path that only shares the prefix text', 'https://moodle.test/mod/lti/services.php/2/lineitemsX?type_id=1'],
    ['another tool in the same course (type_id)', 'https://moodle.test/mod/lti/services.php/2/lineitems/8/lineitem?type_id=2'],
    ['no type_id', 'https://moodle.test/mod/lti/services.php/2/lineitems/8/lineitem'],
    ['type_id twice', 'https://moodle.test/mod/lti/services.php/2/lineitems/8/lineitem?type_id=1&type_id=2'],
    ['user info', 'https://a:b@moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1'],
    ['a fragment', 'https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1#x'],
    ['not a URL', 'lineitem-7'],
  ])('refuses %s', (_n, url) => expect(isAllowedServiceUrl(url, LINEITEMS)).toBe(false));

  it('agsBaseUrl prefers lineitems, else lineitem', () => {
    expect(agsBaseUrl({ lineitems: LINEITEMS, lineitem: 'x' })).toBe(LINEITEMS);
    expect(agsBaseUrl({ lineitem: 'https://moodle.test/li' })).toBe('https://moodle.test/li');
    expect(agsBaseUrl(null)).toBeNull();
  });
});

describe('scores and results URL (contract §3.4)', () => {
  it('adds /scores before the query, with and without a query', () => {
    expect(lineItemSubUrl('https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1', 'scores'))
      .toBe('https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1');
    expect(lineItemSubUrl('https://platform.example/li/7', 'scores')).toBe('https://platform.example/li/7/scores');
    expect(lineItemSubUrl('https://platform.example/li/7/', 'results')).toBe('https://platform.example/li/7/results');
  });

  it('withQuery keeps the existing parameters and skips undefined values', () => {
    expect(withQuery(LINEITEMS, { resource_link_id: '3', tag: undefined, limit: 5 })).toBe(`${LINEITEMS}&resource_link_id=3&limit=5`);
  });
});
