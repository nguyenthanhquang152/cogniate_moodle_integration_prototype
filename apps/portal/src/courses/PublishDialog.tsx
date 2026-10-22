import { useChannels } from "../channels/context.tsx";
import { createPortalSdk } from "../sdk/index.ts";
import { useNavigate } from "react-router";
import { Select } from "../ui/input.tsx";
import { buttonVariants, Button } from "../ui/button.tsx";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Connection, Course, Publication } from "../types.ts";
import { ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";
import { lmsNames } from "../lms.ts";

export function PublishDialog({
  course,
  onClose,
  onPublished,
}: {
  course: Course;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { modules } = useChannels();
  const sdk = createPortalSdk(useNavigate());
  const { data, error: loadError } = useApi<{ connections: Connection[] }>(
    "/connections",
  );
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<Publication | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [createCourse, setCreateCourse] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready =
    data?.connections.filter(
      (connection) =>
        connection.status === "registered" || connection.status === "connected",
    ) ?? [];
  const connection = ready.find((item) => item.id === connectionId);
  const canCreateCourse = connection?.capabilities.courseShell && !!connection.webServices;
  const versions = course.versions ?? [];
  const [versionId, setVersionId] = useState(versions.at(-1)?.id ?? "");
  const selectedVersion = versions.find((version) => version.id === versionId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const publication = await api<Publication>("/publications", {
        method: "POST",
        body: {
          courseId: course.id,
          connectionId: form.get("connectionId"),
          versionId: form.get("versionId"),
          ...(canCreateCourse && createCourse
            ? { createMoodleCourse: {} }
            : {}),
        },
      });
      if (canCreateCourse && createCourse) setResult(publication);
      else onPublished();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <Modal title={`Published to ${lmsNames[result.lms]}`} onClose={onPublished}>
        <div role="status">
          <p>This course is available in the {lmsNames[result.lms]} content picker.</p>
        </div>
        {modules.get(result.lms)?.publicationPanels?.map((Panel, index) => <Panel key={index} publication={result} onChanged={onPublished} sdk={sdk} />)}
        <Button variant="primary" onClick={onPublished} autoFocus>Done</Button>
      </Modal>
    );
  return (
    <Modal title="Publish to an LMS" onClose={onClose}>
      <p className="text-muted-foreground">
        Make this course available in the LMS content picker.
      </p>
      <p className="font-semibold wrap-anywhere">{course.title}</p>
      <ErrorNotice error={loadError} />
      {!data && !loadError && <Loading />}
      {data && ready.length === 0 ? (
        <div className="flex flex-col gap-5">
          <p>No LMS connection is ready. Connect an LMS first.</p>
          <Link
            to="/integrations"
            className={buttonVariants({ variant: "primary", size: "default" })}
          >
            Connect an LMS
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <label>
            <span id="publish-connection-label">LMS connection</span>
            <Select
              name="connectionId"
              value={connectionId}
              disabled={busy}
              onChange={(event) => {
                setConnectionId(event.target.value);
                setCreateCourse(false);
              }}
              aria-labelledby="publish-connection-label"
              required
              autoFocus
            >
              <option value="">Choose a connection</option>
              {ready.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name} ({lmsNames[connection.lms]}, {new URL(connection.siteUrl).host})
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span id="publish-version-label">Version</span>
            <Select
              name="versionId"
              aria-labelledby="publish-version-label"
              required
              value={versionId}
              disabled={busy}
              onChange={(event) => setVersionId(event.target.value)}
            >
              {[...versions].reverse().map((version) => (
                <option key={version.id} value={version.id}>
                  Version {version.version} · {formatName(version.format)}
                </option>
              ))}
            </Select>
          </label>
          {canCreateCourse && (
            <label className="flex flex-row items-center gap-3">
              <input
                type="checkbox"
                className="size-[17px] shrink-0 accent-[#b78bf9]"
                checked={createCourse}
                disabled={busy}
                onChange={(event) => setCreateCourse(event.target.checked)}
              />
              Also create an empty {connection ? lmsNames[connection.lms] : "LMS"} course
            </label>
          )}
          {selectedVersion?.report?.scorm?.title && (
            <p className="wrap-anywhere">
              Package: {selectedVersion.report.scorm.title}
            </p>
          )}
          {versions.length === 0 && <p>Upload a package before you publish.</p>}
          <ErrorNotice error={error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={busy || ready.length === 0 || versions.length === 0}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
