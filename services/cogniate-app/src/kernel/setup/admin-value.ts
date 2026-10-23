// The kernel admin-value setup adapter (LA-ADR-01 D5, E2-K; Reviewer-B B-LAD-05): one ConnectionSetup for each channel
// that has no app.ts, because all its profiles have `endpoints: admin` (lti-generic; later brightspace). It is pure: no
// database, no LTI call. Everything comes from the manifest and the capability set. The LTI service checks the values
// again against the profile traits, and the operator grant binds every admin value (LA-ADR-02 D2a, D6).
import type { CapabilitySet, ChannelManifest } from '@cogniate/channel-kernel';
import { fillFieldDefault } from '@cogniate/channel-kernel';
import { GRANT_CODE, PRINTABLE_ID, toolName } from '@cogniate/channel-kernel/setup';
import type { AdminValues, BindingTarget, ConnectionSetup, PlatformBodyResult, StagedCreate, ToolRow } from '../ports.ts';

/** The strict `PUT …/platform` body of an admin-value channel (app API delta §3.4). */
const URL_KEYS = ['issuer', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl', 'tokenAudience'] as const;
const INITIAL = { required: ['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl', 'grantCode'], optional: ['tokenAudience'] } as const;
const ADD_DEPLOYMENT = { required: ['deploymentId', 'grantCode'], optional: [] } as const;

const PRIVACY = "Do not send the learner's name or e-mail.";

/** An https URL with no user name, password or fragment, at most 2048 characters. */
function isHttpsUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
}

/**
 * Strict body (app contract §4.4): every key must be listed and every required key present; a value is a trimmed
 * string of the right form. A key with a `FieldSpec.default` that the body does not send gets the default, with
 * `{siteUrl}` filled; a sent value always replaces it. The answer lists every bad key, in body order first, then the
 * missing required keys.
 */
function parseBody(body: unknown, spec: { required: readonly string[]; optional: readonly string[] }, defaults: Readonly<Record<string, string>>, siteUrl: string):
  { ok: true; values: Record<string, string> } | { ok: false; fields: string[] } {
  if (body !== null && body !== undefined && (typeof body !== 'object' || Array.isArray(body))) return { ok: false, fields: ['body'] };
  const sent = (body ?? {}) as Record<string, unknown>;
  const known = new Set<string>([...spec.required, ...spec.optional]);
  const bad: string[] = [];
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(sent)) {
    if (!known.has(key)) { bad.push(key); continue; }
    const v = typeof raw === 'string' ? raw.trim() : null;
    const ok = v !== null && (key === 'grantCode' ? GRANT_CODE.test(v) : (URL_KEYS as readonly string[]).includes(key) ? isHttpsUrl(v) : PRINTABLE_ID.test(v));
    if (ok) values[key] = v; else bad.push(key);
  }
  for (const key of known) {
    if (key in sent || defaults[key] === undefined) continue;
    values[key] = fillFieldDefault(defaults[key], { siteUrl });
  }
  for (const key of spec.required) if (!(key in sent) && values[key] === undefined) bad.push(key);
  return bad.length > 0 ? { ok: false, fields: [...new Set(bad)] } : { ok: true, values };
}

