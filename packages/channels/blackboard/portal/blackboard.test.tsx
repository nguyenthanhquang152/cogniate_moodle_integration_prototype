import { createPortalSdk } from "@cogniate/portal-sdk";
import { BlackboardBinding } from "./BlackboardBinding.tsx";
// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ChannelScope, MemoryRouter } from "@cogniate/portal-sdk";
import type { Connection, LmsProvider } from "@cogniate/portal-sdk";
import { BlackboardTeacherSteps, BlackboardWizard } from "./BlackboardWizard.tsx";
import steps from "./steps.ts";
import manifest from "../manifest.ts";

const capabilities = {
  dynamicRegistration: false, operatorApproval: true, webServices: false,
  courseShell: false, addDeployment: false, canvasConfiguration: false,
};
const provider = (ready: Array<[string, boolean]>): LmsProvider => ({
  lms: "blackboard", label: "Blackboard Learn", methods: ["manual"], capabilities,
  profiles: ready.map(([id, isReady]) => ({ id, label: id === "blackboard" ? "Blackboard Learn" : "Blackboard Learn (simulation)", simulation: id !== "blackboard", ready: isReady, clientId: isReady ? "qa-bb-app" : null })),
});
const connection: Connection = {
  id: "con_bb", name: "Learn", lms: "blackboard", profile: "blackboard-sim",
  siteUrl: "https://learn-a.blackboard.sim.test", serviceUrl: "https://learn-a.blackboard.sim.test",
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
const field = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
// The connect route sets the channel scope; the error texts of this channel come from its manifest (BD-A1-63).
const wizard = (props: Partial<Parameters<typeof BlackboardWizard>[0]>) => render(h(MemoryRouter, null, h(ChannelScope, { manifest }, h(BlackboardWizard, {
  provider: provider([["blackboard", false], ["blackboard-sim", true]]), connection: null, libraryName: "School", opener: "blackboard-connect",
  onCreated: vi.fn(), onChanged: vi.fn(), sdk: createPortalSdk(() => undefined), ...props,
}))));

it("has 4 step data entries, none verified", () => {
  expect(steps.steps.map((s) => s.id)).toEqual(["blackboard-site", "blackboard-register", "blackboard-approval", "blackboard-teacher"]);
  expect(steps.steps.every((s) => s.verified === false)).toBe(true);
});

it("register step: the first Submit only shows the settings; the final Submit after Institution Policies comes before the Deployment ID", () => {
  const register = steps.steps.find((s) => s.id === "blackboard-register")!.instructions;
  const at = (pattern: RegExp) => register.findIndex((text) => pattern.test(text));
  const first = at(/^Enter the Client ID below, then select Submit\. This first Submit only shows the tool settings\./);
  const policies = at(/^In Institution Policies, set User Fields to Send to Role in Course only\. Do not send Name or Email Address\.$/);
  const final = at(/^Select Submit again at the end of the page\. This final Submit adds the tool\./);
  const deployment = at(/^Copy the Deployment ID that Learn shows\. Then come back to Cogniate\.$/);
  expect([first, policies, final, deployment].every((i) => i >= 0)).toBe(true);
  expect(first < at(/Tool Status to Approved/) && first < policies && policies < final && at(/grade service access/) < final && final < deployment).toBe(true);
  expect(register.filter((text) => /Submit/.test(text))).toHaveLength(2);
});

it("step 1: name and Learn URL only; the single ready profile is sent; no issuer, endpoint or secret input", async () => {
  fetchMock.mockResolvedValue(json(connection, 201));
  const onCreated = vi.fn();
  const view = wizard({ onCreated });
  expect(view.container.querySelectorAll("input")).toHaveLength(2);
  expect(screen.queryByLabelText("Blackboard type")).toBeNull();
  for (const name of [/client secret/i, /issuer/i, /jwks/i, /token url/i, /authentication url/i]) expect(screen.queryByLabelText(name)).toBeNull();
  field("Connection name", "Learn");
  field("Learn URL", "https://learn-a.blackboard.sim.test");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(connection));
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
    lms: "blackboard", method: "manual", name: "Learn", siteUrl: "https://learn-a.blackboard.sim.test", profile: "blackboard-sim",
  });
});

