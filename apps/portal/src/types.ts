// Browser DTOs follow docs/architecture/contracts/cogniate-app-api.md. No service imports.
export type Lms = "moodle" | "canvas" | "blackboard";
export interface LmsCapabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}
export interface LmsProfile {
  id: string;
  label: string;
  simulation: boolean;
  ready: boolean;
  clientId: string | null;
}
export interface LmsProvider {
  lms: Lms;
  label: string;
  methods: ("dynamic" | "manual")[];
  capabilities: LmsCapabilities;
  profiles: LmsProfile[];
}
export interface LmsProvidersResponse {
  lms: LmsProvider[];
}
export type ConnectionCreateBody =
  | { name: string; siteUrl: string; method: "dynamic" | "manual"; lms?: "moodle"; profile?: "standard" }
  | { name: string; siteUrl: string; method: "manual"; lms: "canvas"; profile: string; serviceUrl?: string }
  | { name: string; siteUrl: string; method: "manual"; lms: "blackboard"; profile: string };
export interface CanvasPlatformBody {
  clientId: string;
  deploymentId: string;
  grantCode: string;
}
export interface BlackboardPlatformBody {
  deploymentId: string;
  grantCode: string;
  clientId?: string;
}
export interface AddDeploymentBody {
  deploymentId: string;
  grantCode: string;
}
export interface CanvasConfigurationSnapshot {
  text: string;
  keyId: string | null;
}
export interface Session {
  user: { id: string; name: string; email: string; role: string };
  library: { id: string; name: string };
}
export interface Connection {
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
export interface Publication {
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
  moodleCourse: { id: number; idnumber: string; url: string } | null;
  shellStatus: "created" | "exists" | "failed" | null;
  shellError: string | null;
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
  capability?: keyof LmsCapabilities;
  reasons?: RejectReason[];
  traceId?: string;
}
