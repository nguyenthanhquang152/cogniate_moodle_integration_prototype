// Host-testable oracle helpers for LA-E5-13 (Two-tenant isolation checks for the new routes).
// Addresses Round 1 review findings:
// - B-LA-E5-13-01 (MAJOR) & A-LA-E5-13-01 (MINOR): Read the contracted `json.lms` array from
//   `GET /app-api/lms-providers` (never `json.providers`), assert every expected built channel
//   and registration method is present, and record exercised channel/method/fixture IDs so an
//   empty or partial list fails loudly.
// - B-LA-E5-13-02 (MAJOR): Capture Library B's connection and publication DTOs before Library A's
//   foreign-ID probes and compare all persisted binding, configuration, status, and activity-count
//   fields afterward, with negative controls proving any mutation is rejected even when all foreign
//   requests return HTTP 404.

export const EXPECTED_BUILT_CHANNELS = [
  'moodle',
  'canvas',
  'blackboard',
  'lti-generic',
  'brightspace',
] as const;

export type BuiltChannelId = (typeof EXPECTED_BUILT_CHANNELS)[number];

export const EXPECTED_CHANNEL_METHODS: Readonly<Record<BuiltChannelId, readonly ('dynamic' | 'manual')[]>> = {
  moodle: ['dynamic', 'manual'],
  canvas: ['manual', 'dynamic'],
  blackboard: ['manual'],
  'lti-generic': ['dynamic', 'manual'],
  brightspace: ['dynamic', 'manual'],
};

export interface LmsProviderItem {
  lms: string;
  channel: string;
  channelName?: string;
  methods: string[];
  capabilities?: Record<string, unknown>;
  channelCapabilities?: Record<string, unknown>;
}

export interface ParsedLmsProvidersEnvelope {
  lms: LmsProviderItem[];
  channelIds: string[];
  channelMethods: string[];
}

export interface ConnectionFixtureSpec {
  label: string;
  channel: BuiltChannelId;
  method: 'dynamic' | 'manual';
  id: string;
}

export interface ExercisedFixtureSummary {
  exercisedChannels: string[];
  exercisedMethods: string[];
  exercisedChannelMethods: string[];
  exercisedFixtures: { label: string; channel: string; method: string; id: string }[];
}

export interface ConnectionRouteProbe {
  label: string;
  channel: string;
  method: string;
  httpMethod: string;
  path: string;
  body?: unknown;
}

export interface VictimConnectionSnapshot {
  id: string;
  name: unknown;
  lms: unknown;
  channel: unknown;
  channelName: unknown;
  method: unknown;
  status: unknown;
  bindingAuthority: unknown;
  siteUrl: unknown;
  serviceUrl: unknown;
  profile: unknown;
  platform: unknown;
  registrationUrl: unknown;
  registrationUrlExpiresAt: unknown;
  webServices: unknown;
  capabilities: unknown;
  channelCapabilities: unknown;
  lastError: unknown;
  lastLaunchAt: unknown;
  createdAt: unknown;
  raw: Record<string, unknown>;
}

export interface VictimPublicationSnapshot {
  id: string;
  courseId: unknown;
  versionId: unknown;
  connectionId: unknown;
  connectionName: unknown;
  lms: unknown;
  status: unknown;
  activities: unknown;
  learners: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  raw: Record<string, unknown>;
}

export interface VictimStateSnapshot {
  connections: Record<string, VictimConnectionSnapshot>;
  publications: Record<string, VictimPublicationSnapshot>;
}

/**
 * Parses and validates the contracted `GET /app-api/lms-providers` response (`{ lms: [...] }`).
 * Refuses non-object payloads, `.providers`-only payloads, empty `.lms` arrays, or missing built channels.
 */
