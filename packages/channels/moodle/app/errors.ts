import { ApiErrorBase, defineErrorTable } from '@cogniate/shared/channel';

const ERRORS = defineErrorTable({
  NOT_FOUND: { status: 404, description: 'Not found.' },
  MBZ_NOT_SUPPORTED: { status: 422, description: 'Only a SCORM 1.2 version can be built as a Moodle backup (.mbz).' },
  MBZ_BUILD_LIMIT: { status: 409, description: 'This library already has the most builds that may wait or run at the same time.' },
});
export class ExportError extends ApiErrorBase<keyof typeof ERRORS> {
  constructor(code: keyof typeof ERRORS, message?: string) { super(ERRORS, code, message); }
}
