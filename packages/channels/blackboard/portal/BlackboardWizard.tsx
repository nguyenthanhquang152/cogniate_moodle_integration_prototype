import manifest from "../manifest.ts";
import { Notice, ConnectionReady } from "@cogniate/portal-sdk";
// Blackboard Learn wizard (M2): create, register, approve, teacher steps. The shared shell owns routing, loading,
// polling, provider and connection checks, the overview and disconnect (connect/wizard-types.ts).
import type { ReactNode } from "react";
import { Card } from "@cogniate/portal-sdk";
import { CopyButton } from "@cogniate/portal-sdk";
import { ToolConfiguration } from "@cogniate/portal-sdk";
import type { ProviderWizardProps } from "@cogniate/portal-sdk";
import { BlackboardBinding } from "./BlackboardBinding.tsx";
import { BlackboardCreate } from "./BlackboardCreate.tsx";
import steps from "./blackboard-steps.json";

/** One step card. `list={false}`: the form in `children` shows the step instructions in context, so no list here. */
function Step({ index, list = true, children }: { index: number; list?: boolean; children?: ReactNode }) {
  const step = steps.steps[index]!;
  return <Card className="flex flex-col gap-5" data-step-id={step.id}>
    <p className="text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">STEP {index + 1}</p>
    <h2>{step.title}</h2>
    {list && <ol className="list-decimal space-y-3 pl-5">
      {[manifest.texts.adminSteps.slice(0, 2), manifest.texts.adminSteps.slice(2, 9), manifest.texts.adminSteps.slice(9), manifest.texts.teacherSteps][index]!.map((value) => value.replaceAll("{LMS}", manifest.names.text)).map((text) => <li key={text}>{text}</li>)}
    </ol>}
    {children}
  </Card>;
}

export function BlackboardTeacherSteps() {
  return <Step index={3} />;
}

export function BlackboardWizard(props: ProviderWizardProps) {
  if (!props.connection) return <Step index={0}><BlackboardCreate {...props} /></Step>;
  if (props.connection.status === "disabled") return <Notice>This connection is disconnected. Connecting again does not restore its old course items.</Notice>;
  if (props.connection.status !== "pending") return <><ConnectionReady connection={props.connection} libraryName={props.libraryName} /><BlackboardTeacherSteps /></>;
  const connection = props.connection;
  // The Blackboard Application ID of the shared platform (GET /app-api/lms-providers, profile clientId).
  const clientId = props.provider.profiles.find((profile) => profile.id === connection.profile)?.clientId ?? "";
  return <>
    <Step index={1}>
      <div className="flex flex-wrap items-center gap-3" data-client-id>
        <span>Client ID</span>
        <code className="wrap-anywhere">{clientId}</code>
        <CopyButton label="Client ID" value={clientId} />
      </div>
      <ToolConfiguration key={connection.id} id={connection.id} lmsName="Blackboard" />
    </Step>
    <Step index={2} list={false}><BlackboardBinding key={connection.id} connection={connection} onChanged={props.onChanged} /></Step>
  </>;
}