export function parseLmsProvidersEnvelope(
  body: unknown,
  requiredChannels: readonly BuiltChannelId[] = EXPECTED_BUILT_CHANNELS,
): ParsedLmsProvidersEnvelope {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('GET /app-api/lms-providers must return a JSON object with a contracted .lms array');
  }
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.lms)) {
    throw new Error(
      `GET /app-api/lms-providers missing contracted .lms array (got keys: ${Object.keys(obj).sort().join(', ') || 'none'})`,
    );
  }
  if (obj.lms.length === 0) {
    throw new Error('GET /app-api/lms-providers returned an empty .lms array');
  }

  const lms: LmsProviderItem[] = obj.lms.map((raw, idx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`GET /app-api/lms-providers .lms[${idx}] is not an object`);
    }
    const r = raw as Record<string, unknown>;
    const channel = typeof r.channel === 'string' && r.channel ? r.channel : typeof r.lms === 'string' ? r.lms : '';
    const lmsId = typeof r.lms === 'string' && r.lms ? r.lms : channel;
    if (!channel) {
      throw new Error(`GET /app-api/lms-providers .lms[${idx}] has no channel/lms string`);
    }
    if (!Array.isArray(r.methods) || r.methods.length === 0 || !r.methods.every((m) => typeof m === 'string')) {
      throw new Error(`GET /app-api/lms-providers .lms[${idx}] (${channel}) has invalid or empty methods array`);
    }
    return {
      lms: lmsId,
      channel,
      channelName: typeof r.channelName === 'string' ? r.channelName : undefined,
      methods: [...(r.methods as string[])],
      capabilities:
        r.capabilities && typeof r.capabilities === 'object'
          ? (r.capabilities as Record<string, unknown>)
          : undefined,
      channelCapabilities:
        r.channelCapabilities && typeof r.channelCapabilities === 'object'
          ? (r.channelCapabilities as Record<string, unknown>)
          : undefined,
    };
  });

  const byChannel = new Map<string, LmsProviderItem>();
  for (const item of lms) {
    byChannel.set(item.channel, item);
  }

  for (const expectedCh of requiredChannels) {
    const found = byChannel.get(expectedCh);
    if (!found) {
      throw new Error(
        `GET /app-api/lms-providers .lms is missing expected built channel "${expectedCh}" (found: ${[...byChannel.keys()].join(', ')})`,
      );
    }
    const expectedMethods = EXPECTED_CHANNEL_METHODS[expectedCh] ?? [];
    for (const m of expectedMethods) {
      if (!found.methods.includes(m)) {
        throw new Error(
          `GET /app-api/lms-providers channel "${expectedCh}" is missing expected registration method "${m}" (got: ${found.methods.join(', ')})`,
        );
      }
    }
  }

  const channelIds = [...byChannel.keys()].sort();
  const channelMethods = lms
    .flatMap((item) => item.methods.map((m) => `${item.channel}:${m}`))
    .sort();

  return { lms, channelIds, channelMethods };
}

/**
 * Verifies that all expected built channels and fixture variants are present with non-empty connection IDs,
 * and returns a non-empty summary of the exercised channels, methods, and fixtures.
 */
export function assertExpectedConnectionFixtures(
  fixtures: readonly ConnectionFixtureSpec[],
  requiredChannels: readonly BuiltChannelId[] = EXPECTED_BUILT_CHANNELS,
  requiredChannelMethods: readonly string[] = [
    'moodle:manual',
    'blackboard:manual',
    'canvas:manual',
    'lti-generic:dynamic',
    'lti-generic:manual',
    'brightspace:dynamic',
    'brightspace:manual',
  ],
): ExercisedFixtureSummary {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error('Victim connection fixture list is empty');
  }

  for (const f of fixtures) {
    if (!f.id || typeof f.id !== 'string' || f.id.trim().length === 0) {
      throw new Error(`Fixture "${f.label}" (${f.channel}:${f.method}) has an empty connection id`);
    }
  }

  const exercisedChannels = [...new Set(fixtures.map((f) => f.channel))].sort();
  const exercisedMethods = [...new Set(fixtures.map((f) => f.method))].sort();
  const exercisedChannelMethods = [...new Set(fixtures.map((f) => `${f.channel}:${f.method}`))].sort();

  for (const ch of requiredChannels) {
    if (!exercisedChannels.includes(ch)) {
      throw new Error(
        `Expected connection fixture for channel "${ch}" is missing (exercised: ${exercisedChannels.join(', ')})`,
      );
    }
  }

  for (const cm of requiredChannelMethods) {
    if (!exercisedChannelMethods.includes(cm)) {
      throw new Error(
        `Expected connection fixture for "${cm}" is missing (exercised: ${exercisedChannelMethods.join(', ')})`,
      );
    }
  }

  return {
    exercisedChannels,
    exercisedMethods,
    exercisedChannelMethods,
    exercisedFixtures: fixtures.map((f) => ({
      label: f.label,
      channel: f.channel,
      method: f.method,
      id: f.id,
    })),
  };
}

/**
 * Builds the 13 cross-tenant connection route probes for each victim connection fixture.
 */
