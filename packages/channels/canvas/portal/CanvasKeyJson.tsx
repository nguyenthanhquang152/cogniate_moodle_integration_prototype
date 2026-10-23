import { useState } from "react";
import type { Connection } from "@cogniate/portal-sdk";
import { CanvasConfiguration } from "./CanvasConfiguration.tsx";

/**
 * The key JSON of a registered or connected Canvas connection (A2 BD-A2-101): a closed "Key JSON" section with the
 * same configuration part as setup step 2. It loads only when it is open, because each load is an export that the app
 * records as the connection's artifact key (LA-E6-05; a page view must not change it).
 */
export function CanvasKeyJson({ connection }: { connection: Connection }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-[9px] border border-border p-4" open={open} data-canvas-key-json="">
    <summary onClick={(event) => { event.preventDefault(); setOpen(!open); }}>Key JSON</summary>
    {open && <div className="mt-4 flex flex-col gap-5"><CanvasConfiguration id={connection.id} /></div>}
  </details>;
}
