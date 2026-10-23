import { createPortalSdk } from "@cogniate/portal-sdk";
// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "@cogniate/portal-sdk";
import { ApiError } from "@cogniate/portal-sdk";
import type { Connection, LmsProvider } from "@cogniate/portal-sdk";
import { ProviderErrorNotice, providerErrorFields, providerErrorMessage } from "@cogniate/portal-sdk";
import { CanvasBinding } from "./CanvasBinding.tsx";
import { CanvasConfiguration } from "./CanvasConfiguration.tsx";
import { CanvasWizard } from "./CanvasWizard.tsx";
import steps from "./steps.ts";
import manifest from "../manifest.ts";
import canvasModule from "./index.tsx";

const capabilities = {
  dynamicRegistration: false, operatorApproval: true, webServices: false,
  courseShell: false, addDeployment: true, canvasConfiguration: true,
};
const provider: LmsProvider = {
  lms: "canvas", label: "Canvas", methods: ["manual"], capabilities,
  profiles: [{ id: "canvas-cloud", label: "Canvas (Instructure hosted)", simulation: false, ready: true, clientId: null },
    { id: "canvas-sim-cloud", label: "Canvas (simulation)", simulation: true, ready: true, clientId: null }],
};
const connection: Connection = {
  id: "con_canvas", name: "School", lms: "canvas", profile: "canvas-cloud",
  siteUrl: "https://canvas.school.edu", serviceUrl: "https://school.instructure.com",
  method: "manual", status: "pending", capabilities, platform: null, webServices: null,
  registrationUrl: null, registrationUrlExpiresAt: null, lastError: null,
  createdAt: "2026-10-20T00:00:00Z", lastLaunchAt: null,
};
const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function field(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }

it("creates Canvas with the selected API profile and optional service origin, without endpoint inputs", async () => {
  fetchMock.mockResolvedValue(json(connection));
  const onCreated = vi.fn();
  const view = render(h(MemoryRouter, null, h(CanvasWizard, { provider, connection: null, libraryName: "School", opener: "canvas-connect", onCreated, onChanged: vi.fn(), sdk: createPortalSdk(() => undefined) })));
  expect(steps.steps).toHaveLength(4);
  expect(steps.steps.every((step) => step.verified === false)).toBe(true);
  expect(screen.getByRole("option", { name: "Canvas (simulation)" })).toBeTruthy();
  expect(view.container.querySelectorAll("input")).toHaveLength(3);
  field("Connection name", "School");
  field("Canvas URL", "https://Canvas.School.edu/");
  field("Canvas service URL", "https://school.instructure.com");
  field("Canvas type", "canvas-sim-cloud");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(connection));
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
    name: "School", siteUrl: "https://Canvas.School.edu/", serviceUrl: "https://school.instructure.com",
    lms: "canvas", method: "manual", profile: "canvas-sim-cloud",
  });
});

it("marks the server-selected URL field and sends an omitted service URL unchanged", async () => {
  fetchMock.mockResolvedValue(json({ details: { message: "INVALID_SITE_URL", rule: 4, field: "siteUrl" } }, 422));
  render(h(MemoryRouter, null, h(CanvasWizard, { provider, connection: null, libraryName: "School", opener: "canvas-connect", onCreated: vi.fn(), onChanged: vi.fn(), sdk: createPortalSdk(() => undefined) })));
  field("Connection name", "School");
  field("Canvas URL", "https://canvas.instructure.com");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("This is the LMS sign-in service, not your school site. Enter the address that teachers use.");
  expect(screen.getByLabelText("Canvas URL").getAttribute("aria-invalid")).toBe("true");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).not.toHaveProperty("serviceUrl");
});