export function buildConnectionRouteProbes(
  fixtures: readonly ConnectionFixtureSpec[],
  aCourseId: string,
): ConnectionRouteProbe[] {
  const probes: ConnectionRouteProbe[] = [];
  for (const conn of fixtures) {
    const cPath = `/app-api/connections/${encodeURIComponent(conn.id)}`;
    probes.push(
      {
        label: `${conn.label}: GET /app-api/connections/:id`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'GET',
        path: cPath,
      },
      {
        label: `${conn.label}: POST /app-api/connections/:id/registration-url`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'POST',
        path: `${cPath}/registration-url`,
      },
      {
        label: `${conn.label}: GET /app-api/connections/:id/tool-configuration`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'GET',
        path: `${cPath}/tool-configuration`,
      },
      {
        label: `${conn.label}: PUT /app-api/connections/:id/platform (admin-value body)`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'PUT',
        path: `${cPath}/platform`,
        body: {
          issuer: 'https://generic.sim.test/lms',
          clientId: 'cross-tenant-client',
          deploymentId: 'dep-cross-1',
          authenticationEndpoint: 'https://generic.sim.test/lms/oidc/auth',
          accessTokenEndpoint: 'https://generic.sim.test/lms/oauth2/token',
          jwksUrl: 'https://generic.sim.test/lms/jwks.json',
          grantCode: 'a'.repeat(43),
        },
      },
      {
        label: `${conn.label}: PUT /app-api/connections/:id/platform (staged-DR/grant body)`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'PUT',
        path: `${cPath}/platform`,
        body: {
          clientId: 'cross-tenant-client',
          deploymentId: 'dep-cross-1',
          grantCode: 'b'.repeat(43),
        },
      },
      {
        label: `${conn.label}: POST /app-api/connections/:id/deployments`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'POST',
        path: `${cPath}/deployments`,
        body: { deploymentId: 'dep-cross-2', grantCode: 'c'.repeat(43) },
      },
      {
        label: `${conn.label}: GET /app-api/connections/:id/canvas-configuration`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'GET',
        path: `${cPath}/canvas-configuration`,
      },
      {
        label: `${conn.label}: PUT /app-api/connections/:id/web-services`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'PUT',
        path: `${cPath}/web-services`,
        body: { token: '0'.repeat(32) },
      },
      {
        label: `${conn.label}: POST /app-api/publications with B connectionId`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'POST',
        path: '/app-api/publications',
        body: { connectionId: conn.id, courseId: aCourseId },
      },
      {
        label: `${conn.label}: POST /app-api/connections/:id/check (LA-E6-04)`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'POST',
        path: `${cPath}/check`,
      },
      {
        label: `${conn.label}: GET /app-api/connections/:id/health (N/A Could route)`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'GET',
        path: `${cPath}/health`,
      },
      {
        label: `${conn.label}: POST /app-api/connections/:id/verify (N/A Could route)`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'POST',
        path: `${cPath}/verify`,
        body: { code: '1234-5678-9012' },
      },
      {
        label: `${conn.label}: DELETE /app-api/connections/:id`,
        channel: conn.channel,
        method: conn.method,
        httpMethod: 'DELETE',
        path: cPath,
      },
    );
  }
  return probes;
}

export function snapshotConnectionDto(dto: Record<string, unknown>): VictimConnectionSnapshot {
  if (!dto || typeof dto !== 'object' || typeof dto.id !== 'string' || !dto.id) {
    throw new Error('Invalid connection DTO for victim state snapshot');
  }
  const clone = structuredClone(dto);
  return {
    id: String(clone.id),
    name: clone.name,
    lms: clone.lms,
    channel: clone.channel ?? clone.lms,
    channelName: clone.channelName,
    method: clone.method,
    status: clone.status,
    bindingAuthority: clone.bindingAuthority,
    siteUrl: clone.siteUrl,
    serviceUrl: clone.serviceUrl ?? null,
    profile: clone.profile ?? null,
    platform: clone.platform ?? null,
    registrationUrl: clone.registrationUrl ?? null,
    registrationUrlExpiresAt: clone.registrationUrlExpiresAt ?? null,
    webServices: clone.webServices ?? null,
    capabilities: clone.capabilities ?? null,
    channelCapabilities: clone.channelCapabilities ?? null,
    lastError: clone.lastError ?? null,
    lastLaunchAt: clone.lastLaunchAt ?? null,
    createdAt: clone.createdAt,
    raw: clone,
  };
}

export function snapshotPublicationDto(dto: Record<string, unknown>): VictimPublicationSnapshot {
  if (!dto || typeof dto !== 'object' || typeof dto.id !== 'string' || !dto.id) {
    throw new Error('Invalid publication DTO for victim state snapshot');
  }
  const clone = structuredClone(dto);
  return {
    id: String(clone.id),
    courseId: clone.courseId,
    versionId: clone.versionId,
    connectionId: clone.connectionId,
    connectionName: clone.connectionName,
    lms: clone.lms,
    status: clone.status,
    activities: clone.activities,
    learners: clone.learners,
    createdAt: clone.createdAt,
    updatedAt: clone.updatedAt,
    raw: clone,
  };
}

