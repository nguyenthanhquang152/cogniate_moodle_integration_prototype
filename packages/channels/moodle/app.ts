import type { ConnectionSetup, ToolRow } from '../../../services/cogniate-app/src/kernel/ports.ts';
// Moodle (`standard` profile): unchanged behaviour (app contract §4, §4.1). Dynamic registration and the six-value
// manual connect stay in app/connections.ts and tool-pages/register.ts; this adapter gives the rows and the data.

/** App contract §4.1: exactly these 16 rows, in this order (stable keys; labels are the Moodle 5.2.4 form labels). */
export function moodleToolRows(urls: Parameters<typeof toolUrls>[0], libraryName: string): ToolRow[] {
  const t = toolUrls(urls);
  return [
    { key: 'tool_name', label: 'Tool name', value: toolName(libraryName) },
    { key: 'tool_url', label: 'Tool URL', value: t.launch },
    { key: 'lti_version', label: 'LTI version', value: 'LTI 1.3' },
    { key: 'public_key_type', label: 'Public key type', value: 'Keyset URL' },
    { key: 'public_keyset_url', label: 'Public keyset', value: t.keys },
    { key: 'initiate_login_url', label: 'Initiate login URL', value: t.login },
    { key: 'redirection_uris', label: 'Redirection URI(s)', value: t.launch },
    { key: 'deep_linking', label: 'Supports Deep Linking (Content-Item Message)', value: 'Yes' },
    { key: 'content_selection_url', label: 'Content Selection URL', value: t.launch },
    { key: 'tool_configuration_usage', label: 'Tool configuration usage', value: 'Show in activity chooser and as a preconfigured tool' },
    { key: 'launch_container', label: 'Default launch container', value: 'New window' },
    { key: 'ags', label: 'IMS LTI Assignment and Grade Services', value: 'Use this service for grade sync and column management' },
    { key: 'nrps', label: 'IMS LTI Names and Role Provisioning', value: "Use this service to retrieve members' information as per privacy settings" },
    { key: 'share_name', label: "Share launcher's name with tool", value: 'Never' },
    { key: 'share_email', label: "Share launcher's email with tool", value: 'Never' },
    // Q-T7-01 (contract §4.1 row 16): the exact Moodle 5.2.4 option text of the tool form.
    { key: 'accept_grades', label: 'Accept grades from the tool', value: 'As specified in Deep Linking definition or Delegate to teacher' },
  ];
}

const profiles: ConnectionSetup['profiles'] = {
  standard: { sharing: 'exclusive', serviceUrl: false, label: 'Moodle site' },
};
const setup: ConnectionSetup = {
  channel: 'moodle', profiles,
  sharingOf: (id) => profiles[id]?.sharing ?? null,
  checkCreate: ({ siteUrl, serviceUrl }) => {
    if (!isHttpsUrl(siteUrl) || new URL(siteUrl).origin !== siteUrl) return { ok: false, field: 'siteUrl' };
    if (serviceUrl !== undefined) return { ok: false, field: 'serviceUrl' };
    return { ok: true, siteUrl, serviceUrl: siteUrl };
  },
  toolConfiguration: (ctx) => moodleToolRows(ctx.urls, ctx.libraryName),
  parseBindingBody: (body, ctx) => {
    if (body !== null && body !== undefined && (typeof body !== 'object' || Array.isArray(body))) return { ok: false, fields: ['body'] };
    const obj = body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const bad = Object.keys(obj).filter((key) => !(PLATFORM_FIELDS as readonly string[]).includes(key));
    const values: Record<string, string> = {};
    for (const key of PLATFORM_FIELDS) {
      const raw = obj[key];
      if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 2048) bad.push(key);
      else values[key] = raw.trim();
    }
    if (bad.length) return { ok: false, fields: [...new Set(bad)] };
    const v = values as Record<(typeof PLATFORM_FIELDS)[number], string>;
    const fields = badPlatformFields(ctx.siteUrl, v);
    if (fields.length) return { ok: false, fields, reason: 'origin' };
    return { ok: true, values: { clientId: v.clientId, deploymentId: v.deploymentId, grantCode: '',
      adminValues: { issuer: v.issuer, authenticationEndpoint: v.authenticationEndpoint, accessTokenEndpoint: v.accessTokenEndpoint, jwksUrl: v.jwksUrl } } };
  },
  selfCreate: (v, { libraryName }) => ({ kind: 'platform', body: {
    url: v.issuer, clientId: v.clientId, name: toolName(libraryName), authenticationEndpoint: v.authenticationEndpoint,
    accesstokenEndpoint: v.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: v.jwksUrl }, deploymentIds: [v.deploymentId],
  } }),
};
const isHttpsUrl = (v: string): boolean => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
};
const PLATFORM_FIELDS = ['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl'] as const;
/**
 * App contract §4 PUT .../platform rules: https; issuer origin = siteUrl; auth, token and JWKS URLs on the issuer
 * origin. Returns the names of the fields that break a rule (empty = fine).
 */
export function badPlatformFields(siteUrl: string, v: Record<(typeof PLATFORM_FIELDS)[number], string>): string[] {
  const bad = new Set<string>();
  if (!isHttpsUrl(v.issuer) || new URL(v.issuer).origin !== siteUrl) bad.add('issuer');
  const origin = isHttpsUrl(v.issuer) ? new URL(v.issuer).origin : siteUrl;
  for (const f of ['authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl'] as const) {
    if (!isHttpsUrl(v[f]) || new URL(v[f]).origin !== origin) bad.add(f);
  }
  return [...bad];
}


// Small pieces that every provider adapter and the connection routes share (no I/O).
type PublicUrls = Parameters<ConnectionSetup['toolConfiguration']>[0]['urls'];

/** The tool account of the app in the LTI service (contract §4.1). */
export const TOOL_ACCOUNT = 'cogniate';

/** Tool name in the LMS: `Cogniate (<library name>)`, ASCII only (flows §6a). */
export function toolName(libraryName: string): string {
  const ascii = libraryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return `Cogniate (${ascii || 'Library'})`;
}

/** The protocol URLs of the tool account (all from PUBLIC_LTI_URL). */
export function toolUrls(urls: PublicUrls): { launch: string; login: string; keys: string } {
  return {
    launch: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}`,
    login: `${urls.lti}/lti/login/${TOOL_ACCOUNT}`,
    keys: `${urls.lti}/lti/keys/${TOOL_ACCOUNT}`,
  };
}


export default setup;
