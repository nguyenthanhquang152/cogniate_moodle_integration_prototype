// The operator listener (LA-ADR-06 D3, contract delta §3): a second Fastify app on OPERATOR_HOST:OPERATOR_PORT
// (default 127.0.0.1:4110). The proxy has no route to it. Every /operator/v1/* route needs
// `Authorization: OPERATOR-AUTH-V1 <operator key>`. A tenant API key is an unknown credential here.
// Mount list (LD-10): one line per endpoint group module. S2 delivers its modules as new files; S1 adds the line (RQ-1).
import type { Logger } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import type { Db } from '../../db/index.ts';
import { findActiveOperatorKey } from '../../store/operator-keys.ts';
import { BODY_LIMIT, installApiBasics } from '../app.ts';
import { registerOperatorKeyRoutes } from './operator-keys.ts';

/** The operator of an accepted request. The audit actor is operator:<operator>. */
export interface OperatorIdentity {
  keyId: string;
  operator: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    operator: OperatorIdentity | null;
  }
}

/** What every operator endpoint group gets. */
export interface OperatorContext {
  db: Db;
  logger: Logger;
  now: () => number;
  /** The operator of the request. The auth hook sets it before a route runs. */
  operator: (req: FastifyRequest) => OperatorIdentity;
}

export interface OperatorDeps {
  db: Db;
  logger: Logger;
  now?: () => number;
}

const MOUNTS: Array<(app: FastifyInstance, ctx: OperatorContext) => void> = [
  registerOperatorKeyRoutes,
];

/**
 * The operator key of the header, or null. Scheme name case-insensitive (as contract §1.2). The credential is the
 * whole rest of the header: a key with another form fails the lookup (wrong grammar).
 */
export function parseOperatorAuthorization(header: string | undefined): string | null {
  const m = /^\s*(\S+)\s+(\S+)\s*$/.exec(header ?? '');
  return m && m[1]!.toLowerCase() === 'operator-auth-v1' ? m[2]! : null;
}

export async function buildOperatorApp(deps: OperatorDeps): Promise<FastifyInstance> {
  const now = deps.now ?? Date.now;
  const log = deps.logger;
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT, return503OnClosing: false });
  installApiBasics(app, log);
  // A POST without a body (for example …/revoke) may still send Content-Type: application/json.
  const json = app.getDefaultJsonParser('error', 'error');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const text = String(body);
    if (text === '') return done(null, undefined);
    return json(req, text, done);
  });

  const ctx: OperatorContext = {
    db: deps.db, logger: log, now,
    operator: (req) => {
      if (!req.operator) throw new Error('operator route without the operator auth hook');
      return req.operator;
    },
  };

  app.decorateRequest('operator', null);
  await app.register(async (scope) => {
    // Every failure (no header, another scheme, wrong grammar, unknown, expired, revoked key) gives the same 401.
    scope.addHook('onRequest', async (req) => {
      const presented = parseOperatorAuthorization(req.headers.authorization);
      const key = presented ? findActiveOperatorKey(deps.db, presented, now()) : null;
      if (!key) {
        log.warn('api_auth_failed', { trace_id: req.traceId, scheme: 'operator', code: 'INVALID_OPERATOR_AUTHORIZATION_HEADER' });
        throw new ApiError('INVALID_OPERATOR_AUTHORIZATION_HEADER');
      }
      req.operator = { keyId: key.id, operator: key.operator };
    });
    for (const mount of MOUNTS) mount(scope, ctx);
  });
  return app;
}
