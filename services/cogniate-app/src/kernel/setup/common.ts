// Small pieces that every setup adapter and the connection routes share (no I/O).
import type { PublicUrls } from '@cogniate/shared';
import type { ToolUrls } from '../ports.ts';

/** The tool account of the app in the LTI service (contract §4.1). */
export const TOOL_ACCOUNT = 'cogniate';

/** The protocol URLs of the tool account (all from PUBLIC_LTI_URL). */
export function toolUrls(urls: PublicUrls): ToolUrls {
  return {
    launch: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}`,
    login: `${urls.lti}/lti/login/${TOOL_ACCOUNT}`,
    keys: `${urls.lti}/lti/keys/${TOOL_ACCOUNT}`,
    register: `${urls.lti}/lti/register/${TOOL_ACCOUNT}`,
    ltiOrigin: new URL(urls.lti).origin,
  };
}

/** The common P2 and P5 deployment context; no channel owns an account or protocol path. */
export function toolContext(urls: PublicUrls): { toolAccountId: string; toolUrls: ToolUrls } {
  return { toolAccountId: TOOL_ACCOUNT, toolUrls: Object.freeze(toolUrls(urls)) };
}
