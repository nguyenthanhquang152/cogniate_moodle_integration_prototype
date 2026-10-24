import ts from 'typescript';
import { isUnitFile, position } from '../common.mjs';

// BD-A2-48: LTI-service URL construction only. Route patterns are not built account URLs.
const RESOLVER = 'services/lti-service/src/accounts/resolver.ts';
// A-LA-E5-06-02: "/lti/<endpoint>/" or "/lti/<endpoint>" at the end of a literal part (the account comes in the next
// part), and the relative form "lti/<endpoint>/" (new URL(`lti/launch/${id}`, base)). The relative form needs a start
// or a character that cannot be in a host or path name before "lti".
const ENDPOINT = /(?:\/|(?<![\w.~%-]))lti\/(?:launch|login|keys|register)(?:\/|$)/g;

export default {
  id: 'protocol-urls',
  description: 'Build /lti/launch/ and other account protocol URLs only in the account resolver (BD-A2-48). Known limit: a URL joined from separate segments, for example [base, "lti", "launch", id].join("/"), passes.',
  check({ path, text }) {
    if (!path.startsWith('services/lti-service/src/') || isUnitFile(path) || path === RESOLVER || !/\.[cm]?[jt]sx?$/.test(path)) return [];
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const hits = [];
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const match of node.text.matchAll(ENDPOINT)) {
          const suffix = node.text.slice(match.index + match[0].length);
          if (match[0].endsWith('/') && /^:account(?:\/|$)/.test(suffix)) continue;
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