/** The ConnectionSetup of an admin-value channel, made from its manifest and its channel-level capability set. */
export function adminValueSetup(manifest: ChannelManifest, capabilities: CapabilitySet): ConnectionSetup {
  const profiles: ConnectionSetup['profiles'] = Object.freeze(Object.fromEntries(manifest.registration.flatMap((r) => r.profiles)
    .map((id) => [id, Object.freeze({ sharing: 'exclusive' as const, serviceUrl: false, label: manifest.names.label })])));
  // FieldSpec.default of the manual binding fields (LA-ADR-01 D2).
  const defaults: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(manifest.setup.bindingFields
    .filter((f) => f.default !== undefined && (f.method === undefined || f.method === 'manual')).map((f) => [f.key, f.default!])));
  const scopes = capabilities['registration.scopes'].join(' ');

  return {
    channel: manifest.id,
    profiles,
    sharingOf: (id) => profiles[id]?.sharing ?? null,
    // The core create route applies site rules 1–4 to an admin-value channel (app API delta §3.1); no service URL.
    checkCreate: ({ siteUrl, serviceUrl, profile }) => {
      if (!profiles[profile.id]) return { ok: false, field: 'profile' };
      if (serviceUrl !== undefined) return { ok: false, field: 'serviceUrl' };
      return { ok: true, siteUrl, serviceUrl: siteUrl };
    },
    // The generic row set of app API delta §3.3 (A1 BD-A1-78: while the manifest has no row data).
    toolConfiguration: ({ toolUrls, libraryName }): ToolRow[] => [
      { key: 'tool_name', label: 'Tool name', value: toolName(libraryName) },
      { key: 'login_url', label: 'Login URL', value: toolUrls.login },
      { key: 'redirect_uri', label: 'Redirect URI', value: toolUrls.launch },
      { key: 'target_link_uri', label: 'Target link URI', value: toolUrls.launch },
      { key: 'jwks_url', label: 'Public keyset URL', value: toolUrls.keys },
      { key: 'deep_linking_url', label: 'Deep Linking URL', value: toolUrls.launch },
      { key: 'scopes', label: 'Scopes', value: scopes },
      { key: 'privacy', label: 'Privacy', value: PRIVACY },
    ],
    parseBindingBody: (body, ctx): PlatformBodyResult => {
      if (ctx.purpose === 'add_deployment') {
        const parsed = parseBody(body, ADD_DEPLOYMENT, {}, ctx.siteUrl);
        if (!parsed.ok) return parsed;
        return { ok: true, values: { clientId: ctx.clientId ?? '', deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode! } };
      }
      const parsed = parseBody(body, INITIAL, defaults, ctx.siteUrl);
      if (!parsed.ok) return parsed;
      const v = parsed.values;
      // The issuer may have a path; its origin must be the connection site. Other endpoints may be on another https
      // host (`endpointOrigins: any-https`); the LTI service checks their hosts, and the grant binds them.
      if (isHttpsUrl(v.issuer!) && new URL(v.issuer!).origin !== ctx.siteUrl) return { ok: false, fields: ['issuer'], reason: 'origin' };
      const adminValues: AdminValues = {
        issuer: v.issuer!, authenticationEndpoint: v.authenticationEndpoint!, accessTokenEndpoint: v.accessTokenEndpoint!, jwksUrl: v.jwksUrl!,
        ...(v.tokenAudience !== undefined ? { tokenAudience: v.tokenAudience } : {}),
      };
      return { ok: true, values: { clientId: v.clientId!, deploymentId: v.deploymentId!, grantCode: v.grantCode!, adminValues } };
    },
    initialTarget: ({ connection, values }): BindingTarget => {
      if (!profiles[connection.profile] || !values.adminValues) throw new Error('an admin-value target needs an offered profile and the admin values');
      return {
        kind: 'exclusive_platform', profile: connection.profile, issuer: values.adminValues.issuer,
        clientId: values.clientId, deploymentId: values.deploymentId, siteUrl: connection.siteUrl, serviceUrl: connection.serviceUrl,
        platformId: connection.ltiPlatformId, adminValues: values.adminValues,
      };
    },
    createRequest: (target, { libraryName }): StagedCreate => {
      if (target.kind === 'exclusive_platform') {
        if (!target.adminValues) throw new Error('an admin-value create needs the admin values');
        const a = target.adminValues;
        return { kind: 'platform', body: {
          profile: target.profile, url: a.issuer, clientId: target.clientId, name: toolName(libraryName),
          authenticationEndpoint: a.authenticationEndpoint, accesstokenEndpoint: a.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: a.jwksUrl },
          ...(a.tokenAudience !== undefined ? { clientAssertionAud: a.tokenAudience } : {}), deploymentIds: [target.deploymentId],
        } };
      }
      if (target.kind === 'platform_deployment') return { kind: 'deployment', platformId: target.platformId, body: { deploymentId: target.deploymentId } };
      throw new Error('an admin-value channel has no shared deployment');
    },
  };
}
