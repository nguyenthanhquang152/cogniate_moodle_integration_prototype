import type { ApprovalLms, ProviderWizardModule } from "./wizard-types.ts";

// Static wiring only. Each provider module is added when its owner delivers it.
// An absent module cannot offer a working connection flow.
export const providerWizards: Partial<Record<ApprovalLms, ProviderWizardModule>> = {};
