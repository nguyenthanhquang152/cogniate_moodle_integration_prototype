// K2 U2: Data-driven connection wizard assertions across all channels (AC-LA-E7-07-02, AC-LA-E1-11-05, AC-LA-E2-05-03).
// Driven by `@cogniate/channel-kernel` (`loadProductChannelRegistry`): `setup.createFields`, `setup.bindingFields`,
// `setup.toolRows`, `capabilities['setup.artifacts']`, `capabilities['binding.authority']`, and `texts.adminSteps`.
import type { Page } from '@playwright/test';
import {
  APP,
  D2L_9_TOOL_ROW_KEYS,
  ERR,
  MOODLE_16_TOOL_ROW_KEYS,
  STANDARD_14_TOOL_ROW_KEYS,
  THANH,
  app,
  clipboardText,
  connection,
  connections,
  defaultSimSiteUrl,
  escape,
  expect,
  fieldMarked,
  fillText,
  k2Case,
  loadProductChannelRegistry,
  next,
  noForbiddenFields,
  ok,
  portalSignIn,
  rememberPrivate,
  saveWizardConnection,
  selectRegistrationMethod,
  session,
  sharedPlatform,
  shot,
  unique,
  urls,
  type ChannelManifest,
  type Json,
} from './lib/k2';

interface FieldSpecItem {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  method?: 'dynamic' | 'manual';
  default?: string;
}

async function selectSimProfileIfPresent(page: Page, m: ChannelManifest): Promise<void> {
  const profileField = (m.setup.createFields as FieldSpecItem[]).find((f) => f.key === 'profile');
  if (!profileField) return;
  const select = page.getByLabel(profileField.label, { exact: true });
  if ((await select.count()) === 0) return;
  const simOption = await select.evaluate((el) => {
    const opts = Array.from((el as HTMLSelectElement).options);
    return opts.find((o) => /simulation/i.test(o.text))?.text ?? opts.at(-1)?.text ?? '';
  });
  if (simOption) {
    await select.selectOption({ label: simOption });
  }
}

async function createPendingViaWizard(
  page: Page,
  m: ChannelManifest,
  method: 'dynamic' | 'manual',
): Promise<{ connectionId: string; name: string; siteUrl: string }> {
  const name = unique(`K2-U2-${m.id}-${method}`);
  const siteUrl = defaultSimSiteUrl(m.id);
  const siteField = (m.setup.createFields as FieldSpecItem[]).find((f) => f.key === 'siteUrl')!;

  await page.goto(`${APP}/integrations/${m.id}/connect`);
  await page.getByLabel('Connection name').fill(name);
  await page.getByLabel(siteField.label, { exact: true }).fill(siteUrl);
  await selectSimProfileIfPresent(page, m);

  if (m.registration.length > 1) {
    await selectRegistrationMethod(page, method);
  }

  await next(page);
  await page.waitForURL(new RegExp(`/integrations/${escape(m.id)}/con_[^/]+$`), { timeout: 25_000 });
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 });
  const connectionId = new URL(page.url()).pathname.split('/').pop()!;
  return { connectionId, name, siteUrl };
}

k2Case(
  'U2.step1-create-fields',
  'Step 1 of every channel renders Connection name, manifest setup.createFields, registration method radios, and enforces Site URL Rule 1',
  async ({ page }) => {
    await sharedPlatform();
    const registry = await loadProductChannelRegistry(true);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
    const s = await session('A');

    await portalSignIn(page, THANH);

    for (const m of manifests) {
      await page.goto(`${APP}/integrations/${m.id}/connect`);
      await expect(page.getByLabel('Connection name')).toBeVisible();

      const createFields = m.setup.createFields as FieldSpecItem[];
      for (const field of createFields) {
        if (
          m.id === 'blackboard' &&
          field.key === 'profile' &&
          (await page.getByLabel(field.label, { exact: true }).count()) === 0
        ) {
          continue;
        }
        await expect(
          page.getByLabel(field.label, { exact: true }),
          `${m.id}: createField "${field.label}" (${field.key}) is visible`,
        ).toBeVisible();
      }

      const hasDynamic = m.registration.some((r) => r.method === 'dynamic');
      const hasManual = m.registration.some((r) => r.method === 'manual');
      const methodCombo = page.getByRole('combobox', { name: /Connection method/i });
      if (hasDynamic && hasManual) {
        if ((await methodCombo.count()) > 0) {
          await expect(methodCombo.first()).toBeVisible();
        } else {
          await expect(
            page.getByRole('radio', { name: /^(Automatic|Dynamic(\s+Registration)?)/i }).first(),
          ).toBeVisible();
          await expect(page.getByRole('radio', { name: /^(Manual|Developer key)/i }).first()).toBeVisible();
        }
      } else {
        await expect(page.getByRole('radio', { name: /^(Automatic|Dynamic)/i })).toHaveCount(0);
      }

      // Site URL Rule 1 validation check (path not allowed on origin input)
      const siteField = createFields.find((f) => f.key === 'siteUrl')!;
      const beforeCount = (await connections(s)).length;
      await page.getByLabel('Connection name').fill(unique(`Rule1-${m.id}`));
      await page.getByLabel(siteField.label, { exact: true }).fill(`${defaultSimSiteUrl(m.id)}/not-an-origin`);
      await selectSimProfileIfPresent(page, m);
      await next(page);

      await expect(
        page
          .getByText(ERR.rule[1], { exact: true })
          .or(page.getByText(/Do not add a path\.|No path\.|origin/i))
          .first(),
      ).toBeVisible();
      if (['moodle', 'canvas', 'blackboard'].includes(m.id)) {
        await fieldMarked(page, siteField.label);
      }
      expect((await connections(s)).length, `${m.id}: Rule 1 refusal makes no connection`).toBe(beforeCount);
      await noForbiddenFields(page);
    }

    await shot(page, 'k2-u2-step1-create-fields');
  },
);

