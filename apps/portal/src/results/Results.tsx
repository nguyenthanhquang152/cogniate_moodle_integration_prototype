import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { ApiError, api, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import type {
  CourseVersion,
  Publication,
  ResultRow,
  ScoreSync,
} from "../types.ts";
import { Empty, ErrorNotice, Loading, formatName } from "../ui.tsx";

const outcomeNames: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
};
const syncNames: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  conflict: "Conflict",
};
export function syncError(error: ScoreSync["lastError"]): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  // Never insert server text as markup; keep unknown structured errors visible as plain text.
  return typeof error.description === "string"
    ? error.description
    : typeof error.message === "string"
      ? error.message
      : JSON.stringify(error);
}
export function Results() {
  const { publicationId = "" } = useParams();
  const publication = useApi<Publication>(
    `/publications/${idPath(publicationId)}`,
  );
  const results = useApi<{ rows: ResultRow[] }>(
    `/publications/${idPath(publicationId)}/results`,
    5000,
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [refreshed, setRefreshed] = useState<Map<string, ResultRow>>(new Map());
  const unavailable =
    results.error instanceof ApiError &&
    [404, 501, 503].includes(results.error.status);
  async function refresh() {
    setBusy("refresh");
    setError(null);
    setMessage("");
    try {
      const response = await api<{ rows: ResultRow[] }>(
        `/publications/${idPath(publicationId)}/results/refresh`,
        { method: "POST" },
      );
      results.setData(response);
      setRefreshed(new Map(response.rows.map((row) => [rowKey(row), row])));
      setMessage("Gradebook values refreshed from Moodle.");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  }
  async function resend(sync: ScoreSync) {
    setBusy(sync.id);
    setError(null);
    setMessage("");
    try {
      await api(`/score-syncs/${idPath(sync.id)}/resend`, { method: "POST" });
      results.setData(
        (current) =>
          current && {
            rows: current.rows.map((row) => ({
              ...row,
              scoreSyncs: row.scoreSyncs.map((s) =>
                s.id === sync.id
                  ? { ...s, status: "pending", tries: 0, lastError: null }
                  : s,
              ),
            })),
          },
      );
      setMessage(
        "Pending. The score will be sent again. Status updates every 5 seconds.",
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Link
        className="back-link"
        to={
          publication.data
            ? `/libraries/courses/${publication.data.courseId}`
            : "/libraries/courses"
        }
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Course
      </Link>
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">MOODLE PUBLICATION</p>
          <h1 tabIndex={-1}>Results</h1>
          {publication.data && (
            <p>
              {publication.data.courseTitle} ·{" "}
              {formatName(publication.data.format)} · Version{" "}
              {publication.data.version}
            </p>
          )}
        </div>
        <button
          className="button secondary"
          disabled={!!busy || !results.data}
          onClick={() => {
            void refresh();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy === "refresh" ? "Refreshing…" : "Refresh from Moodle"}
        </button>
      </div>
      {publication.data && <PackageTitle publication={publication.data} />}
      <ErrorNotice error={publication.error} />
      <ErrorNotice error={error} />
      <p className="sr-only" role="status">
        {message}
      </p>
      {unavailable ? (
        <Empty>
          <h2>Results are not available yet</h2>
          <p>
            The results service is not ready. Your course and publications are
            saved.
          </p>
          <button className="button secondary" onClick={results.reload}>
            Try again
          </button>
        </Empty>
      ) : (
        <ErrorNotice error={results.error} />
      )}
      {!results.data && !results.error && <Loading />}
      {results.data?.rows.length === 0 && (
        <Empty>
          <h2>No learner results yet</h2>
          <p>Results appear after a learner opens this course from Moodle.</p>
        </Empty>
      )}
      {!!results.data?.rows.length && (
        <section className="panel results-panel">
          <div className="table-scroll">
            <table className="results-table">
              <caption>
                Learner results · Status updates every 5 seconds.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Best outcome</th>
                  <th scope="col">Moodle sync</th>
                  <th scope="col">Gradebook</th>
                  <th scope="col">History and actions</th>
                </tr>
              </thead>
              <tbody>
                {results.data.rows.map((row) => {
                  const cached = refreshed.get(rowKey(row));
                  const displayed = row.gradebook
                    ? row
                    : cached?.gradebook
                      ? {
                          ...row,
                          gradebook: cached.gradebook,
                          gradebookDiffers: gradeDiffers(row, cached.gradebook),
                        }
                      : row;
                  return (
                    <ResultTableRow
                      row={displayed}
                      key={rowKey(row)}
                      busy={!!busy}
                      onResend={(sync) => {
                        void resend(sync);
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
function rowKey(row: ResultRow): string {
  return `${row.activity.resourceLinkId}:${row.learner.sub}:${row.preview}`;
}
function gradeDiffers(
  row: ResultRow,
  grade: NonNullable<ResultRow["gradebook"]>,
): boolean {
  return (
    row.scoreSyncs.at(-1)?.status === "sent" &&
    row.best?.scoreGiven !== null &&
    !!row.best?.scoreMaximum &&
    grade.resultMaximum > 0 &&
    Math.abs(
      grade.resultScore / grade.resultMaximum -
        row.best!.scoreGiven! / row.best!.scoreMaximum!,
    ) > 0.000001
  );
}
export function ResultTableRow({
  row,
  busy,
  onResend,
}: {
  row: ResultRow;
  busy: boolean;
  onResend: (sync: ScoreSync) => void;
}) {
  const latest = row.scoreSyncs.at(-1);
  const resendable =
    latest && (latest.status === "failed" || latest.status === "conflict");
  return (
    <tr>
      <th scope="row">
        {row.learner.label}
        {row.preview && <span className="badge">Preview</span>}
      </th>
      <td>
        {row.activity.title}
        <small>{row.activity.contextTitle}</small>
      </td>
      <td>
        {row.best ? (
          <>
            <strong>
              {outcomeNames[row.best.outcome] ?? row.best.outcome}
              {row.best.scoreGiven !== null ? ` ${row.best.scoreGiven}` : ""}
            </strong>
            {row.best.scoreMaximum !== null && (
              <small>Out of {row.best.scoreMaximum}</small>
            )}
          </>
        ) : (
          "No outcome yet"
        )}
      </td>
      <td>
        <span
          className={`badge ${latest?.status === "sent" ? "success" : latest?.status === "failed" || latest?.status === "conflict" ? "warning" : ""}`}
        >
          {latest ? (syncNames[latest.status] ?? latest.status) : "Not sent"}
        </span>
        {latest?.status === "conflict" && (
          <p className="sync-message">Moodle has a grade with a newer time</p>
        )}
        {latest?.lastError && (
          <p className="sync-message">{syncError(latest.lastError)}</p>
        )}
      </td>
      <td>
        {row.gradebook
          ? `${row.gradebook.resultScore} / ${row.gradebook.resultMaximum}`
          : "Not refreshed"}
        {row.gradebookDiffers && (
          <p className="sync-message">
            Moodle keeps another grade, for example a teacher override
          </p>
        )}
      </td>
      <td>
        {resendable && (
          <button
            className="button secondary compact"
            title="Send again"
            disabled={busy}
            onClick={() => onResend(latest)}
          >
            Resend
          </button>
        )}
        <details className="sync-history">
          <summary>Sync history ({row.scoreSyncs.length})</summary>
          {row.scoreSyncs.length ? (
            <ol>
              {row.scoreSyncs.map((sync) => (
                <li key={sync.id}>
                  <strong>{syncNames[sync.status] ?? sync.status}</strong> ·{" "}
                  {sync.scoreGiven} / {sync.scoreMaximum}
                  <small>
                    {new Date(sync.createdAt).toLocaleString()} · {sync.tries}{" "}
                    tries
                  </small>
                  {sync.lastError && <p>{syncError(sync.lastError)}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>No score sync yet.</p>
          )}
        </details>
        <details className="sync-history">
          <summary>Attempts ({row.attempts.length})</summary>
          <ol>
            {row.attempts.map((attempt) => (
              <li key={attempt.attemptId}>
                {outcomeNames[attempt.outcome] ?? attempt.outcome}
                {attempt.scoreGiven !== null
                  ? ` · ${attempt.scoreGiven} / ${attempt.scoreMaximum}`
                  : ""}
                <small>{new Date(attempt.updatedAt).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        </details>
      </td>
    </tr>
  );
}

function PackageTitle({ publication }: { publication: Publication }) {
  const { data } = useApi<CourseVersion>(
    `/courses/${idPath(publication.courseId)}/versions/${idPath(publication.versionId)}`,
  );
  return data?.report?.scorm?.title ? (
    <p className="manifest-title muted">Package: {data.report.scorm.title}</p>
  ) : null;
}
