import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import { maskComments, repoPath } from './common.mjs';
import { bannedWords, checkText, compareCounts, parts } from './lms-names.mjs';
import { classifyPath, readPaths } from './channel-diff.mjs';
import { loadRules, productTextFiles, runRules } from './rules.mjs';
import sqlPortability, { STATEMENTS } from './rules/sql-portability.mjs';
const scratch = [];
function temp() {
    const folder = mkdtempSync(join(tmpdir(), 'fitness-unit-'));
    scratch.push(folder);
    return folder;
}
afterEach(() => {
    for (const folder of scratch.splice(0))
        rmSync(folder, { recursive: true, force: true });
});
describe('CLI entry points', () => {
    for (const [script, label, args, input] of [
        ['lms-names.mjs', 'F1', ['--stdin', '--as', 'services/example/src/entry-probe.ts'], 'export const moodleX = 1;'],
        ['channel-diff.mjs', 'F2', ['--channel', 'example', '--paths-from', 'paths.txt'], ''],
        ['rules.mjs', 'F5', ['--stdin', '--as', 'services/lti-service/src/db/migrations/999_probe.sql'], 'PRAGMA foreign_keys=ON;'],
    ]) {
        it(`${label} runs through a symlinked folder and returns its failing result`, () => {
            const root = temp();
            const link = join(root, 'fitness');
            symlinkSync(new URL('./', import.meta.url), link, 'dir');
            writeFileSync(join(root, 'paths.txt'), 'package.json\n');
            const result = spawnSync(process.execPath, [join(link, script), ...args], { cwd: root, input, encoding: 'utf8', timeout: 10_000 });
            assert.ifError(result.error);
            assert.equal(result.status, 1, result.stderr);
            assert.ok(result.stdout.includes(`${label} FAIL`), result.stdout);
        });
    }
});
describe('token scanner internals', () => {
    const path = 'services/example/src/probe.tsx';
    const words = ['moodle', 'canvas', 'd2l', 'lti-generic'];
    it('splits acronyms, camel case and numbers without partial-word matches', () => {
        assert.deepEqual(parts('createMoodleWsClient_D2L-ltiGeneric'), ['create', 'moodle', 'ws', 'client', 'd', '2', 'l', 'lti', 'generic']);
        assert.deepEqual(checkText({ path, text: 'const canvaslike = "generic"; const x = "moodler";' }, words), []);
        assert.deepEqual(checkText({ path, text: 'const xD2L = ltiGeneric;' }, words).map((hit) => hit.word), ['d2l', 'lti-generic']);
    });
    it('uses AST nodes so comments and regular expressions do not become identifiers', () => {
        const text = '// canvas\n/* moodle */\nconst pattern = /canvas/; const value = "can\\u0076as";';
        assert.deepEqual(checkText({ path, text }, words), [{ line: 3, col: 41, token: 'canvas', word: 'canvas' }]);
    });
    it('visits expressions inside templates and JSX, retaining source positions', () => {
        const text = 'const x = `ok ${createMoodle()} canvas`;\nconst ui = <p title="moodle">canvas {ltiGeneric}</p>;';
        assert.deepEqual(checkText({ path, text }, words).map((hit) => [hit.line, hit.word]), [[1, 'moodle'], [1, 'canvas'], [2, 'moodle'], [2, 'canvas'], [2, 'lti-generic']]);
    });
    it('limits Canvas exceptions to DOM tags and exact Web API identifiers', () => {
        const text = 'let x: HTMLCanvasElement; const ui = <canvas canvas={canvasConfiguration} />;';
        assert.deepEqual(checkText({ path, text }, words).map((hit) => hit.token), ['canvas', 'canvasConfiguration']);
    });
    it('keeps comment markers inside quoted SQL and JSON values', () => {
        const sql = "-- canvas\nSELECT 'https://canvas.test/*keep*/', moodle_x; /* moodle */";
        const clean = maskComments(sql, 'sql');
        assert.equal(clean.length, sql.length);
        assert.ok(clean.includes("'https://canvas.test/*keep*/'"));
        assert.deepEqual(checkText({ path: 'services/example/src/query.sql', text: sql }, words).map((hit) => hit.word), ['canvas', 'moodle']);
        assert.ok(maskComments('{"x":"https://canvas.test"}// moodle', 'json').includes('https://canvas.test'));
    });
    it('applies consecutive-part matching within quoted values and private fields', () => {
        assert.equal(checkText({ path, text: 'class Example { #canvasConfiguration = 1; }' }, words).length, 1);
        for (const extension of ['sql', 'css', 'html']) {
            const text = extension === 'html' ? '<p>lti generic</p>' : '\'lti.generic\'';
            assert.deepEqual(checkText({ path: `apps/example/src/probe.${extension}`, text }, words).map((hit) => hit.word), ['lti-generic']);
        }
        assert.deepEqual(checkText({ path: 'apps/example/src/probe.json', text: '{"name":"can\\u0076as"}' }, words).map((hit) => hit.word), ['canvas']);
    });
    it('removes HTML comments and tag names but checks attribute and body values', () => {
        assert.deepEqual(checkText({ path: 'apps/example/src/page.html', text: '<!-- moodle --><canvas title="canvas">Moodle</canvas>' }, words).map((hit) => hit.word), ['canvas', 'moodle']);
    });
    it('keeps the config exception limited to the dev URL', () => {
        assert.deepEqual(checkText({ path: 'packages/shared/src/config.ts', text: 'const moodle = "PUBLIC_MOODLE_URL"; const canvas = "moodle";' }, words).map((hit) => hit.token), ['canvas']);
    });
    it('reads display names as data and ignores the generic display text', () => {
        const root = temp();
        const folder = join(root, 'packages/channels');
        mkdirSync(join(folder, 'acme'), { recursive: true });
        mkdirSync(join(folder, 'lti-generic'));
        writeFileSync(join(folder, 'acme/manifest.ts'), 'throw new Error("never execute"); export default { names: { text: "Acme LMS", label: "Acme School" } };');
        writeFileSync(join(folder, 'lti-generic/manifest.ts'), 'export default { names: { text: "your LMS", label: "Other LMS" } };');
        const found = bannedWords(root);
        assert.ok(found.includes('acme school'));
        assert.ok(!found.includes('your lms'));
        assert.equal(found.filter((word) => word === 'lti-generic').length, 1);
    });
    it('refuses unreadable manifest names instead of silently dropping the ban', () => {
        const root = temp();
        mkdirSync(join(root, 'packages/channels/acme'), { recursive: true });
        writeFileSync(join(root, 'packages/channels/acme/manifest.ts'), 'export default { names: getNames() };');
        assert.throws(() => bannedWords(root), new RegExp('expected literal names'));
    });
    it('compares each file separately and counts removed files as zero', () => {
        assert.deepEqual(compareCounts({ a: 2, b: 1 }, { a: 1, gone: 4 }), [
            { path: 'a', count: 2, allowed: 1, delta: 1 },
            { path: 'b', count: 1, allowed: 0, delta: 1 },
            { path: 'gone', count: 0, allowed: 4, delta: -4 },
        ]);
        assert.throws(() => compareCounts({}, { bad: -1 }), new RegExp('invalid F1 baseline'));
    });
});
describe('path boundaries', () => {
    it('rejects paths outside the tree and normalizes relative paths', () => {
        assert.throws(() => repoPath('../outside.ts'));
        assert.throws(() => repoPath('/outside.ts'));
        assert.equal(repoPath('./services/a/../b/src/a.ts'), 'services/b/src/a.ts');
    });
    it('does not classify a channel prefix, unit test or build file as a channel extension', () => {
        assert.equal(classifyPath('packages/channels/acme-two/app.ts', 'acme'), 'core');
        assert.equal(classifyPath('services/app/src/a.test.ts', 'acme'), 'core');
        assert.equal(classifyPath('infra/.certs/new.crt', 'acme'), 'core');
        assert.equal(classifyPath('tests/sim/hosts.json', 'acme'), 'sim');
    });
    it('keeps both rename paths and spaces when reading name-status input', () => {
        assert.deepEqual(readPaths('M\tpackage.json\r\nR100\told path.ts\tnew path.ts\nplain path.ts\n'), ['package.json', 'old path.ts', 'new path.ts', 'plain path.ts']);
    });
});
describe('F5 adapter and portability internals', () => {
    it('selects all product text extensions and skips ignored and binary input', () => {
        const root = temp();
        execFileSync('git', ['init', '-q', root]);
        mkdirSync(join(root, 'services/example'), { recursive: true });
        mkdirSync(join(root, 'docs'));
        writeFileSync(join(root, '.gitignore'), 'ignored\n');
        writeFileSync(join(root, 'services/example/template.txt'), 'text');
        writeFileSync(join(root, 'services/example/NOTICE'), 'notice');
        writeFileSync(join(root, 'services/example/binary'), Buffer.from([0, 1]));
        writeFileSync(join(root, 'services/example/ignored'), 'ignore');
        writeFileSync(join(root, 'docs/outside.txt'), 'docs');
        assert.deepEqual(productTextFiles(root).map((file) => file.path), ['services/example/NOTICE', 'services/example/template.txt']);
    });
    it('discovers rule modules in order without executing the command-line entry point', async () => {
        const folder = temp();
        writeFileSync(join(folder, 'z.mjs'), 'export default { id: "z", check: () => [{ line: 2, col: 3, message: "hit" }] };');
        writeFileSync(join(folder, 'a.mjs'), 'export default { id: "a", check: () => [] };');
        writeFileSync(join(folder, 'ignored.txt'), 'not a module');
        const rules = await loadRules(folder);
        assert.deepEqual(rules.map((rule) => rule.id), ['a', 'z']);
        assert.deepEqual(runRules({ path: 'a.ts', text: '' }, rules), [{ rule: 'z', line: 2, col: 3, message: 'hit' }]);
    });
    it('refuses duplicate rule ids', async () => {
        const folder = temp();
        for (const name of ['a', 'b'])
            writeFileSync(join(folder, `${name}.mjs`), 'export default { id: "a", check: () => [] };');
        await assert.rejects(loadRules(folder), new RegExp('duplicate rule id'));
    });
    it('refuses a missing check function and malformed findings', async () => {
        const folder = temp();
        writeFileSync(join(folder, 'bad.mjs'), 'export default { id: "bad" };');
        await assert.rejects(loadRules(folder), new RegExp('expected default'));
        assert.throws(() => runRules({}, [{ id: 'bad', check: () => undefined }]), new RegExp('must return an array'));
        assert.throws(() => runRules({}, [{ id: 'bad', check: () => [{ line: 0, col: 1, message: 'bad' }] }]), new RegExp('invalid finding'));
    });
    it('ignores SQL comments and string constants while preserving the real statement location', () => {
        const path = 'services/lti-service/src/db/migrations/999_next.sql';
        const text = "-- PRAGMA\nINSERT INTO settings VALUES ('PRAGMA; REPLACE INTO');\n/* INSERT OR IGNORE */\nPRAGMA foreign_keys = ON;";
        assert.deepEqual(sqlPortability.check({ path, text }), [{ line: 4, col: 1, message: 'PRAGMA: PRAGMA is not portable SQL' }]);
    });
    it('has a concrete detection pattern for each declared portability statement', () => {
        const text = 'PRAGMA foreign_keys=ON; INSERT OR IGNORE INTO t VALUES(1); UPDATE OR FAIL t SET x=1; REPLACE INTO t VALUES(1); CREATE TABLE x(id INTEGER PRIMARY KEY AUTOINCREMENT) WITHOUT ROWID; CREATE TABLE y(x TEXT) STRICT; CREATE VIRTUAL TABLE v USING fts5(x); ATTACH DATABASE file AS aux;';
        const hits = sqlPortability.check({ path: 'services/lti-service/src/db/migrations/999_next.sql', text });
        assert.equal(hits.length, STATEMENTS.length);
    });
    it('does not exempt an unknown migration just because its number is old', () => {
        const text = 'PRAGMA foreign_keys=OFF;';
        assert.equal(sqlPortability.check({ path: 'services/lti-service/src/db/migrations/001_new.sql', text }).length, 1);
        assert.deepEqual(sqlPortability.check({ path: 'services/lti-service/src/db/migrations/001_init.sql', text }), []);
    });
});
