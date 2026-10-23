import type { CanvasConfigurationSnapshot, CourseVersion, ErrorDetails } from "./types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly details: ErrorDetails;
  readonly traceId: string | null;
  constructor(
    status: number,
    details: ErrorDetails,
    traceId: string | null = null,
  ) {
    super(
      details.description ||
        details.message ||
        "The request failed. Try again.",
    );
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.traceId = traceId ?? details.traceId ?? null;
  }
}
function errorDetails(value: unknown): ErrorDetails {
  if (
    value &&
    typeof value === "object" &&
    "details" in value &&
    value.details &&
    typeof value.details === "object"
  ) {
    return value.details as ErrorDetails;
  }
  return { description: "The server cannot complete this request. Try again." };
}
function sessionExpired(status: number, code: string | undefined) {
  if (status === 401 && code === "NOT_SIGNED_IN")
    window.dispatchEvent(new Event("portal:session-expired"));
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/app-api${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    signal: options.signal,
    headers:
      options.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = errorDetails(body);
    sessionExpired(response.status, details.message);
    throw new ApiError(
      response.status,
      details,
      response.headers.get("x-trace-id"),
    );
  }
  return body as T;
}
export const idPath = (id: string): string => encodeURIComponent(id);

/** Keep the exact export bytes and its snapshot header together. */
export async function canvasConfiguration(
  connectionId: string,
  inline: boolean,
  signal?: AbortSignal,
): Promise<CanvasConfigurationSnapshot> {
  const response = await fetch(
    `/app-api/connections/${idPath(connectionId)}/canvas-configuration${inline ? "?jwk=inline" : ""}`,
    { credentials: "same-origin", cache: "no-store", signal },
  );
  if (!response.ok) {
    const details = errorDetails(await response.json().catch(() => null));
    sessionExpired(response.status, details.message);
    throw new ApiError(response.status, details, response.headers.get("x-trace-id"));
  }
  const text = await response.text();
  // Refuse a malformed response rather than copying an error page as configuration.
  JSON.parse(text);
  const keyId = response.headers.get("x-cogniate-key-id");
  if (inline && !keyId) throw new Error("The key id is missing. Reload the configuration.");
  return { text, keyId };
}

// XHR exposes real upload progress. Fetch cannot report transferred request bytes.
export function uploadPackage(
  courseId: string,
  file: File,
  masteryScore: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<CourseVersion> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const clean = () => signal?.removeEventListener("abort", abort);
    xhr.open("POST", `/app-api/courses/${idPath(courseId)}/versions`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
    };
    xhr.onload = () => {
      clean();
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as CourseVersion);
        return;
      }
      const details = errorDetails(body);
      sessionExpired(xhr.status, details.message);
      reject(
        new ApiError(xhr.status, details, xhr.getResponseHeader("x-trace-id")),
      );
    };
    xhr.onerror = () => {
      clean();
      reject(new Error("The upload could not reach Cogniate. Try again."));
    };
    xhr.onabort = () => {
      clean();
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    const form = new FormData();
    form.append("package", file);
    if (masteryScore !== "") form.append("masteryScore", masteryScore);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      clean();
      reject(new DOMException("Upload cancelled.", "AbortError"));
      return;
    }
    xhr.send(form);
  });
}
