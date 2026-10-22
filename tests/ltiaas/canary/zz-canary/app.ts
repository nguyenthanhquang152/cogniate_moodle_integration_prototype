// Canary channel app adapter (LA-E7-01, LA-ADR-01 D5 `ConnectionSetup` contract surface, BD-A1-20).
// Pure functions with fixed data; never uses a database, LTI client, network or process globals (BD-A1-16, BD-A2-11).

export interface CanaryToolRow {
  key: string;
  label: string;
  value: string;
}

export interface CanaryBindingValues {
  clientId: string;
  deploymentId: string;
  grantCode: string;
}

export interface CanaryBindingTarget {
  kind: 'exclusive_platform';
  profileId: string;
  siteUrl: string;
  clientId: string;
  deploymentId: string;
}

export interface CanaryStagedCreate {
  profileId: string;
  siteUrl: string;
  clientId: string;
  deploymentId: string;
}

const ALLOWED_BINDING_KEYS = ['clientId', 'deploymentId', 'grantCode'] as const;

const canaryAppAdapter = {
  channel: 'zz-canary',

  checkCreate(input: {
    siteUrl: string;
    serviceUrl?: string;
    profile: unknown;
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

  toolConfiguration(ctx: { publicLtiOrigin?: string; publicAppOrigin?: string } = {}): CanaryToolRow[] {
    const ltiOrigin =
      ctx && typeof ctx.publicLtiOrigin === 'string' && ctx.publicLtiOrigin.length > 0
        ? ctx.publicLtiOrigin
        : 'https://lti.cogniate.test';
    return [
      { key: 'issuer', label: 'Tool URL', value: ltiOrigin },
      { key: 'loginUrl', label: 'Initiate login URL', value: `${ltiOrigin}/lti/login` },
      { key: 'launchUrl', label: 'Redirection URI(s)', value: `${ltiOrigin}/lti/launch` },
      { key: 'jwksUrl', label: 'Public keyset URL', value: `${ltiOrigin}/lti/keys` },
    ];
  },

  parseBindingBody(
    body: unknown,
    _ctx?: unknown,
  ): { ok: true; values: CanaryBindingValues } | { ok: false; fields: string[] } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, fields: ['body'] };
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

  initialTarget(
    ctx: {
      siteUrl?: string;
      profileId?: string;
      values?: Partial<CanaryBindingValues>;
    } = {},
  ): CanaryBindingTarget {
    return {
      kind: 'exclusive_platform',
      profileId: typeof ctx?.profileId === 'string' ? ctx.profileId : 'zz-canary-sim',
      siteUrl: typeof ctx?.siteUrl === 'string' ? ctx.siteUrl : 'https://canary.sim.test',
      clientId: typeof ctx?.values?.clientId === 'string' ? ctx.values.clientId : 'client-canary-1',
      deploymentId: typeof ctx?.values?.deploymentId === 'string' ? ctx.values.deploymentId : 'dep-canary-1',
    };
  },

  createRequest(target: CanaryBindingTarget, _ctx?: unknown): CanaryStagedCreate {
    return {
      profileId: target.profileId,
      siteUrl: target.siteUrl,
      clientId: target.clientId,
      deploymentId: target.deploymentId,
    };
  },
};

export default canaryAppAdapter;
