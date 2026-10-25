import { Button } from "../ui/button.tsx";
import { useState } from "react";
import { api, idPath } from "../api.ts";
import { ErrorNotice, Modal } from "../ui.tsx";
import type { Lms } from "../types.ts";
import { channelRegistry, channelText } from "../channels/registry.ts";
import { useAlive } from "../hooks.ts";

export function DisconnectDialog({
  id,
  lms,
  onClose,
  onDisconnected,
}: {
  id: string;
  lms: Lms;
  onClose: () => void;
  onDisconnected: () => void;
}) {
  const manifest = channelRegistry.channel(lms);
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
    <Modal title={`Disconnect ${manifest?.names.text ?? "LMS"}?`} onClose={onClose}>
      <p>
        {manifest ? channelText(manifest, manifest.texts.disconnect) : "This stops launches through this connection."}
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
