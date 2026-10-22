// Admin-value canary channel manifest variant without `app.ts` (LA-E7-01, LA-E2-03 AC-05).
// Uses `lti.toolConfiguration: 'none'` and manifest-declared `createFields` / `bindingFields`
// so the kernel routes handle create, edit, approve and tool configuration without an `app.ts` adapter.
const adminValueCanaryManifest = {
  id: 'zz-canary-admin',
  family: 'lti13',
  names: {
    text: 'Canary Admin LMS',
    label: 'Canary Admin LMS',
  },
  card: {
    title: 'Canary Admin LMS',
    description: 'Connect an admin-configured LTI 1.3 platform without a channel app adapter.',
    mark: 'Ca',
    color: 'teal',
    category: 'LMS Publishing',
    order: 991,
  },
  availability: 'simulation-only',
  registration: [
    {
      method: 'manual',
      authority: 'operatorGrant',
      profiles: ['zz-canary-admin-sim'],
      defaultProfile: 'zz-canary-admin-sim',
    },
  ],
  capabilities: {
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
    'deployments.multiple': false,
    'setup.artifacts': [],
    'siteApi.token': false,
    'publish.createCourse': false,
    'export.packages': [],
    'content.multiple': false,
    'content.ungraded': false,
    'launch.windowHint': false,
    'launch.topLevelContinue': false,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  lti: {
    guardedFamilies: [],
    toolConfiguration: 'none',
  },
  setup: {
    createFields: [
      {
        key: 'siteUrl',
        label: 'LMS site URL',
        kind: 'origin',
        required: true,
      },
    ],
    bindingFields: [
      {
        key: 'issuer',
        label: 'Platform ID (issuer)',
        kind: 'url',
        required: true,
        method: 'manual',
      },
      {
        key: 'clientId',
        label: 'Client ID',
        kind: 'id',
        required: true,
        method: 'manual',
      },
      {
        key: 'deploymentId',
        label: 'Deployment ID',
        kind: 'id',
        required: true,
        method: 'manual',
      },
      {
        key: 'authenticationEndpoint',
        label: 'Authentication request URL',
        kind: 'url',
        required: true,
        method: 'manual',
      },
      {
        key: 'accessTokenEndpoint',
        label: 'Access token URL',
        kind: 'url',
        required: true,
        method: 'manual',
      },
      {
        key: 'jwksUrl',
        label: 'Public keyset URL',
        kind: 'url',
        required: true,
        method: 'manual',
      },
      {
        key: 'grantCode',
        label: 'Approval code',
        kind: 'grantCode',
        required: true,
        method: 'manual',
      },
    ],
    connectionCheck: false,
  },
  texts: {
    adminSteps: [
      'Open {LMS} administration and register Cogniate as an LTI 1.3 tool.',
      'Paste the Platform ID, endpoints, Client ID and Deployment ID from {LMS} into Cogniate.',
      'Ask your Cogniate operator for an approval code.',
    ],
    teacherSteps: [
      'In {LMS}, add an External Tool activity and select the Cogniate course.',
    ],
    disconnect: 'This stops launches through this {LMS} connection.',
    notReady: '{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  },
} as const;

export default adminValueCanaryManifest;
