import type { ComponentType } from "react";
import type { Connection, Course, CourseVersion, Publication, LmsProvider } from "../types.ts";
import { ApiError, api, idPath, extension, configurationSnapshot, uploadPackage } from "../api.ts";
import * as ui from "./ui.ts";
import { useApi } from "../hooks.ts";

// API client: authenticated requests, extension routes, exports and uploads.
export { ApiError, api, idPath, extension, configurationSnapshot, uploadPackage };
// Hooks: request lifecycle, mounted state and the signed-in library session.
export { useApi, useAlive } from "../hooks.ts";
export { SessionContext, useSession } from "./session.ts";
// DTO types: request bodies and read-only views returned by the app API.
export type {
  Lms, LmsCapabilities, LmsProfile, LmsProvider, LmsProvidersResponse, ConnectionCreateBody,
  ClientBindingBody, DeploymentBindingBody, AddDeploymentBody, ConfigurationSnapshot,
  Session, Connection, ToolRow, Course, CourseVersion, MbzBuild, Publication, ScoreSync,
  ResultRow, RejectReason, ErrorDetails,
} from "../types.ts";
// UI kit: stable controls, state views, navigation and icons used by channel modules.
export { ErrorNotice, ConnectionError, DefaultConnectionError, connectionStatus, ConnectionBadge, CopyButton, Loading, Empty, formatName, Modal, Button, buttonVariants, Card, Input, Select, Textarea, Notice, Badge, Tabs } from "./ui.ts";
export { ConnectionDetailBlock, ConnectionOpenLink, ConnectionReady } from "../connect/ConnectionStatus.tsx";
export { ToolConfiguration } from "../connect/ToolConfiguration.tsx";
export { Link, MemoryRouter, useNavigate } from "react-router";
export { ArrowRight, ExternalLink, Link2, ShieldCheck, Download, GraduationCap } from "lucide-react";
// Error helpers: safe field errors, descriptions and the existing pending-tool action. Texts that can name an LMS
// come from the channel's manifest `texts.errors`: providerErrorMessage and channelErrorText take the channel, and
// the two notices use the channel of ChannelScope (the shell sets it on the connect routes), else generic texts
// (BD-A1-63). ProviderErrorNotice also replaces the other provider error texts; ChannelErrorNotice keeps the server
// text for every error whose text cannot name an LMS.
export { providerErrorMessage, providerErrorFields, ProviderErrorNotice, channelErrorText, ChannelErrorNotice } from "../connect/provider-errors.tsx";
export type { ChannelErrorTexts } from "../connect/provider-errors.tsx";
export { ChannelScope } from "../channels/context.tsx";
export { pendingToolText } from "@cogniate/channel-kernel";
// Manifest helpers and default wizard parts; they share the shell's authority and text rules.
export type { ChannelManifest, CapabilitySet, BindingAuthority } from "@cogniate/channel-kernel";
export { fillText } from "@cogniate/channel-kernel";
export { channelText, toolName } from "../channels/registry.ts";
export { verificationAuthority, VerificationInstructions } from "../channels/verification.tsx";
export { ManifestBinding, ShowStep, CollectStep, VerifyStep, EnableStep } from "../channels/ManifestWizard.tsx";

export type ConnectionView = Connection;
export type CourseView = Course;
export type CourseVersionView = CourseVersion;
export type PublicationView = Publication;
const apiClient = { ApiError, api, idPath, extension, configurationSnapshot, uploadPackage };
export type PortalApi = typeof apiClient;
export type PortalUiKit = typeof ui;
/** Services provided by the shell. No channel module needs to import shell internals. */
export interface PortalSdk {
  /** The named API client helpers exported above. */
  api: PortalApi;
  /** Read a JSON resource with cancellation and reload support. */
  useApi: typeof useApi;
  /** Navigate to a portal route without reloading the page. */
  navigate(to: string): void;
  /** Reload the parent view after a successful mutation; a no-op when no reload applies. */
  refresh(): void;
  /** The named controls in the SDK UI kit. */
  ui: PortalUiKit;
}
/** Context shared by a whole wizard and each optional step override. */
export interface ChannelWizardProps {
  /** The server's channel entry, including profile readiness and configured client IDs. */
  provider: LmsProvider;
  /** The current saved connection; null on the create route. Its bindingAuthority wins. */
  connection: ConnectionView | null;
  /** The signed-in library name for manifest text placeholders. */
  libraryName: string;
  /** The opener token passed to a registration window. */
  opener: string;
  /** Call after create succeeds; the shell opens this connection's manage route. */
  onCreated(connection: ConnectionView): void;
  /** Call with the complete updated DTO after a successful connection change. */
  onChanged(connection: ConnectionView): void;
  /** Shell services for requests, navigation, refresh and shared controls. */
  sdk: PortalSdk;
}
export type WizardStep = "show" | "collect" | "verify" | "enable";
/** Error context passed to the optional channel error slot and its default component. */
export interface ConnectionErrorProps {
  /** The connection whose latest error is being shown. */
  connection: ConnectionView;
  /** The server error, including its code and trace ID. */
  error: NonNullable<ConnectionView["lastError"]>;
  /** The library name, used only for channel-specific action text. */
  libraryName: string;
  /** The same services supplied to the channel's wizard. */
  sdk: PortalSdk;
}
/** Optional portal module discovered beside a channel manifest. Omit unused slots. */
export interface ChannelUiModule {
  /** Replaces the whole wizard on create/manage routes. Without it, the shell renders four manifest steps. Must select verification from bindingAuthority. */
  Wizard?: ComponentType<ChannelWizardProps>;
  /** Replaces individual shell steps, only when Wizard is absent. Unspecified steps use the SDK defaults; overrides can render those defaults inside the shell. */
  steps?: Partial<Record<WizardStep, ComponentType<ChannelWizardProps>>>;
  /** Teacher instructions in the course publication view; defaults to manifest teacherSteps. */
  TeacherSteps?: ComponentType;
  /** Extra panels below the connection wizard. An absent list adds no panels. */
  connectionPanels?: ComponentType<{ connection: ConnectionView; sdk: PortalSdk }>[];
  /** Extra course panels with its selected version (null before upload) and reload callback. An absent list adds no panels. */
  coursePanels?: ComponentType<{ course: CourseView; version: CourseVersionView | null; onChanged(): void; sdk: PortalSdk }>[];
  /** Extra publication panels and their reload callback. An absent list adds no panels. */
  publicationPanels?: ComponentType<{ publication: PublicationView; onChanged(): void; sdk: PortalSdk }>[];
  /** Replaces connection overview details. Defaults to the generic name, site and deployments. */
  ConnectionDetails?: ComponentType<{ connection: ConnectionView; sdk: PortalSdk }>;
  /** Renders only when lastError exists. Use Default for the generic safe text, code and trace ID; the shell uses it when this slot is absent. */
  ConnectionError?: ComponentType<ConnectionErrorProps & { Default: ComponentType<ConnectionErrorProps> }>;
}
/** Make the SDK for one shell view; a caller can omit refresh for a static view. */
export function createPortalSdk(navigate: (to: string) => void, refresh: () => void = () => undefined): PortalSdk {
  return { api: apiClient, useApi, navigate, refresh, ui };
}
