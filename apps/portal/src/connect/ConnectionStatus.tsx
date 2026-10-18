import { buttonVariants } from "../ui/button.tsx";
import { Select } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Connection } from "../types.ts";
import { ConnectionBadge } from "../ui.tsx";
import { MoodleSteps } from "./MoodleSteps.tsx";

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
        <p className="text-muted-foreground">{connection.siteUrl}</p>
      </div>
      <div role="status">
        <ConnectionBadge connection={connection} />
      </div>
      <label className="ml-auto max-w-[300px] text-[11px] max-[720px]:ml-0">
        <span id="manage-connection-label">Moodle connection</span>
        <Select
          aria-labelledby="manage-connection-label"
          value={connection.id}
          onChange={(event) =>
            navigate(`/integrations/moodle/${event.target.value}`)
          }
        >
          {connections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.siteUrl}
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
        connection.method === "dynamic" && (
          <div>
            <h3>Complete the steps in Moodle</h3>
            <MoodleSteps method="dynamic" libraryName={libraryName} />
          </div>
        )}
      <p>The first launch from Moodle changes the status to Connected.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className={buttonVariants({ variant: "primary", size: "default" })}
          to="/libraries/courses"
        >
          Go to Courses <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <a
          className={buttonVariants({ variant: "secondary", size: "default" })}
          href={`${connection.siteUrl}/mod/lti/toolconfigure.php`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Moodle <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
