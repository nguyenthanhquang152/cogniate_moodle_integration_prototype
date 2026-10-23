// The generic LTI 1.3 channel (LA-ADR-02 D1, D3): any kind A LTI 1.3 platform without a named channel (Sakai, Open
// edX, Absorb, ...). Its one profile has `endpoints: admin`, so the folder has no app.ts: the kernel admin-value setup
// adapter serves it (LA-ADR-01 D5). Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'lti-generic',
  family: 'lti13',
  names: { text: 'your LMS', label: 'Other LTI 1.3 platform' },
  card: {
    title: 'LTI 1.3', description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.', mark: 'LTI', color: 'green',
    category: 'LMS Publishing', order: 4,
  },
  availability: 'ga',
  // Dynamic Registration binds with `self` only when the configuration keeps every endpoint on the issuer origin
  // (I-SELF, LA-ADR-02 D2a); else it is staged with a grant. Manual always needs an operator grant (D3).
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
    { method: 'manual', authority: 'operatorGrant', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
  ],
  capabilities: {
    // A2 LA-ADR-05 D4: the four AGS scopes, no NRPS scope.
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
    'deployments.multiple': true,
    // A2 LA-ADR-05 D3b: several items in one Deep Linking answer.
    'content.multiple': true,
    'launch.windowHint': true,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // No product family is guarded: a named channel guards its own family (LA-ADR-02 D1). The kernel adapter gives the
  // tool rows; 'none' until the K0 kit accepts 'channel' for a channel without app.ts (Lead provisional call, to A1).
  lti: { guardedFamilies: [], toolConfiguration: 'none' },
  setup: {
    createFields: [{ key: 'siteUrl', label: 'LMS site URL', kind: 'origin', required: true }],
    // The strict body of the kernel admin-value adapter (app API delta §3.4). The issuer may have a path; its default
    // is the site URL, and a posted value replaces it.
    bindingFields: [
      { key: 'issuer', label: 'Platform ID (issuer)', kind: 'url', required: true, method: 'manual', default: '{siteUrl}' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'authenticationEndpoint', label: 'Authentication request URL', kind: 'url', required: true, method: 'manual' },
      { key: 'accessTokenEndpoint', label: 'Access token URL', kind: 'url', required: true, method: 'manual' },
      { key: 'jwksUrl', label: 'Public keyset URL', kind: 'url', required: true, method: 'manual' },
      { key: 'tokenAudience', label: 'Token audience', kind: 'url', required: false, method: 'manual' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'manual' },
    ],
  },
  texts: {
    adminSteps: [
      'In {LMS}, open the administration page for LTI 1.3 tools.',
      'Add {tool} as a new LTI 1.3 tool. If {LMS} supports Dynamic Registration, paste the registration URL. Else enter the tool values below in {LMS}.',
      'For a manual connection, copy the Platform ID (issuer), the Client ID, the Deployment ID and the three platform URLs from {LMS} into Cogniate.',
      'Ask your Cogniate operator for an approval code. The operator checks the values with your {LMS} administrator first. The code works once and expires.',
    ],
    teacherSteps: ['In {LMS}, add an LTI 1.3 activity, select {tool}, and select the Cogniate course.'],
    disconnect: 'This stops launches through this connection. Cogniate items in {LMS} courses stop working.',
    // The profile shares no platform, so it is always ready.
    notReady: null,
  },
} satisfies ChannelManifest;

export default manifest;