it.each([200, 403, 422, 502])("clears approval on submit with response %s and uses only the binding body", async (status) => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
  const onChanged = vi.fn();
  render(h(CanvasBinding, { connection, onChanged }));
  field("Client ID", " client ");
  field("Deployment ID", " deployment ");
  field("Approval code", "one-use-code");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ clientId: "client", deploymentId: "deployment", grantCode: "one-use-code" });
  await act(async () => finish(status === 200 ? json({ ...connection, status: "registered" }) : json({ details: { message: status === 403 ? "GRANT_INVALID" : status === 422 ? "GRANT_MISMATCH" : "LTI_SERVICE_ERROR", fields: ["deploymentId"], traceId: "trace-123" } }, status)));
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  expect(window.location.href).not.toContain("one-use-code");
  expect(JSON.stringify(localStorage)).not.toContain("one-use-code");
  expect(JSON.stringify(sessionStorage)).not.toContain("one-use-code");
  if (status === 200) expect(onChanged).toHaveBeenCalled();
  else {
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("Deployment ID").getAttribute("aria-invalid")).toBe("true");
  }
});

it("adds a deployment with a distinct endpoint and no client id", async () => {
  fetchMock.mockResolvedValue(json({ ...connection, status: "registered" }));
  const onChanged = vi.fn();
  render(h(CanvasBinding, { connection, onChanged, addDeployment: true }));
  expect(screen.queryByLabelText("Client ID")).toBeNull();
  field("Deployment ID", "next-deployment");
  field("Approval code", "add-code");
  fireEvent.click(screen.getByRole("button", { name: "Add deployment ID" }));
  await screen.findByText("Deployment ID added.");
  expect(fetchMock.mock.calls[0]![0]).toBe("/app-api/connections/con_canvas/deployments");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ deploymentId: "next-deployment", grantCode: "add-code" });
});

it.each(["canvas"] as const)("shows the neutral readiness title and action after %s binding fails", async (lms) => {
  fetchMock.mockResolvedValue(json({ details: { message: "PROVIDER_NOT_READY", traceId: "trace-readiness" } }, 409));
  const onChanged = vi.fn();
  const current: Connection = { ...connection, lms, id: `con_${lms}` };
  render(h(CanvasBinding, { connection: current, onChanged }));
  if (lms === "canvas") field("Client ID", "client");
  field("Deployment ID", "deployment");
  field("Approval code", "one-use-code");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  const alert = within(await screen.findByRole("alert"));
  expect(alert.getByText("This LMS setup is not ready in Cogniate.")).toBeTruthy();
  expect(alert.getByText("Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.")).toBeTruthy();
  expect(alert.getByText("Code: PROVIDER_NOT_READY")).toBeTruthy();
  expect(alert.getByText("Trace id: trace-readiness")).toBeTruthy();
  expect(alert.queryByText(/Blackboard is not set up/)).toBeNull();
  expect(screen.getByRole("alert").textContent).not.toContain("one-use-code");
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  expect(onChanged).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0]![0]).toBe(`/app-api/connections/con_${lms}/platform`);
});

it("keeps the server action for other provider errors", () => {
  render(h(ProviderErrorNotice, { error: new ApiError(422, {
    message: "GRANT_MISMATCH", fields: ["deploymentId"], action: "Check the Deployment ID with your operator.",
  }, "trace-mismatch") }));
  const alert = within(screen.getByRole("alert"));
  expect(alert.getByText("The values do not match the approval. Check the marked fields, or ask your Cogniate operator.")).toBeTruthy();
  expect(alert.getByText("Check the Deployment ID with your operator.")).toBeTruthy();
  expect(alert.getByText("Trace id: trace-mismatch")).toBeTruthy();
});

