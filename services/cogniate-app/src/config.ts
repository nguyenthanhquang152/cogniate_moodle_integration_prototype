import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KeyRing, Logger, PublicUrls } from '@cogniate/shared';
import { ConfigRefusedError, loadPublicUrls } from '@cogniate/shared';
import { readAppStartupKeys } from './app/sealing.ts';

/** apps/player/dist of this checkout (compose mounts the repo's apps folder read-only at /repo/apps). */
const DEFAULT_PLAYER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'player', 'dist');

export interface AppConfig {
  jobInstanceId: string;
  /** APP_JOB_RUNNER controls jobs in the web process. The standalone worker always runs them. */
  jobRunner: boolean;
  urls: PublicUrls;
  /** cogniate.db, packages/, uploads/ (ADR-006). Compose: /data = infra/.data/cogniate-app. */
  dataDir: string;
  profile: string;
  /**
   * The key handle: APP_MASTER_KEY or APP_MASTER_KEY_FILE (64 hex characters, npm run gen-env), or the version `legacy`
   * of the app key ring (LA-E5-22).
   */
  masterKey: Buffer;
  /** APP_KEYRING_FILE (default /run/secrets/app-keys/keyring.json); no file = the master key as the version `legacy`. */
  keyRing: KeyRing;
  /** The LTI service API key file of the tool account `cogniate` (read at each use; app contract §1). */
  ltiApiKeyFile: string;
  /**
   * LTI_API_URL: base URL of the `/api/*` calls when it is not PUBLIC_LTI_URL. Only the `acceptance` profile may set it,
   * to the app-to-LTI transport gate (M3 §3.3). In every other profile the app calls the LTI service directly, so
   * loadConfig refuses a value there (the API key must not go to another origin by mistake).
   */
  ltiApiUrl: string | null;
  /** apps/player build (runtime.js, runtime.css, shell.js): PLAYER_DIR, default apps/player/dist. */
  playerDir: string;
  /** T8: the Build Runner queue (BUILD_QUEUE_DIR, compose /build-queue): requests/ writable, status/ and out/ read-only. */
  buildQueueDir: string;
}

/** A2 BD-A2-91 (LA-ADR-06 D12): production takes the app master key only from a file. Fixed text, never a value. */
export const APP_MASTER_KEY_IN_ENV_MESSAGE = 'Production does not allow the app master key as an environment value. Remove APP_MASTER_KEY and use APP_MASTER_KEY_FILE or the app key-ring file.';

/** An https origin in the `acceptance` profile, or null when unset (M3 §3.3). Any other profile refuses a value. */
function ltiApiUrlFrom(raw: string | undefined, profile: string): string | null {
  if (!raw) return null;
  if (profile !== 'acceptance') {
    throw new Error(`LTI_API_URL is only for the acceptance profile (M3 §3.3), but STACK_PROFILE is ${profile}. Unset LTI_API_URL.`);
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('LTI_API_URL must be an https origin without path or trailing slash.');
  }
  if (u.protocol !== 'https:' || u.origin !== raw) throw new Error('LTI_API_URL must be an https origin without path or trailing slash.');
  return u.origin;
}

/** `logger` gets the one `secret_file_mode_open` warning of a secret file with group or world access (not production). */
export function loadConfig(env: Record<string, string | undefined> = process.env, logger?: Pick<Logger, 'warn'>): AppConfig {
  const profile = env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default';
  if (profile === 'production' && env.APP_MASTER_KEY) throw new ConfigRefusedError('app_master_key_in_env', APP_MASTER_KEY_IN_ENV_MESSAGE);
  const keys = readAppStartupKeys(env, logger);
  const jobInstanceId = env.JOB_INSTANCE_ID ?? 'app-1';
  if (!/^[A-Za-z0-9-]{1,64}$/.test(jobInstanceId)) throw new Error('JOB_INSTANCE_ID must contain 1 to 64 ASCII letters, digits, or hyphens.');
  const runner = env.APP_JOB_RUNNER ?? 'on';
  if (runner !== 'on' && runner !== 'off') throw new Error('APP_JOB_RUNNER must be on or off.');
  return {
    jobInstanceId, jobRunner: runner === 'on',
    urls: loadPublicUrls(env),
    dataDir: env.DATA_DIR && env.DATA_DIR !== '' ? env.DATA_DIR : '/data',
    profile,
    masterKey: keys.handle,
    keyRing: keys.ring,
    ltiApiKeyFile: env.LTI_API_KEY_FILE && env.LTI_API_KEY_FILE !== '' ? env.LTI_API_KEY_FILE : '/run/secrets/app/lti-api-key',
    ltiApiUrl: ltiApiUrlFrom(env.LTI_API_URL, profile),
    playerDir: env.PLAYER_DIR && env.PLAYER_DIR !== '' ? env.PLAYER_DIR : DEFAULT_PLAYER_DIR,
    buildQueueDir: env.BUILD_QUEUE_DIR && env.BUILD_QUEUE_DIR !== '' ? env.BUILD_QUEUE_DIR : '/build-queue',
  };
}
