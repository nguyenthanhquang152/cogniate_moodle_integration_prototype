import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { Connection, ConnectionHealth as Health } from "../types.ts";
import { ConnectionHealth, healthWarnings, isHealth } from "./ConnectionHealth.tsx";

const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const NOW = Date.UTC(2026, 9, 23, 6, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
function health(over: { keys?: Partial<Health["keys"]>; dispatch?: Partial<Health["dispatch"]> } & Partial<Omit<Health, "keys" | "dispatch">> = {}): Health {
  const { keys, dispatch, ...rest } = over;
  return {
    status: "connected", lastLaunchAt: null, lastLaunchRefusal: null,
    dispatch: { pending: 0, oldestPendingAt: null, lastSentAt: null, failedLast24h: 0, lastError: null, ...dispatch },
    keys: { activeKid: "kid-1", nextKid: null, artifactKeyKid: null, artifactKeyCurrent: null, ...keys },
    lastCheck: null, events: [], ...rest,
  };
}
const connection = (channel = "canvas", status: Connection["status"] = "connected"): Connection => ({
  id: `con_${channel}`, channel, lms: channel, name: "School", siteUrl: "https://school.test", serviceUrl: "https://school.test", profile: "p",
  capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false },
  method: "manual", status, registrationUrl: null, registrationUrlExpiresAt: null, createdAt: "2026-10-23T00:00:00Z", lastLaunchAt: null,
  webServices: null, platform: null, lastError: null,
});

