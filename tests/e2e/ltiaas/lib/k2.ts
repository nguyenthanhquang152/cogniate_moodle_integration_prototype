// K2 browser conformance kit helpers (LA-E7-07: U1–U4, plus LA-E7-09 R2-sim).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E7-07.md (AC-LA-E7-07-01..05)
// - docs/architecture/ltiaas/tasks/LA-E1-11.md (AC-LA-E1-11-04, AC-LA-E1-11-05)
// - docs/architecture/ltiaas/tasks/LA-E2-05.md (AC-LA-E2-05-03)
// - docs/architecture/ltiaas/tasks/LA-E3-02.md (AC-LA-E3-02-08, AC-LA-E3-02-09)
// - docs/architecture/ltiaas/tasks/LA-E7-09.md (AC-LA-E7-09-01..05)
// - Public test entry points: @cogniate/channel-kernel (LA-E1-02)
import path from 'node:path';
import type { BrowserContext, Frame, Locator, Page, TestInfo } from '@playwright/test';
import { THANH } from '../../../acceptance/lib/app';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  APP,
  BLACKBOARD,
  CLOUD,
  ROLE,
  SELF,
  admin,
  app,
  blackboardBinding,
  canvasBinding,
  canvasClientId,
  canvasDeploymentId,
  canvasPending,
  captureSecrets,
  check,
  cli,
  completeHtml,
  deepLinkPatch,
  embeddedPath,
  escape,
  fixtureZip,
  gate,
  hostAction,
  issueGrant,
  jsonRequest,
  ok,
  pause,
  pickerUrlFor,
  playPath,
  publicationFor,
  rememberPrivate,
  requireShas,
  scenario,
  serverLaunch,
  session,
  sharedPlatform,
  sim,
  unique,
  urls,
  waitForFrame,
  type Bound,
  type Grant,
  type Json,
  type Target as BaseTarget,
} from '../../../acceptance/M1/canvas/browser';
import { doCourse, shellText } from '../../lib/learner';
import { cellUnder, createCourseWithZip, publicationOf, resultsApi, resultsRow } from '../../lib/portal';
import {
  COURSE_ZIP,
  ERR,
  FORBIDDEN_FIELDS,
  TEACHER,
  TEXT,
  blackboardGrantFor,
  blackboardStep1,
  blackboardToStep3,
  button,
  canvasGrantFor,
  canvasStep1,
  canvasToStep3,
  card,
  clipboardDenied,
  clipboardText,
  codeCleared,
  connectControl,
  connection,
  connections,
  errorNear,
  expect,
  fieldMarked,
  fillBlackboardStep3,
  fillCanvasStep3,
  gateClear,
  gateFailNext,
  integrations,
  libraryPage,
  manageControl,
  newestByName,
  noForbiddenFields,
  pendingWizard,
  portalSignIn,
  requireCourseZip,
  save,
  shot,
  test,
} from '../../M2/lib/m2';

export interface Target extends BaseTarget {
  issuer?: string;
}

export interface FieldSpec {
  readonly key: string;
  readonly label: string;
  readonly kind: string;
  readonly required: boolean;
  readonly method?: 'dynamic' | 'manual';
  readonly default?: string;
}

