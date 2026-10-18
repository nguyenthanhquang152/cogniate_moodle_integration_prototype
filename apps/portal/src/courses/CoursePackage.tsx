import { Notice } from "../ui/notice.tsx";
import { Badge } from "../ui/badge.tsx";
import { buttonVariants } from "../ui/button.tsx";
import { Select } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { Download } from "lucide-react";
import { idPath } from "../api.ts";
import type { CourseVersion } from "../types.ts";
import { formatName } from "../ui.tsx";

export function CoursePackage({
  courseId,
  versions,
  version,
  onVersionChange,
}: {
  courseId: string;
  versions: CourseVersion[];
  version?: CourseVersion;
  onVersionChange: (id: string) => void;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start">
        <h2>Course package</h2>
        {versions.length > 0 && (
          <label className="flex flex-row items-center whitespace-nowrap text-[12px] [&_select]:max-w-[190px] [&_select]:text-[12px]">
            Version
            <Select
              aria-label="Course version"
              value={version?.id}
              onChange={(event) => onVersionChange(event.target.value)}
            >
              {[...versions].reverse().map((v) => (
                <option value={v.id} key={v.id}>
                  Version {v.version} · {formatName(v.format)}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      {version ? (
        <InspectorReport version={version} />
      ) : (
        <p className="text-muted-foreground">
          Upload a package to add the first version.
        </p>
      )}
      {version?.format === "scorm12" && (
        <div className="grid justify-items-start gap-3 border-t border-border pt-5 [&_p]:text-[12px]">
          <a
            className={buttonVariants({
              variant: "secondary",
              size: "default",
            })}
            href={`/app-api/courses/${idPath(courseId)}/versions/${idPath(version.id)}/download?kind=original`}
            download
          >
            <Download size={16} aria-hidden="true" />
            Download SCORM package
          </a>
          <p className="text-muted-foreground">
            In Moodle: Add an activity → SCORM package
          </p>
        </div>
      )}
    </Card>
  );
}

export function InspectorReport({ version }: { version: CourseVersion }) {
  const { report, trackingProfile: profile } = version;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>{formatName(version.format)}</Badge>
        <Badge variant="success">Package accepted</Badge>
      </div>
      {report.scorm?.title && (
        <p className="wrap-anywhere">{report.scorm.title}</p>
      )}
      <dl className="m-0 grid grid-cols-2 gap-[18px]">
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
      <p className="text-[14px] text-[#d0b4f4]">
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
        <Notice variant="warning">
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
        </Notice>
      )}
      {report.warnings
        .filter((w) => w.code !== "EXTERNAL_ASSETS")
        .map((warning) => (
          <Notice variant="warning" key={warning.code}>
            {warning.detail}
          </Notice>
        ))}
    </div>
  );
}
