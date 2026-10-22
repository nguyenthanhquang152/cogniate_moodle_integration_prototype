import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@cogniate/portal-sdk";
import { api } from "@cogniate/portal-sdk";
import { useAlive } from "@cogniate/portal-sdk";
import type { Connection, ConnectionCreateBody } from "@cogniate/portal-sdk";
import { Button, buttonVariants } from "@cogniate/portal-sdk";
import { Input, Select } from "@cogniate/portal-sdk";
import { ProviderErrorNotice, providerErrorFields } from "@cogniate/portal-sdk";
import type { ChannelWizardProps } from "@cogniate/portal-sdk";

export function CanvasCreate({ provider, opener, onCreated }: ChannelWizardProps) {
  const alive = useAlive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fields = providerErrorFields(error);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const serviceUrl = String(data.get("serviceUrl") ?? "").trim();
    const body: ConnectionCreateBody = {
      lms: "canvas", method: "manual",
      name: String(data.get("name") ?? "").trim(),
      siteUrl: String(data.get("siteUrl") ?? "").trim(),
      profile: String(data.get("profile") ?? ""),
      ...(serviceUrl ? { serviceUrl } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      const connection = await api<Connection>("/connections", { method: "POST", body });
      if (alive.current) onCreated(connection);
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
    <label>Connection name
      <Input name="name" required maxLength={100} placeholder="School Canvas"
        aria-invalid={fields.includes("name")} aria-describedby={fields.includes("name") ? "canvas-create-error" : undefined} />
    </label>
    <label><span id="canvas-site-label">Canvas URL</span>
      <Input name="siteUrl" type="url" required placeholder="https://canvas.school.edu" aria-labelledby="canvas-site-label"
        aria-invalid={fields.includes("siteUrl")}
        aria-describedby={`canvas-site-help${fields.includes("siteUrl") ? " canvas-create-error" : ""}`} />
      <small id="canvas-site-help">The address that teachers use, for example https://canvas.school.edu</small>
    </label>
    <label><span id="canvas-service-label">Canvas service URL</span>
      <Input name="serviceUrl" type="url" placeholder="https://school.instructure.com" aria-labelledby="canvas-service-label"
        aria-invalid={fields.includes("serviceUrl")}
        aria-describedby={`canvas-service-help${fields.includes("serviceUrl") ? " canvas-create-error" : ""}`} />
      <small id="canvas-service-help">The Canvas account domain, for example https://school.instructure.com. Leave empty if it is the same as the Canvas URL.</small>
    </label>
    <label><span id="canvas-type-label">Canvas type</span>
      <Select name="profile" aria-labelledby="canvas-type-label" defaultValue={provider.profiles.find((p) => p.ready)?.id}
        aria-invalid={fields.includes("profile")} aria-describedby={fields.includes("profile") ? "canvas-create-error" : undefined}>
        {provider.profiles.map((profile) =>
          <option key={profile.id} value={profile.id} disabled={!profile.ready}>{profile.label}</option>)}
      </Select>
    </label>
    <div id="canvas-create-error"><ProviderErrorNotice error={error} /></div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled={busy || !provider.profiles.some((p) => p.ready)}>Next</Button>
      <Link className={buttonVariants({ variant: "secondary" })} to="/integrations" state={{ focus: opener }}>Cancel</Link>
      {busy && <span role="status">Creating connection…</span>}
    </div>
  </form>;
}
