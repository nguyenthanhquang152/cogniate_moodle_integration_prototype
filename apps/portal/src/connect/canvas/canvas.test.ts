// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ApiError } from "../../api.ts";
import type { Connection, LmsProvider } from "../../types.ts";
import { providerErrorFields, providerErrorMessage } from "../provider-errors.tsx";
import { CanvasBinding } from "./CanvasBinding.tsx";
import { CanvasConfiguration } from "./CanvasConfiguration.tsx";
import { CanvasWizard } from "./CanvasWizard.tsx";
import steps from "./canvas-steps.json";

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
  const view = render(h(MemoryRouter, null, h(CanvasWizard, { provider, connection: null, libraryName: "School", opener: "canvas-connect", onCreated, onChanged: vi.fn() })));
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
  render(h(MemoryRouter, null, h(CanvasWizard, { provider, connection: null, libraryName: "School", opener: "canvas-connect", onCreated: vi.fn(), onChanged: vi.fn() })));
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
  for (const message of codes) expect(providerErrorMessage(new ApiError(422, { message }, "trace-123"))).toBeTruthy();
  for (let rule = 1; rule <= 5; rule++) expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule }))).toBeTruthy();
  expect(providerErrorFields(new ApiError(422, { field: "siteUrl", fields: { deploymentId: "invalid" } }))).toEqual(["deploymentId", "siteUrl"]);
  expect(providerErrorMessage(new ApiError(502, { message: "LTI_SERVICE_ERROR" }, "trace-123"))).toBe("Cogniate could not save the connection. Try again. Trace id: trace-123");
  expect(providerErrorMessage(new ApiError(409, { message: "DEPLOYMENT_FIXED" }))).toBe("This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.");
});
