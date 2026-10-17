import type { PublicUrls } from '@cogniate/shared';
import { loadPublicUrls } from '@cogniate/shared';

export interface AppConfig {
  urls: PublicUrls;
  /** cogniate.db, packages/, uploads/ (ADR-006). Compose: /data = infra/.data/cogniate-app. */
  dataDir: string;
  profile: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    urls: loadPublicUrls(env),
    dataDir: env.DATA_DIR && env.DATA_DIR !== '' ? env.DATA_DIR : '/data',
    profile: env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default',
  };
}
