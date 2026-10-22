import type { ChannelUiModule } from "@cogniate/portal-sdk";
import { Card, ConnectionDetailBlock } from "@cogniate/portal-sdk";
import { CanvasWizard, CanvasTeacherSteps } from "./CanvasWizard.tsx";
import { CanvasBinding } from "./CanvasBinding.tsx";
const module: ChannelUiModule = {
  Wizard: CanvasWizard, TeacherSteps: CanvasTeacherSteps,
  ConnectionDetails: ({ connection }) => <ConnectionDetailBlock connection={connection} serviceLabel="Canvas service URL" />,
  connectionPanels: [({ connection, sdk }) => connection.capabilities.addDeployment && connection.status !== "pending"
    ? <Card className="flex flex-col gap-5"><h2>Add deployment ID</h2><CanvasBinding key={connection.id} connection={connection} onChanged={sdk.refresh} addDeployment /></Card> : null],
};
export default module;
