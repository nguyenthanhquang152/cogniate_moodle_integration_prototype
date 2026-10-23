import { useState } from "react";
import { RegistrationUrl, renewRegistrationUrl } from "@cogniate/portal-sdk";
import { useAlive } from "@cogniate/portal-sdk";
import type { Connection } from "@cogniate/portal-sdk";
import { ProviderErrorNotice } from "@cogniate/portal-sdk";
import steps from "./steps.ts";

/** The registration URL step of a pending Dynamic Registration connection (LA-E3-16): the shell's URL part and the expiry. */
export function CanvasRegistration({ connection, onChanged }: { connection: Connection; onChanged: (connection: Connection) => void }) {
  const alive = useAlive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function renew() {
    setBusy(true);
    setError(null);
    try {
      const updated = await renewRegistrationUrl(connection);
      if (alive.current) onChanged(updated);
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <div className="flex flex-col gap-5">
    <RegistrationUrl connection={connection} method={connection.method} busy={busy} onRenew={() => { void renew(); }} />
    {connection.registrationUrl && connection.registrationUrlExpiresAt
      && <p className="text-muted-foreground">{steps.dynamic.urlExpires.replace("{time}", new Date(connection.registrationUrlExpiresAt).toLocaleString())}</p>}
    <ProviderErrorNotice error={error} />
  </div>;
}
