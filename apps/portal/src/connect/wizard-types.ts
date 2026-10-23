import type { ComponentType } from "react";
import type { Connection, LmsProvider } from "../types.ts";

export type ApprovalLms = "canvas" | "blackboard";

/**
 * A provider wizard renders create (connection=null), setup (pending), or
 * teacher guidance (registered/connected). The shared shell owns routing,
 * loading, polling, provider/connection checks, overview and disconnect.
 */
export interface ProviderWizardProps {
  provider: LmsProvider;
  connection: Connection | null;
  libraryName: string;
  opener: string;
  onCreated: (connection: Connection) => void;
  onChanged: (connection: Connection) => void;
}

export interface ProviderWizardModule {
  Wizard: ComponentType<ProviderWizardProps>;
  /** The same teacher instructions are shown after publication. */
  TeacherSteps: ComponentType;
}
