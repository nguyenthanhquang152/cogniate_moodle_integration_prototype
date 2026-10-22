import type { SQLInputValue } from 'node:sqlite';
import { constants } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EXPORT_BUILD_SCOPE_SQL, PACKAGE_EXPORT_WIRE } from '@cogniate/channel-kernel';
import { z } from 'zod';
import type { Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import { decrypt, encrypt } from '@cogniate/shared';
import type { Db } from '../domain/db.ts';
import type { BuildQueue, ChannelSql, PortContext } from './ports.ts';
import type { LtiClient } from '../clients/lti-client.ts';
import { TOOL_ACCOUNT, toolContext } from './setup/common.ts';
import { ApiError } from '../app/api-errors.ts';

// The runtime log records only the class name; keep each contract refusal identifiable.
class ChannelSqlUnscopedError extends Error {
  constructor() { super('channel_sql_unscoped'); this.name = 'ChannelSqlUnscopedError'; }
}
class ChannelSqlParameterError extends TypeError {
  constructor() { super('channel_sql_invalid_parameter'); this.name = 'ChannelSqlParameterError'; }
}
class BuildQueueError extends Error {
  constructor(reason: 'build_artifact_invalid' | 'build_queue_folder_invalid') { super(reason); this.name = 'BuildQueueError'; }
}

/** Ignore quoted values and comments when looking for the required scope parameter. */
function parameters(statement: string): Set<string> {
  const sql = statement.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]/g, ' ');
  return new Set(sql.match(/[:@$][A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

/** A bound handle, without a way to change the library or the connection of the call. */
export function createChannelSql(db: Db, libraryId: string, connectionId: string | null): ChannelSql {
  function prepare(statement: string, params: Record<string, unknown> = {}) {
    const names = parameters(statement);
    if (!names.has(':library_id')) throw new ChannelSqlUnscopedError();
    const bound: Record<string, SQLInputValue> = {};
    for (const [key, value] of Object.entries(params)) {
      const name = /^[:@$]/.test(key) ? key : `:${key}`;
      if (/^[:@$](library_id|connection_id)$/.test(name)) continue;
      if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint' && !(value instanceof Uint8Array)) {
        throw new ChannelSqlParameterError();
      }
      bound[name] = value;
    }
    for (const name of names) {
      if (/^[:@$]library_id$/.test(name)) bound[name] = libraryId;
      if (/^[:@$]connection_id$/.test(name)) bound[name] = connectionId;
    }
    return { query: db.prepare(statement), bound };
  }
  return Object.freeze({
    get<T>(statement: string, params?: Record<string, unknown>): T | undefined {
      const { query, bound } = prepare(statement, params);
      return query.get(bound) as T | undefined;
    },
    all<T>(statement: string, params?: Record<string, unknown>): T[] {
      const { query, bound } = prepare(statement, params);
      return query.all(bound) as T[];
    },
    run(statement: string, params?: Record<string, unknown>): { changes: number } {
      const { query, bound } = prepare(statement, params);
      return { changes: Number(query.run(bound).changes) };
    },
  });
}

export interface PortContextDeps {
  db: Db;
  masterKey: Buffer;
  outbound: OutboundClient;
  logger: Logger;
  now(): number;
  urls: PublicUrls;
  lti: Pick<LtiClient, 'getToolKeys'>;
}

/** Construct a new context for one port call; keys and the raw database stay in the kernel. */
export function createPortContext(deps: PortContextDeps, libraryId: string, connectionId: string | null, traceId: string, libraryName: string): PortContext {
  return Object.freeze({
    libraryId, connectionId, traceId,
    sql: createChannelSql(deps.db, libraryId, connectionId),
    outbound: deps.outbound,
    seal: async (value: string) => encrypt(deps.masterKey, value),
    unseal: async (blob: Uint8Array) => decrypt(deps.masterKey, blob),
    logger: deps.logger,
    now: deps.now,
    urls: Object.freeze({ ...deps.urls }), libraryName, ...toolContext(deps.urls),
    publicToolKeys: async () => {
      try {
        const keys = await deps.lti.getToolKeys(TOOL_ACCOUNT, traceId);
        if (keys.some((key) => key.kty !== 'RSA' || ![key.kid, key.alg, key.use, key.n, key.e].every((v) => typeof v === 'string')
          || !/^[A-Za-z0-9_-]+$/.test(key.n) || !/^[A-Za-z0-9_-]+$/.test(key.e))) return { ok: false as const };
        return { ok: true as const, keys: keys.map(({ kty, kid, alg, use, n, e }) => ({ kty, kid, alg, use, n, e })) };
      } catch {
        return { ok: false as const };
      }
    },
  });
}

const BUILD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUS_LIMIT = 64 * 1024;
const time = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const BuildStatus = z.strictObject({
  status: z.enum(['queued', 'running', 'ready', 'failed']),
  // The runner's stop trap can run before its first step starts.
  step: z.enum(['', 'start', 'course', 'scorm', 'backup', 'copy', 'done']).transform((value) => value || null).optional(),
  reason: z.string().max(4096).optional(), bytes: z.number().int().nonnegative().optional(),
  updatedAt: time.optional(), startedAt: time.optional(), finishedAt: time.optional(),
  holdFile: z.string().regex(/^infra\/\.data\/build-queue\/hold\/bld_[0-9a-f]{24}$/).optional(),
});
const RunnerStatus = z.strictObject({
  pid: z.number().int().positive(), startedAt: time, lastSeenAt: time, image: z.enum(['missing', 'building', 'ready', 'failed']),
});
function checkedId(id: string): string {
  if (!BUILD_ID.test(id)) throw new BuildQueueError('build_artifact_invalid');
  return id;
}

/** Fixed subfolders only; a channel cannot supply a path or replace a folder with a symlink. */
async function queueFolder(root: string, folder: 'requests' | 'status' | 'out'): Promise<string> {
  const path = join(resolve(root), folder);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new BuildQueueError('build_queue_folder_invalid');
  return path;
}

/** Read a regular, bounded file without following a symlink or waiting on a pipe. */
async function readStatus(root: string, filename: string): Promise<unknown | null> {
  try {
    const file = await open(join(await queueFolder(root, 'status'), filename), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > STATUS_LIMIT) return null;
      const data = Buffer.alloc(STATUS_LIMIT + 1);
      const { bytesRead } = await file.read(data, 0, data.length, 0);
      if (bytesRead > STATUS_LIMIT) return null;
      return JSON.parse(data.subarray(0, bytesRead).toString('utf8')) as unknown;
    } finally { await file.close(); }
  } catch { return null; }
}

/** This service only exchanges files. It never starts the host runner. */
function assertBuildOwner(db: Db, libraryId: string, id: string): void {
  checkedId(id);
  if (!db.prepare(EXPORT_BUILD_SCOPE_SQL).get(id, libraryId)) throw new ApiError('NOT_FOUND');
}

export function createBuildQueue(db: Db, libraryId: string, root: string, knobs: { hold: boolean; failAt: string }): BuildQueue {
  return Object.freeze({
    async submit(id: string, request: Record<string, unknown>) {
      assertBuildOwner(db, libraryId, id);
      const folder = await queueFolder(root, 'requests');
      const tmp = join(folder, `${id}.${randomUUID()}.tmp`);
      const file = await open(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        await file.writeFile(JSON.stringify({ ...request, buildId: id, libraryId, hold: knobs.hold, failAt: knobs.failAt }));
        await file.close();
        await rename(tmp, join(folder, `${id}.json`));
      } catch (error) {
        await file.close().catch(() => {});
        await unlink(tmp).catch(() => {});
        throw error;
      }
    },
    status: async (id: string) => {
      assertBuildOwner(db, libraryId, id);
      const result = BuildStatus.safeParse(await readStatus(root, `${id}.json`));
      return result.success ? result.data : null;
    },
    runner: async () => {
      const result = RunnerStatus.safeParse(await readStatus(root, 'runner.json'));
      return result.success ? result.data : null;
    },
    pending: async (id: string) => {
      checkedId(id);
      if (!db.prepare(EXPORT_BUILD_SCOPE_SQL).get(id, libraryId)) return false;
      try {
        const file = await open(join(await queueFolder(root, 'requests'), `${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try { return (await file.stat()).isFile(); } finally { await file.close(); }
      } catch { return false; }
    },
  });
}

/** The kernel streams a validated artifact; extensions never receive its filesystem path. */
export async function openExportArtifact(db: Db, libraryId: string, root: string, artifact: string, exporter: string) {
  assertBuildOwner(db, libraryId, artifact);
  const wire = PACKAGE_EXPORT_WIRE[exporter];
  if (!wire) throw new ApiError('NOT_FOUND');
  const filename = `${artifact}.${wire.extension}`;
  const file = await open(join(await queueFolder(root, 'out'), filename), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  if (!(await file.stat()).isFile()) {
    await file.close();
    throw new BuildQueueError('build_artifact_invalid');
  }
  return file;
}
