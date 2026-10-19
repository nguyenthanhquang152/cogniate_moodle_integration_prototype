import type { Publication } from "../types.ts";
import { Notice } from "../ui/notice.tsx";
import { buttonVariants } from "../ui/button.tsx";

export function MoodleCourse({ publication }: { publication: Publication }) {
  if (!publication.shellStatus) return null;
  return (
    <Notice
      variant={publication.shellStatus === "failed" ? "error" : "default"}
      className="flex flex-col items-start gap-3"
    >
      <p>Moodle course status: {publication.shellStatus}</p>
      {publication.shellStatus === "failed" && <p>{publication.shellError}</p>}
      {publication.moodleCourse && (
        <a
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          href={publication.moodleCourse.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Moodle course
        </a>
      )}
      {publication.shellStatus === "created" && (
        <p>
          The empty course is hidden. Add the activities and check the course
          before you make it visible.
        </p>
      )}
    </Notice>
  );
}
