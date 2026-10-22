import type { PublicUrls } from '@cogniate/shared';
import { knobValue, loadPublicUrls, parseAllowlist, portFromEnv } from '@cogniate/shared';
import { simulationEnabled } from './profiles/index.ts';

export interface LtiConfig {
  urls: PublicUrls;
  port: number;
  /** Operator listener (LA-ADR-06 D3): OPERATOR_HOST, default 127.0.0.1; the acceptance compose profile sets 0.0.0.0. */
  operatorHost: string;
  /** OPERATOR_PORT, default 4110. */
  operatorPort: number;
  /** Folder of lti.db (compose: /data = infra/.data/lti-service). */
  dataDir: string;
  /** AES-256-GCM key for private key material (LTI_MASTER_KEY, 64 hex characters). */
  masterKey: Buffer;
  ltikTtlSeconds: number;
  /** Compose profile: "default" or "acceptance" (T2b). */
  profile: string;
  /** Hosts that may resolve to private addresses (dev: the Moodle host behind the stack proxy). */
  outboundAllowlist: string[];
  /** Simulation profiles on: profile acceptance AND LTI_PROVIDER_SIMULATION=on (contract §9.13). */
  simulationProfiles: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): LtiConfig {
  const masterHex = env.LTI_MASTER_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(masterHex)) throw new Error('LTI_MASTER_KEY must be 64 hex characters (npm run gen-env)');
  const profile = env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default';
  return {
    urls: loadPublicUrls(env),
    port: portFromEnv('PORT', 4100),
    operatorHost: env.OPERATOR_HOST?.trim() || '127.0.0.1',
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
