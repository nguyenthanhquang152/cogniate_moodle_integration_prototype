import { describe, expect, it } from 'vitest';
import { hostPort, loadConfig } from './config.ts';

const ENV = {
  LTI_MASTER_KEY: '0'.repeat(64),
  PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test', PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
};

describe('operator listener settings (LA-ADR-06 D3)', () => {
  it('binds 127.0.0.1:4110 by default; OPERATOR_HOST changes the host (acceptance compose: 0.0.0.0)', () => {
    expect(loadConfig(ENV)).toMatchObject({ operatorHost: '127.0.0.1', operatorPort: 4110 });
    expect(loadConfig({ ...ENV, OPERATOR_HOST: '' }).operatorHost).toBe('127.0.0.1');
    expect(loadConfig({ ...ENV, OPERATOR_HOST: '0.0.0.0' }).operatorHost).toBe('0.0.0.0');
  });

  it('formats operator_bind as host:port, with brackets for IPv6', () => {
    expect(hostPort('127.0.0.1', 4110)).toBe('127.0.0.1:4110');
    expect(hostPort('::1', 4110)).toBe('[::1]:4110');
  });
});
