// The Acme LMS channel: a kind A LMS that speaks standard LTI 1.3 (no Dynamic Registration). Its one profile has
// `endpoints: admin`, so the folder has no app.ts: the kernel admin-value setup adapter serves it (LA-ADR-01 D5). The
// Acme URL forms are field defaults that the portal pre-fills; the grant binds every value. Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'acme-lms',
  family: 'lti13',
  names: { text: 'Acme LMS', label: 'Acme LMS' },
  card: {
    title: 'Acme LMS', description: 'Publish Cogniate courses to Acme LMS with LTI 1.3.', mark: 'ACM', color: 'orange',
    category: 'LMS Publishing', order: 6,
  },
  availability: 'ga',
  // Acme LMS has no Dynamic Registration, so manual is the only method. Manual always needs an operator grant (load
  // check 6; LA-ADR-02 D6).
  registration: [
    { method: 'manual', authority: 'operatorGrant', profiles: ['acme-lms'], defaultProfile: 'acme-lms' },
  ],
  capabilities: {
    // A2 LA-ADR-05 D4: the four AGS scopes, no NRPS scope.
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
    // Many deployments per registration.
    'deployments.multiple': true,
    // A2 LA-ADR-05 D3b: standard Deep Linking 2.0 accepts several items in one answer (as lti-generic).
    'content.multiple': true,
    // Acme opens a link in a frame by default. The hint is sent only when the platform accepts `window`.
    'launch.windowHint': true,
    'launch.topLevelContinue': false,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // LA-ADR-02 D1: new Dynamic Registrations of the Acme family must use this channel; existing lti-generic connections
  // of an Acme site keep working (registration level; UNVERIFIED family, simulated only). 'channel': without app.ts, the
  // kernel admin-value adapter gives the generic tool rows (no `setup.toolRows`; A1 BD-A1-85).
  lti: { guardedFamilies: [{ family: 'acme', level: 'registration' }], toolConfiguration: 'channel' },
  setup: {
    createFields: [{ key: 'siteUrl', label: 'Acme LMS site URL', kind: 'origin', required: true }],
    // The strict body of the kernel admin-value adapter (app API delta §3.4). The issuer is the site URL. The Acme URL
    // forms are defaults; the values on the Acme tool page always win.
    bindingFields: [
      { key: 'issuer', label: 'Issuer', kind: 'url', required: true, method: 'manual', default: '{siteUrl}' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'authenticationEndpoint', label: 'OIDC authentication URL', kind: 'url', required: true, method: 'manual', default: '{siteUrl}/lti/auth' },
      { key: 'accessTokenEndpoint', label: 'Access token URL', kind: 'url', required: true, method: 'manual', default: '{siteUrl}/lti/token' },
      { key: 'jwksUrl', label: 'Keyset URL', kind: 'url', required: true, method: 'manual', default: '{siteUrl}/lti/jwks.json' },
      { key: 'tokenAudience', label: 'Token audience', kind: 'url', required: false, method: 'manual' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'manual' },
    ],
  },
  texts: {
    adminSteps: [
      'You need an {LMS} administrator to complete the connection.',
      'In {LMS}, open Site administration, then Integrations, then LTI 1.3 tools, and select Add tool.',
      'Enter the tool values below and save the tool.',
      'Copy the Issuer, the Client ID, the OIDC authentication URL, the Access token URL and the Keyset URL from the tool page into Cogniate.',
      'Make a deployment of the tool for your courses. Copy its Deployment ID.',
      'Ask your Cogniate operator for an approval code. The operator checks the values with your {LMS} administrator first. The code works once and expires.',
    ],
    teacherSteps: ['In {LMS}, add an LTI 1.3 activity to a course, select {tool}, then select the Cogniate course.'],
    disconnect: 'This stops launches through this connection. Cogniate items in {LMS} courses stop working.',
    // The profile shares no platform, so it is always ready.
    notReady: null,
  },
} satisfies ChannelManifest;

export default manifest;
