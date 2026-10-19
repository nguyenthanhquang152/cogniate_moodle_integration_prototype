import { MoodleCourse } from "./MoodleCourse.tsx";
import { Select } from "../ui/input.tsx";
import { buttonVariants, Button } from "../ui/button.tsx";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Connection, Course, Publication } from "../types.ts";
import { ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";

export function PublishDialog({
  course,
  onClose,
  onPublished,
}: {
  course: Course;
  onClose: () => void;
  onPublished: () => void;
}) {
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
          ...(connection?.webServices && createCourse
            ? { createMoodleCourse: {} }
            : {}),
        },
      });
      if (connection?.webServices && createCourse) setResult(publication);
      else onPublished();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <Modal title="Published to Moodle" onClose={onPublished}>
        <div role="status">
          <p>This course is available in the Moodle content picker.</p>
        </div>
        <MoodleCourse publication={result} />
        <Button variant="primary" onClick={onPublished} autoFocus>Done</Button>
      </Modal>
    );
  return (
    <Modal title="Publish to Moodle" onClose={onClose}>
      <p className="text-muted-foreground">
        Make this course available in the Moodle content picker.
      </p>
      <p className="font-semibold wrap-anywhere">{course.title}</p>
      <ErrorNotice error={loadError} />
      {!data && !loadError && <Loading />}
      {data && ready.length === 0 ? (
        <div className="flex flex-col gap-5">
          <p>No Moodle connection is ready. Connect a site first.</p>
          <Link
            to="/integrations/moodle/connect"
            className={buttonVariants({ variant: "primary", size: "default" })}
          >
            Connect Moodle
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <label>
            <span id="publish-connection-label">Moodle connection</span>
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
                  {connection.name} · {connection.siteUrl}
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
          {connection?.webServices && (
            <label className="flex flex-row items-center gap-3">
              <input
                type="checkbox"
                className="size-[17px] shrink-0 accent-[#b78bf9]"
                checked={createCourse}
                disabled={busy}
                onChange={(event) => setCreateCourse(event.target.checked)}
              />
              Also create an empty Moodle course
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
