// The user text of each package reject code (B-T4a-02): a short title and one next-action sentence. The app owns it
// (B-T2b-02): the inspector says WHAT is wrong (codes), the app says what the user should DO.
import type { RejectCode } from '@cogniate/package-inspector';

const EXPORT_AGAIN = 'Export the course again from Cogniate and upload the new file. Do not change the files by hand.';

/**
 * The user text of each reject code (B-T4a-02): a short title and one next-action sentence. The API returns them in
 * each reason and the first action as details.action (contract §3.2), so the portal needs no text list of its own.
 */
export const REJECT_INFO: Record<RejectCode, { title: string; action: string }> = {
  ZIP_INVALID: { title: 'The file is not a readable zip', action: 'Upload the zip file that Cogniate exported (SCORM 1.2 or HTML), without changes.' },
  ZIP_TOO_LARGE: { title: 'The package is too large', action: 'Make the course smaller than 200 MB (500 MB unpacked), for example with shorter videos, and export it again.' },
  ZIP_TOO_MANY_ENTRIES: { title: 'The package has too many files', action: 'Make a package with at most 5,000 files and upload it again.' },
  ZIP_BOMB: { title: 'A file in the package is compressed too much', action: EXPORT_AGAIN },
  PATH_TRAVERSAL: { title: 'The package has an unsafe file path', action: EXPORT_AGAIN },
  ABSOLUTE_PATH: { title: 'The package has an unsafe file path', action: EXPORT_AGAIN },
  SYMLINK_ENTRY: { title: 'The package has a symbolic link', action: EXPORT_AGAIN },
  INVALID_ENTRY_NAME: { title: 'A file name in the package is not allowed', action: 'Rename the file without control characters or backslashes, or export the course again.' },
  DUPLICATE_ENTRY: { title: 'Two files in the package have the same name', action: 'Give each file a different name (upper and lower case count as the same), or export the course again.' },
  MANIFEST_INVALID_XML: { title: 'The SCORM manifest cannot be read', action: 'Export the course again as SCORM 1.2.' },
  MANIFEST_DTD_FORBIDDEN: { title: 'The SCORM manifest has a forbidden declaration', action: 'Export the course again as SCORM 1.2. The manifest must not have <!DOCTYPE> or <!ENTITY>.' },
  SCORM_VERSION_UNSUPPORTED: { title: 'This SCORM version is not supported', action: 'Export the course again as SCORM 1.2.' },
  MULTI_SCO_UNSUPPORTED: { title: 'The package has more than one SCO', action: 'Export the course again as SCORM 1.2 with one SCO.' },
  LAUNCH_FILE_MISSING: { title: 'The start file of the SCO is missing', action: 'Export the course again as SCORM 1.2. The file that the manifest names must be in the zip.' },
  NO_ENTRY_PAGE: { title: 'The package has no start page', action: 'Upload a package with index.html (HTML export) or imsmanifest.xml (SCORM export) at the top level.' },
  INVALID_PACKAGE_IDENTIFIER: { title: 'An id, page name or title in the package is not allowed', action: 'Export the course again from Cogniate. Ids, page names and titles must follow the Cogniate package rules.' },
};
