// Canary channel app adapter (LA-E7-01, LA-ADR-01 D5 ports P1 and P2).
// Pure functions with fixed data; never calls a database or LTI client.
export interface CanaryToolConfigInput {
  connectionId?: string;
  publicAppOrigin?: string;
  publicLtiOrigin?: string;
  siteUrl?: string | null;
}

export interface CanaryToolConfigRow {
  key: string;
  label: string;
  value: string;
}

function normalizeOrigin(raw: unknown, fieldName: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${fieldName} must use http or https`);
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${fieldName} must be an origin without path, query or hash`);
  }
  return parsed.origin;
}

function assertStrictKeys(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown field: ${key}`);
    }
  }
  return record;
}

const canaryAppAdapter = {
  id: 'zz-canary',

  toolConfiguration(input: CanaryToolConfigInput = {}): { rows: CanaryToolConfigRow[] } {
    const ltiOrigin = input.publicLtiOrigin ?? 'https://lti.cogniate.test';
    return {
      rows: [
        { key: 'issuer', label: 'Tool URL', value: ltiOrigin },
        { key: 'loginUrl', label: 'Initiate login URL', value: `${ltiOrigin}/lti/login` },
        { key: 'launchUrl', label: 'Redirection URI(s)', value: `${ltiOrigin}/lti/launch` },
        { key: 'jwksUrl', label: 'Public keyset URL', value: `${ltiOrigin}/lti/keys` },
      ],
    };
  },

  stageCreate(body: unknown): {
    channelId: 'zz-canary';
    profileId: 'zz-canary-sim';
    siteUrl: string;
    status: 'pending';
  } {
    const record = assertStrictKeys(body, ['siteUrl']);
    const siteUrl = normalizeOrigin(record.siteUrl, 'siteUrl');
    return {
      channelId: 'zz-canary',
      profileId: 'zz-canary-sim',
      siteUrl,
      status: 'pending',
    };
  },

  bindingTarget(
    body: unknown,
    staged: { siteUrl?: string } = {},
  ): {
    profileId: 'zz-canary-sim';
    clientId: string;
    deploymentId: string;
    grantCode: string;
    siteUrl: string;
  } {
    const record = assertStrictKeys(body, ['clientId', 'deploymentId', 'grantCode']);
    const clientId = typeof record.clientId === 'string' ? record.clientId.trim() : '';
    const deploymentId = typeof record.deploymentId === 'string' ? record.deploymentId.trim() : '';
    const grantCode = typeof record.grantCode === 'string' ? record.grantCode.trim() : '';
    if (!clientId) throw new Error('clientId is required');
    if (!deploymentId) throw new Error('deploymentId is required');
    if (!grantCode) throw new Error('grantCode is required');
    return {
      profileId: 'zz-canary-sim',
      clientId,
      deploymentId,
      grantCode,
      siteUrl: staged.siteUrl ?? 'https://canary.sim.test',
    };
  },
};

export default canaryAppAdapter;
