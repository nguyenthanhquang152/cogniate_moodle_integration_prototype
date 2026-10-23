import type { ReactNode } from "react";
import { Card } from "../../ui/card.tsx";
import type { ProviderWizardProps } from "../wizard-types.ts";
import { CanvasCreate } from "./CanvasCreate.tsx";
import { CanvasConfiguration } from "./CanvasConfiguration.tsx";
import { CanvasBinding } from "./CanvasBinding.tsx";
import steps from "./canvas-steps.json";

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
export function CanvasWizard(props: ProviderWizardProps) {
  if (!props.connection) return <Step index={0}><CanvasCreate {...props} /></Step>;
  if (props.connection.status === "disabled") return null;
  if (props.connection.status !== "pending") return <CanvasTeacherSteps />;
  return <>
    <Step index={1}><CanvasConfiguration key={props.connection.id} id={props.connection.id} /></Step>
    <Step index={2}><CanvasBinding key={props.connection.id} connection={props.connection} onChanged={props.onChanged} /></Step>
  </>;
}
