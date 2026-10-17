// Write infra/.secrets/seed.json (mode 600) from the seed step results (stdin) and .env (process.env).
// Format "cogniate-seed/1" is documented in infra/README.md ("seed.json"). Later tasks ADD keys; they do not
// rename or remove keys. Keys that other steps write (for example ltiSeed from seed:lti-manual) are kept.
// stdin: {"moodle": <setup_users_courses.php JSON>, "ws": {"product": <...>, "qa_oracle": <...>}, "lti": {"apiKeyFiles": {...}},
//         "portal": <cogniate-app src/cli/seed-portal.ts JSON>}
// Usage (by seed.sh): node infra/scripts/seed-json.mjs <out-file>
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('usage: seed-json.mjs <out-file>');
const input = JSON.parse(readFileSync(0, 'utf8'));
const env = process.env;
const need = (name) => {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set (load .env first)`);
  return v;
};
const passwords = {
  admin: need('MOODLE_ADMIN_PASSWORD'),
  cg_teacher: need('MOODLE_TEACHER_PASSWORD'),
  cg_student: need('MOODLE_STUDENT_PASSWORD'),
  cg_student2: need('MOODLE_STUDENT2_PASSWORD'),
};

const users = {};
for (const [username, password] of Object.entries(passwords)) {
  const id = input.moodle?.users?.[username]?.id;
  if (!Number.isInteger(id)) throw new Error(`seed result has no id for ${username}`);
  users[username] = { username, password, id };
}
const courses = {};
for (const [shortname, c] of Object.entries(input.moodle?.courses ?? {})) courses[shortname] = c.id;
const ws = (key) => {
  const w = input.ws?.[key];
  if (!w?.token) throw new Error(`seed result has no ${key} token`);
  return { service: w.service, username: w.username, userid: w.userid, token: w.token, functions: w.functions };
};

// Portal users (T4a): key = email, like moodle.users (key = user name). Passwords come from .env.
const portalPasswords = { 'thanh@cogniate.test': 'PORTAL_THANH_PASSWORD', 'qa-b@cogniate.test': 'PORTAL_QAB_PASSWORD' };
let portal;
if (input.portal) {
  const portalUsers = {};
  for (const [email, envName] of Object.entries(portalPasswords)) {
    const u = input.portal.users?.[email];
    if (!u?.id || !u.library?.id) throw new Error(`seed result has no portal user ${email}`);
    portalUsers[email] = { email, password: need(envName), id: u.id, name: u.name, role: u.role, library: { id: u.library.id, name: u.library.name } };
  }
  portal = { users: portalUsers };
}

const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
const seed = {
  ...previous,
  format: 'cogniate-seed/1',
  generatedAt: new Date().toISOString(),
  urls: { moodle: need('PUBLIC_MOODLE_URL'), lti: need('PUBLIC_LTI_URL'), app: need('PUBLIC_APP_URL'), content: need('PUBLIC_CONTENT_URL') },
  moodle: {
    users,
    courses,
    ws: { product: ws('product'), qa_oracle: ws('qa_oracle') },
  },
  ...(input.lti ? { lti: { ...(previous.lti ?? {}), ...input.lti } } : {}),
  ...(portal ? { portal: { ...(previous.portal ?? {}), ...portal } } : {}),
};
const tmp = `${out}.tmp`;
writeFileSync(tmp, `${JSON.stringify(seed, null, 2)}\n`, { mode: 0o600 });
chmodSync(tmp, 0o600);
renameSync(tmp, out);
