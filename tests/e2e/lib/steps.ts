// The Moodle steps that the Connect wizard shows (apps/portal/src/connect/moodle-steps.json, T6 "steps as data").
// T7 A2 follows these steps. The suite does not hard-code step ids (they changed in T6 rounds). It maps each step to a
// Moodle action by its content: the labels and the words of its text.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../acceptance/lib/paths';

export const STEPS_FILE = path.join(REPO_ROOT, 'apps', 'portal', 'src', 'connect', 'moodle-steps.json');

export interface MoodleStep {
  id: string;
  text: string;
  menuPath: string[];
  labels: string[];
  optional: boolean;
}

export type StepAction = 'open-manage-tools' | 'paste-url' | 'choose-new' | 'confirm-connect' | 'activate' | 'edit-tool' | 'configure-manually' | 'fill-values' | 'copy-details' | 'unknown';

export interface StepsFile {
  format: string;
  moodleRelease: string;
  dynamic: MoodleStep[];
  manual: MoodleStep[];
}

export function readSteps(): StepsFile {
  const raw = JSON.parse(fs.readFileSync(STEPS_FILE, 'utf8')) as Partial<StepsFile>;
  const norm = (list: unknown): MoodleStep[] =>
    (Array.isArray(list) ? list : []).map((s) => {
      const o = s as Partial<MoodleStep>;
      return {
        id: String(o.id ?? ''),
        text: String(o.text ?? ''),
        menuPath: Array.isArray(o.menuPath) ? o.menuPath.map(String) : [],
        labels: Array.isArray(o.labels) ? o.labels.map(String) : [],
        optional: Boolean(o.optional),
      };
    });
  return { format: String(raw.format ?? ''), moodleRelease: String(raw.moodleRelease ?? ''), dynamic: norm(raw.dynamic), manual: norm(raw.manual) };
}

/** Maps a step to the Moodle action that a person does for it. Order of the rules matters (see comments). */
export function classify(step: MoodleStep): StepAction {
  const t = `${step.text} ${step.labels.join(' ')}`.toLowerCase();
  if (t.includes('add lti advantage')) return 'paste-url';
  if (t.includes('register as a new')) return 'choose-new';
  // Before "activate": the edit step can say "On the same tool card…".
  if (t.includes('default launch container') && t.includes('tool configuration usage')) return 'edit-tool';
  if (/\bactivate\b/.test(t)) return 'activate';
  if (t.includes('configure a tool manually')) return 'configure-manually';
  if (t.includes('configuration details') || t.includes('platform id')) return 'copy-details';
  if (t.includes('save changes') && (t.includes('tool settings') || t.includes('tool name') || t.includes('value'))) return 'fill-values';
  if (/\bconnect\b/.test(t) && t.includes('cogniate')) return 'confirm-connect';
  if (t.includes('manage tools')) return 'open-manage-tools';
  return 'unknown';
}
