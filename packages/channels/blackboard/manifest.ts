// Blackboard channel manifest (LA-ADR-01 D2). Values come from today's adapter
// (services/cogniate-app/src/providers/blackboard.ts), the D3 and D6 tables and the portal texts
// (apps/portal/src/Integrations.tsx, lms.ts, connect/blackboard/*). Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'blackboard',
  family: 'lti13',
  names: { text: 'Blackboard', label: 'Blackboard Learn' },
  card: {
    title: 'Blackboard', description: 'Publish Cogniate courses to Blackboard Learn with LTI 1.3.', mark: 'Bb', color: 'blue',
    category: 'LMS Publishing', order: 3,
  },
  availability: 'ga',
  // One shared platform (the Cogniate Application ID): only `operatorGrant` (load check 6, rule A4).
  registration: [
    { method: 'manual', authority: 'operatorGrant', profiles: ['blackboard', 'blackboard-sim'], defaultProfile: 'blackboard' },
  ],
  capabilities: {
    // ADR-009: the services that the tool asks for today (LA-E3-07 changes this list, LA-IC-04).
    'registration.scopes': [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    ],
    'content.multiple': false,
    'launch.windowHint': true,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // Check 14 (D6): a launch with family `blackboardlearn` must come from a Blackboard profile.
  lti: { guardedFamilies: [{ family: 'blackboardlearn', level: 'launch' }], toolConfiguration: 'channel' },
  setup: {
    createFields: [
      { key: 'siteUrl', label: 'Learn URL', kind: 'origin', required: true },
      { key: 'profile', label: 'Blackboard type', kind: 'choice', required: false },
    ],
    bindingFields: [
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'manual' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: false, method: 'manual' },
    ],
  },
  texts: {
    // The administrator steps of the portal (apps/portal/src/connect/blackboard/blackboard-steps.json).
    adminSteps: [
      'You need a {LMS} Learn administrator to complete the connection.',
      'One Learn site is one connection. Enter the address that teachers use.',
      'In Learn, open Administrator Panel, then LTI Tool Providers, then Register LTI 1.3/Advantage Tool.',
      'Enter the Client ID below, then select Submit. This first Submit only shows the tool settings. Compare the values that Learn shows with the rows below.',
      'Set the Tool Status to Approved.',
      'In Institution Policies, set User Fields to Send to Role in Course only. Do not send Name or Email Address.',
      'Allow grade service access and Membership Service access.',
      'Select Submit again at the end of the page. This final Submit adds the tool. Learn does not save the tool without it.',
      'Copy the Deployment ID that Learn shows. Then come back to Cogniate.',
      'Ask your Cogniate operator for an approval code. The operator checks the request with your {LMS} administrator first. The code works once and expires.',
    ],
    teacherSteps: [
      '{LMS} Ultra: open Course Content, then select +, then Content Market, then Cogniate. Select the course.',
      '{LMS} Original: open a content area, then Build Content, then Cogniate. Select the course.',
      'A learner must open the activity from {LMS}. Learners are anonymous: Cogniate gets no names or emails.',
    ],
    disconnect: 'This switches off Cogniate for this {LMS} site only. Other schools are not affected. Cogniate items in {LMS} courses stop working, and connecting again later does not restore them.',
    notReady: '{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  },
} satisfies ChannelManifest;

export default manifest;
