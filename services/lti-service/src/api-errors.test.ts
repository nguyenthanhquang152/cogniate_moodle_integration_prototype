import { describe, expect, it } from 'vitest';
import { API_ERRORS, ApiError } from './api-errors.ts';

// Contract lti-service-api §1.3, copied from the table (HTTP, details.message). Update both together.
const CONTRACT_1_3: Array<[number, string]> = [
  [403, 'API_KEY_SCOPE_MISSING'], [409, 'API_KEY_LIMIT'],
  [409, 'SIGNING_KEY_NEXT_EXISTS'], [409, 'SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH'],
  [409, 'SIGNING_KEY_ACTIVE'], [409, 'SIGNING_KEY_WRONG_STATE'],
  [400, 'INVALID_REQUEST'], [400, 'INVALID_LINE_ITEM_ID'], [400, 'INVALID_URL_PARAMETER'], [400, 'INVALID_CONTENT_ITEM'],
  [400, 'INVALID_DEEP_LINK_RETURN_URL'], // T3c round 2; Architect must add this return URL rule to §3.2.
  [400, 'UNSUPPORTED_AUTH_METHOD'], [400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
  // M1 (§9.2)
  [400, 'UNKNOWN_PROFILE'], [400, 'ISSUER_RESERVED'], [400, 'INVALID_SITE_URL'], [400, 'PLATFORM_URL_NOT_IN_PROFILE'],
  [401, 'INVALID_AUTHORIZATION_HEADER'],
  [401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'], [401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER'], [403, 'SERVICE_NOT_AVAILABLE'],
  [403, 'PLATFORM_NOT_ACTIVE'], [403, 'DEPLOYMENT_NOT_ACTIVE'], [404, 'NOT_FOUND'], [404, 'UNREGISTERED_PLATFORM'], [404, 'UNKNOWN_DEPLOYMENT'],
  [404, 'REGISTRATION_NOT_FOUND'],
  [409, 'REGISTRATION_ALREADY_COMPLETED'], [409, 'REGISTRATION_UPDATE_NOT_ALLOWED'], [409, 'PLATFORM_ALREADY_EXISTS'],
  [409, 'SHARED_PLATFORM_EXISTS'], [409, 'SHARED_PLATFORM_DEPLOYMENTS'], [409, 'SHARED_PLATFORM_IN_USE'], [409, 'DEPLOYMENT_ALREADY_EXISTS'],
  [409, 'BINDING_REF_MISMATCH'],
  [409, 'PLATFORM_CONFLICT'], [400, 'PLATFORM_REJECTED_REQUEST'], [501, 'NOT_IMPLEMENTED'], [502, 'PLATFORM_ERROR'],
  [504, 'PLATFORM_TIMEOUT'], [500, 'INTERNAL_ERROR'],
  // LA (contract delta §1.3)
  [401, 'INVALID_OPERATOR_AUTHORIZATION_HEADER'], [409, 'OPERATOR_KEY_IN_USE'],
  [403, 'TOOL_ACCOUNT_SUSPENDED'], [409, 'ACCOUNT_ALREADY_EXISTS'], [409, 'ACCOUNT_CLOSED'],
  [429, 'PLATFORM_RATE_LIMITED'],
  [429, 'RATE_LIMITED'],
];

describe('LTI service API codes (contract §1.3)', () => {
  it('the typed list has exactly the contract codes and statuses', () => {
    expect(Object.entries(API_ERRORS).map(([code, spec]) => [spec.status, code])).toEqual(CONTRACT_1_3);
  });

  it('ApiError takes the status and the default description from the list; only listed extra statuses', () => {
    const err = new ApiError('UNREGISTERED_PLATFORM');
    expect([err.status, err.code, err.description]).toEqual([404, 'UNREGISTERED_PLATFORM', 'Unknown platform id.']);
    expect(new ApiError('INVALID_REQUEST', 'Invalid field: url.').body()).toEqual({
      status: 400, error: 'Bad Request', details: { message: 'INVALID_REQUEST', description: 'Invalid field: url.' },
    });
    expect(new ApiError('PLATFORM_REJECTED_REQUEST', 'x', { status: 404 }).status).toBe(404);
    expect(() => new ApiError('NOT_FOUND', 'x', { status: 500 })).toThrow(/not allowed/);
  });
});
