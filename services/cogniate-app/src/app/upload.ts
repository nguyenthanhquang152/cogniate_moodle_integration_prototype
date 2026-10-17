// POST /app-api/courses/:courseId/versions (contract cogniate-app-api §3, security §7).
// Stream the upload to a temp file -> inspect (no writes) -> extract into a new pkg_ folder -> keep the zip -> rows.
// On any error the temp file and the new folder are deleted.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Limits, RejectReason } from '@cogniate/package-inspector';
import { PackageRejectedError, extractPackage, inspectPackage } from '@cogniate/package-inspector';
import type { Logger } from '@cogniate/shared';
import { randomId, randomToken } from '@cogniate/shared';
import type { FastifyRequest } from 'fastify';
import type { Course, CourseVersion } from '../domain/courses.ts';
import { addVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import type { StorePaths } from '../domain/package-store.ts';
import { ApiError } from './errors.ts';
import { REJECT_INFO } from './reject-info.ts';

export interface UploadDeps {
  db: Db;
  logger: Logger;
  store: StorePaths;
  limits: Limits;
  now: () => number;
}

const MASTERY = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * 422 PACKAGE_REJECTED (contract §3.2). Each reason gets the title and the action of its code (REJECT_INFO), and
 * details.action is the action of the first reason, so the portal shows them without its own text list.
 */
function rejected(log: Logger, traceId: string, reasons: RejectReason[]): ApiError {
  log.warn('package_rejected', { trace_id: traceId, codes: [...new Set(reasons.map((r) => r.code))] });
  const described = reasons.map((r) => ({ ...r, ...REJECT_INFO[r.code] }));
  return new ApiError('PACKAGE_REJECTED', undefined, {
    details: { reasons: described, action: described[0]?.action ?? REJECT_INFO.ZIP_INVALID.action },
  });
}

/** Read the multipart body: one file field `package` (streamed to `tmpFile`) and an optional `masteryScore`. */
async function receive(req: FastifyRequest, tmpFile: string, deps: UploadDeps): Promise<{ sha256: string; masteryScore: number | undefined }> {
  if (!req.isMultipart()) throw new ApiError('INVALID_REQUEST', 'Send multipart/form-data with the file field "package".');
  let sha256: string | undefined;
  let masteryRaw: string | undefined;
  try {
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'package' || sha256 !== undefined) {
          part.file.resume();
          throw new ApiError('INVALID_REQUEST', 'Send one file, in the field "package".');
        }
        const hash = createHash('sha256');
        const tap = new Transform({ transform(chunk: Buffer, _enc, cb) { hash.update(chunk); cb(null, chunk); } });
        await pipeline(part.file, tap, createWriteStream(tmpFile, { flags: 'wx', mode: 0o600 }));
        if (part.file.truncated) throw Object.assign(new Error('file too large'), { code: 'FST_REQ_FILE_TOO_LARGE' });
        sha256 = hash.digest('hex');
      } else if (part.fieldname === 'masteryScore') {
        masteryRaw = String(part.value).trim();
      } else {
        throw new ApiError('INVALID_REQUEST', 'Unknown form field. Send only "package" and "masteryScore".');
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const code = (err as { code?: unknown }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      throw rejected(deps.logger, req.traceId, [{ code: 'ZIP_TOO_LARGE', detail: `The upload is larger than ${deps.limits.maxUploadBytes / 1_000_000} MB.` }]);
    }
    throw new ApiError('INVALID_REQUEST', 'The multipart body cannot be read.');
  }
  if (sha256 === undefined) throw new ApiError('INVALID_REQUEST', 'The file field "package" is missing.');
  let masteryScore: number | undefined;
  if (masteryRaw !== undefined && masteryRaw !== '') {
    masteryScore = Number(masteryRaw);
    if (!MASTERY.test(masteryRaw) || masteryScore > 100) {
      throw new ApiError('INVALID_REQUEST', 'masteryScore must be a number from 0 to 100.', { details: { field: 'masteryScore' } });
    }
  }
  return { sha256, masteryScore };
}

export async function uploadVersion(req: FastifyRequest, course: Course, deps: UploadDeps): Promise<CourseVersion> {
  const tmpFile = join(deps.store.tmp, `${randomToken()}.part`);
  let pkgDir: string | undefined;
  try {
    const { sha256, masteryScore } = await receive(req, tmpFile, deps);
    const result = await inspectPackage(tmpFile, { limits: deps.limits, ...(masteryScore === undefined ? {} : { masteryScore }) });
    if (!result.ok) throw rejected(deps.logger, req.traceId, result.reasons);
    const { inspection } = result;
    if (inspection.format === 'scorm12' && masteryScore !== undefined) {
      throw new ApiError('MASTERY_SCORE_NOT_ALLOWED', undefined, {
        details: { field: 'masteryScore', action: 'Upload the SCORM package without masteryScore. To change the mastery score, change it in the SCORM export.' },
      });
    }

    const packageId = randomId('pkg_');
    pkgDir = join(deps.store.packages, packageId);
    let extracted;
    try {
      extracted = await extractPackage(tmpFile, pkgDir, deps.limits);
    } catch (err) {
      if (err instanceof PackageRejectedError) throw rejected(deps.logger, req.traceId, err.reasons);
      throw err;
    }
    await rename(tmpFile, join(deps.store.uploads, `${sha256}.zip`));
    const version = addVersion(deps.db, course.libraryId, {
      courseId: course.id,
      format: inspection.format,
      pkg: { id: packageId, sha256, totalBytes: extracted.totalBytes, fileCount: extracted.fileCount, storagePath: `packages/${packageId}` },
      report: inspection.report,
      trackingProfile: inspection.trackingProfile,
    }, deps.now());
    pkgDir = undefined; // stored: keep the folder
    deps.logger.info('package_accepted', { trace_id: req.traceId, version_id: version.id, format: version.format });
    return version;
  } finally {
    await rm(tmpFile, { force: true });
    if (pkgDir) await rm(pkgDir, { recursive: true, force: true });
  }
}
