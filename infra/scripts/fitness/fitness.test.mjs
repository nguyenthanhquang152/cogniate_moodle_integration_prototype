import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
        ['channel-diff.mjs', 'F2', ['--channel', 'example', '--paths-from', 'paths.txt', '--no-renames'], ''],
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
    it('reports a lower baseline count without failing the probe', () => {
        const baseline = JSON.parse(readFileSync(new URL('./f1-baseline.json', import.meta.url), 'utf8'));
        const [path, allowed] = Object.entries(baseline).find(([, count]) => count > 0) ?? ['services/example/src/entry-probe.ts', 0];
        const result = spawnSync(process.execPath, [fileURLToPath(new URL('./lms-names.mjs', import.meta.url)), '--stdin', '--as', path], { input: '// no hits', encoding: 'utf8', timeout: 10_000 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.stdout.includes('F1 PASS'), result.stdout);
        assert.equal(result.stdout.includes(`lower f1-baseline.json for ${path} to 0`), allowed > 0, result.stdout);
    });
    it('refuses the report-only flag instead of accepting a core change', () => {
        const root = temp();
        const paths = join(root, 'paths.txt');
        writeFileSync(paths, 'package.json\n');
        const result = spawnSync(process.execPath, [fileURLToPath(new URL('./channel-diff.mjs', import.meta.url)), '--channel', 'example', '--paths-from', paths, '--report-only'], { encoding: 'utf8', timeout: 10_000 });
        assert.ifError(result.error);
        assert.equal(result.status, 2, result.stderr);
        assert.ok(result.stderr.includes('--report-only'), result.stderr);
    });
});
describe('token scanner internals', () => {
    const path = 'services/example/src/probe.tsx';
    const words = ['moodle', 'canvas', 'd2l', 'lti-generic'];
    it('splits acronyms, camel case and numbers without partial-word matches', () => {
        assert.deepEqual(parts('createMoodleWsClient_D2L-ltiGeneric'), ['create', 'moodle', 'ws', 'client', 'd', '2', 'l', 'lti', 'generic']);
        assert.deepEqual(checkText({ path, text: 'const canvaslike = "generic"; const x = "moodler";' }, words), []);
        assert.deepEqual(checkText({ path, text: 'const xD2L = ltiGeneric;' }, words).map((hit) => hit.word), ['d2l', 'lti-generic']);
    });
    it('ignores comments but checks regex patterns and cooked strings at their source positions', () => {
        const text = '// canvas\n/* moodle */\nconst pattern = /canvas/; const value = "can\\u0076as";';
        assert.deepEqual(checkText({ path, text }, words), [
            { line: 3, col: 18, token: 'canvas', word: 'canvas' },
            { line: 3, col: 41, token: 'canvas', word: 'canvas' },
        ]);
    });
    it('uses regex escapes as separators and keeps identifier exceptions out of regex patterns', () => {
        const patterns = [
            [String.raw`/\.instructure\.com$/`, ['instructure']],
            [String.raw`/\bcanvas\b/i`, ['canvas']],
            ['/^(moodle|canvas|blackboard)-/', ['moodle', 'canvas', 'blackboard']],
            [String.raw`/\dcanvas/`, ['canvas']],
            [String.raw`/can\wvas/`, []],
            ['/HTMLCanvasElement/', ['canvas']],
            ['/canvases/', []],
        ];
        for (const [pattern, expected] of patterns) {
            assert.deepEqual(checkText({ path, text: `const match = ${pattern};` }, [...words, 'instructure', 'blackboard']).map((hit) => hit.word), expected, pattern);
        }
        assert.deepEqual(checkText({ path, text: 'const flags = /neutral/gi;' }, ['g', 'i']), []);
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
    it('checks all JavaScript and TypeScript source extensions', () => {
        for (const extension of ['jsx', 'cjs', 'cts']) {
            assert.equal(checkText({ path: `apps/example/src/probe.${extension}`, text: 'const moodleName = "value";' }, words).length, 1);
        }
    });
    it('checks the former config exception after S3 removed it from the scope', () => {
        assert.deepEqual(checkText({ path: 'packages/shared/src/config.ts', text: 'const moodle = "PUBLIC_MOODLE_URL";' }, words).map((hit) => hit.token), ['moodle', 'PUBLIC_MOODLE_URL']);
    });
    it('exempts only whole frozen SQL string values in the channel backfill migration', () => {
        const path = 'services/cogniate-app/src/domain/migrations/013_channel_kernel.sql';
        const words = ['moodle', 'canvas', 'blackboard'];
        const text = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
        assert.deepEqual(checkText({ path, text }, words), []);
        assert.deepEqual(checkText({ path, text: "SELECT 'moodle', 'canvas', 'blackboard';" }, words), []);
        assert.equal(checkText({ path: path.replace('013_channel_kernel', '014_next'), text: "SELECT 'moodle';" }, words).length, 1);
        assert.deepEqual(checkText({ path, text: 'SELECT moodle_x, "canvas", \'moodle extra\';' }, words).map((hit) => hit.word), ['moodle', 'canvas', 'moodle']);
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
    it('refuses a symlinked rule and a directory named like a rule', async () => {
        for (const kind of ['symlink', 'directory']) {
            const folder = temp();
            const path = join(folder, 'probe.mjs');
            if (kind === 'symlink') symlinkSync(new URL('./rules/sql-portability.mjs', import.meta.url), path);
            else mkdirSync(path);
            await assert.rejects(loadRules(folder), /rule_invalid probe\.mjs: rule module must be a regular file/);
        }
    });
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
    it('detects blobs, every SQLite date function, randomblob and rowid in new migrations', () => {
        const expressions = ["X''", "x'00FF'", 'unixepoch()', 'julianday()', "strftime('%s')", 'datetime()', "date('now')", 'time()', "timediff('a', 'b')", 'randomblob(16)', 'rowid'];
        const text = expressions.map((value) => `SELECT ${value};`).join('\n');
        for (const path of ['services/lti-service/src/db/migrations/999_next.sql', 'services/example/src/db/migrations/999_next.sql', 'services/cogniate-app/src/domain/migrations/999_next.sql']) {
            const hits = sqlPortability.check({ path, text });
            assert.equal(hits.length, expressions.length, path);
            assert.deepEqual(hits.map(({ line, col }) => [line, col]), expressions.map((_, i) => [i + 1, 8]));
        }
    });
    it('ignores comments and values but detects quoted and qualified SQL identifiers', () => {
        const path = 'services/lti-service/src/db/migrations/999_next.sql';
        const text = "-- X'' date() rowid\n/* randomblob(4) */ SELECT 'rowid', 'X''00''', 'date() randomblob(4)', updated_at, date, time, myrandomblob(4), rowid_suffix;";
        assert.deepEqual(sqlPortability.check({ path, text }), []);
        const forms = 'SELECT t.ROWID, "rowid", `rowid`, [rowid], "datetime" /* comment */ (), RANDOMBLOB (4);';
        assert.equal(sqlPortability.check({ path, text: forms }).length, 6);
    });
    it('limits adapter exceptions to each exact file and form without waivers', () => {
        const folder = 'services/lti-service/src/db/migrations/';
        for (const [file, permitted, forbidden] of [
            ['009_signing_key_lifecycle.sql', "SELECT unixepoch('subsec'), date('now');", 'SELECT randomblob(4);'],
            ['011_api_key.sql', 'SELECT hex(randomblob(16));', "SELECT date('now');"],
        ]) {
            assert.deepEqual(sqlPortability.check({ path: folder + file, text: permitted }), []);
            assert.equal(sqlPortability.check({ path: folder + file, text: forbidden }).length, 1);
            assert.ok(sqlPortability.check({ path: folder + file.replace('.sql', '_other.sql'), text: permitted }).length > 0);
        }
        const path = 'services/cogniate-app/src/domain/migrations/013_channel_kernel.sql';
        assert.equal(sqlPortability.check({ path, text: "-- fitness-allow sql-portability\nSELECT X'';" }).length, 1);
        const migration = folder + '009_signing_key_lifecycle.sql';
        assert.deepEqual(sqlPortability.check({ path: migration, text: readFileSync(new URL(`../../../${migration}`, import.meta.url), 'utf8') }), []);
    });
    it('checks only string and template text in service TypeScript, including cooked escapes', () => {
        const path = 'services/example/src/nested/query.ts';
        const text = String.raw`// randomblob(4), rowid
const date = () => 1;
const rowid = date(); const pattern = /randomblob\(4\)/;
const query = "SELECT \u0072owid,\nrandomblob(4)";
const template = ` + '`SELECT date(${date()}), ${rowid}, "rowid"`;' + `
const quoted = ` + "`SELECT 'date(${date()})', randomblob(4)`;";
        const hits = sqlPortability.check({ path, text });
        assert.equal(hits.length, 5);
        assert.deepEqual(hits.slice(0, 2).map(({ line, col }) => [line, col]), [[4, 23], [4, 36]]);
        for (const skipped of [path.replace('.ts', '.test.ts'), 'services/example/src/testkit.ts', 'packages/shared/src/query.ts', 'apps/portal/src/query.ts', 'services/example/query.ts']) {
            assert.deepEqual(sqlPortability.check({ path: skipped, text }), [], skipped);
        }
    });
    it('maps multibyte escapes and template newlines to their source positions', () => {
        const path = 'services/example/src/query.ts';
        const text = String.raw`const query = "SELECT '\u{1f600}', rowid";` + '\nconst template = `SELECT\r\n rowid`;';
        const hits = sqlPortability.check({ path, text });
        assert.deepEqual(hits.map(({ line, col }) => [line, col]), [[1, text.indexOf('rowid') + 1], [3, 2]]);
    });
    it('freezes only one exact occurrence of each existing inline blob query', () => {
        const cases = [
            ['services/cogniate-app/src/domain/pickers.ts', "UPDATE picker_session SET ltik_encrypted = X'' WHERE id = ?"],
            ['services/cogniate-app/src/domain/retention.ts', "UPDATE picker_session SET ltik_encrypted = X'' WHERE used_at IS NOT NULL AND length(ltik_encrypted) > 0 AND expires_at < ?"],
            ['services/lti-service/src/store/tool-keys.ts', "UPDATE tool_key SET status = 'removed', removed_at = ?, private_jwk_encrypted = X'' WHERE tool_account_id = ? AND kid = ?"],
            ['services/lti-service/src/jobs/signing-key-cleanup.ts', "UPDATE tool_key SET private_jwk_encrypted = X'' WHERE status = 'removed' AND length(private_jwk_encrypted) > 0"],
        ];
        for (const [path, query] of cases) {
            const text = `db.prepare(${JSON.stringify(query)});`;
            assert.deepEqual(sqlPortability.check({ path, text }), []);
            assert.equal(sqlPortability.check({ path, text: `${text}\n${text}` }).length, 1);
            assert.equal(sqlPortability.check({ path, text: text.replace("X''", "X'00'") }).length, 1);
            assert.equal(sqlPortability.check({ path: 'services/example/src/query.ts', text }).length, 1);
            assert.equal(sqlPortability.check({ path, text: `${text}\nconst next = 'SELECT rowid';` }).length, 1);
        }
    });
    it('freezes the seven legacy rowid statements and rejects edits or added uses', () => {
        for (const [name, count] of [['attempts', 1], ['bindings', 2], ['mbz-builds', 3], ['results', 1]]) {
            const path = `services/cogniate-app/src/domain/${name}.ts`;
            const text = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
            assert.deepEqual(sqlPortability.check({ path, text }), []);
            assert.equal(sqlPortability.check({ path, text: text.replace('rowid', 'rowid + 0') }).length, 1);
            assert.equal(sqlPortability.check({ path, text: `${text}\nconst next = 'SELECT rowid';` }).length, 1);
            assert.equal(sqlPortability.check({ path, text: `${text}\n${text}` }).length, count);
        }
    });
});
