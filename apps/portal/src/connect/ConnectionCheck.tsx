import { useState } from "react";
import { api, idPath } from "../api.ts";
import { useAlive } from "../hooks.ts";
import type { Connection, ConnectionCheckAnswer } from "../types.ts";
import { ErrorNotice } from "../ui.tsx";
import { Button } from "../ui/button.tsx";
import { Card } from "../ui/card.tsx";
import { Notice } from "../ui/notice.tsx";
import { useChannels } from "../channels/context.tsx";
import { channelOf, channelText } from "../channels/registry.ts";

// The result texts of A2 LA-ADR-08 D4 and BD-A2-98, with {LMS} filled. They name no LMS in core code.
const TEXTS = {
  ok: "Cogniate can reach {LMS}.",
  jwks: "Cogniate cannot reach the {LMS} key set.",
  invalidClient: "{LMS} refused our client id. Check the Client ID in {LMS}.",
  noGrantedScope: "{LMS} gave Cogniate no grade scope. Allow the grade (AGS) scopes for the Cogniate tool in {LMS}.",
  token: "{LMS} did not give Cogniate an access token.",
};

/** The texts of a check: the "ok" text, or one text for each part that failed. */
export function connectionCheckTexts(answer: ConnectionCheckAnswer): (keyof typeof TEXTS)[] {
  if (answer.result === "ok") return ["ok"];
  const { jwks, token } = answer.details;
  return [
    ...(jwks.ok ? [] : ["jwks" as const]),
    ...(token.ok ? [] : [token.detail === "invalid_client" ? "invalidClient" as const : token.detail === "no_granted_scope" ? "noGrantedScope" as const : "token" as const]),
  ];
}

/**
 * The "Check connection" panel of the connection page (LA-ADR-08 D4): only for a channel with `setup.connectionCheck`
 * and an active connection. The check reads no course or learner data.
 */
export function ConnectionCheck({ connection }: { connection: Connection }) {
  const { registry } = useChannels();
  const alive = useAlive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [answer, setAnswer] = useState<ConnectionCheckAnswer | null>(null);
  const manifest = registry.channel(channelOf(connection));
  if (!manifest?.setup.connectionCheck || (connection.status !== "registered" && connection.status !== "connected")) return null;
  const text = (value: string) => channelText(manifest, value);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<ConnectionCheckAnswer>(`/connections/${idPath(connection.id)}/check`, { method: "POST" });
      if (alive.current) setAnswer(result);
    } catch (reason) {
      if (alive.current) { setAnswer(null); setError(reason); }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const { jwks, token } = answer?.details ?? {};
  return <Card className="flex flex-col gap-5" data-connection-check="">
    <h2>Check connection</h2>
    <p className="text-muted-foreground">{text("Cogniate asks {LMS} for its key set and for one access token. Cogniate reads no course or learner data.")}</p>
    <div><Button type="button" variant="secondary" disabled={busy} onClick={() => { void run(); }}>{busy ? "Checking…" : "Check connection"}</Button></div>
    {answer && <Notice variant={answer.result === "ok" ? "default" : "error"} role="status">
      {connectionCheckTexts(answer).map((key) => <p key={key}>{text(TEXTS[key])}</p>)}
      {jwks && token && answer.result === "failed" && <small>
        Key set: {jwks.ok ? "ok" : jwks.detail ?? "failed"} · Access token: {token.ok ? "ok" : token.detail ?? "failed"}
      </small>}
      <small>Checked {new Date(answer.checkedAt).toLocaleString()}</small>
    </Notice>}
    <ErrorNotice error={error} />
  </Card>;
}
