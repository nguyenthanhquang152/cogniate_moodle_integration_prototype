// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App, Portal } from "./App.tsx";
import { Integrations } from "./Integrations.tsx";
import { PublishDialog } from "./courses/PublishDialog.tsx";
import { DisconnectDialog } from "./connect/DisconnectDialog.tsx";
const BLACKBOARD_NOT_READY = "Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.";
import type { Connection, Course, Lms, LmsProvidersResponse, Publication, Session } from "./types.ts";

const session: Session = { user: { id: "usr_a", name: "Author", email: "author@example.test", role: "owner" }, library: { id: "lib_a", name: "Library A" } };
function connection(lms: Lms, id: string = lms, status: Connection["status"] = "registered"): Connection {
  return {
    id, lms, name: "School", siteUrl: `https://${lms}.school.test`, serviceUrl: `https://${lms}.service.test`,
    profile: lms === "moodle" ? "standard" : `${lms}-sim`, method: "manual", status,
    capabilities: { dynamicRegistration: lms === "moodle", operatorApproval: lms !== "moodle", webServices: lms === "moodle", courseShell: lms === "moodle", addDeployment: lms === "canvas", canvasConfiguration: lms === "canvas" },
    registrationUrl: null, registrationUrlExpiresAt: null, createdAt: "2026-10-20T00:00:00Z", lastLaunchAt: null, lastError: null, webServices: null,
    platform: { id: `plt_${id}`, issuer: `https://${lms}.issuer.test`, clientId: `client_${id}`, deploymentIds: [`dep_${id}`], productFamilyCode: lms, siteUrl: `https://${lms}.school.test`, serviceUrl: `https://${lms}.service.test` },
  };
}
const all = (["moodle", "canvas", "blackboard"] as const).map((lms) => connection(lms));
const providers: LmsProvidersResponse = {
  lms: all.map((c) => ({
    lms: c.lms, label: c.lms, methods: ["manual"], capabilities: c.capabilities,
    profiles: [{ id: c.profile, label: `${c.lms} (simulation)`, ready: c.lms !== "blackboard", simulation: true, clientId: null }],
  })),
};
const course = {
  id: "crs_a", title: "Safety", versions: [{ id: "ver_a", version: 1, format: "html" }],
} as Course;
const publication: Publication = {
  id: "pub_a", lms: "canvas", connectionName: "School Canvas", connectionId: "canvas",
  courseId: "crs_a", courseTitle: "Safety", versionId: "ver_a", version: 1, format: "html",
  status: "available", createdAt: "2026-10-20", updatedAt: "2026-10-20",
  moodleCourse: null, shellStatus: null, shellError: null,
  stats: { activities: 1, learners: 1, inProgress: 0, completed: 1, passed: 1, failed: 0, lastScoreSync: null },
};
const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
function defaultFetch(path: string) {
  if (path === "/app-api/me") return json(session);
  if (path === "/app-api/connections") return json({ connections: all });
  if (path === "/app-api/lms-providers") return json(providers);
  const found = all.find((c) => path === `/app-api/connections/${c.id}`);
  if (found) return json(found);
  throw new Error(`Unexpected test request: ${path}`);
}
function app(path: string) { return render(h(MemoryRouter, { initialEntries: [path] }, h(App))); }
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (path: string) => defaultFetch(path));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("isolates newest card status by LMS with equal names/times and a stable id tie break", async () => {
  fetchMock.mockImplementation(async (path: string) => path.endsWith("/connections") ? json({ connections: [
    connection("canvas", "canvas-a", "pending"), connection("blackboard", "blackboard-z", "connected"),
    connection("moodle", "moodle-z", "disabled"), connection("canvas", "canvas-z", "registered"),
  ] }) : json(providers));
  render(h(MemoryRouter, null, h(Integrations)));
  await waitFor(() => expect(screen.getAllByRole("link", { name: /Manage/ })).toHaveLength(3));
  for (const [name, id, status] of [["Moodle", "moodle-z", "Disconnected"], ["Canvas", "canvas-z", "Registered"], ["Blackboard", "blackboard-z", "Connected"]]) {
    const card = within(screen.getByRole("article", { name }));
    expect(card.getByRole("link", { name: /Manage/ }).getAttribute("href")).toBe(`/integrations/${name!.toLowerCase()}/${id}`);
    expect(card.getByText(status!)).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("tab", { name: "LMS Publishing" }));
  expect(screen.getAllByRole("article")).toHaveLength(4);
});

