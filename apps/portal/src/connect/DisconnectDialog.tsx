import { Button } from "../ui/button.tsx";
import { useState } from "react";
import { api, idPath } from "../api.ts";
import { ErrorNotice, Modal } from "../ui.tsx";

export function DisconnectDialog({
  id,
  onClose,
  onDisconnected,
}: {
  id: string;
  onClose: () => void;
  onDisconnected: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api(`/connections/${idPath(id)}`, { method: "DELETE" });
      onDisconnected();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Disconnect Moodle?" onClose={onClose}>
      <p>
        This stops launches through this connection. The tool stays in Moodle.
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
