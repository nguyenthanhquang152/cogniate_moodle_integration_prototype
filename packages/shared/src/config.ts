import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import type { Logger } from './logger.ts';

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
 * config_refused {reason, message[, setting]} and exits with code 1 (BD-A2-79). The reason is a fixed code, the message
 * is a fixed sentence with the fix, and the setting is a setting name: never a setting value.
 */
export class ConfigRefusedError extends Error {
  readonly reason: string;
  readonly setting: string | undefined;
  constructor(reason: string, message: string, setting?: string) {
    super(message);
    this.name = 'ConfigRefusedError';
    this.reason = reason;
    this.setting = setting;
  }
}

/** BD-A2-79: the fixed message of the secret_file_mode refusal. */
export const SECRET_FILE_MODE_MESSAGE = 'A secret file has group or world access. Set the mode of the file named by the setting to 0600, then start the service again.';

/**
 * BD-A2-78: read the secret file that `setting` names. It opens the file, then checks the opened descriptor (no
 * check-then-open race): a regular file whose mode has no group or world bit, so 0600 and 0400 pass and 0640 and 0644
 * fail. A failed mode check refuses the start in the production profile (secret_file_mode with the setting name, never
 * the path); the default and acceptance profiles log one warn line secret_file_mode_open {setting} and go on.
 */
export function readSecretFile(path: string, setting: string, profile: string, logger?: Pick<Logger, 'warn'>): string {
  const fd = openSync(path, 'r');
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error(`${setting} must name a regular file.`);
    if ((stat.mode & 0o077) !== 0) {
      if (profile === 'production') throw new ConfigRefusedError('secret_file_mode', SECRET_FILE_MODE_MESSAGE, setting);
      logger?.warn('secret_file_mode_open', { setting });
    }
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}

const HEX_KEY = /^[0-9a-f]{64}$/i;

/**
 * A secret setting from the file named by `<NAME>_FILE` (read with readSecretFile; its text without the surrounding
 * white space), or from the value `<NAME>` (LA-ADR-06 D12). The profile is STACK_PROFILE of the same env. Both set
 * with different values is an error, so a stale value never wins in silence. Undefined when neither is set. Errors name
 * the settings, never their values.
 * hexKey (BD-A2-80): each value must be 64 hex characters; the compare ignores the letter case (the same bytes), and
 * the result is in lower case. Other secrets keep the exact compare.
 */
export function readSecretSetting(
  env: Record<string, string | undefined>, name: string, options: { hexKey?: boolean; logger?: Pick<Logger, 'warn'> } = {},
): string | undefined {
  const file = env[`${name}_FILE`];
  const fromFile = file ? readSecretFile(file, `${name}_FILE`, env.STACK_PROFILE || 'default', options.logger).trim() : undefined;
  const fromEnv = env[name] || undefined;
  const values = [fromFile, fromEnv].filter((value): value is string => value !== undefined);
  if (options.hexKey && values.some((value) => !HEX_KEY.test(value))) {
    throw new Error(`${name} must be 64 hex characters (npm run gen-env), or the file ${name}_FILE must hold them.`);
  }
  const normal = values.map((value) => (options.hexKey ? value.toLowerCase() : value));
  if (normal.length === 2 && normal[0] !== normal[1]) throw new Error(`${name} and ${name}_FILE have different values. Set only one of them.`);
  return normal[0];
}