it("disables Blackboard creation with the operator readiness explanation", async () => {
  fetchMock.mockImplementation(async (path: string) => path.endsWith("/connections") ? json({ connections: [] }) : json(providers));
  render(h(MemoryRouter, null, h(Integrations)));
  const card = within(screen.getByRole("article", { name: "Blackboard" }));
  await card.findByText(BLACKBOARD_NOT_READY);
  expect(card.getByText("Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.")).toBeTruthy();
  expect(card.queryByText("This LMS setup is not ready in Cogniate.")).toBeNull();
  expect((card.getByRole("button", { name: "Connect" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(screen.getByRole("article", { name: "Canvas" })).getByRole("link", { name: "Connect" }).getAttribute("href")).toBe("/integrations/canvas/connect");
});

it("mounts the ready Blackboard wizard from its card through creation, approval and teacher guidance", async () => {
  const readyProviders: LmsProvidersResponse = {
    lms: providers.lms.map((provider) => provider.lms === "blackboard"
      ? { ...provider, profiles: provider.profiles.map((profile) => ({ ...profile, ready: true, clientId: "qa-bb-app" })) }
      : provider),
  };
  let created = false;
  let current: Connection = { ...connection("blackboard", "bb-new", "pending"), platform: null };
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === "/app-api/lms-providers") return json(readyProviders);
    if (url === "/app-api/connections") {
      if (options?.method === "POST") { created = true; return json(current, 201); }
      return json({ connections: created ? [current] : [] });
    }
    if (url === "/app-api/connections/bb-new/platform") {
      current = connection("blackboard", "bb-new", "registered");
      return json(current);
    }
    if (url === "/app-api/connections/bb-new") return json(current);
    if (url.endsWith("/tool-configuration")) return json([]);
    return defaultFetch(url);
  });
  app("/integrations");
  const card = within(await screen.findByRole("article", { name: "Blackboard" }));
  fireEvent.click(await card.findByRole("link", { name: "Connect" }));
  await screen.findByLabelText("Learn URL");
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "School Blackboard" } });
  fireEvent.change(screen.getByLabelText("Learn URL"), { target: { value: "https://learn.school.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Register Cogniate in Blackboard Learn" });
  expect(screen.getByText("qa-bb-app")).toBeTruthy();
  expect(screen.queryByLabelText("Client ID")).toBeNull();
  fireEvent.change(screen.getByLabelText("Deployment ID"), { target: { value: "bb-deployment" } });
  fireEvent.change(screen.getByLabelText("Approval code"), { target: { value: "b".repeat(43) } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("heading", { name: "Add a Cogniate course in Blackboard" });
  expect(screen.getByText(/Blackboard Ultra:/)).toBeTruthy();
  expect(screen.getByText(/Blackboard Original:/)).toBeTruthy();
  expect(screen.queryByLabelText("Approval code")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Add deployment ID" })).toBeNull();
  expect(screen.queryByText(/Web services/)).toBeNull();
  const createCall = fetchMock.mock.calls.find(([url, options]) => url === "/app-api/connections" && options?.method === "POST")!;
  expect(JSON.parse(createCall[1].body)).toEqual({
    name: "School Blackboard", siteUrl: "https://learn.school.edu", lms: "blackboard", method: "manual", profile: "blackboard-sim",
  });
  const bindCall = fetchMock.mock.calls.find(([url]) => url.endsWith("/bb-new/platform"))!;
  expect(JSON.parse(bindCall[1].body)).toEqual({ deploymentId: "bb-deployment", grantCode: "b".repeat(43) });
});

it.each(["/integrations/blackboard/canvas", "/integrations/unknown/canvas", "/integrations/canvas/foreign"])("shows not found without exposing connection settings at %s", async (path) => {
  fetchMock.mockImplementation(async (url: string) => url.endsWith("/connections/foreign") ? json({ details: { message: "NOT_FOUND" } }, 404) : defaultFetch(url));
  app(path);
  await screen.findByRole("heading", { name: "Page not found" });
  expect(screen.queryByText("https://canvas.school.test")).toBeNull();
  expect(screen.queryByLabelText("Approval code")).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/tool-configuration"))).toBe(false);
});

it("shows canonical Canvas values and deployment ids with only Canvas capabilities", async () => {
  app("/integrations/canvas/canvas");
  await screen.findByRole("heading", { name: "Add deployment ID" });
  expect(screen.getByText("https://canvas.school.test")).toBeTruthy();
  expect(screen.getByText("Canvas service URL: https://canvas.service.test")).toBeTruthy();
  expect(screen.getByText("dep_canvas")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Open Canvas/ }).getAttribute("href")).toBe("https://canvas.school.test");
  expect(screen.queryByText(/Web services/)).toBeNull();
  expect(screen.queryByText(/activate in Moodle/)).toBeNull();
  expect(await screen.findByRole("heading", { name: "Add a Cogniate course in Canvas" })).toBeTruthy();
});

