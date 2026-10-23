import { useEffect, useState } from "react";
import { configurationSnapshot, idPath } from "@cogniate/portal-sdk";
import type { ConfigurationSnapshot } from "@cogniate/portal-sdk";
import { CopyButton, ErrorNotice, Loading } from "@cogniate/portal-sdk";
import { Button } from "@cogniate/portal-sdk";
import { ToolConfiguration } from "@cogniate/portal-sdk";
import { downloadJson } from "./download-json.ts";

export function CanvasConfiguration({ id }: { id: string }) {
  const [inline, setInline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string; snapshot?: ConfigurationSnapshot; error?: unknown;
  }>();
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const key = `${id}:${inline}:${revision}`;
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    configurationSnapshot(`/connections/${idPath(id)}/canvas-configuration`, inline, controller.signal).then(
      (snapshot) => { if (active) setResult({ key, snapshot }); },
      (error: unknown) => { if (active) setResult({ key, error }); },
    );
    return () => { active = false; controller.abort(); };
  }, [id, inline, key]);
  function download() {
    if (!current?.snapshot) return;
    setDownloadError(null);
    try {
      downloadJson(current.snapshot.text);
    } catch (reason) {
      setDownloadError(reason);
    }
  }
  return <>
    <ToolConfiguration key={id} id={id} lmsName="Canvas" />
    <label className="flex flex-row items-center gap-3">
      <input type="checkbox" checked={inline} onChange={(event) => { setInline(event.target.checked); setDownloadError(null); }} />
      Put a copy of the current public key in the JSON
    </label>
    {inline && current?.snapshot && <p role="status">
      Use this only when Canvas cannot reach Cogniate. If the Cogniate key changes, you must paste a new JSON in Canvas. Key id: {current.snapshot.keyId}
    </p>}
    <ErrorNotice error={current?.error ?? downloadError} />
    {!current && <Loading text="Loading configuration…" />}
    <div className="flex flex-wrap items-start gap-3">
      {current?.snapshot
        ? <CopyButton key={key} label="JSON" text="Copy JSON" value={current.snapshot.text} />
        : <Button variant="secondary" size="sm" disabled>Copy JSON</Button>}
      <Button variant="secondary" size="sm" disabled={!current?.snapshot} onClick={download}>Download JSON</Button>
      {!!current?.error && <Button variant="link" onClick={() => setRevision((n) => n + 1)}>Reload configuration</Button>}
    </div>
  </>;
}
