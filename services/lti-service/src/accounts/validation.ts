import { z } from 'zod';
import { RATE_LIMIT_CLASSES } from '../store/accounts.ts';

export const AccountStatusSchema = z.enum(['active', 'suspended', 'closed']);
export const ClaimPolicySchema = z.object({
  mode: z.enum(['allowlist', 'passthrough']),
  keep: z.object({ names: z.boolean(), email: z.boolean(), custom: z.boolean(), lis: z.boolean() }).strict(),
}).strict();
export const AccountLimitsSchema = z.partialRecord(z.enum(RATE_LIMIT_CLASSES), z.object({
  ratePerMinute: z.number().min(1), burst: z.number().int().min(1),
}).strict());

/** Tool URLs are redirects, not protocol endpoints. Compare hosts without ports. */
export function toolUrlSchema(urls: { lti: string; content: string }) {
  const host = (url: URL) => url.hostname.replace(/\.$/, '');
  const reserved = new Set([host(new URL(urls.lti)), host(new URL(urls.content))]);
  return z.string().min(1).max(2048).refine((text) => {
    try {
      const url = new URL(text);
      return text === text.trim() && url.protocol === 'https:' && !url.username && !url.password && !text.includes('#') &&
        !reserved.has(host(url));
    } catch { return false; }
  });
}
