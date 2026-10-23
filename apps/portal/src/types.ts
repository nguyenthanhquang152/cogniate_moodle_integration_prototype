// Browser DTOs follow docs/architecture/contracts/cogniate-app-api.md. No service imports.
import type { BindingAuthority, CapabilitySet, ChannelManifest, LegacyCapabilities, LegacyPublicationFields } from "@cogniate/channel-kernel";

export type Lms = string;
/** The six M1 capability flags; the frozen names come from the kernel (BD-A1-64). */
export type LmsCapabilities = LegacyCapabilities;
export interface LmsProfile {
  id: string;
  label: string;
  simulation: boolean;
  ready: boolean;
  clientId: string | null;
}
export interface LmsProvider {
  channel?: string;
  channelName?: string;
  family?: ChannelManifest["family"];
  channelCapabilities?: CapabilitySet;
  registration?: Omit<ChannelManifest["registration"][number], "defaultProfile">[];
  lms: Lms;
  label: string;
  methods: ("dynamic" | "manual")[];
  capabilities: LmsCapabilities;
  profiles: LmsProfile[];
}
export interface LmsProvidersResponse {
  lms: LmsProvider[];
}
export interface ConnectionCreateBody {
  name: string;
  siteUrl: string;
  method: "dynamic" | "manual";
  channel?: string;
  lms?: string;
  profile?: string;
  serviceUrl?: string;
  [key: string]: unknown;
}
export interface ClientBindingBody {
  clientId: string;
  deploymentId: string;
  grantCode: string;
}
export interface DeploymentBindingBody {
  deploymentId: string;
  grantCode: string;
  clientId?: string;
}
export interface AddDeploymentBody {
  deploymentId: string;
  grantCode: string;
}
export interface ConfigurationSnapshot {
  text: string;
  keyId: string | null;
}
export interface Session {
  user: { id: string; name: string; email: string; role: string };
  library: { id: string; name: string };
}
export interface Connection {
  channel?: string;
  channelName?: string;
  channelCapabilities?: CapabilitySet;
  bindingAuthority?: BindingAuthority | "verifiedAdminLaunch";
  id: string;
  name: string;
  siteUrl: string;
  serviceUrl: string;
  lms: Lms;
  profile: string;
  capabilities: LmsCapabilities;
  method: "dynamic" | "manual";
  status: "pending" | "registered" | "connected" | "disabled";
  registrationUrl: string | null;
  registrationUrlExpiresAt: string | null;
  createdAt: string;
  lastLaunchAt: string | null;
  webServices: { siteName: string; release: string } | null;
  platform: {
    id: string;
    issuer: string;
    clientId: string;
    deploymentIds: string[];
    productFamilyCode: string | null;
    siteUrl: string;
    serviceUrl: string;
  } | null;
  lastError: {
    title?: string;
    action?: string;
    code: string;
    ltiCode: string | null;
    traceId: string;
    at: string;
  } | null;
}
export interface ToolRow {
  key: string;
  label: string;
  value: string;
}
export interface Course {
  id: string;
  title: string;
  summary: string;
  variant: string;
  lang: string;
  createdAt: string;
  latestVersion: {
    id: string;
    version: number;
    format: string;
    createdAt: string;
  } | null;
  publications: { id: string; connectionId: string; status: string }[];
  versions?: CourseVersion[];
}
export interface CourseVersion {
  id: string;
  courseId: string;
  version: number;
  format: string;
  packageId: string;
  createdAt: string;
  report: {
    format: string;
    entryPath: string;
    totalBytes: number;
    fileCount: number;
    scorm: {
      title: string;
      masteryScore: number | null;
      scoCount: number;
      schemaVersion: string;
    } | null;
    html: {
      pages: string[];
      menuPage: string | null;
      questionIds: string[];
    } | null;
    externalHosts: string[];
    warnings: { code: string; detail: string }[];
  };
  trackingProfile: {
    pages: string[];
    questionIds: string[];
    masteryScore: number | null;
  };
}
export interface MbzBuild {
  buildId: string;
  courseId: string;
  versionId: string;
  updatedAt: string;
  status: "queued" | "running" | "ready" | "failed";
  step: string | null;
  reason: string | null;
  bytes: number | null;
  createdAt: string;
  finishedAt: string | null;
  downloadUrl: string | null;
}
/** The frozen extension fields (moodleCourse, shellStatus, shellError) come from the kernel (BD-A1-64). */
export interface Publication extends LegacyPublicationFields {
  id: string;
  lms: Lms;
  connectionName: string;
  connectionId: string;
  courseId: string;
  courseTitle: string;
  versionId: string;
  version: number;
  format: string;
  status: "available" | "withdrawn";
  createdAt: string;
  updatedAt: string;
  stats: {
    activities: number;
    learners: number;
    inProgress: number;
    completed: number;
    passed: number;
    failed: number;
    lastScoreSync: string | null;
  };
}
export interface ScoreSync {
  id: string;
  status: "pending" | "sent" | "failed" | "conflict" | "superseded";
  tries: number;
  scoreGiven: number;
  scoreMaximum: number;
  createdAt: string;
  sentAt: string | null;
  lastError: string | Record<string, unknown> | null;
}
export interface ResultRow {
  learner: { sub: string; label: string };
  activity: { resourceLinkId: string; contextTitle: string; title: string };
  preview: boolean;
  best: {
    attemptId: string;
    outcome: string;
    scoreGiven: number | null;
    scoreMaximum: number | null;
  } | null;
  attempts: {
    attemptId: string;
    versionId: string;
    outcome: string;
    scoreGiven: number | null;
    scoreMaximum: number | null;
    updatedAt: string;
  }[];
  scoreSyncs: ScoreSync[];
  gradebook: {
    resultScore: number | null;
    resultMaximum: number | null;
    readAt: string;
  } | null;
  gradebookDiffers?: boolean;
}
export interface RejectReason {
  code: string;
  title: string;
  action: string;
  path?: string;
  detail: string;
}
export interface ErrorDetails {
  message?: string;
  description?: string;
  action?: string;
  fields?: Record<string, string> | string[];
  field?: string;
  rule?: number;
  /** A specific cause of a refusal, for example "staged_gone" (BD-A1-102). The portal then keeps the server description. */
  reason?: string;
  capability?: keyof LmsCapabilities;
  reasons?: RejectReason[];
  traceId?: string;
}
