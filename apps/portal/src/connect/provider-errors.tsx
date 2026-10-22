import { fillText } from "@cogniate/channel-kernel";
import type { ChannelManifest, ErrorTextKey } from "@cogniate/channel-kernel";
import { ApiError } from "../api.ts";
import { useCurrentChannel } from "../channels/context.tsx";
import { ErrorNotice } from "../ui.tsx";

const providerNotReadyAction = "Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.";
// Texts that can name an LMS come from the channel (manifest `texts.errors`, BD-A1-63). These are the generic
// texts for a channel with no own text: they name no LMS.
const genericTexts: Record<ErrorTextKey, string> = {
  SITE_RULE_1: "Enter only the address, for example https://lms.example.edu. No path.",
  SITE_RULE_5: "This is the address of a hosted LMS. Choose a hosted type.",
  PLATFORM_IN_USE: "This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library.",
  DEPLOYMENT_IN_USE: "This LMS site is already connected to Cogniate.",
  DEPLOYMENT_FIXED: "This connection already reserved another deployment. Disconnect it, then make a new connection.",
};
const siteRules: Record<number, string> = {
  2: "Enter a host name, not an IP address or localhost.",
  3: "This is a Cogniate address. Enter your LMS address.",
  4: "This is the LMS sign-in service, not your school site. Enter the address that teachers use.",
};
const texts: Record<string, string> = {
  INVALID_PLATFORM_VALUES: "Check the marked fields.",
  GRANT_INVALID: "This approval code is not valid, was used, or expired. Ask your Cogniate operator for a new code.",
  GRANT_MISMATCH: "The values do not match the approval. Check the marked fields, or ask your Cogniate operator.",
  GRANT_IN_USE: "Cogniate is already saving this connection. Wait a moment, then reload the page.",
  CONNECTION_NOT_PENDING: "This connection changed while Cogniate saved it. Reload the page.",
  PROVIDER_NOT_READY: "This LMS setup is not ready in Cogniate.",
};

/** The parts of a channel manifest that the error texts read: `texts.errors` and the name for `{LMS}`. */
export type ChannelErrorTexts = Pick<ChannelManifest, "names" | "texts">;

function channelTextKey(code: string | undefined, rule: number | undefined): ErrorTextKey | undefined {
  if (code === "INVALID_SITE_URL") return rule === 1 ? "SITE_RULE_1" : rule === 5 ? "SITE_RULE_5" : undefined;
  return code === "PLATFORM_IN_USE" || code === "DEPLOYMENT_IN_USE" || code === "DEPLOYMENT_FIXED" ? code : undefined;
}

/** The safe text of a provider error. `channel`: the channel of the error (its manifest); without it, the generic texts. */
export function providerErrorMessage(error: unknown, channel?: ChannelErrorTexts | null): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const { message: code, rule } = error.details;
  const key = channelTextKey(code, rule);
  if (key) {
    const text = channel?.texts.errors?.[key];
    return channel && text ? fillText(text, { LMS: channel.names.text }) : genericTexts[key];
  }
  if (code === "INVALID_SITE_URL") return siteRules[rule ?? 0];
  if (code === "LTI_SERVICE_ERROR")
    return `Cogniate could not save the connection. Try again. Trace id: ${error.traceId ?? "unavailable"}`;
  return code ? texts[code] : undefined;
}
export function providerErrorFields(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [];
  const { fields, field } = error.details;
  return [...(fields ? (Array.isArray(fields) ? fields : Object.keys(fields)) : []), ...(field ? [field] : [])];
}
/** Uses the texts of the channel in context (`ChannelScope`; the connect routes set it), else the generic texts. */
export function ProviderErrorNotice({ error }: { error: unknown }) {
  const message = providerErrorMessage(error, useCurrentChannel());
  return <ErrorNotice error={error instanceof ApiError && message
    ? new ApiError(error.status, {
      ...error.details, description: message,
      action: error.details.message === "PROVIDER_NOT_READY" ? providerNotReadyAction : error.details.action,
    }, error.traceId)
    : error} />;
}