describe("connection health warnings (LA-ADR-08 D5; AC-LA-E6-02-08)", () => {
  it("warns for a stale key JSON only for an active connection (BD-A2-101: its Key JSON is on the page)", async () => {
    const stale = health({ keys: { artifactKeyKid: "kid-0", artifactKeyCurrent: false } });
    expect(healthWarnings(stale, NOW, false)).toEqual([]);
    for (const status of ["pending", "disabled"] as const) {
      fetchMock.mockResolvedValue(json(stale));
      const view = render(<ConnectionHealth connection={connection("canvas", status)} />);
      await screen.findByText("Last refused launch");
      expect(screen.queryByText("Paste a new Canvas key JSON.")).toBeNull();
      view.unmount();
    }
    for (const status of ["registered", "connected"] as const) {
      fetchMock.mockResolvedValue(json(stale));
      const view = render(<ConnectionHealth connection={connection("canvas", status)} />);
      expect(await screen.findByText("Paste a new Canvas key JSON.")).toBeTruthy();
      expect(screen.getByText(/Open Key JSON on this page/)).toBeTruthy();
      view.unmount();
    }
  });
  it("warns for a stale key JSON only when artifactKeyCurrent is false", () => {
    expect(healthWarnings(health({ keys: { artifactKeyKid: "kid-0", artifactKeyCurrent: false } }), NOW)).toEqual(["staleKey"]);
    expect(healthWarnings(health({ keys: { artifactKeyKid: "kid-1", artifactKeyCurrent: true } }), NOW)).toEqual([]);
    expect(healthWarnings(health({ keys: { artifactKeyKid: null, artifactKeyCurrent: null } }), NOW)).toEqual([]);
  });
  it("warns for a backlog only when the oldest pending dispatch is older than 1 hour", () => {
    expect(healthWarnings(health({ dispatch: { pending: 3, oldestPendingAt: iso(NOW - 3_600_001) } }), NOW)).toEqual(["backlog"]);
    expect(healthWarnings(health({ dispatch: { pending: 3, oldestPendingAt: iso(NOW - 3_600_000) } }), NOW)).toEqual([]);
    expect(healthWarnings(health({ dispatch: { pending: 0, oldestPendingAt: null } }), NOW)).toEqual([]);
  });

  it("shows both warnings with {LMS} filled, and no warning when none applies", async () => {
    fetchMock.mockResolvedValue(json(health({ keys: { artifactKeyKid: "kid-0", artifactKeyCurrent: false }, dispatch: { pending: 1, oldestPendingAt: iso(Date.now() - 2 * 3_600_000) } })));
    const view = render(<ConnectionHealth connection={connection()} />);
    expect(await screen.findByText("Paste a new Canvas key JSON.")).toBeTruthy();
    expect(screen.getByText("Canvas still has an old Cogniate key in its developer key. Open Key JSON on this page. Choose the key URL (it never needs a new paste), or download the JSON again. Then paste it into the Cogniate developer key in Canvas.")).toBeTruthy();
    expect(screen.getByText("Some grades wait more than 1 hour to go to Canvas.")).toBeTruthy();
    expect(fetchMock.mock.calls[0]![0]).toBe("/app-api/connections/con_canvas/health");
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();
    fetchMock.mockResolvedValue(json(health()));
    render(<ConnectionHealth connection={connection("lti-generic")} />);
    await screen.findByText("Last refused launch");
    expect(document.querySelectorAll("[data-health-warning]")).toHaveLength(0);
  });

  it("shows the health values in a closed section", async () => {
    fetchMock.mockResolvedValue(json(health({
      lastLaunchRefusal: { reason: "site_mismatch", at: iso(NOW) },
      dispatch: { pending: 2, oldestPendingAt: iso(NOW - 60_000), lastSentAt: iso(NOW - 120_000), failedLast24h: 1, lastError: { code: "PLATFORM_REJECTED_REQUEST", at: iso(NOW) } },
      keys: { artifactKeyKid: "kid-1", artifactKeyCurrent: true },
      lastCheck: { at: iso(NOW), jwks: true, token: false },
      events: [{ kind: "launch_refused", code: "site_mismatch", at: iso(NOW) }, { kind: "check", code: "token:invalid_client", at: iso(NOW - 1000) }],
    })));
    render(<ConnectionHealth connection={connection()} />);
    const section = await screen.findByText("Connection health");
    const details = section.closest("details")!;
    expect(details.open).toBe(false);
    await within(details).findByText("Last refused launch");
    expect(details.textContent).toContain(`site_mismatch · ${new Date(NOW).toLocaleString()}`);
    expect(details.textContent).toContain("2 waiting");
    expect(details.textContent).toContain("Failed in the last 24 hours: 1");
    expect(details.textContent).toContain("PLATFORM_REJECTED_REQUEST");
    expect(details.textContent).toContain("Active key id: kid-1 · Key id in the last key JSON: kid-1");
    expect(details.textContent).toContain("Key set: ok · Access token: failed");
    expect(within(details).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      `${new Date(NOW).toLocaleString()} · launch_refused · site_mismatch`, `${new Date(NOW - 1000).toLocaleString()} · check · token:invalid_client`,
    ]);
  });

  it.each([
    ["a refusal", json({ details: { message: "LTI_SERVICE_ERROR", description: "x" } }, 502)],
    ["an answer of another shape", json({ id: "con_canvas", status: "connected" })],
  ])("says when the health cannot be read (%s), without an alert", async (_name, reply) => {
    fetchMock.mockResolvedValue(reply);
    render(<ConnectionHealth connection={connection()} />);
    expect(await screen.findByText(/The connection health is not available/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load the connection health again" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelectorAll("[data-health-warning]")).toHaveLength(0);
  });

  // A-LA-E6-02-01, B-LA-E6-02-02: a malformed value inside the answer never reaches the render.
  const valid = health({ lastLaunchRefusal: { reason: "site_mismatch", at: iso(NOW) }, lastCheck: { at: iso(NOW), jwks: true, token: true },
    dispatch: { lastError: { code: "PLATFORM_ERROR", at: iso(NOW) } }, events: [{ kind: "check", code: "ok", at: iso(NOW) }] });
  it.each<[string, unknown]>([
    ["a null event", { ...valid, events: [null] }],
    ["an event without kind", { ...valid, events: [{ code: "ok", at: iso(NOW) }] }],
    ["an object as event code", { ...valid, events: [{ kind: "check", code: {}, at: iso(NOW) }] }],
    ["an event without time", { ...valid, events: [{ kind: "check", code: "ok" }] }],
    ["an object as grade error code", { ...valid, dispatch: { ...valid.dispatch, lastError: { code: {}, at: iso(NOW) } } }],
    ["a text as pending count", { ...valid, dispatch: { ...valid.dispatch, pending: "2" } }],
    ["an object as active key id", { ...valid, keys: { ...valid.keys, activeKid: {} } }],
    ["a text as key state", { ...valid, keys: { ...valid.keys, artifactKeyCurrent: "no" } }],
    ["a refusal without time", { ...valid, lastLaunchRefusal: { reason: "site_mismatch" } }],
    ["a text as check result", { ...valid, lastCheck: { at: iso(NOW), jwks: "yes", token: true } }],
    ["an array as dispatch", { ...valid, dispatch: [] }],
  ])("shows the not-available state for %s", async (_name, answer) => {
    expect(isHealth(answer)).toBe(false);
    fetchMock.mockResolvedValue(json(answer));
    render(<ConnectionHealth connection={connection()} />);
    expect(await screen.findByText(/The connection health is not available/)).toBeTruthy();
    expect(document.querySelectorAll("[data-health-warning]")).toHaveLength(0);
  });
  it("accepts a complete answer", () => {
    expect(isHealth(valid)).toBe(true);
  });

  // B-LA-E6-02-01: the backlog help names only what the page has and shows.
  const backlog = (lastError: Health["dispatch"]["lastError"] = { code: "PLATFORM_ERROR", at: iso(NOW) }) =>
    health({ dispatch: { pending: 2, oldestPendingAt: iso(Date.now() - 2 * 3_600_000), lastError } });
  const helpLines = async () => [...(await screen.findByText(/Some grades wait more than 1 hour/)).parentElement!.querySelectorAll("p")].slice(1).map((p) => p.textContent);
  it("names Check connection when that panel is on the page, and the values to give the operator", async () => {
    fetchMock.mockResolvedValue(json(backlog()));
    render(<ConnectionHealth connection={connection("canvas", "connected")} />);
    expect(await helpLines()).toEqual([
      "Select Check connection to test the connection to Canvas.",
      `If the grades still wait, give your Cogniate operator the connection name "School" and the last grade error PLATFORM_ERROR at ${new Date(NOW).toLocaleString()}.`,
    ]);
  });
  it.each([["moodle", "connected"], ["blackboard", "registered"], ["canvas", "disabled"], ["canvas", "pending"]] as const)(
    "does not name Check connection for %s (%s), where that panel is not on the page", async (channel, status) => {
      fetchMock.mockResolvedValue(json(backlog(null)));
      render(<ConnectionHealth connection={connection(channel, status)} />);
      expect(await helpLines()).toEqual(['Give your Cogniate operator the connection name "School".']);
      expect(screen.queryByText(/Check connection/)).toBeNull();
      expect(screen.queryByText(/trace id/)).toBeNull();
    });
});
