import { createContext, useContext, useState } from "react";
import type { FormEvent } from "react";
import type { ChannelManifest, FieldSpec } from "@cogniate/channel-kernel";
import type { ChannelUiModule, ChannelWizardProps, Connection, WizardStep } from "../sdk/index.ts";
import { useAlive } from "../hooks.ts";
import { api, idPath } from "../api.ts";
import { Card } from "../ui/card.tsx";
import { Button } from "../ui/button.tsx";
import { Input, Select } from "../ui/input.tsx";
import { CopyButton } from "../ui.tsx";
import { ToolConfiguration } from "../connect/ToolConfiguration.tsx";
import { ChannelErrorNotice } from "../connect/provider-errors.tsx";
import { channelText } from "./registry.ts";

import { verificationAuthority, VerificationInstructions } from "./verification.tsx";

function initialFieldValue(spec: FieldSpec, connection: Connection | null): string | undefined {
  const fallback = "default" in spec && typeof spec.default === "string" ? spec.default.replaceAll("{siteUrl}", connection?.siteUrl ?? "") : undefined;
  if (spec.key === "clientId") return connection?.platform?.clientId ?? fallback;
  if (spec.key === "deploymentId") return connection?.platform?.deploymentIds[0] ?? fallback;
  return fallback;
}
type WizardProps = ChannelWizardProps & { manifest: ChannelManifest };
function useWizard(props: WizardProps) {
  const { manifest } = props;
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
    return <label key={spec.key}>{text(spec.label)}
      {spec.kind === "choice" ? <Select name={spec.key} required={spec.required} defaultValue={ready.find((p) => p.id === selected.defaultProfile)?.id ?? ready[0]?.id}>
        {ready.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
      </Select> : <Input name={spec.key} required={spec.required} type={spec.kind === "origin" || spec.kind === "url" ? "url" : "text"}
        defaultValue={initialFieldValue(spec, connection)}
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
  async function renew() {
    if (!connection) return;
    setBusy(true); setError(null);
    try {
      const updated = await api<{ registrationUrl: string; expiresAt: string }>(`/connections/${idPath(connection.id)}/registration-url`, { method: "POST" });
      if (alive.current) props.onChanged({ ...connection, registrationUrl: updated.registrationUrl, registrationUrlExpiresAt: updated.expiresAt });
    } catch (reason) { if (alive.current) setError(reason); }
    finally { if (alive.current) setBusy(false); }
  }
  return { manifest, connection, method, setMethod, error, busy, fields, text, ready, finished, hasBinding, authority, field, submit, renew };
}
type WizardState = ReturnType<typeof useWizard>;
const WizardContext = createContext<WizardState | null>(null);
function useWizardState(): WizardState {
  const state = useContext(WizardContext);
  if (!state) throw new Error("Render default steps inside the manifest wizard.");
  return state;
}
/** Tool settings and registration URL. Use inside a shell step override to reuse the default. */
export function ShowStep() {
  const state = useWizardState();
  const { manifest, connection, method, busy, text, renew } = state;
  return <>
      <h2>Tool settings</h2>
      <ol className="list-decimal space-y-3 pl-5">{manifest.texts.adminSteps.map((step, index) => <li key={index}>{text(step)}</li>)}</ol>
      {connection && manifest.lti?.toolConfiguration === "channel" && <ToolConfiguration id={connection.id} lmsName={manifest.names.text} />}
      {connection?.registrationUrl && <CopyButton label="Registration URL" value={connection.registrationUrl} />}
      {connection && connection.status === "pending" && method === "dynamic" && <Button type="button" disabled={busy} onClick={renew}>Get registration URL</Button>}
    </>;
}
/** Create fields or the pending platform fields. Use inside a shell step override to reuse the default. */
export function CollectStep() {
  const state = useWizardState();
  const { manifest, connection, method, setMethod, fields, field, ready, busy, hasBinding } = state;
  return <>
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
    </>;
}
/** Instructions and approval field selected by stored authority. Use inside a shell step override to reuse the default. */
export function VerifyStep() {
  const state = useWizardState();
  const { manifest, authority, hasBinding, fields, field, busy } = state;
  return <>
      <h2>Verify connection</h2>
      <VerificationInstructions authority={authority} name={manifest.names.text} />
      {authority === "operatorGrant" && hasBinding && field(fields(manifest.setup.bindingFields).find((item) => item.kind === "grantCode") ?? { key: "grantCode", label: "Approval code", kind: "grantCode", required: true })}
      {hasBinding && <Button disabled={busy}>Save</Button>}
    </>;
}
/** Teacher instructions and the completion heading. Use inside a shell step override to reuse the default. */
export function EnableStep() {
  const state = useWizardState();
  const { manifest, finished, text } = state;
  return <>
      <h2>{finished ? "Your library is connected" : "Enable the connection"}</h2>
      <ol className="list-decimal space-y-3 pl-5">{manifest.texts.teacherSteps.map((step, index) => <li key={index}>{text(step)}</li>)}</ol>
    </>;
}
const defaultSteps: Record<WizardStep, React.ComponentType> = {
  show: ShowStep, collect: CollectStep, verify: VerifyStep, enable: EnableStep,
};
/** The manifest binding form for a module that uses the default verification step. */
export function ManifestBinding(props: WizardProps) {
  const state = useWizard(props);
  return <WizardContext.Provider value={state}><form className="flex flex-col gap-5" onSubmit={state.submit}>
    <CollectStep /><VerifyStep /><ChannelErrorNotice error={state.error} />
  </form></WizardContext.Provider>;
}
export function ManifestWizard({ module, ...props }: WizardProps & { module?: ChannelUiModule }) {
  const state = useWizard(props);
  return <WizardContext.Provider value={state}><form className="flex flex-col gap-5" onSubmit={state.submit}>
    {(["show", "collect", "verify", "enable"] as const).map((step) => {
      const Override = module?.steps?.[step];
      const Default = defaultSteps[step];
      return <Card key={step} data-channel-step={step} className="flex flex-col gap-5"><p className="eyebrow">{step}</p>{Override ? <Override {...props} /> : <Default />}</Card>;
    })}
    <ChannelErrorNotice error={state.error} />
  </form></WizardContext.Provider>;
}
