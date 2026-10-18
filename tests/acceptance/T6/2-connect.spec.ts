// T6: the Connect wizard (dynamic and manual) and its Moodle steps. Source: tasks/T6.md AC-T6-04, -05, -12; contract
// cogniate-app-api.md §4 (connections, PUT …/platform rules), §4.1 (16 rows by key); AC-T4-07 (registration URL form).
// QA Library B makes both connections (Thanh already has his connection from the T5 setup). Because Thanh's Moodle tool
// exists, Moodle shows the "update or register new" choice page in AC-T6-04: QA follows the wizard's step and chooses
// "register as new".
import fs from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { appApi, APP, QA_B, signIn } from '../lib/app';
import { publicUrls } from '../lib/env';
import { ACCOUNT } from '../lib/lti';
import { createManualTool } from '../lib/moodle-dl';
import { newStackContext } from '../lib/moodle-launch';
import { openManageTools, startRegistration, toolDetails, waitForDialogClosed } from '../lib/moodle-reg';
import {
  allowClipboard,
  clipboardText,
  hasInlineError,
  markNoReload,
  MOODLE_STEPS_FILE,
  normText,
  PORTAL_ROUTES,
  portalSignIn,
  sixValueInput,
  specMoodleSteps,
  TOOL_CONFIG_KEYS,
} from '../lib/portal';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REG_URL = new RegExp(`^${esc(urls.lti)}/lti/register/${ACCOUNT}\\?ref=[A-Za-z0-9_-]{43}$`);

/** Wizard start: site URL, name, method; then the next step. */
async function startWizard(page: Page, name: string, method: 'dynamic' | 'manual'): Promise<void> {
  await page.goto(`${APP}${PORTAL_ROUTES.connect}`);
  await page.getByLabel(/url/i).first().fill(urls.moodle);
  await page.getByLabel(/name/i).first().fill(name);
  await page.getByRole('radio', { name: method === 'dynamic' ? /Automatic \(recommended\)/ : /^Manual/ }).check();
  await page.getByRole('button', { name: /continue|next|create|connect/i }).first().click();
}

/** The registration URL shown by the wizard (in a text node or an input value). */
async function shownRegistrationUrl(page: Page, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await page.evaluate((src) => {
      const re = new RegExp(src);
      const inputs = Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[];
      const fromInput = inputs.map((i) => i.value.trim()).find((v) => re.test(v));
      if (fromInput) return fromInput;
      const texts = Array.from(document.querySelectorAll('body *')).map((el) => (el.children.length === 0 ? (el.textContent ?? '').trim() : ''));
      return texts.find((t) => re.test(t)) ?? '';
    }, REG_URL.source);
    if (found || Date.now() > deadline) return found;
    await page.waitForTimeout(250);
  }
}

