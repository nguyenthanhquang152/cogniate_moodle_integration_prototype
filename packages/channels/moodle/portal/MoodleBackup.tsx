import { useEffect, useState } from "react";
import { Download } from "@cogniate/portal-sdk";
import { api, ApiError, idPath } from "@cogniate/portal-sdk";
import type { MbzBuild } from "@cogniate/portal-sdk";
import { ErrorNotice, Loading } from "@cogniate/portal-sdk";
import { Button, buttonVariants } from "@cogniate/portal-sdk";
import { Notice } from "@cogniate/portal-sdk";

export function MoodleBackup({
  courseId,
  versionId,
}: {
  courseId: string;
  versionId: string;
}) {
  const path = `/courses/${idPath(courseId)}/versions/${idPath(versionId)}/mbz`;
  const [build, setBuild] = useState<MbzBuild | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      let poll = false;
      try {
        const next = await api<MbzBuild>(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setBuild(next);
        setLoadError(null);
        poll = next.status === "queued" || next.status === "running";
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setBuild(null);
          setLoadError(null);
        } else {
          setLoadError(reason);
          poll = true;
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (poll)
            timer = setTimeout(() => {
              void load();
            }, 3000);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, revision]);
  const active = build?.status === "queued" || build?.status === "running";
  async function start() {
    setBusy(true);
    setError(null);
    try {
      setBuild(await api<MbzBuild>(path, { method: "POST" }));
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Moodle backup (.mbz) – Moodle only"
      className="flex flex-col gap-3 border-t border-border pt-5"
    >
      <h3>Moodle backup (.mbz) – Moodle only</h3>
      <div>
        <Button
          variant="secondary"
          disabled={loading || busy || active || !!loadError}
          onClick={() => { void start(); }}
        >
          {busy ? "Starting build…" : "Build Moodle backup (.mbz)"}
        </Button>
      </div>
      {loading && <Loading />}
      <ErrorNotice error={loadError} />
      <ErrorNotice error={error} />
      <div role="status" aria-live="polite" aria-atomic="true">
        {build && (
          <Notice variant={build.status === "failed" ? "error" : "default"}>
            <p>Build status: {build.status}</p>
            {build.step && <p>Step: {build.step}</p>}
            {build.status === "ready" && build.bytes !== null && (
              <p>
                Size: {(build.bytes / 1_000_000).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })} MB ({build.bytes.toLocaleString()} bytes)
              </p>
            )}
            {build.reason && <p>{build.reason}</p>}
          </Notice>
        )}
      </div>
      {build?.status === "ready" && build.downloadUrl && (
        <div>
          <a
            className={buttonVariants({ variant: "secondary", size: "default" })}
            href={build.downloadUrl}
            download
          >
            <Download size={16} aria-hidden="true" /> Download Moodle backup (.mbz)
          </a>
        </div>
      )}
      <div className="text-[12px] text-muted-foreground">
        <h3>Restore in MoodleCloud</h3>
        <ol className="mt-2 list-decimal pl-5 space-y-2">
          <li>Open Site administration &gt; Courses &gt; Restore course.</li>
          <li>Upload the .mbz file.</li>
          <li>Restore as a new course.</li>
          <li>The course arrives hidden. Check the course, then make it visible.</li>
        </ol>
      </div>
    </section>
  );
}
