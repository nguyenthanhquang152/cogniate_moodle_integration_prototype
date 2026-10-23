import { useEffect, useState } from "react";
import { canvasConfiguration } from "../../api.ts";
import type { CanvasConfigurationSnapshot } from "../../types.ts";
import { CopyButton, ErrorNotice, Loading } from "../../ui.tsx";
import { Button } from "../../ui/button.tsx";
import { ToolConfiguration } from "../ToolConfiguration.tsx";

export function CanvasConfiguration({ id }: { id: string }) {
  const [inline, setInline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string; snapshot?: CanvasConfigurationSnapshot; error?: unknown;
  }>();
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const key = `${id}:${inline}:${revision}`;
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    canvasConfiguration(id, inline, controller.signal).then(
      (snapshot) => { if (active) setResult({ key, snapshot }); },
      (error: unknown) => { if (active) setResult({ key, error }); },
    );
    return () => { active = false; controller.abort(); };
  }, [id, inline, key]);
  function download() {
    if (!current?.snapshot) return;
    setDownloadError(null);
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([current.snapshot.text], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "cogniate-canvas-lti.json";
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
    } catch (reason) {
      setDownloadError(reason);
    } finally {
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      }
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
