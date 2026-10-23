import { buttonVariants, Button } from "../ui/button.tsx";
import { useState } from "react";
import { Link } from "react-router";
import { ApiError, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Connection, Lms } from "../types.ts";
import { ConnectionError, ErrorNotice, Loading } from "../ui.tsx";
import { ConnectionOverview } from "./ConnectionStatus.tsx";
import { DisconnectDialog } from "./DisconnectDialog.tsx";
import { NotFound } from "../NotFound.tsx";
import { ProviderSetup } from "./ProviderSetup.tsx";
import { ConnectionCheck } from "./ConnectionCheck.tsx";
import { useChannels } from "../channels/context.tsx";
import { channelOf } from "../channels/registry.ts";
import { createPortalSdk } from "../sdk/index.ts";
import { useNavigate } from "react-router";

export function ConnectionSetup({ id, lms, opener = `${lms}-manage` }: { id: string; lms: Lms; opener?: string }) {
  const { library } = useSession();
  const { modules } = useChannels();
  const navigate = useNavigate();
  const {
    data: connection,
    setData,
    error,
    reload,
  } = useApi<Connection>(`/connections/${idPath(id)}`, 5000);
  const list = useApi<{ connections: Connection[] }>("/connections");
  const [disconnect, setDisconnect] = useState(false);
  function changed(updated: Connection) {
    setData(updated);
    // End any older poll before it can replace the result of this write.
    reload();
    list.reload();
  }
  if ((connection && channelOf(connection) !== lms) || (error instanceof ApiError && error.status === 404)) return <NotFound />;
  if (!connection)
    return (
      <>
        <ErrorNotice error={error} />
        {!error && <Loading />}
      </>
    );
  return (
    <div className="flex flex-col gap-5">
      <ConnectionOverview
        connection={connection}
        connections={list.data?.connections ?? [connection]}
      />
      <ErrorNotice error={error} />
      <ErrorNotice error={list.error} />
      <ConnectionError connection={connection} libraryName={library.name} />
      <ProviderSetup key={`${lms}:${id}`} lms={lms} connection={connection} opener={opener} onCreated={changed} onChanged={changed} />
      <ConnectionCheck connection={connection} />
      {connection.status !== "disabled" && modules.get(lms)?.connectionPanels?.map((Panel, index) => <Panel key={index} connection={connection} sdk={createPortalSdk(navigate, reload)} />)}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className={buttonVariants({ variant: "secondary", size: "default" })}
          to={`/integrations/${lms}/connect`}
        >
          Connect another site
        </Link>
        {connection.status !== "disabled" && (
          <Button variant="destructiveLink" onClick={() => setDisconnect(true)}>
            Disconnect
          </Button>
        )}
        <Button variant="link" onClick={reload}>
          Refresh status
        </Button>
      </div>
      {disconnect && (
        <DisconnectDialog
          id={id}
          lms={lms}
          onClose={() => setDisconnect(false)}
          onDisconnected={() => {
            setDisconnect(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