export interface ToolRowSpec {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface ChannelManifest {
  readonly id: string;
  readonly family: string;
  readonly names: { readonly text: string; readonly label: string };
  readonly card: {
    readonly title: string;
    readonly description: string;
    readonly mark: string;
    readonly icon?: string;
    readonly color: string;
    readonly category: string;
    readonly order: number;
  };
  readonly availability: 'ga' | 'preview' | 'simulation-only';
  readonly registration: ReadonlyArray<{
    readonly method: 'dynamic' | 'manual';
    readonly authority: 'self' | 'operatorGrant';
    readonly profiles: readonly string[];
    readonly defaultProfile: string;
  }>;
  readonly capabilities: Record<string, unknown>;
  readonly setup: {
    readonly createFields: readonly FieldSpec[];
    readonly bindingFields: readonly FieldSpec[];
    readonly toolRows?: readonly ToolRowSpec[];
    readonly connectionCheck?: boolean;
  };
  readonly texts: {
    readonly errors?: Record<string, string>;
    readonly adminSteps: readonly string[];
    readonly teacherSteps: readonly string[];
    readonly disconnect: string;
    readonly notReady: string | null;
    readonly registered?: string;
    readonly registration?: Record<string, string>;
  };
}

export interface CapabilitySet {
  readonly 'registration.dynamic': boolean;
  readonly 'binding.authority': Readonly<Record<string, 'self' | 'operatorGrant'>>;
  readonly 'registration.scopes': readonly string[];
  readonly 'deployments.multiple': boolean;
  readonly 'setup.artifacts': readonly string[];
  readonly 'siteApi.token': boolean;
  readonly 'publish.createCourse': boolean;
  readonly 'export.packages': readonly string[];
  readonly 'content.multiple': boolean;
  readonly 'content.ungraded': boolean;
  readonly 'launch.windowHint': boolean;
  readonly 'launch.topLevelContinue': boolean;
  readonly 'records.reporters': readonly string[];
  readonly 'records.readBack': boolean;
  readonly 'setup.connectionCheck': boolean;
}

export interface ChannelRegistry {
  channels(): readonly ChannelManifest[];
  channel(id: string): ChannelManifest | null;
  capabilities(id: string): CapabilitySet;
  textName(id: string): string;
}

export function fillText(
  template: string,
  values: Partial<Record<'LMS' | 'tool' | 'site', string>>,
): string {
  return template.replace(/\{(LMS|tool|site)\}/g, (match, key: 'LMS' | 'tool' | 'site') => values[key] ?? match);
}

export {
  APP,
  BLACKBOARD,
  CLOUD,
  COURSE_ZIP,
  ERR,
  FORBIDDEN_FIELDS,
  ROLE,
  SELF,
  TEACHER,
  TEXT,
  THANH,
  admin,
  app,
  blackboardBinding,
  blackboardGrantFor,
  blackboardStep1,
  blackboardToStep3,
  button,
  canvasBinding,
  canvasClientId,
  canvasDeploymentId,
  canvasGrantFor,
  canvasPending,
  canvasStep1,
  canvasToStep3,
  captureSecrets,
  card,
  cellUnder,
  check,
  cli,
  clipboardDenied,
  clipboardText,
  codeCleared,
  completeHtml,
  connectControl,
  connection,
  connections,
  createCourseWithZip,
  deepLinkPatch,
  doCourse,
  embeddedPath,
  errorNear,
  escape,
  expect,
  fieldMarked,
  fillBlackboardStep3,
  fillCanvasStep3,
  fixtureZip,
  gate,
  gateClear,
  gateFailNext,
  hostAction,
  httpsRequest,
  integrations,
  issueGrant,
  jsonRequest,
  libraryPage,
  manageControl,
  newestByName,
  noForbiddenFields,
  ok,
  pause,
  pendingWizard,
  pickerUrlFor,
  playPath,
  portalSignIn,
  publicationFor,
  publicationOf,
  rememberPrivate,
  requireCourseZip,
  requireShas,
  resultsApi,
  resultsRow,
  save,
  scenario,
  serverLaunch,
  session,
  sharedPlatform,
  shellText,
  shot,
  sim,
  test,
  unique,
  urls,
  waitForFrame,
  type Bound,
  type Frame,
  type Grant,
  type Json,
};

export const REPO_ROOT = path.resolve(__dirname, '../../../..');
export const CHANNELS_DIR = path.join(REPO_ROOT, 'packages/channels');

export const GENERIC_SIM = Object.freeze({
  provider: 'generic-sim',
  siteHost: 'generic.sim.test',
  siteUrl: 'https://generic.sim.test',
  issuer: 'https://generic.sim.test/lti',
  authUrl: 'https://generic.sim.test/lti/oidc/auth',
  jwksUrl: 'https://generic.sim.test/lti/jwks.json',
  sameHostTokenUrl: 'https://generic.sim.test/lti/oauth2/token',
  foreignHostTokenUrl: 'https://token.generic.sim.test/lti/oauth2/token',
  deployments: ['deploy-generic-1', 'deploy-generic-2', 'deploy-generic-3'] as const,
});

export const MOODLE_SIM = Object.freeze({
  provider: 'moodle-sim',
  siteHost: 'moodle.sim.test',
  siteUrl: 'https://moodle.sim.test',
  issuer: 'https://moodle.sim.test',
  authUrl: 'https://moodle.sim.test/mod/lti/auth.php',
  jwksUrl: 'https://moodle.sim.test/mod/lti/certs.php',
  tokenUrl: 'https://moodle.sim.test/mod/lti/token.php',
  deployments: ['1', '2'] as const,
});

export const BRIGHTSPACE_SIM = Object.freeze({
  provider: 'brightspace-sim',
  siteHost: 'brightspace.sim.test',
  siteUrl: 'https://brightspace.sim.test',
  issuer: 'https://brightspace.sim.test',
  authUrl: 'https://brightspace.sim.test/d2l/lti/authenticate',
  jwksUrl: 'https://brightspace.sim.test/d2l/.well-known/jwks',
  tokenUrl: 'https://auth.brightspace.sim.test/core/connect/token',
  tokenAudience: 'https://api.brightspace.sim.test/auth/token',
  deployments: [
    '8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90',
    '1c4e7b20-5a3d-4f9b-8d2e-3a6b7c8d9e01',
    '7a9b3c40-6d4e-4a1c-9e3f-4b7c8d9e0f12',
  ] as const,
});

export const CANVAS_SSO_ORIGIN = 'https://sso.canvas.sim.test';

/** The 14 standard tool-configuration keys of cogniate-app-api-delta.md §3.3, in order. */
export const STANDARD_14_TOOL_ROW_KEYS = [
  'tool_name',
  'tool_url',
  'lti_version',
  'public_key_type',
  'public_keyset_url',
  'initiate_login_url',
  'redirection_uris',
  'deep_linking',
  'content_selection_url',
  'launch_container',
  'ags',
  'nrps',
  'share_name',
  'share_email',
] as const;

/** The 9 D2L Brightspace tool-configuration keys of cogniate-app-api-delta.md §3.3, in order. */
export const D2L_9_TOOL_ROW_KEYS = [
  'tool_name',
  'domain',
  'redirect_urls',
  'openid_connect_login_url',
  'target_link_uri',
  'keyset_url',
  'extensions',
  'roles',
  'privacy',
] as const;

/** The 16 Moodle tool-configuration keys of cogniate-app contract §4.1, in order. */
export const MOODLE_16_TOOL_ROW_KEYS = [
  'tool_name',
  'tool_url',
  'lti_version',
  'public_key_type',
  'public_keyset_url',
  'initiate_login_url',
  'redirection_uris',
  'deep_linking',
  'content_selection_url',
  'tool_configuration_usage',
  'launch_container',
  'ags',
  'nrps',
  'share_name',
  'share_email',
  'accept_grades',
] as const;

/** Registers a K2 browser case with a `{case:<id>}` title tag for manifest coverage accounting. */
export function k2Case(
  id: string,
  title: string,
  fn: (fixtures: { page: Page; context: BrowserContext }, testInfo: TestInfo) => Promise<void>,
  timeoutMs = 240_000,
): void {
  test(`K2 ${id} ${title} {case:${id}}`, async ({ page, context }, testInfo) => {
    requireShas();
    test.setTimeout(timeoutMs);
    testInfo.annotations.push({ type: 'k2_case', description: `${id}: ${title}` });
    await fn({ page, context }, testInfo);
  });
}

/** Loads the product ChannelRegistry from `packages/channels/*` via `@cogniate/channel-kernel` (`LA-E1-02`). */
export async function loadProductChannelRegistry(simulations = true): Promise<ChannelRegistry> {
  const kernelSpecifier = ['@cogniate', 'channel-kernel'].join('/');
  const kernel = (await import(kernelSpecifier)) as {
    loadChannelFolders(
      roots: readonly string[],
      side: 'app' | 'lti',
    ): Promise<Array<{ folder: string; manifest: ChannelManifest; ltiProfiles?: unknown[]; appAdapter?: unknown }>>;
    buildChannelRegistry(
      channels: ReadonlyArray<{ folder: string; manifest: ChannelManifest; ltiProfiles?: unknown[] }>,
      options?: { simulations?: boolean },
    ): ChannelRegistry;
  };
  const appLoaded = await kernel.loadChannelFolders([CHANNELS_DIR], 'app');
  const ltiLoaded = await kernel.loadChannelFolders([CHANNELS_DIR], 'lti');
  const ltiByFolder = new Map(ltiLoaded.map((c) => [c.folder, c.ltiProfiles ?? []]));
  const merged = appLoaded.map((c) => ({
    ...c,
    ltiProfiles: ltiByFolder.get(c.folder) ?? [],
  }));
  return kernel.buildChannelRegistry(merged, { simulations });
}

/** Default simulator site URL for each product channel in the acceptance stack. */
export function defaultSimSiteUrl(channelId: string): string {
  switch (channelId) {
    case 'moodle':
      return MOODLE_SIM.siteUrl;
    case 'canvas':
      return CLOUD.siteA;
    case 'blackboard':
      return BLACKBOARD.siteA;
    case 'lti-generic':
      return GENERIC_SIM.siteUrl;
    case 'brightspace':
      return BRIGHTSPACE_SIM.siteUrl;
    default:
      return `https://${channelId}.sim.test`;
  }
}

export interface SimScenarioRegistration {
  openidConfiguration: string;
  registrationToken: string;
  tokenFormat: string;
  startUrl: string;
}

export interface SimScenarioResult {
  id: string;
  fields: Record<string, string>;
  loginUrl: string;
  registration: SimScenarioRegistration;
}

/**
 * Creates a simulator scenario on any provider (`generic-sim`, `brightspace-sim`, `moodle-sim`, `canvas-sim`, `blackboard-sim`)
 * without merging Canvas-specific `CANVAS_LOGIN` fields onto non-Canvas providers.
 */
export async function createSimScenario(target: Target, patch: Json = {}): Promise<SimScenarioResult> {
  const id = String(patch.id ?? unique('k2-sc'));
  const body: Json = {
    id,
    provider: target.provider,
    ...(target.issuer ? { issuer: target.issuer } : {}),
    clientId: target.clientId,
    deploymentId: target.deploymentId,
    siteHost: target.serviceHost,
    pageHost: target.pageHost ?? target.serviceHost,
    ...patch,
  };
  const r = await sim('/scenarios', 'POST', body);
  ok(r, 201, `createSimScenario(${target.provider})`);
  const rawLogin = (r.json.login ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawLogin)) {
    if (v !== null && v !== undefined) fields[k] = String(v);
  }
  return {
    id,
    fields,
    loginUrl: `${urls.lti}/lti/login/cogniate?${new URLSearchParams(fields).toString()}`,
    registration: r.json.registration as SimScenarioRegistration,
  };
}

