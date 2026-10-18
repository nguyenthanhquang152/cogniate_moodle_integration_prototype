import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  FileArchive,
  Plus,
  Upload,
} from "lucide-react";
import { api, idPath, uploadPackage } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type {
  Connection,
  Course,
  CourseVersion,
  Publication,
} from "../types.ts";
import { Empty, ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";
import { PublishDialog } from "./PublishDialog.tsx";

export function Courses() {
  const { data, error, reload } = useApi<{ courses: Course[] }>("/courses");
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">YOUR LIBRARY</p>
          <h1 tabIndex={-1}>Courses</h1>
          <p>Upload a course. Publish it to your connected Moodle sites.</p>
        </div>
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={17} aria-hidden="true" />
          New course
        </button>
      </div>
      <ErrorNotice error={error} />
      {error ? (
        <button className="text-button" onClick={reload}>
          Try again
        </button>
      ) : (
        !data && <Loading />
      )}
      {data &&
        (data.courses.length === 0 ? (
          <Empty>
            <BookOpen size={32} aria-hidden="true" />
            <h2>Your library starts here</h2>
            <p>Create a course, then upload a SCORM or HTML zip.</p>
            <button className="button primary" onClick={() => setCreate(true)}>
              New course
            </button>
          </Empty>
        ) : (
          <div className="course-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <article className="panel course-card" key={course.id}>
                <div className="course-art" aria-hidden="true">
                  <FileArchive size={38} />
                </div>
                <div className="stack">
                  <div className="actions">
                    <span className="badge">
                      {course.latestVersion
                        ? formatName(course.latestVersion.format)
                        : "No package"}
                    </span>
                    {course.latestVersion && (
                      <span className="muted">
                        Version {course.latestVersion.version}
                      </span>
                    )}
                  </div>
                  <h2>
                    <Link to={`/libraries/courses/${course.id}`}>
                      {course.title}
                    </Link>
                  </h2>
                  {course.summary && <p className="muted">{course.summary}</p>}
                  <p className="fine-print">
                    {
                      course.publications.filter(
                        (p) => p.status === "available",
                      ).length
                    }{" "}
                    Moodle publications
                  </p>
                  <Link
                    className="quiet-link"
                    to={`/libraries/courses/${course.id}`}
                  >
                    Manage course <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ))}
      {create && (
        <Modal title="New course" onClose={() => setCreate(false)}>
          <NewCourse
            onCreated={(id) => navigate(`/libraries/courses/${id}`)}
            onCancel={() => setCreate(false)}
          />
        </Modal>
      )}
    </>
  );
}
export function NewCourse({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const course = await api<Course>("/courses", {
        method: "POST",
        body: {
          title: String(data.get("title")).trim(),
          summary: String(data.get("summary")).trim(),
        },
      });
      onCreated(course.id);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Course title
        <input name="title" required maxLength={200} autoFocus />
      </label>
      <label>
        Summary (optional)
        <textarea name="summary" rows={3} maxLength={2000} />
      </label>
      <ErrorNotice error={error} />
      <div className="actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Creating…" : "Create course"}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function CourseDetail({ publish = false }: { publish?: boolean }) {
  const { courseId = "" } = useParams();
  const { library } = useSession();
  const courseState = useApi<Course>(`/courses/${idPath(courseId)}`);
  const pubState = useApi<{ publications: Publication[] }>(
    `/publications?courseId=${idPath(courseId)}`,
  );
  const connectionState = useApi<{ connections: Connection[] }>("/connections");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<Publication | null>(
    null,
  );
  const navigate = useNavigate();
  const course = courseState.data;
  const versions = course?.versions ?? [];
  const version =
    versions.find((v) => v.id === selectedVersion) ?? versions.at(-1);
  const coursePath = `/libraries/courses/${idPath(courseId)}`;
  if (!course)
    return (
      <>
        <ErrorNotice error={courseState.error} />
        {!courseState.error && <Loading />}
      </>
    );
  async function republish(publication: Publication) {
    setBusy(publication.id);
    setActionError(null);
    try {
      await api("/publications", {
        method: "POST",
        body: {
          connectionId: publication.connectionId,
          courseId,
          versionId: publication.versionId,
        },
      });
      pubState.reload();
      courseState.reload();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Link className="back-link" to="/libraries/courses">
        <ArrowLeft size={16} aria-hidden="true" />
        Courses
      </Link>
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">COURSE DETAILS</p>
          <h1 tabIndex={-1}>{course.title}</h1>
          {course.summary && <p>{course.summary}</p>}
        </div>
        {version && (
          <Link
            id="publish-opener"
            className="button primary"
            to={`${coursePath}/publish`}
          >
            Publish to Moodle
            <ArrowUpRightIcon />
          </Link>
        )}
      </div>
      <ErrorNotice error={courseState.error} />
      <ErrorNotice error={actionError} />
      <div className="course-detail-grid">
        <div className="stack">
          <section className="panel stack">
            <div className="section-heading">
              <h2>Course package</h2>
              {versions.length > 0 && (
                <label className="inline-label">
                  Version
                  <select
                    aria-label="Course version"
                    value={version?.id}
                    onChange={(event) => setSelectedVersion(event.target.value)}
                  >
                    {[...versions].reverse().map((v) => (
                      <option value={v.id} key={v.id}>
                        Version {v.version} · {formatName(v.format)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {version ? (
              <InspectorReport version={version} />
            ) : (
              <p className="muted">
                Upload a package to add the first version.
              </p>
            )}
            {version?.format === "scorm12" && (
              <div className="download-box">
                <a
                  className="button secondary"
                  href={`/app-api/courses/${idPath(courseId)}/versions/${idPath(version.id)}/download?kind=original`}
                  download
                >
                  <Download size={16} aria-hidden="true" />
                  Download SCORM package
                </a>
                <p className="muted">
                  In Moodle: Add an activity → SCORM package
                </p>
              </div>
            )}
          </section>
          <UploadForm
            key={courseId}
            courseId={courseId}
            onUploaded={(v) => {
              setSelectedVersion(v.id);
              courseState.reload();
            }}
          />
        </div>
        <section className="panel publications-panel">
          <p className="eyebrow">LMS PUBLISHING</p>
          <h2>Moodle publications</h2>
          <ErrorNotice error={pubState.error} />
          <ErrorNotice error={connectionState.error} />
          {!pubState.data && !pubState.error && <Loading />}
          {pubState.data?.publications.length === 0 && (
            <p className="muted">
              This course is not published yet. Select Publish to Moodle to make
              it available.
            </p>
          )}
          {pubState.data?.publications.map((publication) => (
            <article className="publication" key={publication.id}>
              <h3>
                {connectionState.data?.connections.find(
                  (c) => c.id === publication.connectionId,
                )?.name ?? "Moodle"}
              </h3>
              <span
                className={`badge ${publication.status === "available" ? "success" : ""}`}
              >
                {publication.status === "available"
                  ? "Available in Moodle"
                  : "Withdrawn"}
              </span>
              <p className="muted">
                Version {publication.version} · {formatName(publication.format)}
              </p>
              {publication.status === "available" && (
                <p className="teacher-help">
                  Teachers: Add an activity &gt; Cogniate ({library.name}) &gt;
                  Select content
                </p>
              )}
              <dl className="publication-stats">
                <div>
                  <dt>Selected in Moodle</dt>
                  <dd>{publication.stats.activities}</dd>
                </div>
                <div>
                  <dt>
                    {publication.stats.learners > 0 ? "In use" : "Learners"}
                  </dt>
                  <dd>{publication.stats.learners}</dd>
                </div>
              </dl>
              <div className="actions">
                <Link
                  className="button secondary compact"
                  to={`/publications/${publication.id}/results`}
                >
                  Results
                </Link>
                {publication.status === "available" ? (
                  <button
                    className="text-button"
                    onClick={() => setConfirmWithdraw(publication)}
                  >
                    Withdraw
                  </button>
                ) : (
                  <button
                    disabled={busy === publication.id}
                    className="button secondary compact"
                    onClick={() => {
                      void republish(publication);
                    }}
                  >
                    Re-publish
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
      {publish && (
        <PublishDialog
          course={course}
          onClose={() =>
            navigate(coursePath, {
              replace: true,
              state: { focus: "publish-opener" },
            })
          }
          onPublished={() => {
            pubState.reload();
            courseState.reload();
            navigate(coursePath, {
              replace: true,
              state: { focus: "publish-opener" },
            });
          }}
        />
      )}
      {confirmWithdraw && (
        <Modal
          title="Withdraw this course?"
          onClose={() => setConfirmWithdraw(null)}
        >
          <p>
            Teachers cannot select this course. Existing Moodle activities
            cannot open it until you re-publish.
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={!!busy}
              onClick={async () => {
                setBusy(confirmWithdraw.id);
                setActionError(null);
                try {
                  await api(
                    `/publications/${idPath(confirmWithdraw.id)}/withdraw`,
                    { method: "POST" },
                  );
                  pubState.reload();
                  courseState.reload();
                } catch (reason) {
                  setActionError(reason);
                } finally {
                  setBusy(null);
                  setConfirmWithdraw(null);
                }
              }}
            >
              Withdraw
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirmWithdraw(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} aria-hidden="true" />;
}
export function InspectorReport({ version }: { version: CourseVersion }) {
  const { report, trackingProfile: profile } = version;
  return (
    <div className="stack">
      <div className="actions">
        <span className="badge">{formatName(version.format)}</span>
        <span className="badge success">Package accepted</span>
      </div>
      {report.scorm?.title && (
        <p className="manifest-title">{report.scorm.title}</p>
      )}
      <dl className="report-grid">
        <div>
          <dt>Entry page</dt>
          <dd>{report.entryPath}</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>{report.fileCount}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{profile.pages.length}</dd>
        </div>
        <div>
          <dt>Questions</dt>
          <dd>{profile.questionIds.length}</dd>
        </div>
      </dl>
      <p className="mastery">
        {profile.masteryScore === null
          ? "No mastery score"
          : `Mastery score ${profile.masteryScore}`}
      </p>
      <details>
        <summary>Pages and questions</summary>
        <p>Pages: {profile.pages.join(", ") || "None"}</p>
        <p>Questions: {profile.questionIds.join(", ") || "None"}</p>
      </details>
      {report.externalHosts.length > 0 && (
        <div className="notice warning">
          <strong>External hosts warning</strong>
          <p>
            This package loads files from external hosts. Those files may be
            unavailable.
          </p>
          <ul>
            {report.externalHosts.map((host) => (
              <li key={host}>{host}</li>
            ))}
          </ul>
        </div>
      )}
      {report.warnings
        .filter((w) => w.code !== "EXTERNAL_ASSETS")
        .map((warning) => (
          <p className="notice warning" key={warning.code}>
            {warning.detail}
          </p>
        ))}
    </div>
  );
}
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
    <section className="panel stack">
      <h2>Upload a new version</h2>
      <p className="muted">
        Use a SCORM 1.2 or HTML zip. Each accepted upload adds a version.
      </p>
      <form className="stack" onSubmit={submit}>
        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy) selectFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          <Upload size={26} aria-hidden="true" />
          <label htmlFor="package">Drop a zip here, or choose a file</label>
          <input
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
          <input
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
          <div className="upload-progress">
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
        <button className="button primary self-start" disabled={busy}>
          <Upload size={16} aria-hidden="true" />
          {busy ? "Uploading…" : "Upload package"}
        </button>
      </form>
    </section>
  );
}
