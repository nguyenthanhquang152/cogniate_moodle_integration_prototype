import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { ApiError } from "./api.ts";
import type { Connection } from "./types.ts";

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : null;
  return (
    <div className="notice error" role="alert">
      <p>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Try again."}
      </p>
      {details?.action && <p>{details.action}</p>}
      {details?.reasons && (
        <ul>
          {details.reasons.map((reason, index) => (
            <li key={index}>
              <strong>
                {reason.code === "PATH_TRAVERSAL"
                  ? `The package has an unsafe file path: ${reason.path}`
                  : reason.title}
              </strong>
              <p>{reason.action}</p>
              <small>
                {reason.code}
                {reason.path && reason.code !== "PATH_TRAVERSAL"
                  ? ` · ${reason.path}`
                  : ""}
              </small>
            </li>
          ))}
        </ul>
      )}
      {details?.message && <small>Code: {details.message}</small>}
      {error instanceof ApiError && error.traceId && (
        <small>Trace id: {error.traceId}</small>
      )}
    </div>
  );
}
const connectionErrors: Record<string, string> = {
  UPDATE_NOT_ALLOWED: "Go back in Moodle and choose Register as a new tool.",
  REGISTRATION_FAILED:
    "The connection failed. Go back to Moodle and try again.",
  MOODLE_TOOL_MAY_EXIST:
    "Moodle may have saved a Pending tool. Delete the Pending Cogniate tool in Manage tools, then connect again.",
  SITE_MISMATCH:
    "The Moodle site does not match this connection. Check the site URL.",
  PLATFORM_IN_USE:
    "This Moodle tool belongs to another connection. Register a new tool.",
  INVALID_PLATFORM_VALUES: "Check the six Moodle values and try again.",
  REF_EXPIRED: "The registration link expired. Make a new URL.",
  LTI_SERVICE_ERROR: "The connection service is unavailable. Try again.",
};
export function ConnectionError({ connection }: { connection: Connection }) {
  const error = connection.lastError;
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <p>
        {connectionErrors[error.code] ??
          "The connection failed. Check the Moodle settings and try again."}
      </p>
      <small>
        Code: {error.code}
        {error.ltiCode ? ` · ${error.ltiCode}` : ""}
      </small>
      <small>Trace id: {error.traceId}</small>
    </div>
  );
}
export function connectionStatus(connection: Connection): string {
  if (connection.status === "registered")
    return "Registered — activate in Moodle";
  if (connection.status === "connected") return "Connected";
  if (connection.status === "disabled") return "Disconnected";
  if (
    connection.registrationUrlExpiresAt &&
    new Date(connection.registrationUrlExpiresAt).getTime() <= Date.now()
  )
    return "Link expired";
  return "Pending";
}
export function ConnectionBadge({ connection }: { connection: Connection }) {
  return (
    <span
      className={`badge ${connection.status === "connected" ? "success" : ""}`}
    >
      {connectionStatus(connection)}
    </span>
  );
}
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState("");
  return (
    <span className="copy-control">
      <button
        type="button"
        className="button secondary compact"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus("Copied");
          } catch {
            setStatus("Copy failed. Select the value and copy it.");
          }
        }}
      >
        {status === "Copied" ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
        Copy
      </button>
      <span className="copy-status" role="status">
        {status}
      </span>
    </span>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <p role="status" className="muted">
      {text}
    </p>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty panel">{children}</div>;
}
export const formatName = (format: string): string =>
  format === "scorm12" ? "SCORM 1.2" : "HTML";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      className="modal panel"
      ref={ref}
      aria-labelledby="modal-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <div className="section-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
