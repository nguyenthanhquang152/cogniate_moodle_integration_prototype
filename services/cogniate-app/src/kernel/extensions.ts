// POST /app-api/connections/:id/deployments (app contract §4.7.2): add a deployment with an `add_deployment`
// grant. The handler calls the common redemption engine (`deps.redeem`); it has no grant, adoption or cleanup logic.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CapabilityId, ChannelRegistry } from '@cogniate/channel-kernel';
import { EMPTY_PUBLICATION_EXTENSION_FIELDS, EXTENSION_CAPABILITY_MEMBERS, EXTENSION_GUARDS, PACKAGE_EXPORT_WIRE, PUBLICATION_EXTENSION_FIELDS } from '@cogniate/channel-kernel';
import { getConnection } from '../domain/connections.ts';
import { parseStrictBody } from '@cogniate/channel-kernel/setup';
import type { SetupRouteDeps } from './setup/deps.ts';
import { ApiError } from '../app/api-errors.ts';
import type { CourseVersionView, ExporterContext, ExtensionRoute, PackageExporter, PortContext, PublicationView } from './ports.ts';
import { setupOf } from './setup.ts';
import { apiErrorBody } from '@cogniate/shared';
import type { PortContextDeps } from './port-context.ts';
import { createBuildQueue, createPortContext } from './port-context.ts';
import type { Course, CourseVersion } from '../domain/courses.ts';
import { getCourse, getVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';

/** P6 may fill only the frozen extension fields of the publication DTO. */
export function publicationExtensionFields(channels: ChannelRegistry, publication: PublicationView, ctx: PortContext): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...EMPTY_PUBLICATION_EXTENSION_FIELDS };
  for (const hook of setupOf(channels, publication.channel)?.publishHooks ?? []) {
    const next = hook.dtoFields(publication, ctx);
    for (const key of Object.keys(next)) {
      if (!PUBLICATION_EXTENSION_FIELDS.includes(key)) throw new Error(`channel_dto_field_not_allowed: ${key}`);
      fields[key] = next[key];
    }
  }
  return fields;
}

type IdParams = { Params: { id: string } };

