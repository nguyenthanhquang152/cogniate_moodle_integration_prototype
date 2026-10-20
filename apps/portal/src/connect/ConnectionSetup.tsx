import { buttonVariants, Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { useState } from "react";
import { Link } from "react-router";
import { ApiError, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Connection, Lms } from "../types.ts";
import { ConnectionError, ErrorNotice, Loading } from "../ui.tsx";
import { DynamicSetup } from "./DynamicSetup.tsx";
import { ManualSetup } from "./ManualSetup.tsx";
import { ConnectionOverview, ConnectionReady } from "./ConnectionStatus.tsx";
import { WebServices } from "./WebServices.tsx";
import { DisconnectDialog } from "./DisconnectDialog.tsx";
import { NotFound } from "../NotFound.tsx";
import { ProviderSetup } from "./ProviderSetup.tsx";
import { CanvasBinding } from "./canvas/CanvasBinding.tsx";
import { Card } from "../ui/card.tsx";

export function ConnectionSetup({ id, lms = "moodle", opener = `${lms}-manage` }: { id: string; lms?: Lms; opener?: string }) {
  const { library } = useSession();
  const {
    data: connection,
    setData,
    error,
    reload,
  } = useApi<Connection>(`/connections/${idPath(id)}`, 5000);
  const list = useApi<{ connections: Connection[] }>("/connections");
  const [disconnect, setDisconnect] = useState(false);
  if ((connection && connection.lms !== lms) || (error instanceof ApiError && error.status === 404)) return <NotFound />;
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
      {connection.status === "disabled" ? (
        <Notice>
          {lms === "moodle" ? "This connection is disconnected. Delete the old Cogniate tool in Moodle before you connect again."
            : "This connection is disconnected. Connecting again does not restore its old course items."}
        </Notice>
      ) : lms !== "moodle" ? (
        <>
          {connection.status !== "pending" && <ConnectionReady connection={connection} libraryName={library.name} />}
          <ProviderSetup key={`${lms}:${id}`} lms={lms} connection={connection} opener={opener} onCreated={setData} onChanged={setData} />
          {lms === "canvas" && connection.capabilities.addDeployment && connection.status !== "pending" &&
            <Card className="flex flex-col gap-5">
              <h2>Add deployment ID</h2>
              <CanvasBinding key={id} connection={connection} onChanged={setData} addDeployment />
            </Card>}
        </>
      ) : connection.status === "pending" ? (
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
      ) : (
        <ConnectionReady connection={connection} libraryName={library.name} />
      )}
      {lms === "moodle" && connection.status !== "disabled" && (
        <Notice>
          To reconnect, delete the old Cogniate tool in Moodle. Then disconnect
          this connection and connect again. Cogniate refuses every tool update.
        </Notice>
      )}
      {lms === "moodle" && connection.capabilities.webServices && connection.status !== "disabled" && (
        <WebServices key={connection.id} connection={connection} onSaved={reload} />
      )}
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
