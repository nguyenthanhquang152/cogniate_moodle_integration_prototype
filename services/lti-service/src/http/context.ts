// What every route group gets from buildApp (B-T2a-01: one file per route group in http/routes/).
import type { Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/index.ts';
import type { ProtocolErrorCode } from '../lti/codes.ts';
import type { PlatformKeys } from '../lti/jwks.ts';
import type { AgsClient } from '../platform/ags.ts';
import type { AuthResult, Scheme } from './auth.ts';

export interface RouteContext {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  keys: PlatformKeys;
  ltikTtlSeconds: number;
  masterKey: Buffer;
  ags: AgsClient;
  /** Guarded outbound client (security §9): dynamic registration calls (T3b). */
  outbound: OutboundClient;
  now: () => number;
  /** Resolve the Authorization header (contract §1.2); throws the 401 ApiError and logs api_auth_failed. */
  auth: (req: FastifyRequest, schemes: Scheme[]) => AuthResult;
  /** Protocol HTML error page (security §2.2) with its status and headers. */
  errorPage: (reply: FastifyReply, req: FastifyRequest, code: ProtocolErrorCode, opts?: { help?: string; detail?: string; status?: number; heading?: string }) => FastifyReply;
}
