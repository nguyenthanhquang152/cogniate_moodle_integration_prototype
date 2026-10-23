// Host side of QA form (c): reads the output of
// `docker compose exec -T lti-service npm run lti:operator -- init …` (LA-E5-01 AC-05, -06, -07).
// "One line" in the ACs means the lines of the CLI itself. These lines are not CLI lines and are removed:
// the npm script banner ("> pkg@version script", "> command"), npm's own lines ("npm error …", "npm warn …",
// "npm notice …") and Node runtime warnings ("(node:<pid>) …Warning…", "(Use `node --trace-warnings …`").
// The raw output stays in the redacted host evidence, so a reviewer can check the filter.
export const OPERATOR_KEY_G = /(?<![A-Za-z0-9_-])ltio_[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;
const NOT_CLI = [/^> /, /^npm (error|ERR!|warn|WARN|notice)\b/, /^\(node:\d+\) /, /^\(Use `node --trace-/];

/** Distinct operator keys in the text. */
export function operatorKeys(text) {
  return [...new Set(String(text ?? '').match(OPERATOR_KEY_G) ?? [])];
}

export function cliLines(stdout, stderr) {
  return [stdout, stderr]
    .flatMap((text) => String(text ?? '').split(/\r?\n/))
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '' && !NOT_CLI.some((re) => re.test(line.trimStart())));
}

export const maskKeys = (line) => line.replace(OPERATOR_KEY_G, '<operator-key>');

/** `keys` stays on the host (redaction, key file); the rest goes to the test in the control folder. */
export function initResult(mode, { code, stdout, stderr }) {
  const keys = operatorKeys(`${stdout}\n${stderr}`);
  return { mode, cliCode: code, cliLines: cliLines(stdout, stderr).map(maskKeys), keyCount: keys.length, keys };
}
