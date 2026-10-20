import { Button } from "../ui/button.tsx";
import { useState } from "react";
import { api, idPath } from "../api.ts";
import { ErrorNotice, Modal } from "../ui.tsx";
import type { Lms } from "../types.ts";
import { lmsNames } from "../lms.ts";
import { useAlive } from "../hooks.ts";

export function DisconnectDialog({
  id,
  lms = "moodle",
  onClose,
  onDisconnected,
}: {
  id: string;
  lms?: Lms;
  onClose: () => void;
  onDisconnected: () => void;
}) {
  const alive = useAlive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api(`/connections/${idPath(id)}`, { method: "DELETE" });
      if (alive.current) onDisconnected();
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Modal title={`Disconnect ${lmsNames[lms]}?`} onClose={onClose}>
      <p>
        {lms === "blackboard"
          ? "This switches off Cogniate for this Blackboard site only. Other schools are not affected. Cogniate items in Blackboard courses stop working, and connecting again later does not restore them."
          : lms === "canvas"
            ? "This stops launches through this connection. Cogniate items in Canvas courses stop working, and connecting again later does not restore them."
            : "This stops launches through this connection. The tool stays in Moodle."}
      </p>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => {
            void disconnect();
          }}
        >
          Disconnect
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
