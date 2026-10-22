import { Badge } from "../ui/badge.tsx";
import { buttonVariants, Button } from "../ui/button.tsx";
import { Card } from "../ui/card.tsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Publication } from "../types.ts";
import { ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";
import { lmsNames } from "../lms.ts";
import { useChannels } from "../channels/context.tsx";
import { channelText } from "../channels/registry.ts";
import { createPortalSdk } from "../sdk/index.ts";

export function Publications({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged: () => void;
}) {
  const { library } = useSession();
  const { modules } = useChannels();
  const sdk = createPortalSdk(useNavigate(), onChanged);
  const pubState = useApi<{ publications: Publication[] }>(
    `/publications?courseId=${idPath(courseId)}`,
  );
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
        <h2>LMS publications</h2>
        <ErrorNotice error={pubState.error} />
        <ErrorNotice error={actionError} />
        {!pubState.data && !pubState.error && <Loading />}
        {pubState.data?.publications.length === 0 && (
          <p className="text-muted-foreground">
            This course is not published yet. Select Publish to an LMS to make
            it available.
          </p>
        )}
        {pubState.data?.publications.map((publication) => (
          <article
            className="flex flex-col items-start gap-3.5 border-t border-border py-[22px] last:pb-0"
            key={publication.id}
          >
            <h3>
              {publication.connectionName}
            </h3>
            <Badge>{lmsNames[publication.lms]}</Badge>
            <Badge
              variant={
                publication.status === "available" ? "success" : "default"
              }
            >
              {publication.status === "available"
                ? `Available in ${lmsNames[publication.lms]}`
                : "Withdrawn"}
            </Badge>
            <p className="text-muted-foreground">
              Version {publication.version} · {formatName(publication.format)}
            </p>
            {publication.status === "available" && <TeacherSteps lms={publication.lms} libraryName={library.name} />}
            {modules.get(publication.lms)?.publicationPanels?.map((Panel, index) => <Panel key={index} publication={publication} onChanged={onChanged} sdk={sdk} />)}
            <dl className="publication-stats m-0 flex gap-[25px] [&_dd]:text-[22px]">
              <div>
                <dt>Selected in {lmsNames[publication.lms]}</dt>
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
            Teachers cannot select this course. Existing {lmsNames[confirmWithdraw.lms]} activities
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

function TeacherSteps({ lms, libraryName }: { lms: string; libraryName: string }) {
  const { registry, modules } = useChannels();
  const Teacher = modules.get(lms)?.TeacherSteps;
  if (Teacher) return <Teacher />;
  const manifest = registry.channel(lms);
  return manifest ? <ol>{manifest.texts.teacherSteps.map((step, index) => <li key={index}>{channelText(manifest, step, libraryName)}</li>)}</ol> : null;
}
