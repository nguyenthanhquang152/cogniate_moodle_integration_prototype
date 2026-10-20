import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../../api.ts";
import { useAlive } from "../../hooks.ts";
import { BLACKBOARD_NOT_READY } from "../../lms.ts";
import type { Connection, ConnectionCreateBody } from "../../types.ts";
import { Button, buttonVariants } from "../../ui/button.tsx";
import { Input, Select } from "../../ui/input.tsx";
import { ProviderErrorNotice, providerErrorFields } from "../provider-errors.tsx";
import type { ProviderWizardProps } from "../wizard-types.ts";

/** Step 1: connection name and Learn URL; "Blackboard type" only when more than one profile is ready (M2). */
export function BlackboardCreate({ provider, opener, onCreated }: ProviderWizardProps) {
  const alive = useAlive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fields = providerErrorFields(error);
  const ready = provider.profiles.filter((profile) => profile.ready);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || ready.length === 0) return;
    const data = new FormData(event.currentTarget);
    const body: ConnectionCreateBody = {
      lms: "blackboard", method: "manual",
      name: String(data.get("name") ?? "").trim(),
      siteUrl: String(data.get("siteUrl") ?? "").trim(),
      profile: ready.length > 1 ? String(data.get("profile") ?? "") : ready[0]!.id,
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
    {ready.length === 0 && <p role="status">{BLACKBOARD_NOT_READY}</p>}
    <label>Connection name
      <Input name="name" required maxLength={100} placeholder="School Blackboard"
        aria-invalid={fields.includes("name")} aria-describedby={fields.includes("name") ? "blackboard-create-error" : undefined} />
    </label>
    <label><span id="blackboard-site-label">Learn URL</span>
      <Input name="siteUrl" type="url" required placeholder="https://learn.school.edu" aria-labelledby="blackboard-site-label"
        aria-invalid={fields.includes("siteUrl")}
        aria-describedby={`blackboard-site-help${fields.includes("siteUrl") ? " blackboard-create-error" : ""}`} />
      <small id="blackboard-site-help">The address that teachers use, for example https://learn.school.edu</small>
    </label>
    {ready.length > 1 && <label><span id="blackboard-type-label">Blackboard type</span>
      <Select name="profile" aria-labelledby="blackboard-type-label" defaultValue={ready[0]!.id}
        aria-invalid={fields.includes("profile")} aria-describedby={fields.includes("profile") ? "blackboard-create-error" : undefined}>
        {ready.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
      </Select>
    </label>}
    <div id="blackboard-create-error"><ProviderErrorNotice error={error} /></div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled={busy || ready.length === 0}>Next</Button>
      <Link className={buttonVariants({ variant: "secondary" })} to="/integrations" state={{ focus: opener }}>Cancel</Link>
      {busy && <span role="status">Creating connection…</span>}
    </div>
  </form>;
}
