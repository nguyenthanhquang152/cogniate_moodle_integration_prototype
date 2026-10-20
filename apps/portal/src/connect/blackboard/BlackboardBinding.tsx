import { useState } from "react";
import type { FormEvent } from "react";
import { api, idPath } from "../../api.ts";
import { useAlive } from "../../hooks.ts";
import type { BlackboardPlatformBody, Connection } from "../../types.ts";
import { Button } from "../../ui/button.tsx";
import { Input } from "../../ui/input.tsx";
import { ProviderErrorNotice, providerErrorFields } from "../provider-errors.tsx";

/**
 * Step 3: the deployment id and the operator's approval code (PUT …/platform, app contract §4.4). The code stays only
 * in this one request: the field is cleared after every submit, and the code is never put in the URL or storage.
 */
export function BlackboardBinding({ connection, onChanged }: { connection: Connection; onChanged: (connection: Connection) => void }) {
  const alive = useAlive();
  const [deploymentId, setDeploymentId] = useState("");
  const [grantCode, setGrantCode] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fields = providerErrorFields(error);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body: BlackboardPlatformBody = { deploymentId: deploymentId.trim(), grantCode };
    setGrantCode("");
    setBusy(true);
    setError(null);
    try {
      const answer = await api<Connection>(`/connections/${idPath(connection.id)}/platform`, { method: "PUT", body });
      if (alive.current) onChanged(answer);
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
    <label>Deployment ID
      <Input name="deploymentId" required maxLength={255} value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)}
        aria-invalid={fields.includes("deploymentId")} aria-describedby={fields.includes("deploymentId") ? "blackboard-binding-error" : undefined} />
    </label>
    <label>Approval code
      <Input name="grantCode" type="text" required autoComplete="off" spellCheck={false} value={grantCode} onChange={(event) => setGrantCode(event.target.value)}
        aria-invalid={fields.includes("grantCode")} aria-describedby={`blackboard-approval-help${fields.includes("grantCode") ? " blackboard-binding-error" : ""}`} />
    </label>
    <p id="blackboard-approval-help" className="text-muted-foreground">Ask your Cogniate operator for an approval code. The operator checks the request with your Blackboard administrator first. The code works once and expires.</p>
    <div id="blackboard-binding-error"><ProviderErrorNotice error={error} /></div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled={busy}>Save</Button>
      <span role="status">{busy ? "Saving connection…" : ""}</span>
    </div>
  </form>;
}
