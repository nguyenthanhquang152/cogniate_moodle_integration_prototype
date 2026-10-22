import { useState } from "react";
import type { FormEvent } from "react";
import type { ChannelManifest, FieldSpec } from "@cogniate/channel-kernel";
import type { ChannelUiModule, ChannelWizardProps, Connection, WizardStep } from "../sdk/index.ts";
import { useAlive } from "../hooks.ts";
import { api, idPath } from "../api.ts";
import { Card } from "../ui/card.tsx";
import { Button } from "../ui/button.tsx";
import { Input, Select } from "../ui/input.tsx";
import { CopyButton, ErrorNotice } from "../ui.tsx";
import { ToolConfiguration } from "../connect/ToolConfiguration.tsx";
import { channelText } from "./registry.ts";

export function verificationAuthority(manifest: ChannelManifest, connection: Connection | null, method: string): NonNullable<Connection["bindingAuthority"]> {
  return connection?.bindingAuthority ?? manifest.registration.find((entry) => entry.method === method)?.authority ?? "operatorGrant";
}
export function ManifestWizard({ manifest, module, ...props }: ChannelWizardProps & { manifest: ChannelManifest; module?: ChannelUiModule }) {
  const [method, setMethod] = useState(props.connection?.method ?? manifest.registration[0]!.method);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const alive = useAlive();
  const connection = props.connection;
  const selected = manifest.registration.find((entry) => entry.method === method)!;
  const authority = verificationAuthority(manifest, connection, method);
  const fields = (items: readonly FieldSpec[]) => items.filter((field) => !field.method || field.method === method);
  const text = (value: string) => channelText(manifest, value, props.libraryName, connection?.siteUrl);
  const ready = props.provider.profiles.filter((profile) => profile.ready && selected.profiles.includes(profile.id));
  const finished = connection?.status === "registered" || connection?.status === "connected";
  const hasBinding = connection?.status === "pending" && (method === "manual" || authority !== "self");
  function field(spec: FieldSpec) {
    const value = "default" in spec && typeof spec.default === "string" ? spec.default.replaceAll("{siteUrl}", connection?.siteUrl ?? "") : undefined;
    return <label key={spec.key}>{text(spec.label)}
      {spec.kind === "choice" ? <Select name={spec.key} required={spec.required} defaultValue={ready.find((p) => p.id === selected.defaultProfile)?.id ?? ready[0]?.id}>
        {ready.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
      </Select> : <Input name={spec.key} required={spec.required} type={spec.kind === "origin" || spec.kind === "url" ? "url" : "text"}
        defaultValue={spec.key === "clientId" ? connection?.platform?.clientId ?? value : spec.key === "deploymentId" ? connection?.platform?.deploymentIds[0] ?? value : value}
        autoComplete={spec.kind === "grantCode" ? "off" : undefined} />}
    </label>;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value).trim()]));
    setBusy(true); setError(null);
    try {
      if (!connection) {
        const result = await api<Connection>("/connections", { method: "POST", body: { ...values, channel: manifest.id, method, profile: values.profile || ready.find((profile) => profile.id === selected.defaultProfile)?.id || ready[0]?.id || selected.defaultProfile } });
        if (alive.current) props.onCreated(result);
      } else {
        const updated = await api<Connection>(`/connections/${idPath(connection.id)}/platform`, { method: "PUT", body: values });
        if (alive.current) props.onChanged(updated);
      }
    } catch (reason) { if (alive.current) setError(reason); }
    finally {
      const code = form.elements.namedItem("grantCode");
      if (code instanceof HTMLInputElement) code.value = "";
      if (alive.current) setBusy(false);
    }
  }
  const content: Record<WizardStep, React.ReactNode> = {
    show: <>
      <h2>Tool settings</h2>
      <ol className="list-decimal space-y-3 pl-5">{manifest.texts.adminSteps.map((step, index) => <li key={index}>{text(step)}</li>)}</ol>
      {connection && manifest.lti?.toolConfiguration === "channel" && <ToolConfiguration id={connection.id} lmsName={manifest.names.text} />}
      {connection?.registrationUrl && <CopyButton label="Registration URL" value={connection.registrationUrl} />}
      {connection && connection.status === "pending" && method === "dynamic" && <Button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const updated = await api<Connection>(`/connections/${idPath(connection.id)}/registration-url`, { method: "POST" });
          if (alive.current) props.onChanged(updated);
        } catch (reason) { if (alive.current) setError(reason); }
        finally { if (alive.current) setBusy(false); }
      }}>Get registration URL</Button>}
    </>,
    collect: <>
      <h2>{connection ? "Platform values" : "Your site"}</h2>
      {!connection && <>
        <label>Connection name<Input name="name" required maxLength={100} /></label>
        <label>Connection method<Select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
          {manifest.registration.map((entry) => <option key={entry.method} value={entry.method}>{entry.method === "dynamic" ? "Automatic" : "Manual"}</option>)}
        </Select></label>
        {fields(manifest.setup.createFields).map(field)}
        {!manifest.setup.createFields.some((item) => item.key === "profile") && ready.length > 1 && field({ key: "profile", label: "Profile", kind: "choice", required: true })}
        <Button disabled={busy || ready.length === 0}>Continue</Button>
      </>}
      {hasBinding && fields(manifest.setup.bindingFields).filter((item) => item.kind !== "grantCode").map(field)}
    </>,
    verify: <>
      <h2>Verify connection</h2>
      {authority === "self" ? <p>The first launch from {manifest.names.text} verifies this connection.</p> : authority === "verifiedAdminLaunch" ? <p>Use the admin launch code to verify this connection.</p> : <>
        <p>Ask your Cogniate operator for an approval code. The code works once and expires.</p>
        {hasBinding && field(fields(manifest.setup.bindingFields).find((item) => item.kind === "grantCode") ?? { key: "grantCode", label: "Approval code", kind: "grantCode", required: true })}
      </>}
      {hasBinding && <Button disabled={busy}>Save</Button>}
    </>,
    enable: <>
      <h2>{finished ? "Your library is connected" : "Enable the connection"}</h2>
      <ol className="list-decimal space-y-3 pl-5">{manifest.texts.teacherSteps.map((step, index) => <li key={index}>{text(step)}</li>)}</ol>
    </>,
  };
  return <form className="flex flex-col gap-5" onSubmit={submit}>
    {(["show", "collect", "verify", "enable"] as const).map((step) => {
      const Override = module?.steps?.[step];
      return <Card key={step} data-channel-step={step} className="flex flex-col gap-5"><p className="eyebrow">{step}</p>{Override ? <Override {...props} /> : content[step]}</Card>;
    })}
    <ErrorNotice error={error} />
  </form>;
}
