import { parse } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

export interface HtmlScan {
  /** `data-cog-quiz` values in document order (not unique, trimmed; may break the id rule: the caller checks). */
  questionIds: string[];
  /** `data-lesson-id` of the first <body>, or null (app contract §3.3: the page key when present). */
  lessonId: string | null;
  /**
   * URLs that load a resource: src, srcset, imagesrcset, poster, data (<object>), background, <link href>,
   * <base href>, SVG href / xlink:href (<image>, <use>, <feImage>), CSS url() and @import.
   */
  resourceUrls: string[];
}

/** SVG elements whose href (or xlink:href) loads a resource. */
const SVG_LOADING = new Set(['image', 'use', 'feimage']);

const SPACE = /\s/;

/**
 * srcset candidates ("a.jpg 1x, b.jpg 2x"), like the HTML parsing rules: a URL is a run without white space
 * (it can hold commas, as in data: URLs); trailing commas end it; else descriptors run to the next comma.
 */
export function srcsetUrls(value: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && (SPACE.test(value[i]!) || value[i] === ',')) i += 1;
    let j = i;
    while (j < value.length && !SPACE.test(value[j]!)) j += 1;
    let url = value.slice(i, j);
    i = j;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      let depth = 0;
      while (i < value.length) {
        const c = value[i]!;
        i += 1;
        if (c === '(') depth += 1;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === ',' && depth === 0) break;
      }
    }
    if (url !== '') out.push(url);
  }
  return out;
}

/** CSS url() and @import targets. Comments are removed first; an open comment runs to the end (CSS rule). */
export function cssUrls(css: string): string[] {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const open = s.indexOf('/*');
  if (open >= 0) s = s.slice(0, open);
  const out: string[] = [];
  for (const m of s.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of s.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) out.push(m[1] ?? m[2] ?? '');
  return out.filter((u) => u !== '');
}

/**
 * Host of an absolute http(s) or protocol-relative URL, lower case. null for a relative URL or another scheme
 * (data:, blob:, javascript:, ...). Browsers read `\` like `/` in these URLs, so `https:\\host` counts too.
 */
export function externalHost(raw: string): string | null {
  // Browsers remove ASCII tab and newline from URLs, so "ht<TAB>tps://x" loads from x.
  const v = raw.replace(/[\t\n\r]/g, '').trim();
  if (!/^(?:https?:)?[\\/]{2}/i.test(v)) return null;
  try {
    const host = new URL(v.startsWith('//') || v.startsWith('\\\\') ? `https:${v}` : v).hostname.toLowerCase();
    return host === '' ? null : host;
  } catch {
    return null;
  }
}

const textOf = (el: Element): string =>
  el.childNodes.map((c) => (c.nodeName === '#text' ? (c as DefaultTreeAdapterTypes.TextNode).value : '')).join('');

/**
 * Read one HTML document with parse5. Only attributes and <style> text are read; script text is never read
 * (so URLs inside inline scripts do not count), and <template> content is not walked.
 */
export function scanHtml(source: string): HtmlScan {
  const doc = parse(source);
  const questionIds: string[] = [];
  const resourceUrls: string[] = [];
  let lessonId: string | null = null;
  let bodySeen = false;
  // Iterative walk in document order (deep documents do not grow the call stack).
  const stack: Node[] = [doc];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if ('tagName' in node) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'body' && !bodySeen) {
        bodySeen = true;
        const lesson = el.attrs.find((a) => a.name === 'data-lesson-id');
        if (lesson) lessonId = lesson.value.trim();
      }
      for (const { name, value } of el.attrs) {
        if (name === 'data-cog-quiz') {
          questionIds.push(value.trim());
        } else if (name === 'src' || name === 'poster' || name === 'background') {
          resourceUrls.push(value);
        } else if (name === 'srcset' || name === 'imagesrcset') {
          resourceUrls.push(...srcsetUrls(value));
        } else if (name === 'data' && tag === 'object') {
          resourceUrls.push(value);
        } else if (name === 'href' && (tag === 'link' || tag === 'base' || SVG_LOADING.has(tag))) {
          // parse5 gives xlink:href as name "href" with prefix "xlink".
          resourceUrls.push(value);
        } else if (name === 'style') {
          resourceUrls.push(...cssUrls(value));
        }
      }
      if (tag === 'style') resourceUrls.push(...cssUrls(textOf(el)));
    }
    if ('childNodes' in node && node.nodeName !== 'template') {
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]!);
    }
  }
  return { questionIds, lessonId, resourceUrls };
}