it("copies exact JSON bytes, shares them with download and switches to a fresh inline snapshot", async () => {
  const text = '{\n  "public_jwk_url": "https://lti.test/keys/cogniate"\n}\n';
  const inline = '{\n  "public_jwk": {"kid":"new-key"}\n}\n';
  let finishInline!: (value: Response) => void;
  fetchMock.mockImplementation((url: string) => url.endsWith("/tool-configuration") ? Promise.resolve(json([]))
    : url.endsWith("?jwk=inline") ? new Promise<Response>((resolve) => { finishInline = resolve; })
      : Promise.resolve(new Response(text)));
  const writeText = vi.fn().mockRejectedValue(new Error("denied"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const createObjectURL = vi.fn().mockReturnValue("blob:config");
  vi.stubGlobal("URL", class extends URL { static override createObjectURL = createObjectURL; static override revokeObjectURL = vi.fn(); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(h(CanvasConfiguration, { id: connection.id }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
  const manual = await screen.findByRole("textbox", { name: "Copy JSON manually" });
  expect((manual as HTMLTextAreaElement).value).toBe(text);
  expect(writeText).toHaveBeenCalledWith(text);
  fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe("cogniate-canvas-lti.json");
  expect(createObjectURL.mock.calls[0]![0].size).toBe(new Blob([text]).size);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect((screen.getByRole("button", { name: "Copy JSON" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finishInline(new Response(inline, { headers: { "x-cogniate-key-id": "new-key" } })));
  expect(screen.getByText(/Key id: new-key/)).toBeTruthy();
  writeText.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(inline));
  expect(fetchMock.mock.calls.find(([url]) => url.endsWith("?jwk=inline"))?.[1]).toMatchObject({ cache: "no-store", credentials: "same-origin" });
});

it("keeps configuration actions unavailable when fetching fails and permits a retry", async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(url.endsWith("/tool-configuration") ? json([]) : json({ details: { description: "Configuration unavailable" } }, 502)));
  render(h(CanvasConfiguration, { id: connection.id }));
  await screen.findByText("Configuration unavailable");
  expect((screen.getByRole("button", { name: "Copy JSON" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Copied")).toBeNull();
  expect(screen.getByRole("button", { name: "Reload configuration" })).toBeTruthy();
});

it("maps every specified provider repair code and site rule without exposing a submitted code", () => {
  const codes = ["INVALID_PLATFORM_VALUES", "GRANT_INVALID", "GRANT_MISMATCH", "GRANT_IN_USE", "PLATFORM_IN_USE", "DEPLOYMENT_IN_USE", "DEPLOYMENT_FIXED", "CONNECTION_NOT_PENDING", "PROVIDER_NOT_READY", "LTI_SERVICE_ERROR"];
  for (const message of codes) expect(providerErrorMessage(new ApiError(422, { message }, "trace-123"), manifest)).toBeTruthy();
  for (let rule = 1; rule <= 5; rule++) expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule }), manifest)).toBeTruthy();
  expect(providerErrorFields(new ApiError(422, { field: "siteUrl", fields: { deploymentId: "invalid" } }))).toEqual(["deploymentId", "siteUrl"]);
  expect(providerErrorMessage(new ApiError(502, { message: "LTI_SERVICE_ERROR" }, "trace-123"), manifest)).toBe("Cogniate could not save the connection. Try again. Trace id: trace-123");
  // The Canvas texts come from its manifest texts.errors, byte for byte (BD-A1-63).
  expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule: 1 }), manifest)).toBe("Enter only the address, for example https://school.instructure.com. No path.");
  expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule: 5 }), manifest)).toBe("This is an Instructure-hosted address. Choose an Instructure-hosted Canvas type.");
  expect(providerErrorMessage(new ApiError(409, { message: "PLATFORM_IN_USE" }), manifest)).toBe("This Canvas developer key is already connected to Cogniate. Make a new developer key for this library.");
  // Canvas has no own DEPLOYMENT_FIXED text: the generic text, not the Blackboard text (LA-IC-20).
  expect(providerErrorMessage(new ApiError(409, { message: "DEPLOYMENT_FIXED" }), manifest)).toBe("This connection already reserved another deployment. Disconnect it, then make a new connection.");
});