it("step 1: a type select only with two ready profiles; not ready: the operator text and a disabled Next", () => {
  wizard({ provider: provider([["blackboard", true], ["blackboard-sim", true]]) });
  expect(screen.getByLabelText("Blackboard type")).toBeTruthy();
  cleanup();
  wizard({ provider: provider([["blackboard", false]]) });
  expect(screen.getByText("Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
});

it("steps 2 and 3: Client ID with Copy, the tool rows, and Save with the approval code cleared after every submit", async () => {
  const rows = [{ key: "client_id", label: "Client ID", value: "qa-bb-app" }];
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/tool-configuration")) return json(rows);
    const body = JSON.parse(String(init?.body));
    if (body.deploymentId === "dZ") return json({ details: { message: "GRANT_MISMATCH", fields: ["deploymentId"] } }, 422);
    if (body.deploymentId === "dF") return json({ details: { message: "DEPLOYMENT_FIXED" } }, 409);
    return json({ ...connection, status: "registered" });
  });
  const onChanged = vi.fn();
  wizard({ connection, onChanged });
  expect(screen.getByRole("heading", { name: "Register Cogniate in Blackboard Learn" })).toBeTruthy();
  expect(document.querySelector("[data-client-id] code")?.textContent).toBe("qa-bb-app");
  expect(screen.getAllByRole("button", { name: /Copy/ }).length).toBeGreaterThan(0);
  await waitFor(() => expect(document.querySelector('tr[data-key="client_id"]')).toBeTruthy());
  // The approval instructions show once: as the help text of the code field, not also as a step list.
  const help = "Ask your Cogniate operator for an approval code. The operator checks the request with your Blackboard administrator first. The code works once and expires.";
  expect(screen.getAllByText(help)).toHaveLength(1);
  expect(screen.getByLabelText("Approval code").getAttribute("aria-describedby")).toBe("blackboard-approval-help");
  expect(document.querySelector('[data-step-id="blackboard-approval"] ol')).toBeNull();
  expect(document.querySelector('[data-step-id="blackboard-register"] ol')).toBeTruthy();
  const code = "A".repeat(43);
  field("Deployment ID", "dZ");
  field("Approval code", code);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByText("The values do not match the approval. Check the marked fields, or ask your Cogniate operator.")).toBeTruthy());
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  expect(screen.getByLabelText("Deployment ID").getAttribute("aria-invalid")).toBe("true");
  field("Deployment ID", "dF");
  field("Approval code", code);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByText("This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.")).toBeTruthy());
  field("Deployment ID", "dA");
  field("Approval code", code);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const put = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "PUT").at(-1)!;
  expect(JSON.parse(String(put[1].body))).toEqual({ deploymentId: "dA", grantCode: code });
  expect((screen.getByLabelText("Approval code") as HTMLInputElement).value).toBe("");
  expect(window.location.href).not.toContain(code);
  expect(JSON.stringify({ ...window.localStorage })).not.toContain(code);
  expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(code);
});

it("step 4: the Ultra and Original teacher steps", () => {
  render(h(BlackboardTeacherSteps));
  expect(screen.getByRole("heading", { name: "Add a Cogniate course in Blackboard" })).toBeTruthy();
  expect(screen.getByText(/Content Market/)).toBeTruthy();
  expect(screen.getByText(/Build Content/)).toBeTruthy();
});

it.each(["blackboard"] as const)("shows the neutral readiness title and action after %s binding fails", async (lms) => {
  fetchMock.mockResolvedValue(json({ details: { message: "PROVIDER_NOT_READY", traceId: "trace-readiness" } }, 409));
  const onChanged = vi.fn();
  const current: Connection = { ...connection, lms, id: `con_${lms}` };
  render(h(BlackboardBinding, { connection: current, onChanged }));
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

it("keeps all pre-move instruction bytes from the manifest", () => {
  expect(steps.steps.flatMap((step) => step.instructions)).toEqual([
  "You need a Blackboard Learn administrator to complete the connection.",
  "One Learn site is one connection. Enter the address that teachers use.",
  "In Learn, open Administrator Panel, then LTI Tool Providers, then Register LTI 1.3/Advantage Tool.",
  "Enter the Client ID below, then select Submit. This first Submit only shows the tool settings. Compare the values that Learn shows with the rows below.",
  "Set the Tool Status to Approved.",
  "In Institution Policies, set User Fields to Send to Role in Course only. Do not send Name or Email Address.",
  "Allow grade service access and Membership Service access.",
  "Select Submit again at the end of the page. This final Submit adds the tool. Learn does not save the tool without it.",
  "Copy the Deployment ID that Learn shows. Then come back to Cogniate.",
  "Ask your Cogniate operator for an approval code. The operator checks the request with your Blackboard administrator first. The code works once and expires.",
  "Blackboard Ultra: open Course Content, then select +, then Content Market, then Cogniate. Select the course.",
  "Blackboard Original: open a content area, then Build Content, then Cogniate. Select the course.",
  "A learner must open the activity from Blackboard. Learners are anonymous: Cogniate gets no names or emails."
]);
});
