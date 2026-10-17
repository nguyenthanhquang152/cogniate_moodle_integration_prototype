// HTML helpers of the server-rendered pages of both services (security §7: escape all untrusted text on output).

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/**
 * The one clean-up text for "Moodle may have saved a Pending tool" (app contract §6 MOODLE_TOOL_MAY_EXIST, A-T3b-01).
 * The app page shows it to the Moodle admin; the LTI service returns the same text in its error description.
 */
export function pendingToolText(toolName: string): string {
  return `Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool '${toolName}', then connect again.`;
}
