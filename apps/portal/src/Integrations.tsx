import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, GraduationCap, Plus } from "lucide-react";
import { useApi } from "./hooks.ts";
import type { Connection } from "./types.ts";
import {
  ConnectionBadge,
  ConnectionError,
  ErrorNotice,
  Loading,
} from "./ui.tsx";

const filters = ["All", "LMS Publishing", "LLM/AI", "Creative", "Knowledge"];
const integrations = [
  {
    name: "Kajabi",
    mark: "K",
    category: "LMS Publishing",
    color: "blue",
    description:
      "Publish and sell your courses directly on Kajabi with seamless content sync.",
  },
  {
    name: "Moodle",
    mark: "m",
    category: "LMS Publishing",
    color: "orange",
    description:
      "Export SCORM packages and sync course content with your Moodle LMS.",
  },
  {
    name: "Figma",
    mark: "F",
    category: "Creative",
    color: "pink",
    description:
      "Import design assets, icons, and images directly from your Figma projects.",
  },
  {
    name: "Collins",
    mark: "C",
    category: "Knowledge",
    color: "red",
    description:
      "Access the Collins dictionary and reference materials for your course content.",
  },
  {
    name: "Anthropic",
    mark: "A",
    category: "LLM/AI",
    color: "peach",
    description:
      "Use Claude AI to generate, review, and improve your course materials.",
  },
  {
    name: "Open AI",
    mark: "◎",
    category: "LLM/AI",
    color: "green",
    description:
      "Use GPT models to create quizzes, summaries, and interactive learning content.",
  },
  {
    name: "MIT",
    mark: "MIT",
    category: "Knowledge",
    color: "red",
    description:
      "Access MIT OpenCourseWare resources and add academic content.",
  },
  {
    name: "Canva",
    mark: "C",
    category: "Creative",
    color: "cyan",
    description:
      "Design course graphics, thumbnails, and visual assets with Canva.",
  },
  {
    name: "Loom",
    mark: "✳",
    category: "Creative",
    color: "purple",
    description:
      "Record and embed video lessons, walkthroughs, and screen captures with Loom.",
  },
];
export function Integrations() {
  const [filter, setFilter] = useState("All");
  const { data, error, loading, reload } = useApi<{
    connections: Connection[];
  }>("/connections", 5000);
  const connections = [...(data?.connections ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const newest = connections[0];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">YOUR CONNECTED WORKSPACE</p>
        <h1 tabIndex={-1}>Integrations</h1>
        <p>Connect your favorite tools to your course library.</p>
      </div>
      <div
        className="filter-pills"
        role="group"
        aria-label="Integration categories"
      >
        {filters.map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ErrorNotice error={error} />
      {error ? (
        <button className="text-button" onClick={reload}>
          Try again
        </button>
      ) : null}
      <div className="integration-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations
          .filter((item) => filter === "All" || item.category === filter)
          .map((item) => (
            <article
              className="integration-card"
              key={item.name}
              aria-labelledby={`integration-${item.name.replaceAll(" ", "-")}`}
            >
              <div className="card-top">
                <span
                  className={`integration-logo ${item.color}`}
                  aria-hidden="true"
                >
                  {item.name === "Moodle" ? (
                    <GraduationCap size={28} />
                  ) : (
                    item.mark
                  )}
                </span>
                {item.name !== "Moodle" ? (
                  <span title="Not part of this prototype">
                    <button
                      className="button compact secondary"
                      disabled
                      aria-label={`Connect ${item.name} — Not part of this prototype`}
                    >
                      Connect
                    </button>
                  </span>
                ) : loading && !data ? (
                  <Loading />
                ) : newest ? (
                  <Link
                    id="moodle-manage"
                    className="button compact secondary"
                    to={`/integrations/moodle/${newest.id}`}
                  >
                    Manage <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                ) : !error ? (
                  <Link
                    id="moodle-connect"
                    className="button compact secondary"
                    to="/integrations/moodle/connect"
                    state={{ opener: "moodle-connect" }}
                  >
                    Connect
                  </Link>
                ) : null}
              </div>
              <h2 id={`integration-${item.name.replaceAll(" ", "-")}`}>
                {item.name}
              </h2>
              <p>{item.description}</p>
              {item.name === "Moodle" && newest && (
                <div className="card-connection">
                  <ConnectionBadge connection={newest} />
                  <Link
                    id="moodle-connect-another"
                    to="/integrations/moodle/connect"
                    state={{ opener: "moodle-connect-another" }}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Connect another site
                  </Link>
                  <ConnectionError connection={newest} />
                </div>
              )}
            </article>
          ))}
      </div>
      <p className="integration-note">One library. Your tools, connected.</p>
    </>
  );
}
