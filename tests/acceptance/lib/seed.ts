// Reads infra/.secrets/seed.json (hook H2). The Lead fixed the content, not the key names.
// So this reader finds the items by shape, and the key names live only here:
// - a Moodle user  = an object with string `username`, string `password` and integer `id`
// - a course id    = a key COGNIATE-DEV-10x with an integer (or { id }) value, or an object { shortname, id }
// - a WS token     = a 32-char lowercase hex string; the QA oracle token has "oracle" in its key path
// Error messages name the missing items, never the values.
import fs from 'node:fs';
import { SEED_FILE } from './paths';

export const MOODLE_USERNAMES = ['admin', 'cg_teacher', 'cg_student', 'cg_student2'] as const;
export type MoodleUsername = (typeof MOODLE_USERNAMES)[number];
export const COURSE_SHORTNAMES = ['COGNIATE-DEV-101', 'COGNIATE-DEV-102'] as const;
export type CourseShortname = (typeof COURSE_SHORTNAMES)[number];

export interface MoodleUser {
  username: string;
  password: string;
  id: number;
}

export interface Seed {
  file: string;
  users: Record<MoodleUsername, MoodleUser>;
  courses: Record<CourseShortname, number>;
  productToken: string;
  oracleToken: string;
  /** Key paths, for evidence (no values). */
  productTokenPath: string;
  oracleTokenPath: string;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const WS_TOKEN = /^[0-9a-f]{32}$/;

function toInt(v: Json | undefined): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
}

function isObject(v: Json | undefined): v is { [key: string]: Json } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function loadSeed(file = SEED_FILE): Seed {
  if (!fs.existsSync(file)) throw new Error(`seed.json not found at ${file} (hook H2).`);
  const root = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;

  const users = new Map<string, MoodleUser>();
  const courses = new Map<string, number>();
  const tokens: { path: string; value: string }[] = [];

  const walk = (node: Json, at: string[]): void => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, [...at, String(i)]));
      return;
    }
    if (!isObject(node)) return;
    const id = toInt(node.id);
    if (typeof node.username === 'string' && typeof node.password === 'string' && id !== null) {
      if ((MOODLE_USERNAMES as readonly string[]).includes(node.username)) {
        users.set(node.username, { username: node.username, password: node.password, id });
      }
    }
    if (typeof node.shortname === 'string' && id !== null) courses.set(node.shortname, id);
    for (const [key, value] of Object.entries(node)) {
      if ((COURSE_SHORTNAMES as readonly string[]).includes(key)) {
        const courseId = toInt(value) ?? (isObject(value) ? (toInt(value.id) ?? toInt(value.courseid)) : null);
        if (courseId !== null) courses.set(key, courseId);
      }
      if (typeof value === 'string' && WS_TOKEN.test(value) && !/pass/i.test(key)) {
        tokens.push({ path: [...at, key].join('.'), value });
      }
      walk(value, [...at, key]);
    }
  };
  walk(root, []);

  const problems: string[] = [];
  for (const name of MOODLE_USERNAMES) if (!users.has(name)) problems.push(`Moodle user "${name}" {username,password,id}`);
  for (const shortname of COURSE_SHORTNAMES) if (!courses.has(shortname)) problems.push(`course id of ${shortname}`);

  const distinct = (list: { path: string; value: string }[]) => [...new Map(list.map((t) => [t.value, t])).values()];
  const oracle = distinct(tokens.filter((t) => /oracle/i.test(t.path)));
  const product = distinct(tokens.filter((t) => !/oracle/i.test(t.path)));
  if (product.length !== 1) {
    problems.push(`exactly one product WS token (found ${product.length} at: ${product.map((t) => t.path).join(', ') || 'none'})`);
  }
  if (oracle.length !== 1) {
    problems.push(`exactly one QA oracle WS token with "oracle" in its key path (found ${oracle.length})`);
  }
  if (problems.length > 0) throw new Error(`seed.json (${file}) is missing: ${problems.join('; ')}.`);

  return {
    file,
    users: Object.fromEntries(MOODLE_USERNAMES.map((n) => [n, users.get(n)!])) as Record<MoodleUsername, MoodleUser>,
    courses: Object.fromEntries(COURSE_SHORTNAMES.map((s) => [s, courses.get(s)!])) as Record<CourseShortname, number>,
    productToken: product[0].value,
    oracleToken: oracle[0].value,
    productTokenPath: product[0].path,
    oracleTokenPath: oracle[0].path,
  };
}

let cached: Seed | undefined;
/** The seed, read once per test file. */
export function seed(): Seed {
  cached ??= loadSeed();
  return cached;
}
