// The D2L Brightspace channel (LA-ADR-02 D4), the first new named LMS. Its one profile has `endpoints: admin`, so the
// folder has no app.ts: the kernel admin-value setup adapter serves it (LA-ADR-01 D5). The D2L constants are field
// defaults that the portal pre-fills; the grant binds every value. Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'brightspace',
  family: 'lti13',
  names: { text: 'Brightspace', label: 'D2L Brightspace' },
  card: {
    title: 'D2L Brightspace', description: 'Publish Cogniate courses to D2L Brightspace with LTI 1.3.', mark: 'D2L', color: 'purple',
    category: 'LMS Publishing', order: 5,
  },
  availability: 'ga',
  // Dynamic Registration (LA-E2-06, Should) starts with `self`. The real D2L token host is off the issuer origin, so
  // I-SELF fails and every real D2L registration is staged; the operator grant binds it (LA-ADR-02 D2a, D4, D5 item 10;
  // A1 BD-A1-108). A configuration with every endpoint on the issuer origin completes active with `self`, as for
  // lti-generic. Manual always needs an operator grant (D6).
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['brightspace'], defaultProfile: 'brightspace' },
    { method: 'manual', authority: 'operatorGrant', profiles: ['brightspace'], defaultProfile: 'brightspace' },
  ],
  capabilities: {
    // A2 LA-ADR-05 D4: the four AGS scopes, no NRPS scope.
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
    // Many deployments per registration (UUIDs).
    'deployments.multiple': true,
    // D2L opens a link in a frame by default; "Open as External Resource" is per link. The hint is sent only when the
    // platform accepts `window`.
    'launch.windowHint': true,
    'launch.topLevelContinue': false,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // LA-ADR-02 D1: new Dynamic Registrations of the D2L family must use this channel; existing lti-generic connections
  // of a D2L site keep working (registration level; UNVERIFIED family, R2-2). 'channel': without app.ts, the kernel
  // admin-value adapter gives the D2L tool rows below (A1 BD-A1-85).
  lti: { guardedFamilies: [{ family: 'desire2learn', level: 'registration' }], toolConfiguration: 'channel' },
  setup: {
    createFields: [{ key: 'siteUrl', label: 'Brightspace URL', kind: 'origin', required: true }],
    // The strict body of the kernel admin-value adapter (app API delta §3.4). The issuer is the site URL. The D2L
    // constants are defaults (A1 BD-A1-80); the values on the D2L registration page always win.
    bindingFields: [
      { key: 'issuer', label: 'Issuer', kind: 'url', required: true, method: 'manual', default: '{siteUrl}' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'authenticationEndpoint', label: 'OpenID Connect authentication endpoint', kind: 'url', required: true, method: 'manual', default: '{siteUrl}/d2l/lti/authenticate' },
      { key: 'accessTokenEndpoint', label: 'Brightspace OAuth2 access token URL', kind: 'url', required: true, method: 'manual', default: 'https://auth.brightspace.com/core/connect/token' },
      { key: 'jwksUrl', label: 'Brightspace keyset URL', kind: 'url', required: true, method: 'manual', default: '{siteUrl}/d2l/.well-known/jwks' },
      { key: 'tokenAudience', label: 'OAuth2 audience', kind: 'url', required: false, method: 'manual', default: 'https://api.brightspace.com/auth/token' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'manual' },
      // A staged Dynamic Registration (LA-ADR-02 D5 item 10): the admin values come from the staged platform, and the
      // portal pre-fills both ids from it (app API delta §3.4).
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'dynamic' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'dynamic' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'dynamic' },
    ],
    // The values for the D2L "Register Tool" form, in its order (app API delta §3.3; A1 BD-A1-78). The kernel fills the
    // placeholders; the labels are UNVERIFIED until a live check (R2-2).
    toolRows: [
      { key: 'tool_name', label: 'Name', value: '{toolName}' },
      { key: 'domain', label: 'Domain', value: '{ltiHost}' },
      { key: 'redirect_urls', label: 'Redirect URLs', value: '{launchUrl}' },
      { key: 'openid_connect_login_url', label: 'OpenID Connect Login URL', value: '{loginUrl}' },
      { key: 'target_link_uri', label: 'Target Link URI', value: '{launchUrl}' },
      { key: 'keyset_url', label: 'Keyset URL', value: '{keysUrl}' },
      { key: 'extensions', label: 'Extensions', value: 'Assignment and Grade Services, Deep Linking' },
      { key: 'roles', label: 'Roles', value: 'Send institution role' },
      { key: 'privacy', label: 'Privacy', value: 'Do not send name or e-mail.' },
    ],
  },
  texts: {
    adminSteps: [
      'You need a {LMS} administrator to complete the connection.',
      'In {LMS}, open Manage Extensibility, then LTI Advantage, and select Register Tool.',
      'For an automatic connection, choose Dynamic and paste the registration URL from Cogniate. For a manual connection, choose Standard and enter the tool values below.',
      'For a manual connection, save the tool. Copy the Client ID, the Brightspace keyset URL, the OpenID Connect authentication endpoint, the Brightspace OAuth2 access token URL and the OAuth2 audience from the registration page into Cogniate.',
      'Make a deployment of the tool for your org units. Copy its Deployment ID.',
      'Ask your Cogniate operator for an approval code. The operator checks the values with your {LMS} administrator first. The code works once and expires.',
    ],
    teacherSteps: ['In {LMS}, add a link to {tool} in a course, then select the Cogniate course.'],
    disconnect: 'This stops launches through this connection. Cogniate items in {LMS} courses stop working.',
    // The profile shares no platform, so it is always ready.
    notReady: null,
  },
} satisfies ChannelManifest;

export default manifest;
