// F5 rule audit-event-delete (LA-ADR-06 D4 rule 2; design README F5; TEST-STRATEGY §3.6): no audit row replacements.
// Only the audit-retention job may delete audit rows (LTI service: LA-E5-19). The rule starts with LA-E5-02.
// Pure rule module: the F5 runner (LA-E1-04) finds it in rules/ and calls check() once per file. Until the runner lands,
// infra/scripts/fitness-audit-event-delete.test.mjs runs it over the tree inside `npm run check`.

/** Product code: the source of every service, package and app. Tests next to the code are not product code. */
const PRODUCT = /^(services|packages|apps)\//;
const NOT_PRODUCT = /(^|\/)(node_modules|dist|\.data|\.tmp)\/|\.test\.[cm]?[jt]sx?$/;
/** The only files that may delete audit rows: the retention jobs. */
export const ALLOWED = ['services/lti-service/src/jobs/audit-retention.ts'];
// SQLite accepts single quotes, double quotes, backticks and brackets for table and schema names.
const PATTERN = /\b(?:DELETE\s+FROM|(?:INSERT\s+OR\s+)?REPLACE\s+INTO)\s+(?:(?:main|"main"|'main'|`main`|\[main\])\s*\.\s*)?(?:audit_event\b|"audit_event"|'audit_event'|`audit_event`|\[audit_event\])/gi;

export default {
  id: 'audit-event-delete',
  description: 'No audit row replacements; only the audit-retention job deletes audit rows (LA-ADR-06 D4 rule 2).',
  /** @param {{ path: string, text: string }} file  path relative to the repository root, with "/" */
  check({ path, text }) {
    if (!PRODUCT.test(path) || NOT_PRODUCT.test(path)) return [];
    const hits = [];
    for (const m of text.matchAll(PATTERN)) {
      const deletion = /^DELETE\b/i.test(m[0]);
      if (deletion && ALLOWED.includes(path)) continue;
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      const col = m.index - before.lastIndexOf('\n');
      const reason = deletion ? 'only the audit-retention job deletes audit rows' : 'audit rows must not be replaced';
      hits.push({ line, col, message: `"${m[0].replace(/\s+/g, ' ')}": ${reason} (LA-ADR-06 D4 rule 2)` });
    }
    return hits;
  },
};
