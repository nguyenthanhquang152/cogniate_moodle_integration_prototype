import type { ChannelUiModule } from "@cogniate/portal-sdk";
import { BlackboardWizard, BlackboardTeacherSteps } from "./BlackboardWizard.tsx";
export default { Wizard: BlackboardWizard, TeacherSteps: BlackboardTeacherSteps } satisfies ChannelUiModule;