it("clears the old connection immediately when navigating to a different LMS", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation((url: string) => url === "/app-api/connections/blackboard"
    ? new Promise<Response>((resolve) => { finish = resolve; }) : Promise.resolve(defaultFetch(url)));
  app("/integrations/canvas/canvas");
  await screen.findByRole("heading", { name: "Add deployment ID" });
  fireEvent.change(screen.getByLabelText("LMS connection"), { target: { value: "blackboard" } });
  expect(screen.queryByText("https://canvas.school.test")).toBeNull();
  expect(screen.queryByLabelText("Approval code")).toBeNull();
  await act(async () => finish(json(all[2])));
  await screen.findByText("https://blackboard.school.test");
  expect(screen.queryByRole("heading", { name: "Add deployment ID" })).toBeNull();
});

it.each([
  { name: "Blackboard selection", target: all[2]!, via: "select" },
  { name: "Moodle selection", target: all[0]!, via: "select" },
  { name: "another Canvas connection", target: { ...connection("canvas", "next-canvas"),
    siteUrl: "https://next.canvas.school.test", serviceUrl: "https://next.canvas.service.test" }, via: "select" },
  { name: "Back to Blackboard", target: all[2]!, via: "back" },
  { name: "Forward to Blackboard", target: all[2]!, via: "forward" },
  { name: "Blackboard Manage link", target: all[2]!, via: "link" },
])("never exposes old Canvas values across $name, including a delayed refresh", async ({ target, via }) => {
  const targetPath = `/integrations/${target.lms}/${target.id}`;
  const traverse = async (direction: "back" | "forward") => {
    const completed = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history[direction]();
    await completed;
  };
  window.history.replaceState(null, "", "/integrations/canvas/canvas");
  if (via === "back") {
    window.history.replaceState(null, "", targetPath);
    window.history.pushState(null, "", "/integrations/canvas/canvas");
  } else if (via === "forward") {
    window.history.pushState(null, "", targetPath);
    await traverse("back");
  }
  let canvasReads = 0;
  let finishRefresh!: (value: Response) => void;
  let refreshSignal: AbortSignal | undefined;
  let finishDestination!: (value: Response) => void;
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url === "/app-api/connections/canvas" && ++canvasReads > 1) {
      refreshSignal = options?.signal ?? undefined;
      return new Promise<Response>((resolve) => { finishRefresh = resolve; });
    }
    if (url === `/app-api/connections/${target.id}`)
      return new Promise<Response>((resolve) => { finishDestination = resolve; });
    if (url === "/app-api/connections")
      return Promise.resolve(json({ connections: all.some((c) => c.id === target.id) ? all : [...all, target] }));
    return Promise.resolve(defaultFetch(url));
  });
  render(h(Portal));
  await screen.findByRole("heading", { name: "Add deployment ID" });
  const oldValues = ["https://canvas.school.test", "https://canvas.service.test", "dep_canvas"];
  const staleSeen = new Set<string>();
  let observations = 0;
  const observe = () => {
    if (window.location.pathname !== targetPath) return;
    observations++;
    for (const value of oldValues) if (document.body.textContent?.includes(value)) staleSeen.add(value);
  };
  const observer = new MutationObserver(observe);
  observer.observe(document.body, { childList: true, characterData: true, attributes: true, subtree: true });
  const afterHistory = () => queueMicrotask(observe);
  window.addEventListener("popstate", afterHistory);
  const push = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    push(...args);
    // Observe the browser location between the navigation event and a concurrent route commit.
    queueMicrotask(observe);
  });
  try {
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => expect(canvasReads).toBe(2));
    if (via === "select") {
      const select = screen.getByLabelText("LMS connection") as HTMLSelectElement;
      await act(async () => {
        select.value = target.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
      });
    } else if (via === "back" || via === "forward") {
      await act(async () => { await traverse(via); });
    } else {
      fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "Integrations" }));
      await screen.findByRole("heading", { name: "Integrations" });
      const card = within(screen.getByRole("article", { name: "Blackboard" }));
      fireEvent.click(await card.findByRole("link", { name: /Manage/ }));
    }
    expect(window.location.pathname).toBe(targetPath);
    expect(refreshSignal?.aborted).toBe(true);
    await act(async () => finishRefresh(json(all[1])));
    expect(screen.queryByText("https://canvas.school.test")).toBeNull();
    await act(async () => finishDestination(json(target)));
    await screen.findByText(target.siteUrl);
    observe();
    expect(observations).toBeGreaterThan(0);
    expect([...staleSeen]).toEqual([]);
  } finally {
    observer.disconnect();
    window.removeEventListener("popstate", afterHistory);
    cleanup();
    window.history.replaceState(null, "", "/");
  }
});

