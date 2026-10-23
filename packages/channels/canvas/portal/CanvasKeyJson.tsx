import { useState } from "react";
import { configurationSnapshot, idPath, useAlive } from "@cogniate/portal-sdk";
import type { ConfigurationSnapshot, Connection } from "@cogniate/portal-sdk";
import { Button, ErrorNotice } from "@cogniate/portal-sdk";
import { downloadJson } from "./download-json.ts";

type Taken = { action: "copy" | "download"; snapshot: ConfigurationSnapshot; inline: boolean; copied: boolean };

/**
 * The key JSON of a registered or connected Canvas connection (A2 BD-A2-101, BD-A2-102): a closed "Key JSON" section.
 * Opening it or switching the key form fetches nothing. The JSON is fetched only by "Copy JSON" or "Download JSON",
 * because each fetch is an export that the app records as the connection's artifact key (LA-E6-05): only an artifact
 * that the admin takes may change the stale-key warning.
 */
export function CanvasKeyJson({ connection }: { connection: Connection }) {
  const alive = useAlive();
  const [open, setOpen] = useState(false);
  const [inline, setInline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [taken, setTaken] = useState<Taken | null>(null);
  async function take(action: Taken["action"]) {
    setBusy(true);
    setError(null);
    setTaken(null);
    try {
      const snapshot = await configurationSnapshot(`/connections/${idPath(connection.id)}/canvas-configuration`, inline);
      if (!alive.current) return;
      let copied = false;
      if (action === "download") downloadJson(snapshot.text);
      else {
        try {
          await navigator.clipboard.writeText(snapshot.text);
          copied = true;
        } catch {
          // The text box below lets the admin copy it.
        }
      }
      if (alive.current) setTaken({ action, snapshot, inline, copied });
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <details className="rounded-[9px] border border-border p-4" open={open} data-canvas-key-json="">
    <summary onClick={(event) => { event.preventDefault(); setOpen(!open); }}>Key JSON</summary>
    {open && <div className="mt-4 flex flex-col gap-5">
      <p className="text-muted-foreground">Cogniate makes the JSON when you select Copy JSON or Download JSON.</p>
      <label className="flex flex-row items-center gap-3">
        <input type="checkbox" checked={inline} disabled={busy} onChange={(event) => { setInline(event.target.checked); setTaken(null); }} />
        Put a copy of the current public key in the JSON
      </label>
      {inline && <p>Use this only when Canvas cannot reach Cogniate. If the Cogniate key changes, you must paste a new JSON in Canvas.</p>}
      <div className="flex flex-wrap items-start gap-3">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => { void take("copy"); }}>Copy JSON</Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => { void take("download"); }}>Download JSON</Button>
      </div>
      <span className="text-[11px] text-[#cbb7e6] empty:hidden" role="status">
        {busy ? "Making the JSON…" : taken?.action === "copy" ? taken.copied ? "Copied" : "Copy failed. Select the JSON and copy it." : ""}
      </span>
      {taken?.action === "copy" && !taken.copied && <textarea aria-label="Copy JSON manually" readOnly value={taken.snapshot.text}
        className="w-full min-w-[220px] rounded border border-border bg-background p-2 font-mono text-xs" onFocus={(event) => event.target.select()} />}
      {taken?.inline && taken.snapshot.keyId && <p>Key id in this JSON: {taken.snapshot.keyId}</p>}
      <ErrorNotice error={error} />
    </div>}
  </details>;
}
