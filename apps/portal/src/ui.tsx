import { Badge } from "./ui/badge.tsx";
import { Card } from "./ui/card.tsx";
import { Button } from "./ui/button.tsx";
import { Notice } from "./ui/notice.tsx";
import { useState } from "react";
import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { ApiError } from "./api.ts";
import type { Connection } from "./types.ts";
import { channelOf, channelRegistry, channelText } from "./channels/registry.ts";
import { useChannels } from "./channels/context.tsx";
import { createPortalSdk } from "./sdk/index.ts";

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : null;
  const action = details?.action;
  return (
    <Notice variant="error" role="alert">
      <p>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Try again."}
      </p>
      {action && <p>{action}</p>}
      {details?.reasons && (
        <ul>
          {details.reasons.map((reason, index) => (
            <li key={index}>
              <strong>
                {reason.title}
                {reason.path ? `: ${reason.path}` : ""}
              </strong>
              <p>{reason.action}</p>
              <small>{reason.code}</small>
            </li>
          ))}
        </ul>
      )}
      {details?.message && <small>Code: {details.message}</small>}
      {error instanceof ApiError && error.traceId && (
        <small>Trace id: {error.traceId}</small>
      )}
    </Notice>
  );
}
export function ConnectionError({ connection, libraryName = "" }: { connection: Connection; libraryName?: string }) {
  const { modules } = useChannels();
  const Slot = modules.get(channelOf(connection))?.ConnectionError;
  if (!connection.lastError) return null;
  const props = { connection, error: connection.lastError, libraryName, sdk: createPortalSdk((to) => window.location.assign(to)) };
  return Slot ? <Slot {...props} Default={DefaultConnectionError} /> : <DefaultConnectionError {...props} />;
}
export function DefaultConnectionError({ connection, error = connection.lastError }: { connection: Connection; error?: Connection["lastError"] }) {
  if (!error) return null;
  return (
    <Notice variant="error" role="alert">
      <p>{error.title ?? "The connection failed."}</p>
      {error.action ? (
        <p>{error.action}</p>
      ) : null}
      <small>
        Code: {error.code}
        {error.ltiCode ? ` · ${error.ltiCode}` : ""}
      </small>
      <small>Trace id: {error.traceId}</small>
    </Notice>
  );
}
export function connectionStatus(connection: Connection): string {
  const manifest = channelRegistry.channel(channelOf(connection));
  if (connection.status === "registered") {
    const registered = manifest?.texts.registered ?? "Registered";
    return manifest ? channelText(manifest, registered) : registered;
  }
  if (connection.status === "connected") return "Connected";
  if (connection.status === "disabled") return "Disconnected";
  if (
    connection.registrationUrlExpiresAt &&
    new Date(connection.registrationUrlExpiresAt).getTime() <= Date.now()
  )
    return "Link expired";
  if (connection.registrationUrl) return `Waiting for ${connection.channelName ?? channelRegistry.textName(channelOf(connection))}`;
  return "Pending";
}
export function ConnectionBadge({ connection }: { connection: Connection }) {
  return (
    <Badge variant={connection.status === "connected" ? "success" : "default"}>
      {connectionStatus(connection)}
    </Badge>
  );
}
export function CopyButton({ value, label, text = "Copy" }: { value: string; label: string; text?: string }) {
  const [result, setResult] = useState<{ value: string; failed: boolean } | null>(null);
  const current = result?.value === value ? result : null;
  const status = current ? current.failed ? "Copy failed. Select the value and copy it." : "Copied" : "";
  return (
    <span className="inline-flex flex-col items-start gap-[5px]">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setResult({ value, failed: false });
          } catch {
            setResult({ value, failed: true });
          }
        }}
      >
        {status === "Copied" ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
        {text}
      </Button>
      <span className="text-[11px] text-[#cbb7e6] empty:hidden" role="status">
        {status}
      </span>
      {current?.failed && <textarea
        aria-label={`Copy ${label} manually`}
        readOnly
        value={value}
        className="w-full min-w-[220px] rounded border border-border bg-background p-2 font-mono text-xs"
        onFocus={(event) => event.target.select()}
      />}
    </span>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <p role="status" className="text-muted-foreground">
      {text}
    </p>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card
      as="div"
      spacing="empty"
      className="flex flex-col items-center gap-3.5 text-center text-muted-foreground [&_h2]:text-[#f5f0ff]"
    >
      {children}
    </Card>
  );
}
export const formatName = (format: string): string =>
  format === "scorm12" ? "SCORM 1.2" : "HTML";

export { Dialog as Modal } from "./ui/dialog.tsx";