/** Issues an operator grant via `app:grant issue` and returns the 43-character grant code + full stdout. */
export async function issueOperatorGrantCli(
  s: Json,
  connectionId: string,
  siteUrl: string,
  args: string[],
): Promise<{ code: string; stdout: string }> {
  const res = await cli('app:grant', [
    'issue',
    '--library',
    String(s.library.id),
    '--connection',
    connectionId,
    '--site',
    siteUrl,
    ...args,
  ]);
  check(res.code === 0, `app:grant issue failed (exit ${res.code}): ${res.stdout}\n${res.stderr}`);
  const match = res.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
  check(match, `No 43-character grant code found in CLI output: ${res.stdout}`);
  rememberPrivate(match[0]);
  return { code: match[0], stdout: res.stdout };
}

/** Clicks Step 1 "Next" or "Continue" across all channel wizards. */
export async function next(page: Page): Promise<void> {
  await button(page, /^(Next|Continue)$/i).first().click();
}

/**
 * Selects the registration method ('dynamic' | 'manual') on Step 1 of any channel wizard.
 * Handles both `<select>` (`combobox "Connection method"` on `lti-generic` / `brightspace`)
 * and radio groups (`Automatic` / `Dynamic Registration` vs `Manual` / `Developer key` on `moodle` / `canvas`).
 */
