import { buttonVariants } from "../ui/button.tsx";
import { Select } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Connection } from "../types.ts";
import { ConnectionBadge } from "../ui.tsx";
import { MoodleSteps } from "./MoodleSteps.tsx";
import { lmsNames } from "../lms.ts";
import { Badge } from "../ui/badge.tsx";

export function ConnectionOverview({
  connection,
  connections,
}: {
  connection: Connection;
  connections: Connection[];
}) {
  const navigate = useNavigate();
  return (
    <Card className="flex flex-wrap items-center gap-5">
      <div>
        <h2>{connection.name}</h2>
        <Badge>{lmsNames[connection.lms]}</Badge>
        <p className="text-muted-foreground">{connection.siteUrl}</p>
        {connection.lms === "canvas" && <p className="text-muted-foreground">Canvas service URL: {connection.serviceUrl}</p>}
        {!!connection.platform?.deploymentIds.length && <div>
          <h3>Deployment IDs</h3>
          <ul className="list-disc pl-5">{connection.platform.deploymentIds.map((id) => <li key={id}><code>{id}</code></li>)}</ul>
        </div>}
      </div>
      <div role="status">
        <ConnectionBadge connection={connection} />
      </div>
      <label className="ml-auto max-w-[300px] text-[11px] max-[720px]:ml-0">
        <span id="manage-connection-label">LMS connection</span>
        <Select
          aria-labelledby="manage-connection-label"
          value={connection.id}
          onChange={(event) => {
            const selected = connections.find((item) => item.id === event.target.value);
            if (selected) navigate(`/integrations/${selected.lms}/${selected.id}`);
          }}
        >
          {connections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({lmsNames[item.lms]}, {new URL(item.siteUrl).host})
            </option>
          ))}
        </Select>
      </label>
    </Card>
  );
}

export function ConnectionReady({
  connection,
  libraryName,
}: {
  connection: Connection;
  libraryName: string;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <h2>
        {connection.status === "registered"
          ? "Registered"
          : "Your library is connected"}
      </h2>
      {connection.status === "registered" &&
        connection.lms === "moodle" &&
        connection.method === "dynamic" && (
          <div>
            <h3>Complete the steps in Moodle</h3>
            <MoodleSteps method="dynamic" libraryName={libraryName} />
          </div>
        )}
      {connection.status === "registered" && (
        <p>The first launch from {lmsNames[connection.lms]} changes the status to Connected.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className={buttonVariants({ variant: "primary", size: "default" })}
          to="/libraries/courses"
        >
          Go to Courses <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <a
          className={buttonVariants({ variant: "secondary", size: "default" })}
          href={connection.lms === "moodle" ? `${connection.siteUrl}/mod/lti/toolconfigure.php` : connection.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open {lmsNames[connection.lms]} <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
