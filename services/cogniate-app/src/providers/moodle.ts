// Moodle (`standard` profile): unchanged behaviour (app contract §4, §4.1). Dynamic registration and the six-value
// manual connect stay in app/connections.ts and tool-pages/register.ts; this adapter gives the rows and the data.
import { toolName, toolUrls } from './common.ts';
import type { ProviderAdapter, ToolRow } from './types.ts';

/** App contract §4.1: exactly these 16 rows, in this order (stable keys; labels are the Moodle 5.2.4 form labels). */
export function moodleToolRows(urls: Parameters<typeof toolUrls>[0], libraryName: string): ToolRow[] {
  const t = toolUrls(urls);
  return [
    { key: 'tool_name', label: 'Tool name', value: toolName(libraryName) },
    { key: 'tool_url', label: 'Tool URL', value: t.launch },
    { key: 'lti_version', label: 'LTI version', value: 'LTI 1.3' },
    { key: 'public_key_type', label: 'Public key type', value: 'Keyset URL' },
    { key: 'public_keyset_url', label: 'Public keyset', value: t.keys },
    { key: 'initiate_login_url', label: 'Initiate login URL', value: t.login },
    { key: 'redirection_uris', label: 'Redirection URI(s)', value: t.launch },
    { key: 'deep_linking', label: 'Supports Deep Linking (Content-Item Message)', value: 'Yes' },
    { key: 'content_selection_url', label: 'Content Selection URL', value: t.launch },
    { key: 'tool_configuration_usage', label: 'Tool configuration usage', value: 'Show in activity chooser and as a preconfigured tool' },
    { key: 'launch_container', label: 'Default launch container', value: 'New window' },
    { key: 'ags', label: 'IMS LTI Assignment and Grade Services', value: 'Use this service for grade sync and column management' },
    { key: 'nrps', label: 'IMS LTI Names and Role Provisioning', value: "Use this service to retrieve members' information as per privacy settings" },
    { key: 'share_name', label: "Share launcher's name with tool", value: 'Never' },
    { key: 'share_email', label: "Share launcher's email with tool", value: 'Never' },
    // Q-T7-01 (contract §4.1 row 16): the exact Moodle 5.2.4 option text of the tool form.
    { key: 'accept_grades', label: 'Accept grades from the tool', value: 'As specified in Deep Linking definition or Delegate to teacher' },
  ];
}

export const moodleProvider: ProviderAdapter = {
  lms: 'moodle',
  lmsName: 'Moodle',
  label: 'Moodle',
  methods: ['dynamic', 'manual'],
  capabilities: { dynamicRegistration: true, operatorApproval: false, webServices: true, courseShell: true, addDeployment: false, canvasConfiguration: false },
  defaultProfile: 'standard',
  acceptsServiceUrl: false,
  siteRuleSuffixes: () => null,
  profileLabel: (id) => (id === 'standard' ? 'Moodle site' : null),
  toolConfiguration: (ctx) => moodleToolRows(ctx.urls, ctx.libraryName),
};
