import { describe, expect, it } from 'vitest';
import { ApiErrorBase, apiErrorBody, defineErrorTable } from './errors.ts';

const TABLE = defineErrorTable({
  NOT_FOUND: { status: 404, description: 'Not found.' },
  REJECTED: { status: 422, description: 'Rejected.' },
  PLATFORM_REJECTED: { status: 400, alsoStatus: [404], description: 'The platform rejected it.' },
});
type Code = keyof typeof TABLE;
class TestError extends ApiErrorBase<Code> {
  constructor(code: Code, description?: string, options?: { status?: number; details?: Record<string, unknown> }) {
    super(TABLE, code, description, options);
  }
}

describe('generic API errors (ADR-008 errors, B-T2b-02)', () => {
  it('a service class takes status and description from its table; details are extra fields', () => {
    const err = new TestError('REJECTED', undefined, { details: { reasons: [{ code: 'X' }], action: 'Do Y.' } });
    expect(err).toBeInstanceOf(ApiErrorBase);
    expect(err.body()).toEqual({ status: 422, error: 'Unprocessable Entity', details: { message: 'REJECTED', description: 'Rejected.', reasons: [{ code: 'X' }], action: 'Do Y.' } });
  });

  it('only the listed other statuses are allowed', () => {
    expect(new TestError('PLATFORM_REJECTED', 'x', { status: 404 }).status).toBe(404);
    expect(() => new TestError('NOT_FOUND', 'x', { status: 500 })).toThrow(/not allowed/);
    expect(() => new ApiErrorBase(TABLE, 'NOPE' as Code)).toThrow(/unknown API error code/);
  });

  it('apiErrorBody: message and description win over extra fields', () => {
    expect(apiErrorBody(422, 'X', 'd', { message: 'no', description: 'no', reasons: [] })).toEqual({ status: 422, error: 'Unprocessable Entity', details: { message: 'X', description: 'd', reasons: [] } });
  });
});
