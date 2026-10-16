// Paths that the QA tests use. All of them can be changed with env variables.
// Default layout: the repo is mounted with tests/ inside it (H8), and infra/.certs,
// infra/.secrets and infra/.logs are at their repo paths.
import fs from 'node:fs';
import path from 'node:path';

function findTestsDir(): string {
  const fromEnv = process.env.QA_TESTS_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  const cwd = process.cwd();
  for (const dir of [cwd, path.join(cwd, 'tests')]) {
    const pkg = path.join(dir, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try {
      if (JSON.parse(fs.readFileSync(pkg, 'utf8')).name === 'cogniate-qa-tests') return dir;
    } catch {
      // Not our package.json. Try the next folder.
    }
  }
  throw new Error(`Cannot find the tests/ project from ${cwd}. Set QA_TESTS_DIR.`);
}

export const TESTS_DIR = findTestsDir();
export const REPO_ROOT = path.resolve(process.env.QA_REPO_ROOT ?? path.join(TESTS_DIR, '..'));
export const CERTS_DIR = path.resolve(process.env.QA_CERTS_DIR ?? path.join(REPO_ROOT, 'infra', '.certs'));
export const SECRETS_DIR = path.resolve(process.env.QA_SECRETS_DIR ?? path.join(REPO_ROOT, 'infra', '.secrets'));
export const LOGS_DIR = path.resolve(process.env.QA_LOGS_DIR ?? path.join(REPO_ROOT, 'infra', '.logs'));
export const ENV_FILE = path.resolve(process.env.QA_ENV_FILE ?? path.join(REPO_ROOT, '.env'));
export const SEED_FILE = path.join(SECRETS_DIR, 'seed.json');

export function artifactsDir(suite: 'acceptance' | 'e2e'): string {
  const dir = path.join(TESTS_DIR, suite, 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
