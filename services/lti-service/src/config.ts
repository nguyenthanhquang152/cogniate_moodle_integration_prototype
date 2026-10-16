import type { PublicUrls } from '@cogniate/shared';
import { knobValue, loadPublicUrls, parseAllowlist, portFromEnv } from '@cogniate/shared';

export interface LtiConfig {
  urls: PublicUrls;
  port: number;
  /** Folder of lti.db (compose: /data = infra/.data/lti-service). */
  dataDir: string;
  /** AES-256-GCM key for private key material (LTI_MASTER_KEY, 64 hex characters). */
  masterKey: Buffer;
  ltikTtlSeconds: number;
  /** Compose profile: "default" or "acceptance" (T2b). */
  profile: string;
  /** Hosts that may resolve to private addresses (dev: the Moodle host behind the stack proxy). */
  outboundAllowlist: string[];
}

export function loadConfig(env: Record<string, string | undefined> = process.env): LtiConfig {
  const masterHex = env.LTI_MASTER_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(masterHex)) throw new Error('LTI_MASTER_KEY must be 64 hex characters (npm run gen-env)');
  return {
    urls: loadPublicUrls(env),
    port: portFromEnv('PORT', 4100),
    dataDir: env.DATA_DIR ?? '/data',
    masterKey: Buffer.from(masterHex, 'hex'),
    ltikTtlSeconds: knobValue('LTIK_TTL_SECONDS', env),
    profile: env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default',
    outboundAllowlist: parseAllowlist(env.OUTBOUND_PRIVATE_HOST_ALLOWLIST),
  };
}
