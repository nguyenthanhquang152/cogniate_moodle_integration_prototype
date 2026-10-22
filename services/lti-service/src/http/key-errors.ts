// Key lifecycle errors owned by lane S2 (LA-ADR-06 D7, contract delta §1.3).
import { ApiErrorBase, defineErrorTable } from '@cogniate/shared';

export const KEY_ERRORS = defineErrorTable({
  SIGNING_KEY_NEXT_EXISTS: { status: 409, description: 'This account already has a next signing key.' },
  SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH: { status: 409, description: 'The signing key has not reached the publish lead time.' },
  SIGNING_KEY_ACTIVE: { status: 409, description: 'The active signing key cannot be removed.' },
  SIGNING_KEY_WRONG_STATE: { status: 409, description: 'The signing key cannot make this change from its current state.' },
});

export class KeyError extends ApiErrorBase<keyof typeof KEY_ERRORS> {
  constructor(code: keyof typeof KEY_ERRORS) { super(KEY_ERRORS, code); }
}
