import { isIP } from 'node:net';
import type { PublicUrls } from '@cogniate/shared';
import { ConfigRefusedError, knobValue, loadPublicUrls, parseAllowlist, portFromEnv, readSecretSetting, readServiceKnobs } from '@cogniate/shared';
import { simulationEnabled } from './profiles/index.ts';

type Env = Record<string, string | undefined>;

export interface LtiConfig {
  urls: PublicUrls;
  port: number;
  /** Operator listener (LA-ADR-06 D3): OPERATOR_HOST, default 127.0.0.1; the acceptance compose profile sets 0.0.0.0. */
  operatorHost: string;
  /** OPERATOR_PORT, default 4110. */
  operatorPort: number;
  /** Folder of lti.db (compose: /data = infra/.data/lti-service). */
  dataDir: string;
  /** AES-256-GCM key for private key material (LTI_MASTER_KEY or the file LTI_MASTER_KEY_FILE, 64 hex characters). */
  masterKey: Buffer;
  ltikTtlSeconds: number;
  /** STACK_PROFILE: "default", "acceptance" (T2b) or "production" (LA-ADR-06 D12). */
  profile: string;
  /** Hosts that may resolve to private addresses (dev: the Moodle host behind the stack proxy). */
  outboundAllowlist: string[];
  /** Simulation profiles on: profile acceptance AND LTI_PROVIDER_SIMULATION=on (contract §9.13). */
  simulationProfiles: boolean;
}

/** 127.0.0.0/8, ::1 or localhost: an address that only this host can reach. */
export function isLoopbackHost(host: string): boolean {
  const bare = host.replace(/^\[(.*)\]$/, '$1').toLowerCase();
  return bare === 'localhost' || bare === '::1' || (isIP(bare) === 4 && bare.startsWith('127.'));
}

/** BD-A2-79: one fixed sentence with the fix for each production refusal. It names settings, never their values. */
export const PRODUCTION_REFUSALS = {
  test_knob_active: 'Production does not allow test knobs. Remove every test knob setting, then start the service again.',
  simulation_on: 'Production does not allow simulation profiles. Remove LTI_PROVIDER_SIMULATION or set it to off, then start the service again.',
  private_host_allowlist: 'Production does not allow private outbound hosts. Remove OUTBOUND_PRIVATE_HOST_ALLOWLIST, then start the service again.',
  master_key_in_env: 'Production does not allow the master key as an environment value. Remove LTI_MASTER_KEY and use LTI_MASTER_KEY_FILE or the key-ring file.',
  no_trusted_proxy: 'Production needs TRUSTED_PROXY_CIDRS. Set it to the address or host name of the proxy, then start the service again.',
  operator_bind_not_loopback: 'Production allows the operator listener on loopback only. Set OPERATOR_HOST to 127.0.0.1 or ::1, then start the service again.',
} as const;
export type ProductionRefusal = keyof typeof PRODUCTION_REFUSALS;

/**
 * LA-ADR-06 D12 (LA-E5-21): the settings that are not safe in the production profile, in this order. The first one
 * refuses the start: one line config_refused {reason, message}, exit 1. The default and acceptance profiles skip this.
 */
export function productionRefusal(env: Env, operatorHost: string): ProductionRefusal | null {
  if (readServiceKnobs('lti-service', env).active.length > 0) return 'test_knob_active';
  if (env.LTI_PROVIDER_SIMULATION === 'on') return 'simulation_on';
  if (parseAllowlist(env.OUTBOUND_PRIVATE_HOST_ALLOWLIST).length > 0) return 'private_host_allowlist';
  // Only LTI_MASTER_KEY_FILE or the key-ring file may hold the key.
  if (env.LTI_MASTER_KEY) return 'master_key_in_env';
  if (!env.TRUSTED_PROXY_CIDRS?.trim()) return 'no_trusted_proxy';
  if (!isLoopbackHost(operatorHost)) return 'operator_bind_not_loopback';
  return null;
}

export function loadConfig(env: Env = process.env): LtiConfig {
  const profile = env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default';
  const operatorHost = env.OPERATOR_HOST?.trim() || '127.0.0.1';
  const refusal = profile === 'production' ? productionRefusal(env, operatorHost) : null;
  if (refusal) throw new ConfigRefusedError(refusal, PRODUCTION_REFUSALS[refusal]);
  const masterHex = readSecretSetting(env, 'LTI_MASTER_KEY', { hexKey: true }) ?? '';
  if (!/^[0-9a-f]{64}$/i.test(masterHex)) throw new Error('LTI_MASTER_KEY must be 64 hex characters (npm run gen-env), or the file LTI_MASTER_KEY_FILE must hold them');
  return {
    urls: loadPublicUrls(env),
    port: portFromEnv('PORT', 4100),
    operatorHost,
    operatorPort: portFromEnv('OPERATOR_PORT', 4110),
    dataDir: env.DATA_DIR ?? '/data',
    masterKey: Buffer.from(masterHex, 'hex'),
    ltikTtlSeconds: knobValue('LTIK_TTL_SECONDS', env),
    profile,
    outboundAllowlist: parseAllowlist(env.OUTBOUND_PRIVATE_HOST_ALLOWLIST),
    simulationProfiles: simulationEnabled(profile, env),
  };
}

/** "host:port" for logs (`operator_bind`); an IPv6 host gets brackets. */
export function hostPort(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}