export async function selectRegistrationMethod(page: Page, method: 'dynamic' | 'manual'): Promise<void> {
  const combo = page.getByRole('combobox', { name: /Connection method/i });
  if ((await combo.count()) > 0) {
    const label = method === 'dynamic' ? 'Automatic' : 'Manual';
    await combo.first().selectOption({ label }).catch(async () => {
      await combo.first().selectOption(method);
    });
    return;
  }
  const radioPattern =
    method === 'dynamic' ? /^(Automatic|Dynamic(\s+Registration)?)/i : /^(Manual|Developer key)/i;
  const radio = page.getByRole('radio', { name: radioPattern });
  if ((await radio.count()) > 0) {
    await radio.first().check();
  }
}

/** Clicks the primary save/connect action button on Step 3 of a connection wizard. */
export function saveWizardConnection(page: Page): Locator {
  return button(page, /^(Save( connection)?|Connect( .*)?|Complete setup)$/i);
}

/**
 * Verifies that after submitting an operator approval code, the code is either cleared from the input
 * or the input is unmounted (when the connection transitions to `registered` in `ManifestWizard`),
 * and the code does not appear in the URL or web storage.
 */
export async function assertGrantCodeCleared(page: Page, code: string): Promise<void> {
  const input = page.getByLabel('Approval code');
  if ((await input.count()) > 0) {
    await expect(input.first()).toHaveValue('');
  }
  expect(page.url().includes(code)).toBe(false);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage.includes(code)).toBe(false);
}

