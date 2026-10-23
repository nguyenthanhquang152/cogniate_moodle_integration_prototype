// Moodle channel manifest (LA-ADR-01 D2). Values come from today's adapter (services/cogniate-app/src/providers/moodle.ts),
// the D3 and D6 tables and the portal texts (apps/portal/src/Integrations.tsx, connect/*). Facts and sources: README.md.
import type { ChannelManifest } from '@cogniate/channel-kernel';

const manifest = {
  id: 'moodle',
  family: 'lti13',
  names: { text: 'Moodle', label: 'Moodle' },
  card: {
    title: 'Moodle', description: 'Export SCORM packages and sync course content with your Moodle LMS.', mark: 'm', icon: 'graduation-cap', color: 'orange',
    category: 'LMS Publishing', order: 1,
  },
  availability: 'ga',
  // Both methods bind with `self` (the typed six-value manual path is in MANUAL_SELF_LEGACY_CHANNELS).
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['standard'], defaultProfile: 'standard' },
    { method: 'manual', authority: 'self', profiles: ['standard'], defaultProfile: 'standard' },
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
    'siteApi.token': true,
    'publish.createCourse': true,
    'export.packages': ['mbz'],
    // Moodle hides the grade settings for several items (A-T0-11): single select.
    'content.multiple': false,
    'launch.windowHint': false,
    'records.reporters': ['lti-ags'],
    'records.readBack': true,
  },
  // Moodle guards no product family (D6).
  lti: { guardedFamilies: [], toolConfiguration: 'channel' },
  setup: {
    createFields: [{ key: 'siteUrl', label: 'Moodle site URL', kind: 'origin', required: true }],
    bindingFields: [
      { key: 'issuer', label: 'Platform ID (issuer)', kind: 'url', required: true, method: 'manual' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
      { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'manual' },
      { key: 'authenticationEndpoint', label: 'Authentication request URL', kind: 'url', required: true, method: 'manual' },
      { key: 'accessTokenEndpoint', label: 'Access token URL', kind: 'url', required: true, method: 'manual' },
      { key: 'jwksUrl', label: 'Public keyset URL', kind: 'url', required: true, method: 'manual' },
    ],
  },
  // D5 "Tables": the frozen Moodle-only tables and columns that the Moodle extension code uses.
  storage: {
    tables: ['mbz_build'],
    columns: [
      'connection.id', 'connection.library_id', 'connection.site_url', 'connection.updated_at',
      'publication.id', 'publication.connection_id', 'publication.updated_at',
      'connection.ws_token_encrypted', 'connection.ws_site_name', 'connection.ws_release', 'publication.moodle_course_id',
      'publication.moodle_course_idnumber', 'publication.shell_status', 'publication.shell_error',
    ],
  },
  texts: {
    // The portal error texts (BD-A1-63; before: apps/portal/src/connect/provider-errors.tsx). Other keys: the generic text.
    errors: {
      SITE_RULE_1: 'Enter only the address, for example https://school.instructure.com. No path.',
      // BD-A1-81: the manual form keeps today's server sentence (LEGACY_SELF_BINDING_TEXT.collision) byte for byte.
      PLATFORM_IN_USE: 'This {LMS} tool is already registered with Cogniate. In {LMS}, make a new tool for this library and use its values.',
    },
    registered: 'Registered — activate in {LMS}',
    // The Dynamic Registration steps of the portal (apps/portal/src/connect/moodle-steps.json, Moodle 5.2.4).
    adminSteps: [
      'In {LMS}, open Manage tools.',
      'Paste the registration URL into the Tool URL field. Click Add LTI Advantage.',
      'If {LMS} asks to update an existing tool, click Register as a new external tool. Cogniate refuses an update.',
      'In the Cogniate panel inside {LMS}, check the site and the library. Click Connect. The panel closes.',
      'Find the tool card "{tool}". It shows Pending. Click Activate.',
      'On the same tool card, click Edit. Set Tool configuration usage to "Show in activity chooser and as a preconfigured tool". Set Default launch container to "New window". Click Save changes.',
    ],
    teacherSteps: ['Edit mode → Add content → Activity or resource → {tool} → Add → Select content'],
    disconnect: 'This stops launches through this connection. The tool stays in {LMS}.',
    // The standard profile is always ready.
    notReady: null,
    // BD-A1-59: the Dynamic Registration help sentences with Moodle menu paths, byte for byte the LA-E1-10 texts
    // (LTI service registration pages) and the app register page text of UPDATE_NOT_ALLOWED.
    registration: {
      UNKNOWN_TOOL_ACCOUNT: 'This registration URL is not valid. Copy it again in Cogniate (Integrations > {LMS} > Connect) and paste it in {LMS} (Manage tools > Add LTI Advantage).',
      INVALID_REQUEST: 'Start the registration again from {LMS} (Site administration > Plugins > Activity modules > External tool > Manage tools).',
      ISSUER_MISMATCH: 'The platform configuration is not from this {LMS} site. Start the registration again from Manage tools on the site itself.',
      INVALID_OPENID_CONFIGURATION: '{LMS} sent a registration that Cogniate cannot use. Start the registration again from Manage tools. If it happens again, give the trace id to your Cogniate contact.',
      REGISTRATION_UPDATE_NOT_ALLOWED: 'This registration updates a tool that is not this connection. Choose "Register as a new external tool" in {LMS}.',
      UPDATE_NOT_ALLOWED: 'Go back in {LMS} and choose Register as a new external tool.',
      TOOL_MAY_EXIST: "{LMS} may have saved a Pending tool. In Manage tools, delete the Pending tool '{tool}', then connect again.",
    },
  },
} satisfies ChannelManifest;

export default manifest;
