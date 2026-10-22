// Canary channel app adapter (LA-E7-01, LA-ADR-01 D5 `ConnectionSetup`, BD-A1-20, BD-A1-28).
// Pure functions with fixed data; never uses a database, LTI client, network or process globals (BD-A1-16, BD-A2-11).
import type {
  BindingTarget,
  ConnectionSetup,
  CreateRequestContext,
  GrantPurpose,
  InitialTargetContext,
  PlatformBodyContext,
  PlatformBodyResult,
  ProfileView,
  StagedCreate,
  ToolConfigurationContext,
  ToolRow,
} from '../../../../services/cogniate-app/src/kernel/ports.ts';

const ALLOWED_BINDING_KEYS = ['clientId', 'deploymentId', 'grantCode'] as const;
const GRANT_CODE_43_BASE64URL = /^[A-Za-z0-9_-]{43}$/;

const canaryAppAdapter = {
  channel: 'zz-canary',

  checkCreate(input: {
    siteUrl: string;
    serviceUrl?: string;
    profile: ProfileView;
  }): { ok: true; siteUrl: string; serviceUrl: string } | { ok: false; field: string; rule?: number } {
    if (!input || typeof input.siteUrl !== 'string' || input.siteUrl.trim().length === 0) {
      return { ok: false, field: 'siteUrl', rule: 1 };
    }
    if (input.serviceUrl !== undefined && input.serviceUrl !== '') {
      return { ok: false, field: 'serviceUrl' };
    }
    let parsed: URL;
    try {
      parsed = new URL(input.siteUrl);
    } catch {
      return { ok: false, field: 'siteUrl', rule: 1 };
    }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
      return { ok: false, field: 'siteUrl', rule: 1 };
    }
    return {
      ok: true,
      siteUrl: parsed.origin,
      serviceUrl: parsed.origin,
    };
  },

  toolConfiguration(ctx: ToolConfigurationContext): ToolRow[] {
    const ltiOrigin = ctx.urls.lti;
    return [
      { key: 'issuer', label: 'Tool URL', value: ltiOrigin },
      { key: 'loginUrl', label: 'Initiate login URL', value: `${ltiOrigin}/lti/login` },
      { key: 'launchUrl', label: 'Redirection URI(s)', value: `${ltiOrigin}/lti/launch` },
      { key: 'jwksUrl', label: 'Public keyset URL', value: `${ltiOrigin}/lti/keys` },
    ];
  },

  parseBindingBody(body: unknown, ctx: PlatformBodyContext & { purpose: GrantPurpose }): PlatformBodyResult {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, fields: ['body'] };
    }
    if (ctx.purpose !== 'initial' && ctx.purpose !== 'add_deployment') {
      return { ok: false, fields: ['purpose'] };
    }
    const record = body as Record<string, unknown>;
    const invalidFields: string[] = [];

    for (const key of Object.keys(record)) {
      if (!(ALLOWED_BINDING_KEYS as readonly string[]).includes(key)) {
        invalidFields.push(key);
      }
    }
    for (const reqKey of ALLOWED_BINDING_KEYS) {
      const val = record[reqKey];
      if (typeof val !== 'string' || val.trim().length === 0) {
        if (!invalidFields.includes(reqKey)) invalidFields.push(reqKey);
      }
    }
    if (
      typeof record.grantCode === 'string' &&
      record.grantCode.trim().length > 0 &&
      !GRANT_CODE_43_BASE64URL.test(record.grantCode.trim())
    ) {
      if (!invalidFields.includes('grantCode')) invalidFields.push('grantCode');
    }
    if (invalidFields.length > 0) {
      return { ok: false, fields: invalidFields };
    }
    return {
      ok: true,
      values: {
        clientId: (record.clientId as string).trim(),
        deploymentId: (record.deploymentId as string).trim(),
        grantCode: (record.grantCode as string).trim(),
      },
    };
  },

  initialTarget(ctx: InitialTargetContext): BindingTarget {
    return {
      kind: 'exclusive_platform',
      profile: ctx.profile.id,
      issuer: ctx.profile.issuer ?? ctx.connection.siteUrl,
      clientId: ctx.values.clientId,
      deploymentId: ctx.values.deploymentId,
      siteUrl: ctx.connection.siteUrl,
      serviceUrl: ctx.connection.serviceUrl,
      platformId: null,
    };
  },

  createRequest(target: BindingTarget, ctx: CreateRequestContext): StagedCreate {
    if (target.kind === 'exclusive_platform') {
      return {
        kind: 'platform',
        body: {
          name: `${ctx.libraryName} (Canary LMS)`,
          profile: target.profile,
          clientId: target.clientId,
          deploymentIds: [target.deploymentId],
          siteUrl: target.siteUrl,
          serviceUrl: target.serviceUrl,
        },
      };
    }
    return {
      kind: 'deployment',
      platformId: target.platformId,
      body: {
        deploymentId: target.deploymentId,
        ...(target.kind === 'shared_deployment' ? { siteUrl: target.siteUrl } : {}),
      },
    };
  },
} satisfies ConnectionSetup;

export default canaryAppAdapter;
