import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublicUrls } from '@cogniate/shared';
import { loadPublicUrls } from '@cogniate/shared';

/** apps/player/dist of this checkout (compose mounts the repo's apps folder read-only at /repo/apps). */
const DEFAULT_PLAYER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'player', 'dist');

export interface AppConfig {
  urls: PublicUrls;
  /** cogniate.db, packages/, uploads/ (ADR-006). Compose: /data = infra/.data/cogniate-app. */
  dataDir: string;
  profile: string;
  /** APP_MASTER_KEY: 64 hex characters (npm run gen-env). */
  masterKey: Buffer;
  /** The LTI service API key file of the tool account `cogniate` (read at each use; app contract §1). */
  ltiApiKeyFile: string;
  /** apps/player build (runtime.js, runtime.css, shell.js): PLAYER_DIR, default apps/player/dist. */
  playerDir: string;
  /** T8: the Build Runner queue (BUILD_QUEUE_DIR, compose /build-queue): requests/ writable, status/ and out/ read-only. */
  buildQueueDir: string;
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
    playerDir: env.PLAYER_DIR && env.PLAYER_DIR !== '' ? env.PLAYER_DIR : DEFAULT_PLAYER_DIR,
    buildQueueDir: env.BUILD_QUEUE_DIR && env.BUILD_QUEUE_DIR !== '' ? env.BUILD_QUEUE_DIR : '/build-queue',
  };
}
