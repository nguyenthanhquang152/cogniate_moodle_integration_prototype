import { useState } from "react";
import type { FormEvent } from "react";
import { api, idPath } from "@cogniate/portal-sdk";
import type { Connection } from "@cogniate/portal-sdk";
import { ErrorNotice } from "@cogniate/portal-sdk";
import { Button } from "@cogniate/portal-sdk";
import { Card } from "@cogniate/portal-sdk";
import { Input } from "@cogniate/portal-sdk";
import { Notice } from "@cogniate/portal-sdk";

export function WebServices({
  connection,
  onSaved,
}: {
  connection: Connection;
  onSaved: () => void;
}) {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState<Connection["webServices"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const details = saved ?? connection.webServices;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ siteName: string; release: string; functions: string[] }>(
        `/connections/${idPath(connection.id)}/web-services`,
        { method: "PUT", body: { token } },
      );
      setSaved({ siteName: response.siteName, release: response.release });
      setToken("");
      onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-5">
      <h2>Moodle web services (optional)</h2>
      <p className="text-muted-foreground">
        Save a Moodle web services token to create an empty course when you publish.
      </p>
      <div role="status" aria-live="polite">
        {details && (
          <Notice>
            <p>Site: {details.siteName}</p>
            <p>Moodle release: {details.release}</p>
          </Notice>
        )}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label>
          Web services token
          <Input
            type="password"
            autoComplete="off"
            required
            value={token}
            disabled={busy}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <ErrorNotice error={error} />
        <div>
          <Button variant="secondary" disabled={busy || !token.trim()}>
            {busy ? "Checking token…" : "Save web services token"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
