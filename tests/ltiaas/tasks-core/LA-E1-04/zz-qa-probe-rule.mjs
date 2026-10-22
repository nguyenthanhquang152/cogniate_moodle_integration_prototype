// QA-3 probe rule for AC-LA-E1-04-10. The test copies this file into infra/scripts/fitness/rules/zz-qa-probe.mjs in
// QA's own clone only (QA form (k)), runs `npm run check`, and removes it. It reports one hit on every run.
// The module shape is QA's guess from the design ("one rule per file in rules/, found by discovery"). If the runner
// needs another shape, QA adapts only this fixture at the first run and records it in qa.md; the assertion stays.
export const id = 'zz-qa-probe';
export const description = 'QA-3 probe rule: always one hit';

export function check() {
  return [{ rule: id, path: 'zz-qa-probe', line: 1, message: 'zz-qa-probe: QA probe hit' }];
}

export default { id, description, check };