export function buildVictimStateSnapshot(
  connections: Readonly<Record<string, Record<string, unknown>>>,
  publications: Readonly<Record<string, Record<string, unknown>>>,
): VictimStateSnapshot {
  const connSnaps: Record<string, VictimConnectionSnapshot> = {};
  for (const [label, dto] of Object.entries(connections)) {
    connSnaps[label] = snapshotConnectionDto(dto);
  }
  const pubSnaps: Record<string, VictimPublicationSnapshot> = {};
  for (const [label, dto] of Object.entries(publications)) {
    pubSnaps[label] = snapshotPublicationDto(dto);
  }
  if (Object.keys(connSnaps).length === 0) {
    throw new Error('Victim state snapshot must contain at least one connection');
  }
  if (Object.keys(pubSnaps).length === 0) {
    throw new Error('Victim state snapshot must contain at least one publication');
  }
  return { connections: connSnaps, publications: pubSnaps };
}

function stableJson(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map((x) => stableJson(x)).join(',')}]`;
  const entries = Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}

const CONNECTION_CHECKED_FIELDS: readonly (keyof Omit<VictimConnectionSnapshot, 'raw'>)[] = [
  'id',
  'name',
  'lms',
  'channel',
  'channelName',
  'method',
  'status',
  'bindingAuthority',
  'siteUrl',
  'serviceUrl',
  'profile',
  'platform',
  'registrationUrl',
  'registrationUrlExpiresAt',
  'webServices',
  'capabilities',
  'channelCapabilities',
  'lastError',
  'lastLaunchAt',
  'createdAt',
];

const PUBLICATION_CHECKED_FIELDS: readonly (keyof Omit<VictimPublicationSnapshot, 'raw'>)[] = [
  'id',
  'courseId',
  'versionId',
  'connectionId',
  'connectionName',
  'lms',
  'status',
  'activities',
  'learners',
  'createdAt',
  'updatedAt',
];

/**
 * Compares Library B's before and after connection and publication snapshots across all persisted
 * binding, configuration, state, and activity-count fields, as well as the full raw DTO.
 */
export function compareVictimStateBeforeAfter(
  before: VictimStateSnapshot,
  after: VictimStateSnapshot,
): { ok: boolean; diffs: string[] } {
  const diffs: string[] = [];

  const beforeConnKeys = Object.keys(before.connections).sort();
  const afterConnKeys = Object.keys(after.connections).sort();
  if (stableJson(beforeConnKeys) !== stableJson(afterConnKeys)) {
    diffs.push(
      `connection labels changed: before=${JSON.stringify(beforeConnKeys)} after=${JSON.stringify(afterConnKeys)}`,
    );
  }

  for (const label of beforeConnKeys) {
    const b = before.connections[label];
    const a = after.connections[label];
    if (!b || !a) continue;
    for (const field of CONNECTION_CHECKED_FIELDS) {
      const bVal = b[field];
      const aVal = a[field];
      if (stableJson(bVal) !== stableJson(aVal)) {
        diffs.push(
          `connection[${label}].${field} changed: before=${stableJson(bVal)} after=${stableJson(aVal)}`,
        );
      }
    }
    if (stableJson(b.raw) !== stableJson(a.raw)) {
      diffs.push(`connection[${label}].raw DTO changed`);
    }
  }

  const beforePubKeys = Object.keys(before.publications).sort();
  const afterPubKeys = Object.keys(after.publications).sort();
  if (stableJson(beforePubKeys) !== stableJson(afterPubKeys)) {
    diffs.push(
      `publication labels changed: before=${JSON.stringify(beforePubKeys)} after=${JSON.stringify(afterPubKeys)}`,
    );
  }

  for (const label of beforePubKeys) {
    const b = before.publications[label];
    const a = after.publications[label];
    if (!b || !a) continue;
    for (const field of PUBLICATION_CHECKED_FIELDS) {
      const bVal = b[field];
      const aVal = a[field];
      if (stableJson(bVal) !== stableJson(aVal)) {
        diffs.push(
          `publication[${label}].${field} changed: before=${stableJson(bVal)} after=${stableJson(aVal)}`,
        );
      }
    }
    if (stableJson(b.raw) !== stableJson(a.raw)) {
      diffs.push(`publication[${label}].raw DTO changed`);
    }
  }

  return { ok: diffs.length === 0, diffs };
}

export function assertVictimStateUnchanged(before: VictimStateSnapshot, after: VictimStateSnapshot): void {
  const res = compareVictimStateBeforeAfter(before, after);
  if (!res.ok) {
    throw new Error(`Victim Library B state changed after foreign-tenant calls:\n- ${res.diffs.join('\n- ')}`);
  }
}
