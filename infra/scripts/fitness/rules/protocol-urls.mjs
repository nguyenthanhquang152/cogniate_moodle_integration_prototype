import ts from 'typescript';
import { isUnitFile, position } from '../common.mjs';

// BD-A2-48: LTI-service URL construction only. Route patterns are not built account URLs.
const RESOLVER = 'services/lti-service/src/accounts/resolver.ts';

export default {
  id: 'protocol-urls',
  description: 'Build /lti/launch/ and other account protocol URLs only in the account resolver (BD-A2-48).',
  check({ path, text }) {
    if (!path.startsWith('services/lti-service/src/') || isUnitFile(path) || path === RESOLVER || !/\.[cm]?[jt]sx?$/.test(path)) return [];
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const hits = [];
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const match of node.text.matchAll(/\/lti\/(?:launch|login|keys|register)\//g)) {
          const suffix = node.text.slice(match.index + match[0].length);
          if (/^:account(?:\/|$)/.test(suffix)) continue;
          hits.push({ ...position(text, node.getStart(source) + 1 + match.index),
            message: 'Build protocol URLs with accounts/resolver.ts protocolUrls(account) (LA-ADR-06 D2).' });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return hits;
  },
};
