// T8 Build Runner queue helper (host side, run by infra/scripts/build-runner.sh). The request file comes from the
// internet-facing app, so it is UNTRUSTED: every field is checked against a strict pattern, and no path from it is
// used (the package is found by its sha256 in the app's upload store).
//   validate <request.json>                 -> the checked job as one JSON line (exit 1 + reason on stderr)
//   status <status.json> key=value ...      -> merge into the status file (atomic), with timestamps
//   jobfile <request.json>                  -> {title, idnumber} for the build Moodle
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

const [cmd, file, ...rest] = process.argv.slice(2);
const STEPS = ['', 'start', 'course', 'scorm', 'backup', 'copy'];
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(1); };

function checked(path) {
  const raw = readFileSync(path, 'utf8');
  if (raw.length > 4096) fail('request too large');
  let r;
  try { r = JSON.parse(raw); } catch { fail('request is not JSON'); }
  const want = (key, re) => { if (typeof r[key] !== 'string' || !re.test(r[key])) fail(`bad field ${key}`); return r[key]; };
  const job = {
    buildId: want('buildId', /^bld_[0-9a-f]{24}$/),
    courseId: want('courseId', /^crs_[A-Za-z0-9_-]{22}$/),
    versionId: want('versionId', /^ver_[A-Za-z0-9_-]{22}$/),
    packageSha256: want('packageSha256', /^[0-9a-f]{64}$/),
    variant: want('variant', /^[A-Za-z0-9_-]{1,32}$/),
    lang: want('lang', /^[A-Za-z0-9_-]{1,16}$/),
    title: typeof r.title === 'string' && r.title.length >= 1 && r.title.length <= 255 && ![...r.title].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) ? r.title : fail('bad field title'),
    hold: r.hold === true,
    failAt: typeof r.failAt === 'string' && STEPS.includes(r.failAt) ? r.failAt : fail('bad field failAt'),
  };
  return { ...job, hex: job.buildId.slice(4), idnumber: `cogniate:${job.courseId}:${job.variant}:${job.lang}` };
}

if (cmd === 'validate') {
  process.stdout.write(`${JSON.stringify(checked(file))}\n`);
} else if (cmd === 'jobfile') {
  const j = checked(file);
  process.stdout.write(`${JSON.stringify({ title: j.title, idnumber: j.idnumber })}\n`);
} else if (cmd === 'status') {
  let current;
  try { current = JSON.parse(readFileSync(file, 'utf8')); } catch { current = {}; }
  const now = new Date().toISOString();
  const next = { ...current, updatedAt: now };
  for (const kv of rest) {
    const i = kv.indexOf('=');
    const key = kv.slice(0, i);
    const value = kv.slice(i + 1);
    next[key] = key === 'bytes' ? Number(value) : value;
  }
  if (!next.startedAt && next.status === 'running') next.startedAt = now;
  if (next.status === 'ready' || next.status === 'failed') next.finishedAt = now;
  writeFileSync(`${file}.tmp`, JSON.stringify(next));
  renameSync(`${file}.tmp`, file);
} else {
  fail('usage: queue.mjs validate|jobfile|status <file> [key=value...]');
}
