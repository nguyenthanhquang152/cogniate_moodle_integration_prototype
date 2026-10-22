// The `{LMS}` text name of the player texts (LA-ADR-01 D12): the server renders the manifest `names.text` of the
// connection's channel in `data-lms-name` (play shell and runtime page). The texts go only into `textContent`.
// The server always sets the attribute. A page without it gets the kernel's generic name (`GENERIC_TEXT_NAME` of
// @cogniate/channel-kernel); the player does not import the kernel, so that its two browser scripts stay small.
const GENERIC_TEXT_NAME = 'your LMS';

export function lmsName(element: Element | null): string {
  const name = element?.getAttribute('data-lms-name')?.trim();
  return name ? name : GENERIC_TEXT_NAME;
}
