// Canary channel manifest (LA-E7-01, LA-ADR-01 D1, D2, D4, TEST-STRATEGY §2.7).
// Loaded only when tests pass `tests/ltiaas/canary` as a second root to `loadChannelFolders`.
// Never part of the product registry (`packages/channels`).
import type { ChannelManifest } from '@cogniate/channel-kernel';

const canaryManifest = {
  id: 'zz-canary',
  family: 'lti13',
  names: {
    text: 'Canary LMS',
    label: 'Canary LMS',
  },
  card: {
    title: 'Canary LMS',
    description: 'Publish Cogniate courses to Canary LMS with LTI 1.3.',
    mark: 'Cn',
    color: 'slate',
    category: 'LMS Publishing',
    order: 990,
  },
  availability: 'simulation-only',
  registration: [
    {
      method: 'manual',
      authority: 'operatorGrant',
      profiles: ['zz-canary-sim'],
      defaultProfile: 'zz-canary-sim',
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
    'launch.windowHint': true,
    'launch.topLevelContinue': false,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  lti: {
    guardedFamilies: [{ family: 'zz-canary-lms', level: 'registration' }],
    toolConfiguration: 'channel',
  },
  setup: {
    createFields: [
      {
        key: 'siteUrl',
        label: 'Canary site URL',
        kind: 'origin',
        required: true,
      },
    ],
    bindingFields: [
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
      'Open {LMS} administration at {site} and register {tool} as an LTI 1.3 tool.',
      'Copy the Client ID and Deployment ID from {LMS} into {tool}.',
      'Ask your Cogniate operator for an approval code.',
    ],
    teacherSteps: [
      'In {LMS}, add an External Tool activity and select the {tool} course.',
      'A learner must open the activity from {LMS}.',
    ],
    disconnect: 'This stops launches through this {LMS} connection at {site}.',
    notReady: '{LMS} is not set up for this {tool} service yet. Ask your Cogniate operator.',
  },
} as const satisfies ChannelManifest;

export default canaryManifest;
