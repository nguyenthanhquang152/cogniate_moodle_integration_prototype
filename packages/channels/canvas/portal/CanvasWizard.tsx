import manifest from "../manifest.ts";
import { Notice, ConnectionReady, verificationAuthority, VerificationInstructions } from "@cogniate/portal-sdk";
import type { ReactNode } from "react";
import { Card } from "@cogniate/portal-sdk";
import type { ChannelWizardProps } from "@cogniate/portal-sdk";
import { CanvasCreate } from "./CanvasCreate.tsx";
import { CanvasConfiguration } from "./CanvasConfiguration.tsx";
import { CanvasBinding } from "./CanvasBinding.tsx";
import steps from "./steps.ts";

function Step({ index, children }: { index: number; children?: ReactNode }) {
  const step = steps.steps[index]!;
  return <Card className="flex flex-col gap-5" data-step-id={step.id}>
    <p className="text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">STEP {index + 1}</p>
    <h2>{step.title}</h2>
    {index === 2 ? null : <ol className="list-decimal space-y-3 pl-5">
      {step.instructions.map((text) => <li key={text}>{text}</li>)}
    </ol>}
    {children}
  </Card>;
}
export function CanvasTeacherSteps() {
  return <Step index={3} />;
}
export function CanvasWizard(props: ChannelWizardProps) {
  if (!props.connection) return <Step index={0}><CanvasCreate {...props} /></Step>;
  if (props.connection.status === "disabled") return <Notice>This connection is disconnected. Connecting again does not restore its old course items.</Notice>;
  if (props.connection.status !== "pending") return <><ConnectionReady connection={props.connection} libraryName={props.libraryName} /><CanvasTeacherSteps /></>;
  const authority = verificationAuthority(manifest, props.connection, props.connection.method);
  return <>
    <Step index={1}><CanvasConfiguration key={props.connection.id} id={props.connection.id} /></Step>
    <Step index={2}>{authority === "operatorGrant" ? <CanvasBinding key={props.connection.id} connection={props.connection} onChanged={props.onChanged} /> : <VerificationInstructions authority={authority} name={manifest.names.text} />}</Step>
  </>;
}
