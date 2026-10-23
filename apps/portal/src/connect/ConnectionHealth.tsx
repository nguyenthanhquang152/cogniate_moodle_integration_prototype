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
  backlogHelp: "Use Check connection. If the problem stays, give the trace id of an error to your Cogniate operator.",
};

/** The warnings of a health answer: a stale key in the setup artifact, and grades that wait more than 1 hour. */
export function healthWarnings(health: Health, now = Date.now()): ("staleKey" | "backlog")[] {
  const oldest = health.dispatch.oldestPendingAt === null ? null : Date.parse(health.dispatch.oldestPendingAt);
  return [
    ...(health.keys.artifactKeyCurrent === false ? ["staleKey" as const] : []),
    ...(oldest !== null && now - oldest > HOUR_MS ? ["backlog" as const] : []),
  ];
}

const time = (value: string | null) => value === null ? "none" : new Date(value).toLocaleString();
const passed = (ok: boolean) => ok ? "ok" : "failed";

/**
 * The connection health of the connection page (LA-ADR-08 D5): the warnings when they apply, and a closed
 * "Connection health" section with the last refused launch, the grade dispatch, the keys, the last check and the
 * events. Read only.
 */
export function ConnectionHealth({ connection }: { connection: Connection }) {
  const { registry } = useChannels();
  const { data, error, reload } = useApi<Health>(`/connections/${idPath(connection.id)}/health`);
  const manifest = registry.channel(channelOf(connection));
  const text = (value: string) => fillText(value, { LMS: manifest?.names.text ?? "your LMS" });
  const warnings = data ? healthWarnings(data) : [];
  return <>
    {warnings.map((key) => <Notice key={key} variant="warning" data-health-warning={key}>
      <p>{text(HEALTH_TEXTS[key])}</p>
      <p>{text(HEALTH_TEXTS[`${key}Help`])}</p>
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
