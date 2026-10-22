import type { ComponentType } from "react";
import type { Connection, Course, CourseVersion, Publication, LmsProvider } from "../types.ts";
import * as apiClient from "../api.ts";
import * as ui from "./ui.ts";
import { useApi } from "../hooks.ts";

export * from "../api.ts";
export * from "../hooks.ts";
export * from "../types.ts";
export * from "./ui.ts";
export * from "./session.ts";
export { pendingToolText } from "@cogniate/channel-kernel";
export { ConnectionDetailBlock, ConnectionReady } from "../connect/ConnectionStatus.tsx";
export * from "../connect/provider-errors.tsx";
export { ToolConfiguration } from "../connect/ToolConfiguration.tsx";
export { Link, MemoryRouter, useNavigate } from "react-router";
export { ArrowRight, ExternalLink, Link2, ShieldCheck, Download, GraduationCap } from "lucide-react";
export type { ChannelManifest, CapabilitySet, BindingAuthority } from "@cogniate/channel-kernel";
export { fillText } from "@cogniate/channel-kernel";

export type ProviderView = LmsProvider;
export type ConnectionView = Connection;
export type CourseView = Course;
export type CourseVersionView = CourseVersion;
export type PublicationView = Publication;
export type PortalApi = typeof apiClient;
export type PortalUiKit = typeof ui;
export interface PortalSdk {
  api: PortalApi;
  useApi: typeof useApi;
  navigate(to: string): void;
  refresh(): void;
  ui: PortalUiKit;
}
export interface ChannelWizardProps {
  provider: ProviderView;
  connection: ConnectionView | null;
  libraryName: string;
  opener: string;
  onCreated(connection: ConnectionView): void;
  onChanged(connection: ConnectionView): void;
  sdk: PortalSdk;
}
export type ProviderWizardProps = ChannelWizardProps;
export type WizardStep = "show" | "collect" | "verify" | "enable";
export interface ConnectionErrorProps {
  connection: ConnectionView;
  error: NonNullable<ConnectionView["lastError"]>;
  libraryName: string;
  sdk: PortalSdk;
}
export interface ChannelUiModule {
  Wizard?: ComponentType<ChannelWizardProps>;
  steps?: Partial<Record<WizardStep, ComponentType<ChannelWizardProps>>>;
  TeacherSteps?: ComponentType;
  connectionPanels?: ComponentType<{ connection: ConnectionView; sdk: PortalSdk }>[];
  coursePanels?: ComponentType<{ course: CourseView; version: CourseVersionView | null; onChanged(): void; sdk: PortalSdk }>[];
  publicationPanels?: ComponentType<{ publication: PublicationView; onChanged(): void; sdk: PortalSdk }>[];
  ConnectionDetails?: ComponentType<{ connection: ConnectionView; sdk: PortalSdk }>;
  ConnectionError?: ComponentType<ConnectionErrorProps & { Default: ComponentType<ConnectionErrorProps> }>;
}
export function createPortalSdk(navigate: (to: string) => void, refresh: () => void = () => undefined): PortalSdk {
  return { api: apiClient, useApi, navigate, refresh, ui };
}

export { verificationAuthority, VerificationInstructions } from "../channels/verification.tsx";
export { ManifestBinding } from "../channels/ManifestWizard.tsx";
export { channelText, toolName } from "../channels/registry.ts";