k2Case(
  'U2.step2-artifacts-and-tool-rows',
  'Step 2 of every channel renders registration URL (dynamic), developer-key-json only when setup.artifacts has it, and exact tool-configuration rows (manual)',
  async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
    await sharedPlatform();
    const registry = await loadProductChannelRegistry(true);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
    const s = await session('A');

    await portalSignIn(page, THANH);

    for (const m of manifests) {
      const caps = registry.capabilities(m.id);

      // 1. Dynamic registration entry (moodle, canvas [LA-IC-14], lti-generic, brightspace [LA-E2-06])
      const dynEntry = m.registration.find((r) => r.method === 'dynamic');
      if (dynEntry) {
        const { connectionId } = await createPendingViaWizard(page, m, 'dynamic');
        const copyBtn = page.getByRole('button', { name: /^Copy registration URL$/i }).first();
        if ((await copyBtn.count()) === 0) {
          const getRegBtn = page.getByRole('button', { name: /Get registration URL/i });
          if ((await getRegBtn.count()) > 0) await getRegBtn.first().click();
        }
        await expect(copyBtn, `${m.id} dynamic: Copy registration URL button visible`).toBeVisible();
        await copyBtn.click();
        const copiedUrl = await clipboardText(page);
        expect(
          copiedUrl,
          `${m.id} dynamic: copied registration URL starts with ${urls.lti}/lti/register/cogniate?ref=`,
        ).toMatch(new RegExp(`^${escape(urls.lti)}/lti/register/cogniate\\?ref=`));
        const refParam = new URL(copiedUrl).searchParams.get('ref');
        if (refParam) rememberPrivate(refParam);

        if (m.id === 'canvas') {
          await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toHaveCount(0);
          await expect(
            page.getByText('Finish the registration in Canvas. Then this page shows the values to check.'),
          ).toBeVisible();
        }

        const dto = await connection(s, connectionId);
        expect(dto.status).toBe('pending');
        expect(dto.bindingAuthority).toBe(dynEntry.authority);
      }

      // 2. Manual registration entry (all 5 channels)
      if (m.registration.some((r) => r.method === 'manual')) {
        const { connectionId } = await createPendingViaWizard(page, m, 'manual');
        const hasDevKeyArtifact = caps['setup.artifacts'].includes('developer-key-json');

        if (hasDevKeyArtifact) {
          await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toBeVisible();
        } else {
          await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toHaveCount(0);
        }

        // Check tool-configuration rows for channels that expose GET .../tool-configuration
        if (!hasDevKeyArtifact && m.id !== 'blackboard') {
          const cfgRes = await app(s, 'GET', `/app-api/connections/${connectionId}/tool-configuration`);
          ok(cfgRes, 200, `${m.id}: GET /tool-configuration`);
          const apiRows = (
            Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json.rows ?? cfgRes.json.fields ?? [])
          ) as Array<{ key: string; label: string; value: string }>;

          const expectedKeys =
            m.setup.toolRows && m.setup.toolRows.length > 0
              ? m.setup.toolRows.map((r) => r.key)
              : m.id === 'moodle'
                ? [...MOODLE_16_TOOL_ROW_KEYS]
                : m.id === 'brightspace'
                  ? [...D2L_9_TOOL_ROW_KEYS]
                  : m.id === 'lti-generic'
                    ? [
                        'tool_name',
                        'login_url',
                        'redirect_uri',
                        'target_link_uri',
                        'jwks_url',
                        'deep_linking_url',
                        'scopes',
                        'privacy',
                      ]
                    : [...STANDARD_14_TOOL_ROW_KEYS];

          expect(apiRows.map((r) => r.key), `${m.id}: tool-configuration keys order`).toEqual(expectedKeys);

          // Verify first and last row are rendered in the DOM and copyable
          for (const row of [apiRows[0], apiRows[apiRows.length - 1]]) {
            const rowLoc = page
              .locator(`[data-key="${row.key}"]`)
              .or(page.locator('tr', { has: page.getByRole('rowheader', { name: row.label, exact: true }) }))
              .first();
            await expect(rowLoc, `${m.id}: row "${row.label}" (${row.key}) visible`).toBeVisible();
            await rowLoc.getByRole('button', { name: /copy/i }).first().click();
            const copiedVal = await clipboardText(page);
            expect(copiedVal, `${m.id}: clipboard value for ${row.key}`).toBe(row.value);
          }
        }
      }
    }

    await shot(page, 'k2-u2-step2-artifacts-and-rows');
  },
  300_000,
);

