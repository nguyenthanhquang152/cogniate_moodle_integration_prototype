import type { PublicUrls } from '@cogniate/shared';
import { loadPublicUrls } from '@cogniate/shared';

export interface AppConfig {
  urls: PublicUrls;
  /** cogniate.db, packages/, uploads/ (ADR-006). Compose: /data = infra/.data/cogniate-app. */
  dataDir: string;
  profile: string;
  /** APP_MASTER_KEY: 64 hex characters (npm run gen-env). */
  masterKey: Buffer;
  /** The LTI service API key file of the tool account `cogniate` (read at each use; app contract §1). */
  ltiApiKeyFile: string;
}

function masterKeyFrom(raw: string | undefined): Buffer {
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) throw new Error('APP_MASTER_KEY must be 64 hex characters (npm run gen-env).');
  return Buffer.from(raw, 'hex');
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    urls: loadPublicUrls(env),
    dataDir: env.DATA_DIR && env.DATA_DIR !== '' ? env.DATA_DIR : '/data',
    profile: env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default',
    masterKey: masterKeyFrom(env.APP_MASTER_KEY),
    ltiApiKeyFile: env.LTI_API_KEY_FILE && env.LTI_API_KEY_FILE !== '' ? env.LTI_API_KEY_FILE : '/run/secrets/app/lti-api-key',
  };
}
