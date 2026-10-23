import { fillText } from "@cogniate/channel-kernel";
import { idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Connection, ConnectionHealth as Health } from "../types.ts";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { useChannels } from "../channels/context.tsx";
import { channelOf } from "../channels/registry.ts";

const HOUR_MS = 3_600_000;
// The warnings of A2 LA-ADR-08 D5, with {LMS} filled. They name no LMS in core code.
export const HEALTH_TEXTS = {
  staleKey: "Paste a new {LMS} key JSON.",
  staleKeyHelp: "The key in the key JSON that {LMS} has is not the active Cogniate key. Download the JSON again and paste it into {LMS}.",
  backlog: "Some grades wait more than 1 hour to go to {LMS}.",
  // B-LA-E6-02-01: name only an action that the page has and values that the page shows.
  backlogCheck: "Select Check connection to test the connection to {LMS}.",
};

/**
 * The help of the backlog warning: "Check connection" only when that panel is on the page (the channel has
 * setup.connectionCheck and the connection is registered or connected), then what to give the operator: the connection
 * name and the last grade error that the health view shows.
 */
export function backlogHelp(health: Health, connection: Pick<Connection, "name">, checkAvailable: boolean, fill: (value: string) => string): string[] {
  const error = health.dispatch.lastError;
  const facts = `the connection name "${connection.name}"${error ? ` and the last grade error ${error.code ?? "(no code)"} at ${time(error.at)}` : ""}`;
  return checkAvailable
    ? [fill(HEALTH_TEXTS.backlogCheck), `If the grades still wait, give your Cogniate operator ${facts}.`]
    : [`Give your Cogniate operator ${facts}.`];
}

/** The warnings of a health answer: a stale key in the setup artifact, and grades that wait more than 1 hour. */
export function healthWarnings(health: Health, now = Date.now()): ("staleKey" | "backlog")[] {
  const oldest = health.dispatch.oldestPendingAt === null ? null : Date.parse(health.dispatch.oldestPendingAt);
  return [
    ...(health.keys.artifactKeyCurrent === false ? ["staleKey" as const] : []),
    ...(oldest !== null && now - oldest > HOUR_MS ? ["backlog" as const] : []),
  ];
}

// A-LA-E6-02-01, B-LA-E6-02-02: every value that the panel reads is checked, also inside dispatch, keys, the last
// check and each event; any other answer counts as "not available" (the page never fails on it).
type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isTextOrNull = (value: unknown): boolean => value === null || isText(value);
const isCount = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value);
const isFlagOrNull = (value: unknown): boolean => value === null || typeof value === "boolean";
const isCodeAt = (value: unknown, codeKey: string): boolean => isObject(value) && isTextOrNull(value[codeKey]) && isText(value.at);
export function isHealth(value: unknown): value is Health {
  if (!isObject(value) || !isText(value.status) || !isTextOrNull(value.lastLaunchAt)) return false;
  const { dispatch: d, keys: k, lastCheck: c, lastLaunchRefusal: r, events: e } = value;
  return (r === null || isCodeAt(r, "reason"))
    && isObject(d) && isCount(d.pending) && isTextOrNull(d.oldestPendingAt) && isTextOrNull(d.lastSentAt) && isCount(d.failedLast24h)
    && (d.lastError === null || isCodeAt(d.lastError, "code"))
    && isObject(k) && isTextOrNull(k.activeKid) && isTextOrNull(k.nextKid) && isTextOrNull(k.artifactKeyKid) && isFlagOrNull(k.artifactKeyCurrent)
    && (c === null || (isObject(c) && isText(c.at) && typeof c.jwks === "boolean" && typeof c.token === "boolean"))
    && Array.isArray(e) && e.every((event) => isCodeAt(event, "code") && isText((event as Fields).kind));
}
function time(value: string | null): string { return value === null ? "none" : new Date(value).toLocaleString(); }
const passed = (ok: boolean) => ok ? "ok" : "failed";

/**
 * The connection health of the connection page (LA-ADR-08 D5): the warnings when they apply, and a closed
 * "Connection health" section with the last refused launch, the grade dispatch, the keys, the last check and the
 * events. Read only.
 */
export function ConnectionHealth({ connection }: { connection: Connection }) {
  const { registry } = useChannels();
  const answer = useApi<unknown>(`/connections/${idPath(connection.id)}/health`);
  const { reload } = answer;
  const data = isHealth(answer.data) ? answer.data : undefined;
  const error = answer.error ?? (answer.data !== undefined && !data ? new Error("not a health answer") : null);
  const manifest = registry.channel(channelOf(connection));
  const text = (value: string) => fillText(value, { LMS: manifest?.names.text ?? "your LMS" });
  const warnings = data ? healthWarnings(data) : [];
  const checkAvailable = !!manifest?.setup.connectionCheck && (connection.status === "registered" || connection.status === "connected");
  const help = (key: "staleKey" | "backlog", health: Health) => key === "staleKey" ? [text(HEALTH_TEXTS.staleKeyHelp)] : backlogHelp(health, connection, checkAvailable, text);
  return <>
    {data && warnings.map((key) => <Notice key={key} variant="warning" data-health-warning={key}>
      <p>{text(HEALTH_TEXTS[key])}</p>
      {help(key, data).map((line) => <p key={line}>{line}</p>)}
    </Notice>)}
    <details className="rounded-[9px] border border-border p-4 [&_dl]:mt-3 [&_dt]:font-semibold [&_dd]:mb-2 [&_ol]:pl-5" data-connection-health="">
      <summary>Connection health</summary>
      {error ? <p>The connection health is not available. <Button type="button" variant="link" onClick={reload}>Load the connection health again</Button></p>
        : !data ? <p>Loading the connection health…</p>
        : <>
          <dl>
            <dt>Last refused launch</dt>
            <dd>{data.lastLaunchRefusal ? `${data.lastLaunchRefusal.reason ?? "unknown"} · ${time(data.lastLaunchRefusal.at)}` : "none"}</dd>
            <dt>Grades to send</dt>
            <dd>{data.dispatch.pending} waiting (oldest: {time(data.dispatch.oldestPendingAt)}) · Last sent: {time(data.dispatch.lastSentAt)} · Failed in the last 24 hours: {data.dispatch.failedLast24h}</dd>
            <dt>Last grade error</dt>
            <dd>{data.dispatch.lastError ? `${data.dispatch.lastError.code ?? "no code"} · ${time(data.dispatch.lastError.at)}` : "none"}</dd>
            <dt>Signing key</dt>
            <dd>Active key id: {data.keys.activeKid ?? "unknown"} · Key id in the last key JSON: {data.keys.artifactKeyKid ?? "none"}</dd>
            <dt>Last connection check</dt>
            <dd>{data.lastCheck ? `${time(data.lastCheck.at)} · Key set: ${passed(data.lastCheck.jwks)} · Access token: ${passed(data.lastCheck.token)}` : "none"}</dd>
          </dl>
          <h3>Events</h3>
          {data.events.length ? <ol>{data.events.map((event, index) => <li key={index}>{time(event.at)} · {event.kind} · {event.code ?? "no code"}</li>)}</ol> : <p>No events in the last 30 days.</p>}
          <Button type="button" variant="link" onClick={reload}>Refresh connection health</Button>
        </>}
    </details>
  </>;
}
