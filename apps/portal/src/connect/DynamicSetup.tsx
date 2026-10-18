import { Notice } from "../ui/notice.tsx";
import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { useState } from "react";
import { Link2 } from "lucide-react";
import { api, idPath } from "../api.ts";
import type { Connection } from "../types.ts";
import { CopyButton, ErrorNotice } from "../ui.tsx";
import { MoodleSteps } from "./MoodleSteps.tsx";

export function DynamicSetup({
  connection,
  libraryName,
  onChanged,
}: {
  connection: Connection;
  libraryName: string;
  onChanged: (connection: Connection) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function renew() {
    setBusy(true);
    setError(null);
    try {
      const next = await api<{ registrationUrl: string; expiresAt: string }>(
        `/connections/${idPath(connection.id)}/registration-url`,
        { method: "POST" },
      );
      onChanged({
        ...connection,
        registrationUrl: next.registrationUrl,
        registrationUrlExpiresAt: next.expiresAt,
      });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-5 [&>div:first-child]:min-w-0 max-[720px]:flex-wrap max-[720px]:items-start">
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            STEP 1 · REGISTRATION URL
          </p>
          <h2>Copy this URL to Moodle</h2>
        </div>
        <Link2 size={22} aria-hidden="true" />
      </div>
      {connection.registrationUrl && (
        <div className="flex items-start gap-3 [&_input]:font-mono [&_input]:text-[12px] max-[720px]:flex-wrap">
          <label htmlFor="registration-url" className="sr-only">
            Registration URL
          </label>
          <Input
            id="registration-url"
            readOnly
            value={connection.registrationUrl}
            onFocus={(event) => event.target.select()}
          />
          <CopyButton
            value={connection.registrationUrl}
            label="registration URL"
          />
        </div>
      )}
      <p className="text-muted-foreground">
        This URL works once. It expires{" "}
        {connection.registrationUrlExpiresAt
          ? new Date(connection.registrationUrlExpiresAt).toLocaleString()
          : "after 24 hours"}
        .
      </p>
      <Button
        variant="link"
        type="button"
        disabled={busy}
        onClick={() => {
          void renew();
        }}
      >
        Make a new URL
      </Button>
      <ErrorNotice error={error} />
      <div className="border-t border-border pt-6">
        <h2>Complete the steps in Moodle</h2>
        <MoodleSteps method="dynamic" libraryName={libraryName} />
      </div>
      <Notice>
        If the connection failed and Moodle shows a Pending tool 'Cogniate (
        {libraryName})' that you did not activate, delete it in Manage tools and
        connect again.
      </Notice>
      <p className="text-muted-foreground" role="status">
        Waiting for Moodle. Status updates every 5 seconds.
      </p>
    </Card>
  );
}
