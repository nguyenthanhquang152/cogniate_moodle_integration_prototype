import { expect, it } from 'vitest';
import { pendingToolText } from './index.ts';

it('keeps the frozen MOODLE_TOOL_MAY_EXIST text through the public kernel export (BD-A1-30)', () => {
  expect(pendingToolText('Course tool')).toBe("Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Course tool', then connect again.");
});
