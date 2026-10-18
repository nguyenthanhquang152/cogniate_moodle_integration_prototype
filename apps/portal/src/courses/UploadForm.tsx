import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Upload } from "lucide-react";
import { uploadPackage } from "../api.ts";
import type { CourseVersion } from "../types.ts";
import { ErrorNotice } from "../ui.tsx";

export function UploadForm({
  courseId,
  onUploaded,
}: {
  courseId: string;
  onUploaded: (version: CourseVersion) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mastery, setMastery] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState("");
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  function selectFile(next: File | null) {
    setError(null);
    setSuccess("");
    if (next && (!/\.zip$/i.test(next.name) || next.size > 200 * 1024 * 1024)) {
      setError(new Error("Choose a zip file no larger than 200 MB."));
      setFile(null);
      return;
    }
    setFile(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError(new Error("Choose a SCORM or HTML zip file."));
      input.current?.focus();
      return;
    }
    abort.current = new AbortController();
    setBusy(true);
    setProgress(0);
    setError(null);
    setSuccess("");
    try {
      const version = await uploadPackage(
        courseId,
        file,
        mastery,
        setProgress,
        abort.current.signal,
      );
      setSuccess(
        `Version ${version.version} uploaded. The package report is above.`,
      );
      setFile(null);
      if (input.current) input.current.value = "";
      onUploaded(version);
    } catch (reason) {
      if (!abort.current.signal.aborted) setError(reason);
    } finally {
      if (!abort.current.signal.aborted) setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-5">
      <h2>Upload a new version</h2>
      <p className="text-muted-foreground">
        Use a SCORM 1.2 or HTML zip. Each accepted upload adds a version.
      </p>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div
          className="flex flex-col items-center gap-3.5 rounded-[10px] border border-dashed border-[#766486] bg-[#b18ae809] px-[18px] py-[25px] [&>svg]:text-[#c7a1f7] [&_small]:text-muted-foreground [&_small]:[word-break:break-word]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy) selectFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          <Upload size={26} aria-hidden="true" />
          <label htmlFor="package">Drop a zip here, or choose a file</label>
          <Input
            id="package"
            name="package"
            type="file"
            accept=".zip,application/zip"
            ref={input}
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
          <small>
            {file
              ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
              : "Maximum 200 MB"}
          </small>
        </div>
        <label>
          Mastery score (HTML only, optional)
          <Input
            name="masteryScore"
            type="number"
            min={0}
            max={100}
            step="any"
            value={mastery}
            disabled={busy}
            onChange={(event) => setMastery(event.target.value)}
            aria-describedby="mastery-help"
          />
          <small id="mastery-help">
            Leave this blank for SCORM. SCORM uses the score in its manifest.
          </small>
        </label>
        {busy && (
          <div className="[&_progress]:h-3 [&_progress]:w-full [&_progress]:accent-[#b78bf9] [&_p]:mt-2 [&_p]:text-[12px] [&_p]:text-muted-foreground">
            <progress
              aria-label="Package upload"
              role="progressbar"
              max={100}
              value={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            />
            <p role="status">
              {progress < 100
                ? `Uploading… ${progress}%`
                : "Upload complete. Checking the package…"}
            </p>
          </div>
        )}
        <ErrorNotice error={error} />
        <p role="status">{success}</p>
        <Button variant="primary" className="self-start" disabled={busy}>
          <Upload size={16} aria-hidden="true" />
          {busy ? "Uploading…" : "Upload package"}
        </Button>
      </form>
    </Card>
  );
}
