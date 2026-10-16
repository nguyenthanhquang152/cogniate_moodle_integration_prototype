// The two Cogniate course zips (untrusted data). They are not in git (tasks README §5): COURSE_FIXTURES_DIR points to
// them. In the e2e container the QA host runner copies them into tests/fixtures/courses/ (git-ignored).
// Each test gets a copy in a new temp folder, and QA checks the SHA-256 first.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, TESTS_DIR } from './paths';

export const COURSE_ZIPS = {
  scorm: { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip', sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7' },
  html: { name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip', sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d' },
} as const;

function fixtureDirs(): string[] {
  return [
    process.env.QA_COURSE_FIXTURES_DIR,
    process.env.COURSE_FIXTURES_DIR,
    path.join(TESTS_DIR, 'fixtures', 'courses'),
    path.join(REPO_ROOT, 'docs', 'raw', 'data', 'courses'),
  ].filter((d): d is string => Boolean(d));
}

/** A fresh copy of a course zip in a new temp folder (after a SHA-256 check of the source). */
export function courseZipCopy(kind: keyof typeof COURSE_ZIPS): string {
  const { name, sha256 } = COURSE_ZIPS[kind];
  const src = fixtureDirs().map((d) => path.join(d, name)).find((f) => fs.existsSync(f));
  if (!src) throw new Error(`course zip "${name}" not found in ${fixtureDirs().join(', ')}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  if (actual !== sha256) throw new Error(`course zip "${name}" has SHA-256 ${actual}, want ${sha256}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-course-'));
  const copy = path.join(dir, name);
  fs.copyFileSync(src, copy);
  return copy;
}
