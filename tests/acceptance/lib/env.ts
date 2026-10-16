// Reads the stack .env file and the four public URLs (PUBLIC_*_URL).
import fs from 'node:fs';
import { ENV_FILE } from './paths';

export const URL_KEYS = {
  moodle: 'PUBLIC_MOODLE_URL',
  lti: 'PUBLIC_LTI_URL',
  app: 'PUBLIC_APP_URL',
  content: 'PUBLIC_CONTENT_URL',
} as const;

export type UrlName = keyof typeof URL_KEYS;
export type PublicUrls = Record<UrlName, string>;

export const DEFAULT_URLS: PublicUrls = {
  moodle: 'https://moodle.test',
  lti: 'https://lti.cogniate.test',
  app: 'https://app.cogniate.test',
  content: 'https://content.cogniate-content.test',
};

export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);
    out[m[1]] = value;
  }
  return out;
}

export function readEnvFile(file = ENV_FILE): Record<string, string> | null {
  if (!fs.existsSync(file)) return null;
  return parseEnvText(fs.readFileSync(file, 'utf8'));
}

/** Public URLs without a trailing slash. Order: process env, then .env, then the README §10 defaults. */
export function publicUrls(): PublicUrls {
  const file = readEnvFile() ?? {};
  const pick = (name: UrlName): string =>
    (process.env[URL_KEYS[name]] ?? file[URL_KEYS[name]] ?? DEFAULT_URLS[name]).replace(/\/+$/, '');
  return { moodle: pick('moodle'), lti: pick('lti'), app: pick('app'), content: pick('content') };
}

export function hostnameOf(url: string): string {
  return new URL(url).hostname;
}