export function registerDeploymentRoutes(api: FastifyInstance, deps: SetupRouteDeps): void {
  api.post<IdParams>('/connections/:id/deployments', async (req: FastifyRequest<IdParams>) => {
    const library = req.auth!.signedIn.library;
    const c = getConnection(deps.db, library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    if (!deps.channels.capabilities(c.channel)['deployments.multiple'])
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection cannot add a deployment.', { details: { capability: 'addDeployment' } });
    if ((c.status !== 'registered' && c.status !== 'connected') || !c.ltiPlatformId || !c.platform)
      throw new ApiError('CONNECTION_NOT_READY');
    const parsed = parseStrictBody(req.body, { required: ['deploymentId', 'grantCode'] });
    if (!parsed.ok) throw new ApiError('INVALID_PLATFORM_VALUES', undefined, { details: { fields: parsed.fields } });
    const connection = await deps.redeem({
      libraryId: library.id,
      connectionId: c.id,
      purpose: 'add_deployment',
      // The engine gets the existing client id from the connection's own platform.
      values: { clientId: '', deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode! },
      traceId: req.traceId,
    });
    return deps.connectionDto(connection, library.name);
  });
}

export interface ExtensionDeps extends PortContextDeps {
  channels: ChannelRegistry;
  buildQueueDir?: string;
  buildKnobs?: { hold: boolean; failAt: string };
}
export function portContextOf(deps: ExtensionDeps, req: FastifyRequest, connectionId: string | null): PortContext {
  const library = req.auth!.signedIn.library;
  return createPortContext(deps, library.id, connectionId, req.traceId, library.name);
}
function supported(channels: ChannelRegistry, channel: string, capability: CapabilityId, path: string): boolean {
  const value = channels.capabilities(channel)[capability];
  if (Array.isArray(value)) {
    const member = EXTENSION_CAPABILITY_MEMBERS[path];
    return member ? value.includes(member) : value.length > 0;
  }
  return typeof value === 'boolean' ? value : value !== undefined && Object.keys(value).length > 0;
}
export function guardExtension(deps: Pick<ExtensionDeps, 'channels'>, channel: string, capability: CapabilityId, path: string, legacyName?: string): void {
  if (supported(deps.channels, channel, capability, path)) return;
  const frozen = EXTENSION_GUARDS[path as keyof typeof EXTENSION_GUARDS];
  throw new ApiError('CAPABILITY_NOT_SUPPORTED', frozen?.description, { details: { capability: legacyName ?? frozen?.capability ?? capability } });
}

/** Mount the discovered path catalog once. A foreign connection is checked before a handler receives context. */
export function registerExtensionRoutes(api: FastifyInstance, deps: ExtensionDeps): void {
  const paths = new Map<string, ExtensionRoute>();
  for (const manifest of deps.channels.channels()) {
    for (const route of setupOf(deps.channels, manifest.id)?.extensionRoutes ?? []) {
      if (!/^(?:[a-z][a-z0-9-]*|x\/[a-z][a-z0-9-]*)$/.test(route.path)) throw new Error('channel_extension_path_invalid');
      paths.set(`${route.method} ${route.path}`, route);
    }
  }
  for (const descriptor of paths.values()) {
    api.route<{ Params: { id: string }; Querystring: Record<string, string> }>({
      method: descriptor.method, url: `/connections/:id/${descriptor.path}`,
      handler: async (req, reply) => {
        const c = getConnection(deps.db, req.auth!.signedIn.library.id, req.params.id);
        if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
        guardExtension(deps, c.channel, descriptor.capability, descriptor.path, descriptor.legacyCapabilityName);
        const route = setupOf(deps.channels, c.channel)?.extensionRoutes?.find((r) => r.path === descriptor.path && r.method === descriptor.method);
        if (!route) throw new ApiError('CAPABILITY_NOT_SUPPORTED', undefined, { details: { capability: descriptor.legacyCapabilityName ?? descriptor.capability } });
        const result = await route.handle({ body: req.body, query: req.query }, portContextOf(deps, req, c.id));
        if ('error' in result) return reply.code(result.error.status).send(apiErrorBody(result.error.status, result.error.code, result.error.message, result.error.details));
        return reply.code(result.status).headers(result.headers ?? {}).send(result.body);
      },
    });
  }
}

export function exporterOf(channels: ChannelRegistry, id: string): PackageExporter | null {
  for (const manifest of channels.channels()) {
    if (!channels.capabilities(manifest.id)['export.packages'].includes(id)) continue;
    const exporter = setupOf(channels, manifest.id)?.packageExporters?.find((candidate) => candidate.id === id);
    if (exporter) return exporter;
  }
  return null;
}
/** The kernel reads core metadata only after it checks the course and version in the session library. */
export function exportVersionView(db: Db, course: Course, version: CourseVersion): CourseVersionView {
  const pkg = db.prepare('SELECT sha256 FROM package WHERE id = ? AND library_id = ?').get(version.packageId, course.libraryId);
  return { id: version.id, courseId: course.id, version: version.version, format: version.format, packageId: version.packageId,
    title: course.title, variant: course.variant, lang: course.lang, packageSha256: typeof pkg?.sha256 === 'string' ? pkg.sha256 : '' };
}
export function exporterContextOf(deps: ExtensionDeps, req: FastifyRequest): ExporterContext {
  if (!deps.buildQueueDir) throw new ApiError('NOT_FOUND');
  const ctx = portContextOf(deps, req, null);
  return { ...ctx, buildQueue: createBuildQueue(deps.db, ctx.libraryId, deps.buildQueueDir, deps.buildKnobs ?? { hold: false, failAt: '' }) };
}
export function registerExporterRoutes(api: FastifyInstance, deps: ExtensionDeps): void {
  if (!deps.buildQueueDir) return;
  for (const id of new Set(deps.channels.channels().flatMap((m) => deps.channels.capabilities(m.id)['export.packages']))) {
    const exporter = exporterOf(deps.channels, id);
    if (!exporter || !PACKAGE_EXPORT_WIRE[id]) continue;
    type Params = { Params: { courseId: string; versionId: string } };
    const versionOf = (req: FastifyRequest<Params>): CourseVersionView => {
      const library = req.auth!.signedIn.library.id;
      const course = getCourse(deps.db, library, req.params.courseId);
      const version = course ? getVersion(deps.db, library, course.id, req.params.versionId) : undefined;
      if (!course || !version) throw new ApiError('NOT_FOUND', 'The course version does not exist in your library.');
      return exportVersionView(deps.db, course, version);
    };
    api.post<Params>(`/courses/:courseId/versions/:versionId/${id}`, async (req, reply) =>
      reply.code(202).send(await exporter.start(versionOf(req), exporterContextOf(deps, req))));
    api.get<Params>(`/courses/:courseId/versions/:versionId/${id}`, async (req) => {
      const build = await exporter.latest(versionOf(req), exporterContextOf(deps, req));
      if (!build) throw new ApiError('NOT_FOUND', PACKAGE_EXPORT_WIRE[id]!.latestMissing);
      return build;
    });
  }
}
