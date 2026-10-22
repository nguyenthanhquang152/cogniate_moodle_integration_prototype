import { expect, it } from 'vitest';
import { BACK_LINK_ATTRIBUTE, TOOL_MAY_EXIST_CODE, pendingToolText } from './index.ts';

it('keeps the frozen MOODLE_TOOL_MAY_EXIST text through the public kernel export (BD-A1-30)', () => {
  expect(pendingToolText('Course tool')).toBe("Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Course tool', then connect again.");
});

it('keeps the frozen register page code and the player link hook byte for byte (LA-E1-09)', () => {
  expect(TOOL_MAY_EXIST_CODE).toBe('MOODLE_TOOL_MAY_EXIST');
  expect(BACK_LINK_ATTRIBUTE).toBe('data-back-to-moodle');
});
