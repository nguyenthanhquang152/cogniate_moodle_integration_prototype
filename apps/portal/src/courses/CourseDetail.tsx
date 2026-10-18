import { buttonVariants } from "../ui/button.tsx";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Course } from "../types.ts";
import { ErrorNotice, Loading } from "../ui.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { CoursePackage } from "./CoursePackage.tsx";
import { UploadForm } from "./UploadForm.tsx";
import { Publications } from "./Publications.tsx";

export function CourseDetail({ publish = false }: { publish?: boolean }) {
  const { courseId = "" } = useParams();
  const courseState = useApi<Course>(`/courses/${idPath(courseId)}`);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [publicationRevision, setPublicationRevision] = useState(0);
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
  return (
    <>
      <Link
        className="inline-flex items-center gap-2 text-[12px] text-[#c9bdd9] no-underline"
        to="/libraries/courses"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Courses
      </Link>
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start mt-[26px] mb-[30px] [&_h1]:mt-[7px] [&_h1]:mb-2.5 [&_p:not(.eyebrow)]:text-muted-foreground">
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            COURSE DETAILS
          </p>
          <h1 tabIndex={-1}>{course.title}</h1>
          {course.summary && <p>{course.summary}</p>}
        </div>
        {version && (
          <Link
            id="publish-opener"
            className={buttonVariants({ variant: "primary", size: "default" })}
            to={`${coursePath}/publish`}
          >
            Publish to Moodle
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      <ErrorNotice error={courseState.error} />
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)] items-start gap-6 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-5">
          <CoursePackage
            courseId={courseId}
            versions={versions}
            version={version}
            onVersionChange={setSelectedVersion}
          />
          <UploadForm
            key={courseId}
            courseId={courseId}
            onUploaded={(v) => {
              setSelectedVersion(v.id);
              courseState.reload();
            }}
          />
        </div>
        <Publications
          key={`${courseId}:${publicationRevision}`}
          courseId={courseId}
          onChanged={courseState.reload}
        />
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
            setPublicationRevision((value) => value + 1);
            courseState.reload();
            navigate(coursePath, {
              replace: true,
              state: { focus: "publish-opener" },
            });
          }}
        />
      )}
    </>
  );
}