k2Case(
  'U2.step3-binding-fields-and-defaults',
  'Step 3 of every channel renders its manifest setup.bindingFields, pre-fills FieldSpec.default values, and gates Approval code on operatorGrant authority',
  async ({ page }) => {
    await sharedPlatform();
    const registry = await loadProductChannelRegistry(true);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
    const s = await session('A');

    await portalSignIn(page, THANH);

    for (const m of manifests) {
      const caps = registry.capabilities(m.id);
      const { connectionId, siteUrl } = await createPendingViaWizard(page, m, 'manual');
      const manualFields = (m.setup.bindingFields as FieldSpecItem[]).filter(
        (f) => !f.method || f.method === 'manual',
      );

      for (const field of manualFields) {
        if (m.id === 'blackboard' && field.key === 'clientId') {
          await expect(page.getByText('Client ID').first(), 'blackboard: Client ID displayed on Step 2').toBeVisible();
          continue;
        }
        const input = page.getByLabel(field.label, { exact: true });
        await expect(input, `${m.id}: bindingField "${field.label}" (${field.key}) visible`).toBeVisible();

        if (field.default !== undefined) {
          const expectedDefault = field.default.replaceAll('{siteUrl}', siteUrl);
          await expect(
            input,
            `${m.id}: bindingField "${field.label}" pre-filled with default "${expectedDefault}"`,
          ).toHaveValue(expectedDefault);
        }
      }

      const manualAuthority = (caps['binding.authority'] as Record<string, string>).manual;
      if (manualAuthority === 'operatorGrant') {
        await expect(page.getByLabel('Approval code', { exact: true })).toBeVisible();
        // Submitting with empty required fields / empty Approval code keeps the connection pending
        await saveWizardConnection(page).first().click();
        expect((await connection(s, connectionId)).status).toBe('pending');
      } else {
        await expect(page.getByLabel('Approval code', { exact: true })).toHaveCount(0);
      }

      if (!manualFields.some((f) => f.label === 'Issuer')) {
        await noForbiddenFields(page);
      }
    }

    await shot(page, 'k2-u2-step3-binding-fields');
  },
  300_000,
);

k2Case(
  'U2.admin-steps-texts',
  'every channel wizard renders manifest.texts.adminSteps with {LMS} and {tool} filled and zero raw placeholder tokens',
  async ({ page }) => {
    await sharedPlatform();
    const registry = await loadProductChannelRegistry(true);
    const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);
    const s = await session('A');
    const toolName = `Cogniate (${s.library.name})`;

    await portalSignIn(page, THANH);

    for (const m of manifests) {
      const preferredMethod = m.registration[0]!.method;
      await page.goto(`${APP}/integrations/${m.id}/connect`);
      await expect(page.getByLabel('Connection name')).toBeVisible();
      const step1Text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      await createPendingViaWizard(page, m, preferredMethod);
      const step2Text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

      const bodyText = `${step1Text} ${step2Text}`;
      expect(bodyText, `${m.id}: no raw {LMS} placeholder in wizard`).not.toContain('{LMS}');
      expect(bodyText, `${m.id}: no raw {tool} placeholder in wizard`).not.toContain('{tool}');

      for (const rawStep of m.texts.adminSteps) {
        const expectedStep = fillText(rawStep, {
          LMS: m.names.text,
          tool: toolName,
          site: defaultSimSiteUrl(m.id),
        });
        expect(
          bodyText,
          `${m.id}: adminStep "${expectedStep}" is rendered on the wizard page`,
        ).toContain(expectedStep);
      }
    }

    await shot(page, 'k2-u2-admin-steps');
  },
  300_000,
);
