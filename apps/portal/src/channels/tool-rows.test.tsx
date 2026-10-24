// B-LA-E2-05-02 (lane K by RQ-2): the real manifest wizard of lti-generic and brightspace shows the tool rows. Both
// channels have no app.ts; with lti.toolConfiguration 'channel' (A1 BD-A1-85) the wizard asks the app for the rows of
// the kernel adapter and shows them in order. With 'none' the wizard makes no request, so this test fails.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { Connection, LmsProvider, ToolRow } from "../types.ts";
import { channelRegistry } from "./registry.ts";
import { ManifestWizard } from "./ManifestWizard.tsx";
import { createPortalSdk } from "../sdk/index.ts";

const SITE = "https://lms.school.edu";
const ROWS: ToolRow[] = [
  { key: "tool_name", label: "Name", value: "Cogniate (Library)" },
  { key: "openid_connect_login_url", label: "OpenID Connect Login URL", value: "https://lti.cogniate.test/lti/login/cogniate" },
  { key: "keyset_url", label: "Keyset URL", value: "https://lti.cogniate.test/lti/keys/cogniate" },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each(["brightspace", "lti-generic"])("B-LA-E2-05-02: the %s manual wizard shows the tool rows", (id) => {
  const manifest = channelRegistry.channel(id)!;
  const provider: LmsProvider = {
    lms: id, channel: id, label: manifest.names.label, methods: manifest.registration.map((entry) => entry.method),
    capabilities: channelRegistry.legacyCapabilities(id),
    profiles: [{ id: manifest.registration[0]!.defaultProfile, label: manifest.names.label, ready: true, simulation: false, clientId: null }],
  };
  const connection = {
    id: "con_rows", name: "School", siteUrl: SITE, serviceUrl: SITE, lms: id, channel: id, channelName: manifest.names.text,
    profile: manifest.registration[0]!.defaultProfile, capabilities: provider.capabilities, method: "manual", status: "pending", bindingAuthority: "operatorGrant",
    registrationUrl: null, registrationUrlExpiresAt: null, platform: null, lastError: null, webServices: null, createdAt: "2026-10-23T00:00:00Z", lastLaunchAt: null,
  } as Connection;

  it("requests GET /app-api/connections/:id/tool-configuration and shows every row in order", async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).endsWith("/tool-configuration") ? ROWS : connection), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<MemoryRouter><ManifestWizard manifest={manifest} provider={provider} connection={connection} libraryName="Library" opener="test" onCreated={vi.fn()} onChanged={vi.fn()} sdk={createPortalSdk(vi.fn())} /></MemoryRouter>);
    await waitFor(() => expect(container.querySelectorAll("tr[data-key]")).toHaveLength(ROWS.length));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain("/app-api/connections/con_rows/tool-configuration");
    expect([...container.querySelectorAll("tr[data-key]")].map((row) => [row.getAttribute("data-key"), row.querySelector("th")!.textContent, row.querySelector("code")!.textContent]))
      .toEqual(ROWS.map((row) => [row.key, row.label, row.value]));
    expect(screen.getByText(`Tool configuration · Copy these values into ${manifest.names.text}, in this order.`)).toBeTruthy();
  });
});
