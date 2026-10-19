import { MoodleCourse } from "./MoodleCourse.tsx";
import { Badge } from "../ui/badge.tsx";
import { buttonVariants, Button } from "../ui/button.tsx";
import { Card } from "../ui/card.tsx";
import { useState } from "react";
import { Link } from "react-router";
import { api, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Connection, Publication } from "../types.ts";
import { ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";

export function Publications({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged: () => void;
}) {
  const { library } = useSession();
  const pubState = useApi<{ publications: Publication[] }>(
    `/publications?courseId=${idPath(courseId)}`,
  );
  const connectionState = useApi<{ connections: Connection[] }>("/connections");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<Publication | null>(
    null,
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
      onChanged();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Card className="[&_h2]:mb-[18px]">
        <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
          LMS PUBLISHING
        </p>
        <h2>Moodle publications</h2>
        <ErrorNotice error={pubState.error} />
        <ErrorNotice error={actionError} />
        <ErrorNotice error={connectionState.error} />
        {!pubState.data && !pubState.error && <Loading />}
        {pubState.data?.publications.length === 0 && (
          <p className="text-muted-foreground">
            This course is not published yet. Select Publish to Moodle to make
            it available.
          </p>
        )}
        {pubState.data?.publications.map((publication) => (
          <article
            className="flex flex-col items-start gap-3.5 border-t border-border py-[22px] last:pb-0"
            key={publication.id}
          >
            <h3>
              {connectionState.data?.connections.find(
                (c) => c.id === publication.connectionId,
              )?.name ?? "Moodle"}
            </h3>
            <Badge
              variant={
                publication.status === "available" ? "success" : "default"
              }
            >
              {publication.status === "available"
                ? "Available in Moodle"
                : "Withdrawn"}
            </Badge>
            <p className="text-muted-foreground">
              Version {publication.version} · {formatName(publication.format)}
            </p>
            {publication.status === "available" && (
              <p className="text-[12px] text-[#cbb9e0]">
                Teachers: Edit mode → Add content → Activity or resource →
                Cogniate ({library.name}) → Add → Select content
              </p>
            )}
            <MoodleCourse publication={publication} />
            <dl className="publication-stats m-0 flex gap-[25px] [&_dd]:text-[22px]">
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
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                to={`/publications/${publication.id}/results`}
              >
                Results
              </Link>
              {publication.status === "available" ? (
                <Button
                  variant="link"
                  onClick={() => setConfirmWithdraw(publication)}
                >
                  Withdraw
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === publication.id}
                  onClick={() => {
                    void republish(publication);
                  }}
                >
                  Re-publish
                </Button>
              )}
            </div>
          </article>
        ))}
      </Card>
      {confirmWithdraw && (
        <Modal
          title="Withdraw this course?"
          onClose={() => setConfirmWithdraw(null)}
        >
          <p>
            Teachers cannot select this course. Existing Moodle activities
            cannot open it until you re-publish.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="destructive"
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
                  onChanged();
                } catch (reason) {
                  setActionError(reason);
                } finally {
                  setBusy(null);
                  setConfirmWithdraw(null);
                }
              }}
            >
              Withdraw
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmWithdraw(null)}
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
