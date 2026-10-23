// Canvas channel manifest (LA-ADR-01 D2). Values come from today's adapter (services/cogniate-app/src/providers/canvas.ts),
// the D3 and D6 tables and the portal texts (apps/portal/src/Integrations.tsx, connect/canvas/*). Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'canvas',
  family: 'lti13',
  names: { text: 'Canvas', label: 'Canvas' },
  card: {
    title: 'Canvas', description: 'Publish Cogniate courses to Canvas with LTI 1.3.', mark: 'Cv', color: 'red',
    category: 'LMS Publishing', order: 2,
  },
  availability: 'ga',
  registration: [
    {
      method: 'manual', authority: 'operatorGrant',
      profiles: ['canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-self-hosted', 'canvas-sim-cloud'],
      defaultProfile: 'canvas-cloud-production',
    },
    {
      // LA-ADR-05 D6 (LA-IC-14): the registration stages an inactive platform; the operator grant still proves ownership.
      method: 'dynamic', authority: 'operatorGrant',
      profiles: ['canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-self-hosted', 'canvas-sim-cloud'],
      defaultProfile: 'canvas-cloud-production',
    },
  ],
  capabilities: {
    // A2 LA-ADR-05 D4 (LA-E3-07, LA-IC-04): the four AGS scopes, no NRPS scope. The developer key JSON uses this list.
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
    'deployments.multiple': true,
    'setup.artifacts': ['developer-key-json'],
    'content.multiple': false,
    'launch.windowHint': true,
    'launch.topLevelContinue': true,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // Check 14 (D6): a launch with family `canvas` must come from a Canvas profile.
  lti: { guardedFamilies: [{ family: 'canvas', level: 'launch' }], toolConfiguration: 'channel' },
  setup: {
    createFields: [
      { key: 'siteUrl', label: 'Canvas URL', kind: 'origin', required: true },
      { key: 'serviceUrl', label: 'Canvas service URL', kind: 'origin', required: false },
      { key: 'profile', label: 'Canvas type', kind: 'choice', required: false },
    ],
    bindingFields: [
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'manual' },
    ],
  },
  texts: {
    // The portal error texts (BD-A1-63; before: apps/portal/src/connect/provider-errors.tsx). Other keys: the generic text.
    errors: {
      SITE_RULE_1: 'Enter only the address, for example https://school.instructure.com. No path.',
      SITE_RULE_5: 'This is an Instructure-hosted address. Choose an Instructure-hosted {LMS} type.',
      PLATFORM_IN_USE: 'This {LMS} developer key is already connected to Cogniate. Make a new developer key for this library.',
    },
    registration: { PLATFORM_IN_USE: 'This {LMS} developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator.' }, // BD-A1-101: the grant collision (409) description
    // The administrator steps of the portal (apps/portal/src/connect/canvas/canvas-steps.json).
    adminSteps: [
      'You need a {LMS} administrator to complete the connection.',
      'Use one {LMS} developer key for this Cogniate library.',
      'In {LMS}, open Admin, select your account, then open Developer Keys.',
      'Select + Developer Key, then + LTI Key. Copy the settings below and paste the JSON. Do not edit the JSON.',
      'Save the key and turn it On. Copy its Client ID.',
      'In the account Settings, open Apps, then View App Configurations. Select + App and choose By Client ID. Enter the Client ID and install Cogniate.',
      "Open the app's menu and select Deployment Id. Copy the Deployment ID.",
      'Ask your Cogniate operator for an approval code. The operator checks the request with your {LMS} administrator first. The code works once and expires.',
    ],
    teacherSteps: [
      'In {LMS}, open Assignments, then select + Assignment.',
      'Set Submission Type to External Tool. Select Find, then Cogniate, and select the course.',
      'Check that Load This Tool In A New Tab is selected. Cogniate asks {LMS} for a new tab.',
      'Keep Allowed Attempts unlimited. Cogniate can send a better score later.',
      'Select Save & Publish. The assignment gets 100 points. Learners see it only when the course and the assignment are published.',
      'A learner must open the activity from {LMS}. Learners are anonymous: Cogniate gets no names or emails.',
    ],
    disconnect: 'This stops launches through this connection. Cogniate items in {LMS} courses stop working, and connecting again later does not restore them.',
    notReady: '{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  },
} satisfies ChannelManifest;

export default manifest;
