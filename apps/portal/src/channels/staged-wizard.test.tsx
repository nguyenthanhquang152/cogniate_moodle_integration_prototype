// LA-E2-04 RQ-2 (lane K, B-LA-E2-04-01): the real manifest wizard of lti-generic after a staged Dynamic Registration.
// The staged connection keeps method "dynamic" with authority "operatorGrant"; the wizard pre-fills both ids from the
// staged platform and sends exactly the short staged body (app API delta §3.4). The long admin-value fields stay manual.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { Connection, LmsProvider } from "../types.ts";
import { channelRegistry } from "./registry.ts";
import { ManifestWizard } from "./ManifestWizard.tsx";
import { createPortalSdk } from "../sdk/index.ts";

const manifest = channelRegistry.channel("lti-generic")!;
const provider: LmsProvider = {
  lms: "lti-generic", channel: "lti-generic", label: manifest.names.label, methods: manifest.registration.map((entry) => entry.method),
  capabilities: channelRegistry.legacyCapabilities("lti-generic"),
  profiles: [{ id: "lti-generic", label: manifest.names.label, ready: true, simulation: false, clientId: null }],
};
const SITE = "https://lms.school.edu";
function pending(method: "dynamic" | "manual", platform: Connection["platform"]): Connection {
  return {
    id: "con_generic", name: "School", siteUrl: SITE, serviceUrl: SITE, lms: "lti-generic", channel: "lti-generic", channelName: manifest.names.text,
    profile: "lti-generic", capabilities: provider.capabilities, method, status: "pending", bindingAuthority: "operatorGrant",
    registrationUrl: null, registrationUrlExpiresAt: null, platform, lastError: null, webServices: null, createdAt: "2026-10-23T00:00:00Z", lastLaunchAt: null,
  } as Connection;
}
// The DTO of a pending staged registration: the staged platform with its deployments (app API delta §3.4).
const staged = pending("dynamic", { id: "plt_staged", issuer: `${SITE}/sakai`, clientId: "client-1", deploymentIds: ["dep-1"], siteUrl: SITE, serviceUrl: SITE } as Connection["platform"]);

const fetchMock = vi.fn();
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function wizard(connection: Connection, onChanged = vi.fn()) {
  fetchMock.mockReset().mockImplementation(async (url: string) => new Response(JSON.stringify(String(url).endsWith("/tool-configuration") ? [] : connection), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return render(<MemoryRouter><ManifestWizard manifest={manifest} provider={provider} connection={connection} libraryName="Library" opener="test" onCreated={vi.fn()} onChanged={onChanged} sdk={createPortalSdk(vi.fn())} /></MemoryRouter>);
}
const inputs = (container: HTMLElement) => [...container.querySelectorAll("input")].map((input) => [input.name, input.value]);

describe("B-LA-E2-04-01: the staged lti-generic wizard", () => {
  it("pre-fills both ids from the staged platform and sends exactly { clientId, deploymentId, grantCode }", async () => {
    const onChanged = vi.fn();
    const { container } = wizard(staged, onChanged);
    expect(inputs(container)).toEqual([["clientId", "client-1"], ["deploymentId", "dep-1"], ["grantCode", ""]]);
    fireEvent.change(screen.getByLabelText("Approval code"), { target: { value: "A".repeat(43) } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(staged));
    const [url, options] = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")! as [string, RequestInit];
    expect(url).toBe("/app-api/connections/con_generic/platform");
    expect(JSON.parse(String(options.body))).toEqual({ clientId: "client-1", deploymentId: "dep-1", grantCode: "A".repeat(43) });
  });

  it("keeps the admin-value fields for the manual method only", () => {
    const { container } = wizard(pending("manual", null));
    expect(inputs(container).map(([name]) => name)).toEqual(["issuer", "clientId", "deploymentId", "authenticationEndpoint", "accessTokenEndpoint", "jwksUrl", "tokenAudience", "grantCode"]);
    expect(inputs(container)[0]).toEqual(["issuer", SITE]);
  });
});
