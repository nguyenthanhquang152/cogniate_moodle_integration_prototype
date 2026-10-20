import { useState } from "react";
import type { FormEvent } from "react";
import { api, idPath } from "../../api.ts";
import { useAlive } from "../../hooks.ts";
import type { AddDeploymentBody, CanvasPlatformBody, Connection } from "../../types.ts";
import { Button } from "../../ui/button.tsx";
import { Input } from "../../ui/input.tsx";
import { ProviderErrorNotice, providerErrorFields } from "../provider-errors.tsx";

export function CanvasBinding({ connection, onChanged, addDeployment = false }: {
  connection: Connection;
  onChanged: (connection: Connection) => void;
  addDeployment?: boolean;
}) {
  const alive = useAlive();
  const [clientId, setClientId] = useState("");
  const [deploymentId, setDeploymentId] = useState("");
  const [grantCode, setGrantCode] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fields = providerErrorFields(error);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body: CanvasPlatformBody | AddDeploymentBody = addDeployment
      ? { deploymentId: deploymentId.trim(), grantCode }
      : { clientId: clientId.trim(), deploymentId: deploymentId.trim(), grantCode };
    // Retain the code only in this one request, including when the request fails.
    setGrantCode("");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const answer = await api<Connection>(`/connections/${idPath(connection.id)}/${addDeployment ? "deployments" : "platform"}`, {
        method: addDeployment ? "POST" : "PUT", body,
      });
      if (alive.current) {
        setSaved(true);
        setDeploymentId("");
        onChanged(answer);
      }
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
    {!addDeployment && <label>Client ID
      <Input name="clientId" required maxLength={255} value={clientId} onChange={(event) => setClientId(event.target.value)}
        aria-invalid={fields.includes("clientId")} aria-describedby={fields.includes("clientId") ? "canvas-binding-error" : undefined} />
    </label>}
    <label>Deployment ID
      <Input name="deploymentId" required maxLength={255} value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)}
        aria-invalid={fields.includes("deploymentId")} aria-describedby={fields.includes("deploymentId") ? "canvas-binding-error" : undefined} />
    </label>
    <label>Approval code
      <Input name="grantCode" type="text" required autoComplete="off" spellCheck={false} value={grantCode} onChange={(event) => setGrantCode(event.target.value)}
        aria-invalid={fields.includes("grantCode")} aria-describedby={`canvas-approval-help${fields.includes("grantCode") ? " canvas-binding-error" : ""}`} />
    </label>
    <p id="canvas-approval-help" className="text-muted-foreground">Ask your Cogniate operator for an approval code. The operator checks the request with your Canvas administrator first. The code works once and expires.</p>
    <div id="canvas-binding-error"><ProviderErrorNotice error={error} /></div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled={busy}>{addDeployment ? "Add deployment ID" : "Save"}</Button>
      <span role="status">{busy ? "Saving connection…" : saved ? "Deployment ID added." : ""}</span>
    </div>
  </form>;
}
