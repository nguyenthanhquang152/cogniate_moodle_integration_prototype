// Author UI self-check with mocked API data. This is not SIM or live-LMS evidence.
// Run after npm run build -w @cogniate/portal. No backend or Docker stack is started.
/* global document, HTMLElement, window */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = new URL("../", import.meta.url);
const evidence = new URL("evidence/M2/author-self-check/", root);
await mkdir(evidence, { recursive: true });
const jsonText = '{\n  "title": "Cogniate (Library A)",\n  "public_jwk_url": "https://lti.example.test/lti/keys/cogniate"\n}\n';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const asset = path.startsWith("/portal/assets/") ? path.slice("/portal/".length) : "index.html";
  try {
    const bytes = await readFile(new URL(`dist/${asset}`, root));
    res.setHeader("content-type", asset.endsWith(".js") ? "text/javascript" : asset.endsWith(".css") ? "text/css" : asset.endsWith(".woff2") ? "font/woff2" : "text/html");
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.PORTAL_SMOKE_BROWSER_CHANNEL ?? "chrome" });
const records = [];
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = {
    id: "con_canvas_smoke", name: "School Canvas", siteUrl: "https://canvas.school.edu", serviceUrl: "https://school.instructure.com",
    lms: "canvas", profile: "canvas-sim-cloud", method: "manual", status: "pending",
    capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: true },
    registrationUrl: null, registrationUrlExpiresAt: null, createdAt: "2026-10-20T00:00:00Z", lastLaunchAt: null, webServices: null, platform: null, lastError: null,
  };
  const blackboard = {
    ...canvas, id: "con_blackboard_smoke", name: "School Blackboard", lms: "blackboard", profile: "blackboard-sim",
    siteUrl: "https://learn.school.edu", serviceUrl: "https://learn.school.edu",
    capabilities: { ...canvas.capabilities, addDeployment: false, canvasConfiguration: false },
  };
  const connections = new Map();
  let blackboardReady = false;
  let blackboardRefusal = true;
  await page.route("**/app-api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice("/app-api".length);
    let body;
    if (path === "/me") body = { user: { id: "usr_a", name: "Author", role: "owner", email: "author@example.test" }, library: { id: "lib_a", name: "Library A" } };
    else if (path === "/lms-providers") body = { lms: [{
      lms: "canvas", label: "Canvas", methods: ["manual"], capabilities: canvas.capabilities,
      profiles: [{ id: "canvas-sim-cloud", label: "Canvas cloud (simulation)", ready: true, simulation: true, clientId: null }],
    }, {
      lms: "blackboard", label: "Blackboard", methods: ["manual"], capabilities: blackboard.capabilities,
      profiles: [{ id: "blackboard-sim", label: "Blackboard Learn (simulation)", ready: blackboardReady, simulation: true, clientId: blackboardReady ? "qa-bb-app" : null }],
    }] };
    else if (path === "/connections") {
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        body = input.lms === "canvas" ? canvas : blackboard;
        assert.deepEqual(Object.keys(input).sort(), (input.lms === "canvas"
          ? ["lms", "method", "name", "profile", "serviceUrl", "siteUrl"] : ["lms", "method", "name", "profile", "siteUrl"]).sort());
        connections.set(body.id, body);
      } else body = { connections: [...connections.values()] };
    } else if (path === `/connections/${canvas.id}` || path === `/connections/${blackboard.id}`) {
      body = connections.get(path.split("/")[2]);
      if (request.method() === "DELETE") {
        body.status = "disabled";
        return route.fulfill({ status: 204 });
      }
    } else if (path === `/connections/${blackboard.id}/tool-configuration`) body = [
      { key: "client_id", label: "Client ID", value: "qa-bb-app" },
      { key: "login_initiation_url", label: "Login Initiation URL", value: "https://lti.example.test/lti/login/cogniate" },
      { key: "tool_redirect_url", label: "Tool Redirect URL(s)", value: "https://lti.example.test/lti/launch/cogniate" },
      { key: "tool_jwks_url", label: "Tool JWKS URL", value: "https://lti.example.test/lti/keys/cogniate" },
      { key: "tool_status", label: "Tool Status", value: "Approved" },
      { key: "user_fields", label: "User Fields to Send", value: "Role in Course only. Do not send Name or Email Address." },
      { key: "grade_service", label: "Allow grade service access", value: "Yes" },
      { key: "membership_service", label: "Allow Membership Service access", value: "Yes" },
      { key: "placement", label: "Placement", value: "Cogniate: type Deep Linking, Target Link URI https://lti.example.test/lti/launch/cogniate, student access off" },
    ];
    else if (path === `/connections/${canvas.id}/tool-configuration`) body = [
      { key: "key_name", label: "Key Name", value: "Cogniate (Library A)" },
      { key: "redirect_uris", label: "Redirect URIs", value: "https://lti.example.test/lti/launch/cogniate" },
      { key: "method", label: "Method", value: "Paste JSON" },
      { key: "lti_json", label: "LTI 1.3 Configuration", value: 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.' },
    ];
    else if (path.endsWith("/canvas-configuration")) {
      const inline = new URL(request.url()).searchParams.get("jwk") === "inline";
      return route.fulfill({ contentType: "application/json", headers: inline ? { "x-cogniate-key-id": "smoke-key" } : {}, body: inline ? '{"public_jwk":{"kid":"smoke-key"}}\n' : jsonText });
    } else if (path.endsWith("/platform")) {
      const input = request.postDataJSON();
      const target = connections.get(path.split("/")[2]);
      assert.deepEqual(Object.keys(input).sort(), (target.lms === "canvas"
        ? ["clientId", "deploymentId", "grantCode"] : ["deploymentId", "grantCode"]).sort());
      if (target.lms === "blackboard" && blackboardRefusal) {
        blackboardRefusal = false;
        return route.fulfill({ status: 422, contentType: "application/json",
          body: JSON.stringify({ details: { message: "GRANT_MISMATCH", fields: ["deploymentId"] } }) });
      }
      target.status = "registered";
      target.platform = {
        id: `plt_${target.lms}_smoke`, issuer: target.lms === "canvas" ? "https://canvas.sim.test" : "https://blackboard.sim.test",
        clientId: input.clientId ?? "qa-bb-app", deploymentIds: [input.deploymentId],
        productFamilyCode: target.lms === "canvas" ? "canvas" : "BlackboardLearn", siteUrl: target.siteUrl, serviceUrl: target.serviceUrl,
      };
      body = target;
    } else if (path.endsWith("/deployments")) {
      canvas.platform.deploymentIds.push(request.postDataJSON().deploymentId);
      body = canvas;
    } else throw new Error(`Unmocked request ${request.method()} ${path}`);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  async function capture(name) {
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true });
    records.push({ stage: name, seriousOrCritical: serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), violations: result.violations.map((v) => ({ id: v.id, impact: v.impact })) });
    assert.deepEqual(serious, [], `axe serious/critical at ${name}`);
  }
  await page.goto(`${origin}/integrations/canvas/connect`);
  await page.getByLabel("Connection name", { exact: true }).waitFor();
  await capture("canvas-step-1");
  // Complete fields and submit using the keyboard.
  await page.getByLabel("Connection name", { exact: true }).focus();
  await page.keyboard.type("School Canvas");
  await page.keyboard.press("Tab");
  await page.keyboard.type("https://Canvas.School.edu/");
  await page.keyboard.press("Tab");
  await page.keyboard.type("https://school.instructure.com");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Make a developer key in Canvas" }).waitFor();
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), jsonText);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "cogniate-canvas-lti.json");
  assert.equal(await readFile(await download.path(), "utf8"), jsonText);
  await capture("canvas-steps-2-and-3");
  await page.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await page.getByText(/Key id: smoke-key/).waitFor();
  await capture("canvas-inline-key");
  await page.getByLabel("Client ID", { exact: true }).focus();
  await page.keyboard.type("canvas-client");
  await page.keyboard.press("Tab");
  await page.keyboard.type("deployment-one");
  await page.keyboard.press("Tab");
  await page.keyboard.type("c".repeat(43));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Add a Cogniate course in Canvas" }).waitFor();
  await capture("canvas-step-4-and-detail");
  await page.getByLabel("Deployment ID", { exact: true }).focus();
  await page.keyboard.type("deployment-two");
  await page.keyboard.press("Tab");
  await page.keyboard.type("d".repeat(43));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByText("deployment-two", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Approval code", { exact: true }).inputValue(), "");
  await capture("canvas-added-deployment");

  await page.goto(`${origin}/integrations`);
  await page.getByRole("tab", { name: "LMS Publishing", exact: true }).click();
  const blackboardCard = page.getByRole("article", { name: "Blackboard", exact: true });
  await blackboardCard.getByText("Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.").waitFor();
  assert.equal(await blackboardCard.getByRole("button", { name: "Connect", exact: true }).isDisabled(), true);
  await capture("blackboard-not-ready");
  blackboardReady = true;
  await page.reload();
  await blackboardCard.getByRole("link", { name: "Connect", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Learn URL", { exact: true }).waitFor();
  await capture("blackboard-step-1");
  await page.getByLabel("Connection name", { exact: true }).focus();
  await page.keyboard.type("School Blackboard");
  await page.keyboard.press("Tab");
  await page.keyboard.type("https://Learn.School.edu/");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.getByLabel("Connection name", { exact: true }).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Register Cogniate in Blackboard Learn" }).waitFor();
  await page.locator("[data-client-id]").getByRole("button", { name: "Copy Client ID", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "qa-bb-app");
  assert.equal(await page.getByLabel("Client ID", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("table").locator("tbody tr").count(), 9);
  await capture("blackboard-steps-2-and-3");
  await page.getByLabel("Deployment ID", { exact: true }).focus();
  await page.keyboard.type("blackboard-deployment");
  await page.keyboard.press("Tab");
  await page.keyboard.type("b".repeat(43));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByText("The values do not match the approval. Check the marked fields, or ask your Cogniate operator.").waitFor();
  assert.equal(await page.getByLabel("Approval code", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Deployment ID", { exact: true }).getAttribute("aria-invalid"), "true");
  await capture("blackboard-approval-error");
  await page.getByLabel("Approval code", { exact: true }).focus();
  await page.keyboard.type("b".repeat(43));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Add a Cogniate course in Blackboard" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Add deployment ID", exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Approval code", { exact: true }).count(), 0);
  assert.equal(page.url().includes("b".repeat(43)), false);
  assert.equal(await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }).includes("b".repeat(43))), false);
  await capture("blackboard-step-4-and-detail");
  await page.getByRole("button", { name: "Disconnect", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").getByText("This switches off Cogniate for this Blackboard site only. Other schools are not affected. Cogniate items in Blackboard courses stop working, and connecting again later does not restore them.").waitFor();
  await capture("blackboard-disconnect");
  await page.getByRole("dialog").getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByText("This connection is disconnected. Connecting again does not restore its old course items.").waitFor();
  assert.equal(canvas.status, "registered");
  assert.deepEqual(errors, []);
} finally {
  await writeFile(new URL("report.json", evidence), `${JSON.stringify({ evidence: "AUTHOR SELF-CHECK — MOCKED API, NOT SIM OR LIVE LMS", viewport: "1440x1000", records, errors }, null, 2)}\n`);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(`Author UI self-check complete: ${records.length} Canvas and Blackboard stages; report in ${fileURLToPath(evidence)}`);
