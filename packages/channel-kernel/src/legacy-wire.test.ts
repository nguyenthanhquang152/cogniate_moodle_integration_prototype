import { expect, it } from 'vitest';
import { BACK_LINK_ATTRIBUTE, EMPTY_PUBLICATION_EXTENSION_FIELDS, LEGACY_APP_ERROR_TEXT, PUBLICATION_EXTENSION_FIELDS, TOOL_MAY_EXIST_CODE, pendingToolText } from './index.ts';
import type { LegacyPublicationFields } from './index.ts';

it('keeps the frozen MOODLE_TOOL_MAY_EXIST text through the public kernel export (BD-A1-30)', () => {
  expect(pendingToolText('Course tool')).toBe("Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Course tool', then connect again.");
});

it('keeps the frozen register page code and the player link hook byte for byte (LA-E1-09)', () => {
  expect(TOOL_MAY_EXIST_CODE).toBe('MOODLE_TOOL_MAY_EXIST');
  expect(BACK_LINK_ATTRIBUTE).toBe('data-back-to-moodle');
});

it('keeps the M1 default texts of the app error codes byte for byte (LA-E1-09)', () => {
  expect(LEGACY_APP_ERROR_TEXT).toEqual({
    PLATFORM_IN_USE: 'This Moodle tool is already registered with Cogniate.',
    DEPLOYMENT_IN_USE: 'This Blackboard site is already connected to Cogniate.',
    DEPLOYMENT_FIXED: 'This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.',
  });
});

it('types the frozen publication extension fields with the frozen names (BD-A1-64)', () => {
  const empty: LegacyPublicationFields = { moodleCourse: null, shellStatus: null, shellError: null };
  expect(Object.keys(empty)).toEqual(PUBLICATION_EXTENSION_FIELDS);
  expect(EMPTY_PUBLICATION_EXTENSION_FIELDS).toEqual(empty);
});