/** Publishes a course via the portal "Publish to an LMS" dialog to the named connection. */
export async function publishCourseViaDialog(page: Page, courseId: string, connectionName: string): Promise<void> {
  await page.goto(`${APP}/libraries/courses/${courseId}`);
  await button(page, TEXT.publishTitle).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: TEXT.publishTitle })).toBeVisible();
  const select = dialog.getByLabel(TEXT.publishSelect, { exact: true });
  await expect(
    select.locator('option').filter({ hasText: new RegExp(`^\\s*${escape(connectionName)} \\(`) }),
  ).toHaveCount(1, { timeout: 15_000 });
  const label = await select.evaluate(
    (el, n) => Array.from((el as HTMLSelectElement).options).find((o) => o.text.trim().startsWith(`${n} (`))?.text ?? '',
    connectionName,
  );
  check(label, `Publish dialog lists connection "${connectionName}"`);
  await select.selectOption({ label });
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** Teacher Deep Linking pick inside the simulator's `/__frame` wrapper. */
export async function performTeacherDeepLinkPick(
  page: Page,
  target: Target,
  siteOrigin: string,
  courseTitle: string,
  shotPrefix: string,
): Promise<Json> {
  const sc = await createSimScenario(target, deepLinkPatch());
  await page.goto(`${siteOrigin}/__frame?url=${encodeURIComponent(sc.loginUrl)}`);
  const picker = await waitForFrame(page, (u) => u.origin === APP && u.pathname.startsWith('/tool/picker/'));
  await picker.getByRole('radio', { name: new RegExp(escape(courseTitle)) }).check();
  await shot(page, `${shotPrefix}-teacher-picker`);
  await picker.getByRole('button', { name: /Select|Add|Insert|Confirm|Continue/i }).or(picker.getByRole('button')).first().click();
  for (let i = 0; i < 120; i++) {
    const records = (await sim('/records?since=0')).json?.records as Json[] | undefined;
    const done = records?.find((r) => r.kind === 'deep-link' && r.scenario === sc.id);
    if (done) return done;
    await pause(250);
  }
  throw new Error(`Simulator did not record a deep-link return for scenario ${sc.id}`);
}