it("does not let an older pending poll replace a successful binding", async () => {
  vi.useFakeTimers();
  const pending = connection("canvas", "canvas", "pending");
  let reads = 0;
  let completePoll!: (value: Response) => void;
  fetchMock.mockImplementation((url: string) => {
    if (url === "/app-api/connections/canvas") {
      reads++;
      if (reads === 2) return new Promise<Response>((resolve) => { completePoll = resolve; });
      return Promise.resolve(json(reads === 1 ? pending : all[1]));
    }
    if (url.endsWith("/platform")) return Promise.resolve(json(all[1]));
    if (url.endsWith("/tool-configuration")) return Promise.resolve(json([]));
    if (url.endsWith("/canvas-configuration")) return Promise.resolve(json({ title: "Configuration" }));
    return Promise.resolve(defaultFetch(url));
  });
  try {
    await act(async () => { app("/integrations/canvas/canvas"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(reads).toBe(2);
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "client" } });
    fireEvent.change(screen.getByLabelText("Deployment ID"), { target: { value: "deployment" } });
    fireEvent.change(screen.getByLabelText("Approval code"), { target: { value: "g".repeat(43) } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
    expect(screen.getByRole("heading", { name: "Add a Cogniate course in Canvas" })).toBeTruthy();
    await act(async () => { completePoll(json(pending)); });
    expect(screen.getByRole("heading", { name: "Add a Cogniate course in Canvas" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Save the Canvas values" })).toBeNull();
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

it.each(["canvas", "blackboard"] as const)("never offers or sends Moodle native course creation for %s", async (lms) => {
  const c = { ...connection(lms), webServices: { siteName: "Malformed unrelated service", release: "5.2" } };
  fetchMock.mockImplementation(async (url: string) => url.endsWith("/connections") ? json({ connections: [c] }) : json({ ...publication, lms }));
  const onPublished = vi.fn();
  render(h(MemoryRouter, null, h(PublishDialog, { course, onClose: vi.fn(), onPublished })));
  await screen.findByRole("option", { name: `School (${lms === "canvas" ? "Canvas" : "Blackboard"}, ${lms}.school.test)` });
  fireEvent.change(screen.getByLabelText("LMS connection"), { target: { value: lms } });
  expect(screen.queryByLabelText("Also create an empty Moodle course")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(onPublished).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)).not.toHaveProperty("createMoodleCourse");
});

it("keeps Moodle native course creation when its capability and web services are present", async () => {
  fetchMock.mockResolvedValue(json({ connections: [{ ...all[0], webServices: { siteName: "Moodle", release: "5.2" } }] }));
  render(h(MemoryRouter, null, h(PublishDialog, { course, onClose: vi.fn(), onPublished: vi.fn() })));
  await screen.findByRole("option", { name: "School (Moodle, moodle.school.test)" });
  fireEvent.change(screen.getByLabelText("LMS connection"), { target: { value: "moodle" } });
  expect(screen.getByLabelText("Also create an empty Moodle course")).toBeTruthy();
});

it("uses the Canvas publication DTO and anonymous label throughout results", async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/results")) return json({ rows: [{
      learner: { sub: "anonymous", label: "Learner anonymous @ school-a.canvas.sim.test" },
      activity: { resourceLinkId: "rl_a", title: "Safety", contextTitle: "School" }, preview: false,
      best: null, attempts: [], scoreSyncs: [], gradebook: { resultScore: null, resultMaximum: 100, readAt: "2026-10-20" }, gradebookDiffers: true,
    }] });
    if (url === "/app-api/publications/pub_a") return json(publication);
    if (url.includes("/versions/")) return json({ report: { scorm: null } });
    return defaultFetch(url);
  });
  app("/publications/pub_a/results");
  await screen.findByText("Learner anonymous @ school-a.canvas.sim.test");
  expect(screen.getByText(/School Canvas/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Refresh from Canvas" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Canvas sync" })).toBeTruthy();
  expect(screen.getByText("No grade in Canvas")).toBeTruthy();
  expect(screen.getByText("Canvas keeps another grade, for example a teacher override")).toBeTruthy();
  expect(screen.queryByText(/Moodle/)).toBeNull();
});

it("uses Blackboard-specific disconnect scope and the original Moodle wording", () => {
  const view = render(h(DisconnectDialog, { id: "blackboard", lms: "blackboard", onClose: vi.fn(), onDisconnected: vi.fn() }));
  expect(screen.getByText("This switches off Cogniate for this Blackboard site only. Other schools are not affected. Cogniate items in Blackboard courses stop working, and connecting again later does not restore them.")).toBeTruthy();
  view.rerender(h(DisconnectDialog, { id: "moodle", lms: "moodle", onClose: vi.fn(), onDisconnected: vi.fn() }));
  expect(screen.getByText("This stops launches through this connection. The tool stays in Moodle.")).toBeTruthy();
});
