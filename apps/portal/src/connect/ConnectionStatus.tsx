import { buttonVariants } from "../ui/button.tsx";
import { Select } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Connection } from "../types.ts";
import { ConnectionBadge } from "../ui.tsx";
import { Badge } from "../ui/badge.tsx";
import { channelOf, channelRegistry } from "../channels/registry.ts";
import { useChannels } from "../channels/context.tsx";
import { createPortalSdk } from "../sdk/index.ts";

export function ConnectionDetailBlock({ connection, serviceLabel, openUrl }: { connection: Connection; serviceLabel?: string; openUrl?: string }) {
  const name = connection.channelName ?? channelRegistry.textName(channelOf(connection));
  return <>
    <h2>{connection.name}</h2><Badge>{name}</Badge>
    <p className="text-muted-foreground">{connection.siteUrl}</p>
    {serviceLabel && <p className="text-muted-foreground">{serviceLabel}: {connection.serviceUrl}</p>}
    {!!connection.platform?.deploymentIds.length && <div><h3>Deployment IDs</h3><ul className="list-disc pl-5">
      {connection.platform.deploymentIds.map((id) => <li key={id}><code>{id}</code></li>)}
    </ul></div>}
    {(connection.status === "registered" || connection.status === "connected") && <a className={buttonVariants({ variant: "secondary", size: "default" })} href={openUrl ?? connection.siteUrl} target="_blank" rel="noopener noreferrer">Open {name} <ExternalLink size={15} aria-hidden="true" /></a>}
  </>;
}
export function ConnectionOverview({ connection, connections }: { connection: Connection; connections: Connection[] }) {
  const navigate = useNavigate();
  const { modules } = useChannels();
  const Details = modules.get(channelOf(connection))?.ConnectionDetails;
  return <Card className="flex flex-wrap items-center gap-5">
    <div>{Details ? <Details connection={connection} sdk={createPortalSdk(navigate)} /> : <ConnectionDetailBlock connection={connection} />}</div>
    <div role="status"><ConnectionBadge connection={connection} /></div>
    <label className="ml-auto max-w-[300px] text-[11px] max-[720px]:ml-0">
      <span id="manage-connection-label">LMS connection</span>
      <Select aria-labelledby="manage-connection-label" value={connection.id} onChange={(event) => {
        const selected = connections.find((item) => item.id === event.target.value);
        if (selected) navigate(`/integrations/${channelOf(selected)}/${selected.id}`);
      }}>{connections.map((item) => <option key={item.id} value={item.id}>{item.name} ({channelRegistry.textName(channelOf(item))}, {new URL(item.siteUrl).host})</option>)}</Select>
    </label>
  </Card>;
}
export function ConnectionReady({ connection }: { connection: Connection; libraryName?: string }) {
  return <Card className="flex flex-col gap-5">
    <h2>{connection.status === "registered" ? "Registered" : "Your library is connected"}</h2>
    {connection.status === "registered" && <p>The first launch from {channelRegistry.textName(channelOf(connection))} changes the status to Connected.</p>}
    <div className="flex flex-wrap items-center gap-3"><Link className={buttonVariants({ variant: "primary", size: "default" })} to="/libraries/courses">Go to Courses <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </Card>;
}
