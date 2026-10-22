import { ApiError } from '../../app/api-errors.ts';
import type { Connection } from '../../domain/connections.ts';
import { selfAuthority } from './self.ts';
import { operatorGrantAuthority } from './operator-grant.ts';
import type { AuthorityDeps, AuthorityStrategy } from './types.ts';

export type { AuthorityDeps, AuthorityStrategy } from './types.ts';
/** The stored authority controls every binding action, independently of channel identity. */
export function authorityFor(c: Pick<Connection, 'bindingAuthority'>, deps: AuthorityDeps): AuthorityStrategy {
  if (c.bindingAuthority === 'self') return selfAuthority(deps);
  if (c.bindingAuthority === 'operatorGrant') return operatorGrantAuthority(deps);
  throw new ApiError('CAPABILITY_NOT_SUPPORTED');
}
