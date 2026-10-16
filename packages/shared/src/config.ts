/**
 * The four public URLs of the stack. They are the only source of public URLs (B-T0-01):
 * npm run gen-env writes them to .env from PUBLIC_PORT, compose passes them to every container.
 * Do not write URL literals in code. Use loadPublicUrls() and build paths from these origins.
 */
export interface PublicUrls {
  /** Moodle (the LTI platform), for example https://moodle.test */
  moodle: string;
  /** LTI service, for example https://lti.cogniate.test */
  lti: string;
  /** Cogniate app and portal, for example https://app.cogniate.test */
  app: string;
  /** Content origin (a different site), for example https://content.cogniate-content.test */
  content: string;
}

export const PUBLIC_URL_ENV = {
  moodle: 'PUBLIC_MOODLE_URL',
  lti: 'PUBLIC_LTI_URL',
  app: 'PUBLIC_APP_URL',
  content: 'PUBLIC_CONTENT_URL',
} as const satisfies Record<keyof PublicUrls, string>;

/** Read and check the four URLs. Each must be an https origin (no path, query or trailing slash). */
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
  return { moodle: read('moodle'), lti: read('lti'), app: read('app'), content: read('content') };
}