it("keeps all pre-move instruction bytes from the manifest", () => {
  expect(steps.steps.flatMap((step) => step.instructions)).toEqual([
  "You need a Canvas administrator to complete the connection.",
  "Use one Canvas developer key for this Cogniate library.",
  "In Canvas, open Admin, select your account, then open Developer Keys.",
  "Select + Developer Key, then + LTI Key. Copy the settings below and paste the JSON. Do not edit the JSON.",
  "Save the key and turn it On. Copy its Client ID.",
  "In the account Settings, open Apps, then View App Configurations. Select + App and choose By Client ID. Enter the Client ID and install Cogniate.",
  "Open the app's menu and select Deployment Id. Copy the Deployment ID.",
  "Ask your Cogniate operator for an approval code. The operator checks the request with your Canvas administrator first. The code works once and expires.",
  "In Canvas, open Assignments, then select + Assignment.",
  "Set Submission Type to External Tool. Select Find, then Cogniate, and select the course.",
  "Check that Load This Tool In A New Tab is selected. Cogniate asks Canvas for a new tab.",
  "Keep Allowed Attempts unlimited. Cogniate can send a better score later.",
  "Select Save & Publish. The assignment gets 100 points. Learners see it only when the course and the assignment are published.",
  "A learner must open the activity from Canvas. Learners are anonymous: Cogniate gets no names or emails."
]);
});

// LA-E3-16: Canvas Dynamic Registration in the portal. The developer key (manual) path does not change.
const both: LmsProvider = { ...provider, methods: ["manual", "dynamic"] };
const wizardProps = (overrides: object) => ({ provider: both, connection: null, libraryName: "School", opener: "canvas-connect", onCreated: vi.fn(), onChanged: vi.fn(), sdk: createPortalSdk(() => undefined), ...overrides });
const staged = (fields: Partial<Connection> = {}): Connection => ({ ...connection, id: "con_dr", method: "dynamic", bindingAuthority: "operatorGrant", ...fields });
const sha256 = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
// SHA-256 of the manual create step and of the pending manual steps (JSON and approval form), taken at 83d97aa,
// before LA-E3-16 changed the Canvas portal files.
const MANUAL_CREATE_DOM = "f76f793a7d692782446ed3573abaec4d4448b6bb17537cda0ac56986a5c4d776";
const MANUAL_PENDING_DOM = "2126a87763a95a925671d3889a84350f2be7e4a81eb39d6fe666f307326fc8ac";

it("AC-LA-E3-16-05: keeps the manual create and pending steps byte for byte (DOM snapshot before LA-E3-16)", async () => {
  const create = render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ provider }))));
  expect(await sha256(create.container.innerHTML)).toBe(MANUAL_CREATE_DOM);
  create.unmount();
  // With both methods, the create step is the same DOM plus the method choice only.
  const choice = render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({}))));
  choice.container.querySelector("fieldset")!.remove();
  expect(await sha256(choice.container.innerHTML)).toBe(MANUAL_CREATE_DOM);
  choice.unmount();
  fetchMock.mockImplementation((url: string) => Promise.resolve(url.endsWith("/tool-configuration") ? json([{ key: "title", label: "Title", value: "Cogniate" }]) : new Response('{\n  "title": "Cogniate"\n}\n', { headers: { "x-cogniate-key-id": "key-1" } })));
  const pending = render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ provider, connection, opener: "canvas-manage" }))));
  await waitFor(() => expect((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled).toBe(false));
  await waitFor(() => expect(document.querySelector('tr[data-key="title"]')).toBeTruthy());
  expect(await sha256(pending.container.innerHTML)).toBe(MANUAL_PENDING_DOM);
});

it("AC-LA-E3-16-01: offers the manifest methods at create with the developer key selected, and sends the chosen method", async () => {
  fetchMock.mockResolvedValue(json(connection));
  const onCreated = vi.fn();
  render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ onCreated }))));
  const group = within(screen.getByRole("group", { name: "Connection method" }));
  expect(group.getAllByRole("radio").map((radio) => [(radio as HTMLInputElement).value, (radio as HTMLInputElement).checked])).toEqual([["manual", true], ["dynamic", false]]);
  expect(group.getByRole("radio", { name: /^Developer key/ })).toBeTruthy();
  // BD-A2-106: hosted Canvas uses the developer key.
  expect(group.getByText("Copy one registration URL into Canvas. Cogniate gets the Client ID and the Deployment ID. For Instructure-hosted Canvas, use Developer key. Cogniate does not support this method there yet.")).toBeTruthy();
  field("Connection name", "School");
  field("Canvas URL", "https://canvas.school.edu");
  field("Canvas type", "canvas-sim-cloud");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  // The default sends today's body, byte for byte.
  expect(fetchMock.mock.calls[0]![1].body).toBe(JSON.stringify({ lms: "canvas", method: "manual", name: "School", siteUrl: "https://canvas.school.edu", profile: "canvas-sim-cloud" }));
  fireEvent.click(group.getByRole("radio", { name: /^Dynamic Registration/ }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1]![1].body).toBe(JSON.stringify({ lms: "canvas", method: "dynamic", name: "School", siteUrl: "https://canvas.school.edu", profile: "canvas-sim-cloud" }));
  cleanup();
  // A manifest with only the developer key: no choice.
  render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ provider }))));
  expect(screen.queryByRole("group", { name: "Connection method" })).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
});

