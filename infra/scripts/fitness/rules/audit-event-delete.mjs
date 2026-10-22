// F5 rule audit-event-delete (LA-ADR-06 D4 rule 2; design README F5; TEST-STRATEGY §3.6): no `DELETE FROM audit_event`
// in product code outside the audit-retention job (LTI service: LA-E5-19). The rule starts with LA-E5-02.
// Pure rule module: the F5 runner (LA-E1-04) finds it in rules/ and calls check() once per file. Until the runner lands,
// infra/scripts/fitness-audit-event-delete.test.mjs runs it over the tree inside `npm run check`.

/** Product code: the source of every service, package and app. Tests next to the code are not product code. */
const PRODUCT = /^(services|packages|apps)\//;
const NOT_PRODUCT = /(^|\/)(node_modules|dist|\.data|\.tmp)\/|\.test\.[cm]?[jt]sx?$/;
/** The only files that may delete audit rows: the retention jobs. */
export const ALLOWED = ['services/lti-service/src/jobs/audit-retention.ts'];
// Also `DELETE FROM "audit_event"`, `main.audit_event` and any spaces or line breaks between the words.
const PATTERN = /\bDELETE\s+FROM\s+(?:main\s*\.\s*)?["`[]?audit_event\b/gi;

export default {
  id: 'audit-event-delete',
  description: 'No DELETE FROM audit_event in product code outside the audit-retention job (LA-ADR-06 D4 rule 2).',
  /** @param {{ path: string, text: string }} file  path relative to the repository root, with "/" */
  check({ path, text }) {
    if (!PRODUCT.test(path) || NOT_PRODUCT.test(path) || ALLOWED.includes(path)) return [];
    const hits = [];
    for (const m of text.matchAll(PATTERN)) {
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      const col = m.index - before.lastIndexOf('\n');
      hits.push({ line, col, message: `"${m[0].replace(/\s+/g, ' ')}": only the audit-retention job deletes audit rows (LA-ADR-06 D4 rule 2)` });
    }
    return hits;
  },
};
