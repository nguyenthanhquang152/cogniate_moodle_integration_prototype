import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { buildChannelRegistry } from "@cogniate/channel-kernel";
import type { ChannelManifest } from "@cogniate/channel-kernel";
import { App } from "../App.tsx";
import type { Connection, LmsProvider } from "../types.ts";
import { ChannelProvider } from "./context.tsx";
import { channelRegistry, discoveredChannels } from "./registry.ts";
import { channelModules } from "./modules.ts";
import { ManifestWizard } from "./ManifestWizard.tsx";
import { CollectStep, createPortalSdk } from "../sdk/index.ts";

// This channel has no folder or portal module. The shell must accept only its data.
const canary: ChannelManifest = {
  id: "shell-canary", family: "lti13", availability: "preview",
  names: { text: "Test learning site", label: "Test learning site" },
  card: { title: "Test learning site", description: "A data-only channel", mark: "T", color: "blue", category: "LMS Publishing", order: 100 },
  registration: [{ method: "manual", authority: "operatorGrant", profiles: ["shell-test"], defaultProfile: "shell-test" }],
  capabilities: {}, lti: { guardedFamilies: [], toolConfiguration: "none" },
  setup: {
    createFields: [{ key: "siteUrl", label: "Site URL", kind: "origin", required: true }],
    bindingFields: [{ key: "deploymentId", label: "Deployment ID", kind: "id", required: true }],
  },
  texts: { adminSteps: ["Open {LMS} settings."], teacherSteps: ["Select {tool} in {LMS}."], disconnect: "Disconnect {LMS}.", notReady: null },
};
const self: ChannelManifest = { ...canary, registration: [{ ...canary.registration[0]!, method: "dynamic", authority: "self" }] };
const simulation: ChannelManifest = { ...canary, id: "shell-simulation", availability: "simulation-only", card: { ...canary.card, title: "Simulation learning site", order: 101 }, registration: [{ ...canary.registration[0]!, profiles: ["shell-sim"], defaultProfile: "shell-sim" }] };
const registry = buildChannelRegistry([...discoveredChannels, ...[canary, simulation].map((manifest) => ({ folder: `/channels/${manifest.id}`, manifest }))], { simulations: true });
function provider(manifest: ChannelManifest): LmsProvider {
  return {
    lms: manifest.id, channel: manifest.id, label: manifest.names.label,
    methods: manifest.registration.map((entry) => entry.method),
    capabilities: registry.legacyCapabilities(manifest.id),
    profiles: [...new Set(manifest.registration.flatMap((entry) => entry.profiles))].map((id) => ({ id, label: id, ready: true, simulation: false, clientId: null })),
  };
}
function connection(manifest: ChannelManifest, fields: Partial<Connection> = {}): Connection {
  return {
    id: "con_shell", name: "Test connection", siteUrl: "https://learning.test", serviceUrl: "https://learning.test",
    lms: manifest.id, channel: manifest.id, channelName: manifest.names.text, profile: manifest.registration[0]!.defaultProfile,
    capabilities: registry.legacyCapabilities(manifest.id), method: manifest.registration[0]!.method, status: "pending",
    registrationUrl: null, registrationUrlExpiresAt: null, platform: null, lastError: null, webServices: null,
    createdAt: "2026-10-22T00:00:00Z", lastLaunchAt: null, ...fields,
  };
}
const session = { user: { id: "usr_test", name: "Test", email: "test@example.test", role: "admin" }, library: { id: "lib_test", name: "Library" } };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
let listed: LmsProvider[];
let current: Connection;
const fetchMock = vi.fn();
beforeEach(() => {
  listed = registry.channels().map(provider);
  current = connection(canary);
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (url === "/app-api/me") return json(session);
    if (url === "/app-api/lms-providers") return json({ lms: listed });
    if (url === "/app-api/connections") return json({ connections: [] });
    if (url === `/app-api/connections/${current.id}/tool-configuration`) return json([]);
    if (url.includes("-configuration")) return json({ title: "Test configuration" });
    if (url === `/app-api/connections/${current.id}`) return json(current);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function app(path: string) {
  return render(<ChannelProvider registry={registry}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></ChannelProvider>);
}
function wizard(manifest: ChannelManifest, existing: Connection | null = null, onChanged = vi.fn()) {
  return render(<MemoryRouter><ManifestWizard manifest={manifest} provider={provider(manifest)} connection={existing} libraryName="Library" opener="test" onCreated={vi.fn()} onChanged={onChanged} sdk={createPortalSdk(vi.fn())} /></MemoryRouter>);
}

describe("manifest portal shell", () => {
  it("renders one card for every discovered channel and the data-only channel", async () => {
    app("/integrations");
    for (const manifest of registry.channels()) {
      const card = await screen.findByRole("article", { name: manifest.card.title });
      expect(within(card).getAllByRole("heading", { name: manifest.card.title })).toHaveLength(1);
      await waitFor(() => expect(within(card).getByRole("link", { name: "Connect" }).getAttribute("href")).toBe(`/integrations/${manifest.id}/connect`));
      expect(card.textContent).toContain(manifest.card.description);
    }
  });
  it("keeps the graduation-cap logo on the baseline card and connect page", async () => {
    const overview = app("/integrations");
    const card = await screen.findByRole("article", { name: "Moodle" });
    const logo = card.querySelector('[title="Moodle"]')!;
    expect(logo.querySelector("svg.lucide-graduation-cap")).toBeTruthy();
    expect(logo.textContent).toBe("");
    const fallback = await screen.findByRole("article", { name: canary.card.title });
    expect(fallback.querySelector(`[title="${canary.card.title}"]`)!.textContent).toBe(canary.card.mark);
    overview.unmount();
    const connect = app("/integrations/moodle/connect");
    await screen.findByRole("heading", { name: "Connect Moodle" });
    expect(connect.container.querySelector('[title="Moodle"] svg.lucide-graduation-cap')).toBeTruthy();
  });
  it.each([...channelRegistry.channels().filter((manifest) => !channelModules.get(manifest.id)?.Wizard), canary])("renders all four default steps from $id manifest data", (manifest) => {
    const { container } = wizard(manifest);
    expect([...container.querySelectorAll("[data-channel-step]")].map((element) => element.getAttribute("data-channel-step"))).toEqual(["show", "collect", "verify", "enable"]);
    expect(container.textContent).toContain(manifest.texts.adminSteps[0]!.replaceAll("{LMS}", manifest.names.text).replaceAll("{tool}", "Cogniate (Library)"));
  });
  it("lets a step override reuse the default fields and form state", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValue(json(current));
    render(<MemoryRouter><ManifestWizard manifest={canary} provider={provider(canary)} connection={null} libraryName="Library" opener="test" onCreated={onCreated} onChanged={vi.fn()} sdk={createPortalSdk(vi.fn())}
      module={{ steps: { collect: () => <><p>Custom instructions</p><CollectStep /></> } }} /></MemoryRouter>);
    expect(screen.getByText("Custom instructions")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "Shared form" } });
    fireEvent.change(screen.getByLabelText("Site URL"), { target: { value: "https://shared.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(current));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ name: "Shared form", siteUrl: "https://shared.test", channel: canary.id });
  });
  it("uses the generic connect route without a portal module and submits manifest fields", async () => {
    app(`/integrations/${canary.id}/connect`);
    expect(await screen.findByRole("heading", { name: "Connect Test learning site" })).toBeTruthy();
    const name = await screen.findByLabelText("Connection name");
    fireEvent.change(name, { target: { value: "New site" } });
    fireEvent.change(screen.getByLabelText("Site URL"), { target: { value: "https://new.test" } });
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      if (options.method === "POST") return json(current);
      if (url === "/app-api/me") return json(session);
      if (url === "/app-api/lms-providers") return json({ lms: listed });
      if (url === "/app-api/connections") return json({ connections: [current] });
      return json(current);
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Manage Test learning site" });
    const call = fetchMock.mock.calls.find(([, options]) => options.method === "POST")!;
    expect(JSON.parse(call[1].body)).toEqual({ name: "New site", siteUrl: "https://new.test", channel: canary.id, method: "manual", profile: "shell-test" });
    expect(await screen.findByLabelText("Approval code")).toBeTruthy();
  });
  it.each(["/integrations/unknown/connect", "/integrations/unknown/con_shell"])("rejects an unknown channel at %s", async (path) => {
    app(path);
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.queryByLabelText("Connection name")).toBeNull();
  });
  it("rejects another channel's connection even when its legacy lms field matches", async () => {
    current = connection(canary, { channel: simulation.id, lms: canary.id });
    app(`/integrations/${canary.id}/${current.id}`);
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.queryByText("Verify connection")).toBeNull();
  });
  it.each(["moodle", "canvas", "blackboard", canary.id])("keeps %s available when profile discovery fails, then honors explicit not-ready data", async (id) => {
    const manifest = registry.channel(id)!;
    const normalFetch = fetchMock.getMockImplementation()!;
    let failed = true;
    fetchMock.mockImplementation((url: string) => url === "/app-api/lms-providers"
      ? Promise.resolve(failed ? new Response(JSON.stringify({ details: { description: "Profile service unavailable" } }), { status: 503 })
        : json({ lms: [ { ...provider(manifest), profiles: provider(manifest).profiles.map((entry) => ({ ...entry, ready: false })) } ] }))
      : normalFetch(url));
    const overview = app("/integrations");
    const card = await screen.findByRole("article", { name: manifest.card.title });
    expect(await within(card).findByRole("link", { name: "Connect" })).toBeTruthy();
    expect(await screen.findByText("Profile service unavailable")).toBeTruthy();
    expect(screen.queryByRole("article", { name: simulation.card.title })).toBeNull();
    overview.unmount();
    app(`/integrations/${id}/connect`);
    expect(await screen.findByLabelText("Connection name")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const notReady = (manifest.texts.notReady ?? "{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.").replaceAll("{LMS}", manifest.names.text);
    expect(await screen.findByText(notReady)).toBeTruthy();
    expect(screen.queryByLabelText("Connection name")).toBeNull();
  });
  it.each(["moodle", "canvas", "blackboard"])("renders the real %s wizard while profile discovery is still pending", async (id) => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url === "/app-api/lms-providers" ? new Promise<Response>(() => undefined) : normalFetch(url));
    app(`/integrations/${id}/connect`);
    expect(await screen.findByLabelText("Connection name")).toBeTruthy();
  });
  it("keeps an existing self connection usable when profile discovery fails", async () => {
    const manifest = registry.channel("moodle")!;
    current = connection(manifest, { status: "registered", bindingAuthority: "self" });
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url === "/app-api/lms-providers" ? Promise.reject(new Error("Profile service unavailable")) : normalFetch(url));
    app(`/integrations/${manifest.id}/${current.id}`);
    expect(await screen.findByText("The first launch from Moodle changes the status to Connected.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("uses profile readiness for the standard channel too", async () => {
    listed = listed.map((entry) => ({ ...entry, profiles: entry.profiles.map((profile) => ({ ...profile, ready: false })) }));
    app("/integrations");
    for (const manifest of registry.channels()) {
      const card = await screen.findByRole("article", { name: manifest.card.title });
      await waitFor(() => expect(within(card).getByRole("button", { name: "Connect" }).hasAttribute("disabled")).toBe(true));
      expect(within(card).queryByRole("link", { name: "Connect" })).toBeNull();
    }
  });
  it("hides an unlisted simulation channel's card and rejects its direct route", async () => {
    listed = listed.filter((entry) => entry.channel !== simulation.id);
    const view = app("/integrations");
    const card = await screen.findByRole("article", { name: canary.card.title });
    await within(card).findByRole("link", { name: "Connect" });
    expect(screen.queryByRole("article", { name: simulation.card.title })).toBeNull();
    view.unmount();
    app(`/integrations/${simulation.id}/connect`);
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  });
  it.each([self, canary])("selects the verification step from a test manifest's $registration.0.authority authority", (manifest) => {
    wizard(manifest, connection(manifest));
    if (manifest.registration[0]!.authority === "self") {
      expect(screen.getByText(`The first launch from ${manifest.names.text} verifies this connection.`)).toBeTruthy();
      expect(screen.queryByLabelText("Approval code")).toBeNull();
    } else {
      expect(screen.getByLabelText("Approval code")).toBeTruthy();
      expect(screen.queryByText(/The first launch/)).toBeNull();
    }
  });
  it("uses the chosen method's authority before create", () => {
    const mixed = { ...canary, registration: [...self.registration, ...canary.registration] };
    wizard(mixed);
    expect(screen.getByText(/The first launch/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Connection method"), { target: { value: "manual" } });
    expect(screen.queryByText(/The first launch/)).toBeNull();
    expect(screen.getByText(/Ask your Cogniate operator/)).toBeTruthy();
  });
  it("uses stored authority after dynamic registration stages a self test connection", () => {
    wizard(self, connection(self, { bindingAuthority: "operatorGrant" }));
    expect(screen.getByLabelText("Approval code")).toBeTruthy();
    expect(screen.queryByText(/The first launch/)).toBeNull();
  });
  it.each(["moodle", "canvas", "blackboard"])("routes %s through its real module with the baseline verification screen", async (id) => {
    const manifest = channelRegistry.channel(id)!;
    const authority = manifest.registration[0]!.authority;
    current = connection(manifest, { bindingAuthority: authority, status: authority === "self" ? "registered" : "pending" });
    const { container } = app(`/integrations/${id}/${current.id}`);
    await screen.findByRole("heading", { name: `Manage ${manifest.names.text}` });
    if (authority === "self") expect(await screen.findByText(`The first launch from ${manifest.names.text} changes the status to Connected.`)).toBeTruthy();
    else expect(await screen.findByLabelText("Approval code")).toBeTruthy();
    expect(container.querySelector("[data-channel-step]")).toBeNull();
  });
  it.each(["moodle", "canvas", "blackboard"])("keeps the %s Open link next to Go to Courses", async (id) => {
    const manifest = channelRegistry.channel(id)!;
    current = connection(manifest, { status: "registered", bindingAuthority: manifest.registration[0]!.authority });
    app(`/integrations/${id}/${current.id}`);
    const courses = await screen.findByRole("link", { name: "Go to Courses" });
    const link = within(courses.parentElement!).getByRole("link", { name: `Open ${manifest.names.text}` });
    expect(link.getAttribute("href")).toBe(id === "moodle" ? `${current.siteUrl}/mod/lti/toolconfigure.php` : current.siteUrl);
    expect(screen.getAllByRole("link", { name: `Open ${manifest.names.text}` })).toHaveLength(1);
  });
  it.each(["moodle", "canvas", "blackboard"])("the real %s module obeys stored authority even when its method is unchanged", async (id) => {
    const manifest = channelRegistry.channel(id)!;
    const authority = manifest.registration[0]!.authority === "self" ? "operatorGrant" : "self";
    current = connection(manifest, { bindingAuthority: authority });
    app(`/integrations/${id}/${current.id}`);
    if (authority === "self") {
      expect(await screen.findByText(`The first launch from ${manifest.names.text} verifies this connection.`)).toBeTruthy();
      expect(screen.queryByLabelText("Approval code")).toBeNull();
    } else {
      expect(await screen.findByLabelText("Approval code")).toBeTruthy();
      expect(screen.queryByText(/The first launch/)).toBeNull();
    }
  });
  it("merges a renewed URL into the existing connection", async () => {
    const existing = connection(self);
    const onChanged = vi.fn();
    fetchMock.mockResolvedValue(json({ registrationUrl: "https://tool.test/register", expiresAt: "2026-10-22T23:00:00Z" }));
    wizard(self, existing, onChanged);
    fireEvent.click(screen.getByRole("button", { name: "Get registration URL" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ ...existing, registrationUrl: "https://tool.test/register", registrationUrlExpiresAt: "2026-10-22T23:00:00Z" }));
  });
  it("keeps the reserved admin-launch authority separate from an operator grant", () => {
    wizard(canary, connection(canary, { bindingAuthority: "verifiedAdminLaunch" }));
    expect(screen.getByText("Use the admin launch code to verify this connection.")).toBeTruthy();
    expect(screen.queryByLabelText("Approval code")).toBeNull();
  });
});