it("AC-LA-E3-16-02: shows the registration URL step instead of the developer key JSON for a pending dynamic connection", async () => {
  const onChanged = vi.fn();
  fetchMock.mockResolvedValue(json({ registrationUrl: "https://lti.test/register?ref=abc", expiresAt: "2026-10-24T05:00:00Z" }));
  const view = render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ connection: staged({ platform: null }), onChanged }))));
  expect(screen.getByRole("heading", { name: "Register Cogniate in Canvas" })).toBeTruthy();
  expect([...document.querySelectorAll('[data-step-id="canvas-registration"] li')].map((item) => item.textContent)).toEqual([
    "Copy the registration URL. If there is no URL, or the URL expired, select Get registration URL.",
    "In Canvas, open Admin, select your account, then open Developer Keys.",
    "Select + Developer Key, then + LTI Registration. Paste the registration URL and complete the steps in Canvas.",
    "Come back to this page. When Canvas sends the registration, the next step shows the Client ID and the Deployment ID.",
  ]);
  expect(screen.queryByRole("heading", { name: "Make a developer key in Canvas" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Copy JSON" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Copy Registration URL" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Get registration URL" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ ...staged({ platform: null }), registrationUrl: "https://lti.test/register?ref=abc", registrationUrlExpiresAt: "2026-10-24T05:00:00Z" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/app-api/connections/con_dr/registration-url");
  expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST" });
  view.rerender(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ connection: onChanged.mock.calls[0]![0], onChanged }))));
  expect(screen.getByRole("button", { name: "Copy Registration URL" })).toBeTruthy();
  expect(screen.getByText(`This URL expires ${new Date("2026-10-24T05:00:00Z").toLocaleString()}.`)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Get registration URL" })).toBeTruthy();
  // No developer key JSON request at any time.
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("canvas-configuration"))).toBe(false);
});

it("AC-LA-E3-16-02: shows the URL and its expiry at once when the create answer has the URL (BD-A1-106)", () => {
  render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ connection: staged({ platform: null, registrationUrl: "https://lti.test/register?ref=new", registrationUrlExpiresAt: "2026-10-24T06:00:00Z" }) }))));
  expect(screen.getByRole("button", { name: "Copy Registration URL" })).toBeTruthy();
  expect(screen.getByText(`This URL expires ${new Date("2026-10-24T06:00:00Z").toLocaleString()}.`)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Get registration URL" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Copy JSON" })).toBeNull();
});

