import { readFileSync } from 'node:fs';

/**
 * The three public service URLs of the stack. They are the only source of public URLs (B-T0-01):
 * npm run gen-env writes them to .env from PUBLIC_PORT, compose passes them to every container.
 * Do not write URL literals in code. Use loadPublicUrls() and build paths from these origins.
 */
export interface PublicUrls {
  /** LTI service, for example https://lti.cogniate.test */
  lti: string;
  /** Cogniate app and portal, for example https://app.cogniate.test */
  app: string;
  /** Content origin (a different site), for example https://content.cogniate-content.test */
  content: string;
}

export const PUBLIC_URL_ENV = {
  lti: 'PUBLIC_LTI_URL',
  app: 'PUBLIC_APP_URL',
  content: 'PUBLIC_CONTENT_URL',
} as const satisfies Record<keyof PublicUrls, string>;

/** Read and check the three service URLs. Each must be an https origin (no path, query or trailing slash). */
export function loadPublicUrls(env: Record<string, string | undefined> = process.env): PublicUrls {
  const read = (key: keyof PublicUrls): string => {
    const name = PUBLIC_URL_ENV[key];
    const raw = env[name];
    if (raw === undefined || raw === '') {
      throw new Error(`${name} is not set. Run npm run gen-env and start the service with the stack .env.`);
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`${name} is not a URL: "${raw}"`);
    }
    if (url.protocol !== 'https:' || url.origin !== raw) {
      throw new Error(`${name} must be an https origin without path or trailing slash, got "${raw}"`);
    }
    return url.origin;
  };
  return { lti: read('lti'), app: read('app'), content: read('content') };
}

/**
 * LA-ADR-06 D12: a setting that the production profile does not allow. The service logs one line
 * config_refused {reason} and exits with code 1. The reason is a fixed code, never a setting value.
 */
export class ConfigRefusedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`config_refused: ${reason}`);
    this.name = 'ConfigRefusedError';
    this.reason = reason;
  }
}

/**
 * A secret setting from the file named by `<NAME>_FILE` (its text without the surrounding white space), or from the
 * value `<NAME>` (LA-ADR-06 D12). Both set with different values is an error, so a stale value never wins in silence.
 * Undefined when neither is set. The error names the settings, never their values.
 */
export function readSecretSetting(env: Record<string, string | undefined>, name: string): string | undefined {
  const file = env[`${name}_FILE`];
  const fromFile = file ? readFileSync(file, 'utf8').trim() : undefined;
  const fromEnv = env[name] || undefined;
  if (fromFile !== undefined && fromEnv !== undefined && fromFile !== fromEnv) {
    throw new Error(`${name} and ${name}_FILE have different values. Set only one of them.`);
  }
  return fromFile ?? fromEnv;
}
