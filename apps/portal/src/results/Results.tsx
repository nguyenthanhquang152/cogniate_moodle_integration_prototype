import { Badge } from "../ui/badge.tsx";
import { Card } from "../ui/card.tsx";
import { Button } from "../ui/button.tsx";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api, idPath } from "../api.ts";
import { useAlive, useApi } from "../hooks.ts";
import { lmsNames } from "../lms.ts";
import type {
  CourseVersion,
  Publication,
  ResultRow,
  ScoreSync,
  Lms,
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
  superseded: "Superseded",
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
  return <ResultsView key={publicationId} publicationId={publicationId} />;
}
function ResultsView({ publicationId }: { publicationId: string }) {
  const alive = useAlive();
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
  const lmsName = publication.data ? lmsNames[publication.data.lms] ?? "LMS" : "LMS";
  async function refresh() {
    setBusy("refresh");
    setError(null);
    setMessage("");
    try {
      const response = await api<{ rows: ResultRow[] }>(
        `/publications/${idPath(publicationId)}/results/refresh`,
        { method: "POST" },
      );
      if (!alive.current) return;
      results.setData(response);
      setMessage(`Gradebook values refreshed from ${lmsName}.`);
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(null);
    }
  }
  async function resend(sync: ScoreSync) {
    setBusy(sync.id);
    setError(null);
    setMessage("");
    try {
      const updated = await api<ScoreSync>(
        `/score-syncs/${idPath(sync.id)}/resend`,
        { method: "POST" },
      );
      if (!alive.current) return;
      results.setData(
        (current) =>
          current && {
            rows: current.rows.map((row) => ({
              ...row,
              scoreSyncs: row.scoreSyncs.map((s) =>
                s.id === sync.id ? updated : s,
              ),
            })),
          },
      );
      setMessage(
        `${syncNames[updated.status] ?? updated.status}. Status updates every 5 seconds.`,
      );
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(null);
    }
  }
  return (
    <>
      <Link
        className="inline-flex items-center gap-2 text-[12px] text-[#c9bdd9] no-underline"
        to={
          publication.data
            ? `/libraries/courses/${publication.data.courseId}`
            : "/libraries/courses"
        }
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Course
      </Link>
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start mt-[26px] mb-[30px] [&_h1]:mt-[7px] [&_h1]:mb-2.5 [&_p:not(.eyebrow)]:text-muted-foreground">
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            {lmsName.toUpperCase()} PUBLICATION
          </p>
          <h1 tabIndex={-1}>Results</h1>
          {publication.data && (
            <p>
              {publication.data.courseTitle} ·{" "}
              {formatName(publication.data.format)} · Version{" "}
              {publication.data.version}
              {" · "}{publication.data.connectionName}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={!!busy || !results.data || !publication.data}
          onClick={() => {
            void refresh();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy === "refresh" ? "Refreshing…" : `Refresh from ${lmsName}`}
        </Button>
      </div>
      {publication.data && <PackageTitle publication={publication.data} />}
      <ErrorNotice error={publication.error} />
      <ErrorNotice error={error} />
      <p className="text-muted-foreground" role="status">
        {message}
      </p>
      <ErrorNotice error={results.error} />
      {!results.data && !results.error && <Loading />}
      {results.data?.rows.length === 0 && (
        <Empty>
          <h2>No learner results yet</h2>
          <p>Results appear after a learner opens this course from {lmsName}.</p>
        </Empty>
      )}
      {!!results.data?.rows.length && publication.data && (
        <Card spacing="results">
          <div className="overflow-x-auto">
            <table className="results-table min-w-[850px] [&_caption]:pl-3 [&_th]:max-w-[240px] [&_td]:max-w-[240px] [&_th]:wrap-anywhere [&_td]:wrap-anywhere">
              <caption>
                Learner results · Status updates every 5 seconds.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Best outcome</th>
                  <th scope="col">{lmsName} sync</th>
                  <th scope="col">Gradebook</th>
                  <th scope="col">History and actions</th>
                </tr>
              </thead>
              <tbody>
                {results.data.rows.map((row) => (
                  <ResultTableRow
                    row={row}
                    lms={publication.data?.lms ?? "moodle"}
                    key={rowKey(row)}
                    busy={!!busy}
                    onResend={(sync) => {
                      void resend(sync);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
function rowKey(row: ResultRow): string {
  return JSON.stringify([
    row.activity.resourceLinkId,
    row.learner.sub,
    row.preview,
  ]);
}
export function ResultTableRow({
  row,
  busy,
  onResend,
  lms = "moodle",
}: {
  row: ResultRow;
  busy: boolean;
  onResend: (sync: ScoreSync) => void;
  lms?: Lms;
}) {
  const lmsName = lmsNames[lms];
  const latest = row.scoreSyncs.at(-1);
  const resendable =
    latest && (latest.status === "failed" || latest.status === "conflict");
  return (
    <tr>
      <th scope="row">
        {row.learner.label}
        {row.preview && <Badge>Preview</Badge>}
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
        <Badge
          variant={
            latest?.status === "sent"
              ? "success"
              : latest?.status === "failed" || latest?.status === "conflict"
                ? "warning"
                : "default"
          }
        >
          {row.preview
            ? "Preview — no grade sent"
            : latest
              ? (syncNames[latest.status] ?? latest.status)
              : "Not sent"}
        </Badge>
        {latest?.status === "conflict" && (
          <p className="mt-2.5 max-w-[220px] text-[12px] text-[#eed3aa]">
            {lmsName} has a grade with a newer time
          </p>
        )}
        {latest?.lastError && (
          <p className="mt-2.5 max-w-[220px] text-[12px] text-[#eed3aa]">
            {syncError(latest.lastError)}
          </p>
        )}
      </td>
      <td>
        {row.gradebook
          ? row.gradebook.resultScore === null
            ? `No grade in ${lmsName}`
            : `${row.gradebook.resultScore} / ${row.gradebook.resultMaximum ?? "—"}`
          : row.preview
            ? "Not applicable"
            : "Not refreshed"}
        {row.gradebook && (
          <small>Read {new Date(row.gradebook.readAt).toLocaleString()}</small>
        )}
        {row.gradebookDiffers && (
          <p className="mt-2.5 max-w-[220px] text-[12px] text-[#eed3aa]">
            {lmsName} keeps another grade, for example a teacher override
          </p>
        )}
      </td>
      <td>
        {resendable && (
          <Button
            variant="secondary"
            size="sm"
            title="Send again"
            disabled={busy}
            onClick={() => onResend(latest)}
          >
            Resend
          </Button>
        )}
        <details className="mt-2.5 [&_ol]:pl-[17px] [&_li]:my-2.5">
          <summary>Sync history ({row.scoreSyncs.length})</summary>
          {row.scoreSyncs.length ? (
            <ol>
              {row.scoreSyncs.map((sync) => (
                <li key={sync.id}>
                  <strong>{syncNames[sync.status] ?? sync.status}</strong> ·{" "}
                  {sync.scoreGiven} / {sync.scoreMaximum}
                  <small>
                    {new Date(sync.createdAt).toLocaleString()} · {sync.tries}{" "}
                    {sync.tries === 1 ? "try" : "tries"}
                  </small>
                  {sync.sentAt && (
                    <small>Sent {new Date(sync.sentAt).toLocaleString()}</small>
                  )}
                  {sync.lastError && <p>{syncError(sync.lastError)}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>No score sync yet.</p>
          )}
        </details>
        <details className="mt-2.5 [&_ol]:pl-[17px] [&_li]:my-2.5">
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
    <p className="wrap-anywhere text-muted-foreground">
      Package: {data.report.scorm.title}
    </p>
  ) : null;
}