it("AC-LA-E3-16-03: pre-fills the staged ids, keeps them editable, and waits without inputs before the platform is staged", async () => {
  const waiting = render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ connection: staged({ platform: null }) }))));
  const step3 = () => document.querySelector('[data-step-id="canvas-approval"]')!;
  expect(step3().textContent).toContain("Finish the registration in Canvas. Then this page shows the values to check.");
  expect(step3().querySelectorAll("input")).toHaveLength(0);
  waiting.unmount();
  const platform = { id: "plt_dr", issuer: "https://canvas.instructure.com", clientId: "10000000000042", deploymentIds: ["42:abc", "43:def"], productFamilyCode: null, siteUrl: "https://canvas.school.edu", serviceUrl: "https://school.instructure.com" };
  fetchMock.mockResolvedValue(json({ ...staged({ platform }), status: "registered" }));
  const onChanged = vi.fn();
  render(h(MemoryRouter, null, h(CanvasWizard, wizardProps({ connection: staged({ platform }), onChanged }))));
  // B-LA-E3-16-01: a staged registration offers no renewal, and step 2 says what comes next.
  const step2 = document.querySelector('[data-step-id="canvas-registration"]')!;
  expect(screen.queryByRole("button", { name: "Get registration URL" })).toBeNull();
  expect(step2.querySelector("ol")).toBeNull();
  expect(step2.textContent).toContain("Canvas sent the registration. The registration URL is not necessary now. In the next step, check the Client ID and the Deployment ID. Then enter the approval code from your Cogniate operator and select Save.");
  expect((screen.getByLabelText("Client ID") as HTMLInputElement).value).toBe("10000000000042");
  expect((screen.getByLabelText("Deployment ID") as HTMLInputElement).value).toBe("42:abc");
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  field("Deployment ID", "43:def");
  field("Approval code", "one-use-code");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/app-api/connections/con_dr/platform");
  expect(init).toMatchObject({ method: "PUT" });
  expect(JSON.parse(init.body as string)).toEqual({ clientId: "10000000000042", deploymentId: "43:def", grantCode: "one-use-code" });
});

it("BD-A2-101/102: a registered or connected connection has a closed Key JSON section; only Copy or Download fetch the JSON", async () => {
  const panels = (current: Connection) => render(h(MemoryRouter, null, ...canvasModule.connectionPanels!.map((Panel, index) =>
    h(Panel, { key: index, connection: current, sdk: createPortalSdk(() => undefined) }))));
  const exports = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/canvas-configuration"));
  const text = '{\n  "title": "Cogniate"\n}\n';
  fetchMock.mockImplementation(() => Promise.resolve(new Response(text, { headers: { "x-cogniate-key-id": "key-9" } })));
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  vi.stubGlobal("URL", class extends URL { static override createObjectURL = vi.fn().mockReturnValue("blob:key"); static override revokeObjectURL = vi.fn(); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  for (const status of ["registered", "connected"] as const) {
    const view = panels({ ...connection, status });
    const summary = screen.getByText("Key JSON");
    expect(summary.closest("details")!.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest("details")!.open).toBe(true);
    // Opening, switching the key form and closing again fetch and record nothing (BD-A2-102).
    const form = screen.getByLabelText("Put a copy of the current public key in the JSON");
    fireEvent.click(form);
    fireEvent.click(form);
    fireEvent.click(summary);
    fireEvent.click(summary);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(exports()).toEqual(["/app-api/connections/con_canvas/canvas-configuration"]);
    fireEvent.click(screen.getByLabelText("Put a copy of the current public key in the JSON"));
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(await screen.findByText("Copied")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(text);
    expect(exports()).toEqual(["/app-api/connections/con_canvas/canvas-configuration", "/app-api/connections/con_canvas/canvas-configuration?jwk=inline"]);
    expect(screen.getByText("Key id in this JSON: key-9")).toBeTruthy();
    view.unmount();
    fetchMock.mockClear();
    click.mockClear();
    writeText.mockClear();
  }
  for (const status of ["pending", "disabled"] as const) {
    const view = panels({ ...connection, status });
    expect(screen.queryByText("Key JSON")).toBeNull();
    view.unmount();
  }
});

it("BD-A2-102: a failed copy shows the fetched JSON in a text box", async () => {
  const text = '{\n  "title": "Cogniate"\n}\n';
  fetchMock.mockImplementation(() => Promise.resolve(new Response(text)));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(h(MemoryRouter, null, h(canvasModule.connectionPanels![1]!, { connection: { ...connection, status: "connected" }, sdk: createPortalSdk(() => undefined) })));
  fireEvent.click(screen.getByText("Key JSON"));
  fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
  expect(await screen.findByText("Copy failed. Select the JSON and copy it.")).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Copy JSON manually" }) as HTMLTextAreaElement).value).toBe(text);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