test.describe.serial('T6 Connect wizard (QA Library B)', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
    await allowClipboard(context);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T6-04 dynamic connect: the registration URL (AC-T4-07 form) with a working copy button; after the admin registers, "Registered — activate in Moodle" within 10 s without a reload', async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await context.newPage();
    await portalSignIn(page, QA_B);
    await startWizard(page, 'Dev Moodle B', 'dynamic');
    const regUrl = await shownRegistrationUrl(page);
    expect(regUrl, 'the wizard shows the registration URL').toMatch(REG_URL);
    await page.getByRole('button', { name: /copy/i }).first().click();
    expect(await clipboardText(page), 'clipboard after "copy"').toBe(regUrl);
    const samePage = await markNoReload(page);

    const admin = await newStackContext(browser);
    let registeredAt = 0;
    try {
      const a = await admin.newPage();
      await openManageTools(a, seed().users.admin);
      const held = await startRegistration(admin, a, regUrl, 'new', 45_000, { hold: false });
      await held.frame.getByRole('button', { name: 'Connect' }).click();
      expect(await waitForDialogClosed(a), 'the Moodle dialog closes').toBe(true);
      registeredAt = Date.now();
      await held.release();
      test.info().annotations.push({ type: 'choice page', description: `Moodle showed the "update or register new" page: ${held.sawChoice}` });
    } finally {
      await admin.close();
    }
    await expect(page.getByText('Registered — activate in Moodle')).toBeVisible({ timeout: Math.max(1_000, registeredAt + 10_000 - Date.now()) });
    expect(await samePage(), 'the page was not reloaded').toBe(true);
  });

  test('AC-T6-05 manual connect: the 16 rows of §4.1 in order (data-key, copy = value); http issuer or a JWKS URL on another origin → inline error; valid values → "Registered"; the six inputs have name = the contract keys', async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await context.newPage();
    await portalSignIn(page, QA_B);
    const name = `Dev Moodle B manual ${Date.now().toString(36)}`;
    await startWizard(page, name, 'manual');
    await page.locator('[data-key]').first().waitFor({ timeout: 15_000 });
    const keys = await page.locator('[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).filter((k) => k && !['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl'].includes(k)));
    expect(keys, 'rows by data-key, in order').toEqual(TOOL_CONFIG_KEYS);

    const b = await signIn(QA_B);
    const list = await appApi<{ connections: { id: string; name: string; method: string; status: string }[] }>('GET', '/app-api/connections', { cookie: b.cookie });
    const conn = list.json.connections.find((c) => c.name === name);
    expect(conn, `connection "${name}"`).toBeDefined();
    const rows = await appApi<{ key: string; value: string }[]>('GET', `/app-api/connections/${conn!.id}/tool-configuration`, { cookie: b.cookie });
    const problems: string[] = [];
    for (const key of TOOL_CONFIG_KEYS) {
      await page.locator(`[data-key="${key}"]`).getByRole('button', { name: /copy/i }).first().click();
      const clip = await clipboardText(page);
      const want = rows.json.find((r) => r.key === key)?.value;
      if (clip !== want) problems.push(`${key}: clipboard "${clip}", value "${want}"`);
    }
    expect(problems).toEqual([]);

    // QA makes the manual tool in Moodle with these values and reads the six values back (ADR-009).
    const admin = await newStackContext(browser);
    let six: Record<string, string>;
    try {
      const a = await admin.newPage();
      const tool = await createManualTool(a, seed().users.admin, 'Cogniate (QA Library B)');
      const d = await toolDetails(a, tool.typeId);
      six = { issuer: d.platformId, clientId: d.clientId, deploymentId: d.deploymentId, authenticationEndpoint: d.authRequestUrl, accessTokenEndpoint: d.accessTokenUrl, jwksUrl: d.publicKeysetUrl };
    } finally {
      await admin.close();
    }
    // Stable hooks (tasks/T6.md): the six inputs for Moodle's values have name = the contract keys.
    for (const key of ['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl']) {
      if ((await page.locator(`input[name="${key}"]`).count()) !== 1) problems.push(`no single input[name="${key}"]`);
    }
    expect(problems, 'six inputs by name').toEqual([]);
    const submit = async (values: Record<string, string>) => {
      for (const [k, v] of Object.entries(values)) await (await sixValueInput(page, k)).fill(v);
      const form = (await sixValueInput(page, 'issuer')).locator('xpath=ancestor::form[1]');
      const button = form.getByRole('button', { name: /save|connect|register|submit|continue/i }).or(form.locator('[type="submit"]')).first();
      await button.click();
    };
    await submit({ ...six, issuer: 'http://moodle.test' });
    expect(await hasInlineError(page), 'issuer http://moodle.test → inline error').toBe(true);
    await submit({ ...six, jwksUrl: 'https://evil.test/jwks' });
    expect(await hasInlineError(page), 'JWKS URL on another origin → inline error').toBe(true);
    expect((await appApi<{ status: string }>('GET', `/app-api/connections/${conn!.id}`, { cookie: b.cookie })).json.status, 'still pending').toBe('pending');
    await submit(six);
    await expect(page.getByText(/^Registered\b/).first()).toBeVisible({ timeout: 15_000 });
    expect((await appApi<{ status: string }>('GET', `/app-api/connections/${conn!.id}`, { cookie: b.cookie })).json.status).toBe('registered');
  });

  test('AC-T6-12 moodle-steps.json equals the content of tasks/T6.md; the wizard shows the steps in order for both methods (data-step-id = id, text with {libraryName} replaced); choose-register-new is optional; edit-tool-settings follows activate-tool', async () => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    const fileJson = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')) as Record<string, unknown>;
    expect(fileJson, 'apps/portal/src/connect/moodle-steps.json = the content in tasks/T6.md').toEqual(specMoodleSteps());

    const b = await signIn(QA_B);
    const me = await appApi<{ library: { name: string } }>('GET', '/app-api/me', { cookie: b.cookie });
    const libraryName = String(me.json?.library?.name ?? '');
    expect(libraryName, 'library name of QA_B').toBeTruthy();
    const page = await context.newPage();
    await portalSignIn(page, QA_B);
    for (const method of ['dynamic', 'manual'] as const) {
      const file = (fileJson[method] ?? []) as { id: string; text: string; optional: boolean }[];
      await startWizard(page, `QA steps ${method} ${Date.now().toString(36)}`, method);
      await expect.poll(() => page.locator('[data-step-id]').count(), { timeout: 15_000, message: `${method}: step elements` }).toBeGreaterThanOrEqual(file.length);
      const screen = await page.locator('[data-step-id]').evaluateAll((els) => els.map((el) => ({ id: el.getAttribute('data-step-id'), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim() })));
      if (screen.length !== file.length) problems.push(`${method}: ${screen.length} step elements, ${file.length} in moodle-steps.json`);
      file.forEach((step, i) => {
        const want = normText(step.text.replace(/\{libraryName\}/g, libraryName));
        if (screen[i]?.id !== step.id) problems.push(`${method} step ${i + 1}: data-step-id "${screen[i]?.id ?? '-'}", file id "${step.id}"`);
        if (!screen[i] || !normText(screen[i].text).includes(want)) problems.push(`${method} step ${i + 1} (${step.id}): screen "${screen[i]?.text ?? '-'}" does not show "${want}"`);
      });
      test.info().annotations.push({ type: `${method} steps`, description: screen.map((x) => x.id).join(', ') });
    }
    const dyn = (fileJson.dynamic ?? []) as { id: string; text: string; optional: boolean }[];
    const choice = dyn.find((x) => x.id === 'choose-register-new');
    if (!choice || choice.optional !== true || !choice.text.includes('Register as a new external tool')) problems.push(`choose-register-new: ${JSON.stringify(choice)}`);
    const ids = dyn.map((x) => x.id);
    if (ids.indexOf('edit-tool-settings') !== ids.indexOf('activate-tool') + 1 || ids.indexOf('activate-tool') < 0) problems.push(`dynamic order: ${ids.join(', ')}`);
    const edit = dyn.find((x) => x.id === 'edit-tool-settings')?.text ?? '';
    for (const label of ['Tool configuration usage', 'Show in activity chooser and as a preconfigured tool', 'Default launch container', 'New window']) if (!edit.includes(label)) problems.push(`edit-tool-settings text has no "${label}"`);
    expect(problems).toEqual([]);
  });
});