/** Learner launch and real HTML course completion through the browser. */
export async function performLearnerCompletion(
  page: Page,
  target: Target,
  publicationId: string,
  expectedLmsTextName: string,
  shotPrefix: string,
): Promise<{ scenarioId: string }> {
  const sc = await createSimScenario(target, {
    resource: publicationId,
    resourceLinkId: unique('rl'),
    documentTarget: 'window',
  });
  await page.goto(sc.loginUrl);
  await page.waitForURL((u) => u.origin === APP && (playPath.test(u.pathname) || embeddedPath.test(u.pathname)), {
    timeout: 30_000,
  });
  if (embeddedPath.test(new URL(page.url()).pathname)) {
    const openLink = page
      .getByRole('link', { name: /Open in a new window/i })
      .or(page.getByRole('button', { name: /Open in a new window/i }));
    const href = await openLink.first().getAttribute('href');
    if (href) {
      await page.goto(new URL(href, APP).href);
    }
    await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 20_000 });
  }
  await doCourse(page, 'correct');
  await expect(page.getByText(`Completed — score 100 sent to ${expectedLmsTextName}`).first()).toBeVisible({
    timeout: 120_000,
  });
  await shot(page, `${shotPrefix}-learner-done`);
  return { scenarioId: sc.id };
}

/** Verifies the portal publication results page shows the learner row with `Sent` and `100`. */
export async function assertPortalResultsSent(page: Page, publicationId: string, siteHost: string): Promise<void> {
  await page.goto(`${APP}/publications/${publicationId}/results`);
  const row = page.locator('tr, [role="row"]').filter({ hasText: `Learner learner-1 @ ${siteHost}` }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('Sent');
  await expect(row).toContainText('100');
}

/**
 * Installs a Playwright route rule on `context` that strips `__Host-lti_state_*` cookies from
 * `POST /lti/launch/cogniate` requests while leaving all other cookies and `/lti/launch/cogniate/storage-check` intact.
 * Required by `LA-E7-07.md` Design notes (`AC-LA-E7-07-04`, `AC-LA-E7-07-05`).
 */
export async function installStateCookieStripper(
  context: BrowserContext,
): Promise<{ strippedUrls: string[]; removedCookies: string[] }> {
  const ltiOrigin = new URL(urls.lti).origin;
  const strippedUrls: string[] = [];
  const removedCookies: string[] = [];

  await context.route(
    (url) => url.origin === ltiOrigin && url.pathname === '/lti/launch/cogniate',
    async (route, request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      const jarCookies = await context.cookies(ltiOrigin);
      for (const c of jarCookies) {
        if (c.name.startsWith('__Host-lti_state_')) {
          removedCookies.push(c.name);
        }
      }
      const allHeaders = await request.allHeaders();
      const rawCookie = allHeaders.cookie ?? request.headers().cookie ?? '';
      if (rawCookie) {
        for (const part of rawCookie.split(/;\s*/).filter(Boolean)) {
          if (part.startsWith('__Host-lti_state_')) {
            const name = part.split('=')[0] ?? part;
            if (!removedCookies.includes(name)) removedCookies.push(name);
          }
        }
      }
      await context.clearCookies({ name: /^__Host-lti_state_/ });
      strippedUrls.push(request.url());
      const headers = { ...allHeaders };
      delete headers.cookie;
      await route.continue({ headers });
    },
  );

  return { strippedUrls, removedCookies };
}
