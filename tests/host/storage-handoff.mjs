// The handoff binding of the storage repair triage revision 4 §9.1. One function: `@old-schema-setup` of the storage
// child and the diagnostic call both use it. The child does not trust a path because the handoff names it: each path
// is checked against facts that the caller has without the handoff. Raw file times, exact fail-closed comparisons.
import fs from 'node:fs';
import path from 'node:path';

export const WINDOW_FORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const BACKUP_ROOT = /^qa-m1-private-backup-[A-Za-z0-9]{6}$/;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The base project `b` of a storage child project `<b>-st`; null for any other project. */
export function baseOfStorageProject(project) {
  return /^(?:qa[234]?|qalead)-[a-z0-9-]+-st$/.test(project ?? '') ? project.slice(0, -'-st'.length) : null;
}
/**
 * Checks the handoff `file` of this window. Facts of the caller: `windowStart` (QA_M1_WINDOW_START), `runRoot` (the
 * folder of the clones), `project` (the storage project `<b>-st`), `productSha`, `s` (host time in ms: the storage
 * child start, or the time of the diagnostic check) and `hostUid`. Returns { ok: true, handoff, m123Clone, m123Backup }
 * or { ok: false, item, cause }.
 */
export function checkHandoff({ file, windowStart, runRoot, project, productSha, s, hostUid = process.getuid() }) {
  const no = (item, detail) => ({ ok: false, item, cause: `handoff check failed: ${item}: ${detail}` });
  const real = (p) => { try { return fs.lstatSync(p); } catch { return null; } };
  const dirOfHost = (st) => st && !st.isSymbolicLink() && st.isDirectory() && st.uid === hostUid;
  const b = baseOfStorageProject(project);
  if (!b) return no('project', `${JSON.stringify(project)} is not a storage project <base>-st`);
  if (!/^[0-9a-f]{40}$/.test(productSha ?? '')) return no('project', 'no candidate SHA');
  if (!Number.isFinite(s)) return no('window', 'no start time s');
  // 1. Window.
  if (typeof windowStart !== 'string' || !WINDOW_FORM.test(windowStart)) return no('window', 'QA_M1_WINDOW_START is missing or not in the form of new Date().toISOString()');
  const w = Date.parse(windowStart);
  if (!Number.isFinite(w) || new Date(w).toISOString() !== windowStart) return no('window', 'QA_M1_WINDOW_START is not a valid time');
  if (!(w <= s)) return no('window', `w ${windowStart} is later than s ${new Date(s).toISOString()}`);
  // 2. Handoff file and its folder D.
  if (typeof file !== 'string' || !path.isAbsolute(file)) return no('handoff file', 'QA_M1_HANDOFF_FILE is missing or not absolute');
  const H = real(file);
  if (!H) return no('handoff file', 'missing');
  if (H.isSymbolicLink() || !H.isFile()) return no('handoff file', 'not a regular file');
  if (H.uid !== hostUid) return no('handoff file', `owner ${H.uid} is not the host user`);
  if ((H.mode & 0o7777) !== 0o600) return no('handoff file', `mode ${(H.mode & 0o7777).toString(8)} is not 0600`);
  if (H.nlink !== 1) return no('handoff file', `${H.nlink} links`);
  const D = real(path.dirname(file));
  if (!dirOfHost(D)) return no('handoff file', 'its folder is not a real directory of the host user');
  if ((D.mode & 0o077) !== 0) return no('handoff file', 'its folder has a group or other bit');
  if (!(w <= H.mtimeMs && H.mtimeMs <= s)) return no('handoff file', 'mtime is not inside the window (w ≤ H.mtime ≤ s)');
  let handoff;
  try { handoff = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return no('handoff file', 'content is not JSON'); }
  for (const key of ['m123Clone', 'm123Backup']) {
    const v = handoff?.[key];
    if (typeof v !== 'string' || !path.isAbsolute(v) || path.resolve(v) !== v) return no('handoff file', `${key} is not an absolute resolved path`);
    let resolved;
    try { resolved = fs.realpathSync(v); } catch { return no('handoff file', `${key} does not exist`); }
    if (resolved !== v) return no('handoff file', `${key} has a symbolic link in its path`);
  }
  // 3. Clone of the migration lane of this window.
  const Cm = handoff.m123Clone;
  if (path.dirname(Cm) !== runRoot) return no('clone', 'not in the run root');
  const runId = new RegExp(`^${escape(b)}-${productSha.slice(0, 8)}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z$`);
  if (!runId.test(path.basename(Cm))) return no('clone', `name is not the RUN_ID of ${b} at ${productSha.slice(0, 8)}`);
  const C = real(Cm);
  if (!dirOfHost(C)) return no('clone', 'not a real directory of the host user');
  if (!(w <= C.birthtimeMs && C.birthtimeMs <= H.mtimeMs)) return no('clone', 'birth time is not inside the window (w ≤ birthtime ≤ H.mtime)');
  // 4. Backup root of migrationRun (X7).
  const Rp = path.dirname(handoff.m123Backup);
  if (handoff.m123Backup !== path.join(Rp, 'original')) return no('backup root', 'm123Backup is not <backup root>/original');
  if (path.dirname(Rp) !== path.dirname(Cm)) return no('backup root', 'not next to the clone');
  if (!BACKUP_ROOT.test(path.basename(Rp))) return no('backup root', 'name is not qa-m1-private-backup-<6>');
  const R = real(Rp);
  if (!dirOfHost(R)) return no('backup root', 'not a real directory of the host user');
  if ((R.mode & 0o7777) !== 0o700) return no('backup root', `mode ${(R.mode & 0o7777).toString(8)} is not 0700`);
  if (!(C.birthtimeMs <= R.birthtimeMs && R.birthtimeMs <= H.mtimeMs)) return no('backup root', 'birth time is not inside the window (clone birthtime ≤ birthtime ≤ H.mtime)');
  // 5. Backup and its product manifest.
  if (!dirOfHost(real(handoff.m123Backup))) return no('backup', 'not a real directory of the host user');
  const manifestFile = path.join(handoff.m123Backup, 'manifest.json'), M = real(manifestFile);
  if (!M || M.isSymbolicLink() || !M.isFile() || M.uid !== hostUid) return no('backup', 'manifest.json is not a regular file of the host user');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { return no('backup', 'manifest.json is not JSON'); }
  if (manifest?.composeProject !== b) return no('backup', `composeProject ${JSON.stringify(manifest?.composeProject)} is not ${b}`);
  return { ok: true, handoff, m123Clone: Cm, m123Backup: handoff.m123Backup };
}
