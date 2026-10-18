import { buttonVariants, Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { useState } from "react";
import { Link } from "react-router";
import { idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Connection } from "../types.ts";
import { ConnectionError, ErrorNotice, Loading } from "../ui.tsx";
import { DynamicSetup } from "./DynamicSetup.tsx";
import { ManualSetup } from "./ManualSetup.tsx";
import { ConnectionOverview, ConnectionReady } from "./ConnectionStatus.tsx";
import { DisconnectDialog } from "./DisconnectDialog.tsx";

export function ConnectionSetup({ id }: { id: string }) {
  const { library } = useSession();
  const {
    data: connection,
    setData,
    error,
    reload,
  } = useApi<Connection>(`/connections/${idPath(id)}`, 5000);
  const list = useApi<{ connections: Connection[] }>("/connections");
  const [disconnect, setDisconnect] = useState(false);
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
      {connection.status === "pending" ? (
        connection.method === "dynamic" ? (
          <DynamicSetup
            connection={connection}
            libraryName={library.name}
            onChanged={setData}
          />
        ) : (
          <ManualSetup
            connection={connection}
            libraryName={library.name}
            onRegistered={setData}
          />
        )
      ) : connection.status !== "disabled" ? (
        <ConnectionReady connection={connection} libraryName={library.name} />
      ) : (
        <Notice>
          This connection is disconnected. Delete the old Cogniate tool in
          Moodle before you connect again.
        </Notice>
      )}
      {connection.status !== "disabled" && (
        <Notice>
          To reconnect, delete the old Cogniate tool in Moodle. Then disconnect
          this connection and connect again. Cogniate refuses every tool update.
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className={buttonVariants({ variant: "secondary", size: "default" })}
          to="/integrations/moodle/connect"
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
