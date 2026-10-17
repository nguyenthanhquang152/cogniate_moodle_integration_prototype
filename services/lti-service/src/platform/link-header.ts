// RFC 8288 Link header -> { next, prev, first, last } URLs (AGS paging, Moodle sends rel="next").

export type PagingLinks = Partial<Record<'next' | 'prev' | 'first' | 'last', string>>;

/** Parse `<url>; rel="next", <url>; rel="last"`. Only https URLs and the four paging relations are kept. */
export function parseLinkHeader(header: string | string[] | undefined): PagingLinks {
  const out: PagingLinks = {};
  const text = Array.isArray(header) ? header.join(',') : header ?? '';
  for (const m of text.matchAll(/<([^>]*)>\s*((?:;\s*[^;,]+)*)/g)) {
    const url = m[1]!.trim();
    const rels = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))/i.exec(m[2] ?? '');
    const relList = (rels?.[1] ?? rels?.[2] ?? '').toLowerCase().split(/\s+/);
    if (!/^https:\/\//i.test(url)) continue;
    for (const rel of relList) if ((rel === 'next' || rel === 'prev' || rel === 'first' || rel === 'last') && out[rel] === undefined) out[rel] = url;
  }
  return out;
}
