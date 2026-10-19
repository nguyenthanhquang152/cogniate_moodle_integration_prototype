// T8 Build Runner queue helper (host side, run by infra/scripts/build-runner.sh). Everything that comes from the
// internet-facing app or from the build container is UNTRUSTED (A-T8-01):
//  - a request file is opened with no-follow semantics (O_NOFOLLOW, O_NONBLOCK) and checked with fstat: only a
//    regular file of this user, at most 4 KB; a symlink, FIFO or device is refused (never read, never waited on);
//  - every request field is checked against a strict pattern, and no path from it is used (the package is found by
//    its sha256 in the app's upload store);
//  - the .mbz from the build container is accepted only as a regular file (lstat, no symlink), below the size limit,
//    with the gzip magic bytes, and it is written into out/ with exclusive create.
//   validate <request.json>                 -> the checked job as one JSON line (exit 1 + reason on stderr)
//   jobfile <request.json>                  -> {title, idnumber} for the build Moodle
//   status <status.json> key=value ...      -> merge into the status file (atomic), with timestamps
//   publish <course.mbz> <out/<id>.mbz>     -> check the backup and copy it with exclusive create
import { closeSync, constants, copyFileSync, fstatSync, lstatSync, openSync, readFileSync, readSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

const [cmd, file, ...rest] = process.argv.slice(2);
const STEPS = ['', 'start', 'course', 'scorm', 'backup', 'copy'];
const MAX_REQUEST = 4096;
const MAX_MBZ = 2 * 1024 * 1024 * 1024; // 2 GB (a backup holds the zip and its extracted files)
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(1); };

/** Read a request file safely: no symlink (O_NOFOLLOW), no blocking open (FIFO), regular file, own user, small. */
function readRequest(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (e) {
    fail(e.code === 'ELOOP' ? 'request is a symlink' : `request cannot be opened (${e.code})`);
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) fail('request is not a regular file');
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) fail('request belongs to another user');
    if (st.size > MAX_REQUEST) fail('request too large');
    const buf = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) { const n = readSync(fd, buf, off, st.size - off, off); if (n <= 0) break; off += n; }
    return buf.subarray(0, off).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

function checked(path) {
  let r;
  try { r = JSON.parse(readRequest(path)); } catch { fail('request is not JSON'); }
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

/**
 * Copy the build's backup into out/: regular file only (no symlink), size limit, gzip magic, exclusive create.
 * A-T8-04: every refusal is ONE readable line on stderr (the runner puts it into the build's reason), never a stack.
 */
function publish(src, dst) {
  const st = lstatSync(src, { throwIfNoEntry: false });
  if (!st) fail('backup file is missing');
  if (!st.isFile()) fail('backup is not a regular file (symlink or special file)');
  if (st.size < 18 || st.size > MAX_MBZ) fail('backup size is out of range');
  let fd;
  try {
    fd = openSync(src, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (e) {
    fail(e.code === 'ELOOP' ? 'backup is not a regular file (symlink or special file)' : `backup cannot be read (${e.code ?? 'error'})`);
  }
  const magic = Buffer.alloc(2);
  try { readSync(fd, magic, 0, 2, 0); } finally { closeSync(fd); }
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) fail('backup is not a gzip file');
  try {
    copyFileSync(src, dst, constants.COPYFILE_EXCL); // fails if dst exists (also a planted symlink)
  } catch (e) {
    if (e.code === 'EEXIST') fail('out/ already has a file for this build; it is never overwritten');
    try { unlinkSync(dst); } catch { /* not created */ } // a partial copy (for example a full disk) is not left in out/
    fail(e.code === 'ENOSPC' ? 'no free disk space for the backup' : `backup cannot be copied into out/ (${e.code ?? 'error'})`);
  }
  process.stdout.write(`${JSON.stringify({ bytes: st.size })}\n`);
}

function main() {
  if (cmd === 'validate') {
    process.stdout.write(`${JSON.stringify(checked(file))}\n`);
  } else if (cmd === 'jobfile') {
    const j = checked(file);
    process.stdout.write(`${JSON.stringify({ title: j.title, idnumber: j.idnumber })}\n`);
  } else if (cmd === 'publish') {
    publish(file, rest[0] ?? fail('usage: publish <src> <dst>'));
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
    fail('usage: queue.mjs validate|jobfile|status|publish <file> [...]');
  }
}

// No stack trace for the runner's log or a build's reason: an unexpected error is one line too.
try {
  main();
} catch (e) {
  fail(`queue.mjs ${cmd ?? ''} failed (${e?.code ?? e?.name ?? 'error'})`);
}
