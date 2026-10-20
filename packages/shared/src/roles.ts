// LTI role sets (ADR-011 §10, F-STD-5). One rule for every LMS: institution roles never make a context role.
const LIS = 'http://purl.imsglobal.org/vocab/lis/v2';
const CONTEXT_STAFF = ['Instructor', 'ContentDeveloper', 'Administrator'] as const;

const isContextRole = (role: string, names: readonly string[]): boolean =>
  names.some((n) => role === `${LIS}/membership#${n}` || role.startsWith(`${LIS}/membership/${n}#`) || role === n);

/** Context staff: membership Instructor, ContentDeveloper or Administrator, their sub-roles, or the simple names. */
export function hasContextStaffRole(roles: readonly string[]): boolean {
  return roles.some((r) => isContextRole(r, CONTEXT_STAFF));
}

/** Context learner: membership Learner, its sub-roles, or the simple name `Learner`. */
export function hasContextLearnerRole(roles: readonly string[]): boolean {
  return roles.some((r) => isContextRole(r, ['Learner']));
}

export const ADMIN_ROLES: readonly string[] = [
  `${LIS}/institution/person#Administrator`,
  `${LIS}/system/person#Administrator`,
  `${LIS}/system/person#SysAdmin`,
];

export function hasAdminRole(roles: readonly string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** Deep Linking (the picker) is allowed with a context staff role or an admin role. */
export function canSelectContent(roles: readonly string[]): boolean {
  return hasContextStaffRole(roles) || hasAdminRole(roles);
}

/** A launch is graded only with a context learner role and no context staff role; any other launch is a preview. */
export function isGradedLaunch(roles: readonly string[]): boolean {
  return hasContextLearnerRole(roles) && !hasContextStaffRole(roles);
}
