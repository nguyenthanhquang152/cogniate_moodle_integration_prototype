import { Input, Textarea } from "../ui/input.tsx";
import { Badge } from "../ui/badge.tsx";
import { Card } from "../ui/card.tsx";
import { Button } from "../ui/button.tsx";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BookOpen, FileArchive, Plus } from "lucide-react";
import { api } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Course } from "../types.ts";
import { Empty, ErrorNotice, Loading, Modal, formatName } from "../ui.tsx";

export function Courses() {
  const { data, error, reload } = useApi<{ courses: Course[] }>("/courses");
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start mt-[26px] mb-[30px] [&_h1]:mt-[7px] [&_h1]:mb-2.5 [&_p:not(.eyebrow)]:text-muted-foreground">
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            YOUR LIBRARY
          </p>
          <h1 tabIndex={-1}>Courses</h1>
          <p>Upload a course. Publish it to your connected LMS sites.</p>
        </div>
        <Button variant="primary" onClick={() => setCreate(true)}>
          <Plus size={17} aria-hidden="true" />
          New course
        </Button>
      </div>
      <ErrorNotice error={error} />
      {error ? (
        <Button variant="link" onClick={reload}>
          Try again
        </Button>
      ) : (
        !data && <Loading />
      )}
      {data &&
        (data.courses.length === 0 ? (
          <Empty>
            <BookOpen size={32} aria-hidden="true" />
            <h2>Your library starts here</h2>
            <p>Create a course, then upload a SCORM or HTML zip.</p>
            <Button variant="primary" onClick={() => setCreate(true)}>
              New course
            </Button>
          </Empty>
        ) : (
          <div className="course-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <Card
                as="article"
                spacing="none"
                className="overflow-hidden [&>div:last-child]:gap-4 [&>div:last-child]:p-[22px] [&_h2]:wrap-anywhere [&_h2_a]:no-underline"
                key={course.id}
              >
                <div
                  className="grid h-[122px] place-items-center border-b border-[#ffffff0a] bg-(image:--gradient-primary) text-[#c9a3f6]"
                  aria-hidden="true"
                >
                  <FileArchive size={38} />
                </div>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge>
                      {course.latestVersion
                        ? formatName(course.latestVersion.format)
                        : "No package"}
                    </Badge>
                    {course.latestVersion && (
                      <span className="text-muted-foreground">
                        Version {course.latestVersion.version}
                      </span>
                    )}
                  </div>
                  <h2>
                    <Link to={`/libraries/courses/${course.id}`}>
                      {course.title}
                    </Link>
                  </h2>
                  {course.summary && (
                    <p className="text-muted-foreground">{course.summary}</p>
                  )}
                  <p className="text-[12px] text-muted-foreground">
                    {
                      course.publications.filter(
                        (p) => p.status === "available",
                      ).length
                    }{" "}
                    LMS publications
                  </p>
                  <Link
                    className="inline-flex items-center gap-1.5 text-[12px] text-[#ccc5d9] no-underline hover:text-white"
                    to={`/libraries/courses/${course.id}`}
                  >
                    Manage course <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </Card>
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
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <label>
        Course title
        <Input name="title" required maxLength={200} autoFocus />
      </label>
      <label>
        Summary (optional)
        <Textarea name="summary" rows={3} maxLength={2000} />
      </label>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={busy}>
          {busy ? "Creating…" : "Create course"}
        </Button>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
