// HTML helpers of the server-rendered pages of both services (security §7: escape all untrusted text on output).
// The frozen clean-up text of the tool-may-exist code lives in the kernel (`pendingToolText`, BD-A1-30).

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
