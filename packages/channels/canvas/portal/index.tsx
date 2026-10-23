import type { ChannelUiModule } from "@cogniate/portal-sdk";
import { Card, ConnectionDetailBlock } from "@cogniate/portal-sdk";
import { CanvasWizard, CanvasTeacherSteps } from "./CanvasWizard.tsx";
import { CanvasBinding } from "./CanvasBinding.tsx";
import { CanvasKeyJson } from "./CanvasKeyJson.tsx";
const module: ChannelUiModule = {
  Wizard: CanvasWizard, TeacherSteps: CanvasTeacherSteps,
  ConnectionDetails: ({ connection }) => <ConnectionDetailBlock connection={connection} serviceLabel="Canvas service URL" />,
  connectionPanels: [({ connection, sdk }) => connection.capabilities.addDeployment && connection.status !== "pending"
    ? <Card className="flex flex-col gap-5"><h2>Add deployment ID</h2><CanvasBinding key={connection.id} connection={connection} onChanged={sdk.refresh} addDeployment /></Card> : null,
  // BD-A2-101: the key JSON again for an active connection, for example after a signing key change (LA-ADR-08 D5).
  ({ connection }) => connection.status === "registered" || connection.status === "connected" ? <CanvasKeyJson key={connection.id} connection={connection} /> : null],
};
export default module;
