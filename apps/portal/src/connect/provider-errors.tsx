import { ApiError } from "../api.ts";
import { ErrorNotice } from "../ui.tsx";

const providerNotReadyAction = "Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.";
const siteRules: Record<number, string> = {
  1: "Enter only the address, for example https://school.instructure.com. No path.",
  2: "Enter a host name, not an IP address or localhost.",
  3: "This is a Cogniate address. Enter your LMS address.",
  4: "This is the LMS sign-in service, not your school site. Enter the address that teachers use.",
  5: "This is an Instructure-hosted address. Choose an Instructure-hosted Canvas type.",
};
const texts: Record<string, string> = {
  INVALID_PLATFORM_VALUES: "Check the marked fields.",
  GRANT_INVALID: "This approval code is not valid, was used, or expired. Ask your Cogniate operator for a new code.",
  GRANT_MISMATCH: "The values do not match the approval. Check the marked fields, or ask your Cogniate operator.",
  GRANT_IN_USE: "Cogniate is already saving this connection. Wait a moment, then reload the page.",
  PLATFORM_IN_USE: "This Canvas developer key is already connected to Cogniate. Make a new developer key for this library.",
  DEPLOYMENT_IN_USE: "This Blackboard site is already connected to Cogniate.",
  DEPLOYMENT_FIXED: "This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.",
  CONNECTION_NOT_PENDING: "This connection changed while Cogniate saved it. Reload the page.",
  PROVIDER_NOT_READY: "This LMS setup is not ready in Cogniate.",
};

export function providerErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const code = error.details.message;
  if (code === "INVALID_SITE_URL") return siteRules[error.details.rule ?? 0];
  if (code === "LTI_SERVICE_ERROR")
    return `Cogniate could not save the connection. Try again. Trace id: ${error.traceId ?? "unavailable"}`;
  return code ? texts[code] : undefined;
}
export function providerErrorFields(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [];
  const { fields, field } = error.details;
  return [...(fields ? (Array.isArray(fields) ? fields : Object.keys(fields)) : []), ...(field ? [field] : [])];
}
export function ProviderErrorNotice({ error }: { error: unknown }) {
  const message = providerErrorMessage(error);
  return <ErrorNotice error={error instanceof ApiError && message
    ? new ApiError(error.status, {
      ...error.details, description: message,
      action: error.details.message === "PROVIDER_NOT_READY" ? providerNotReadyAction : error.details.action,
    }, error.traceId)
    : error} />;
}
