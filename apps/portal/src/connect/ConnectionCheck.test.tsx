import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Connection, ConnectionCheckAnswer } from "../types.ts";
import { ConnectionCheck } from "./ConnectionCheck.tsx";

const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function connection(channel: string, status: Connection["status"] = "registered"): Connection {
  return {
    id: `con_${channel}`, channel, lms: channel, name: "School", siteUrl: "https://school.test", serviceUrl: "https://school.test", profile: "p",
    capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false },
    method: "manual", status, registrationUrl: null, registrationUrlExpiresAt: null, createdAt: "2026-10-23T00:00:00Z", lastLaunchAt: null,
    webServices: null, platform: null, lastError: null,
  };
}
const answer = (details: Partial<ConnectionCheckAnswer["details"]> = {}): ConnectionCheckAnswer => {
  const full = { jwks: { ok: true, keys: 2 }, token: { ok: true, scope: "score" }, platform: { active: true, deploymentActive: true }, limits: null, ...details };
  return { result: full.jwks.ok && full.token.ok ? "ok" : "failed", checkedAt: "2026-10-23T06:00:00.000Z", details: full };
};
async function runCheck(channel: string, reply: Response) {
  fetchMock.mockResolvedValue(reply);
  render(<ConnectionCheck connection={connection(channel)} />);
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  return within(await screen.findByRole(reply.ok ? "status" : "alert"));
}

describe("Check connection panel (LA-ADR-08 D4; AC-LA-E6-01-09)", () => {
  it.each([
    ["canvas", "registered", true], ["lti-generic", "connected", true],
    ["canvas", "pending", false], ["canvas", "disabled", false], ["moodle", "registered", false], ["blackboard", "connected", false],
  ] as const)("shows the button for %s with status %s: %s", (channel, status, shown) => {
    render(<ConnectionCheck connection={connection(channel, status)} />);
    expect(screen.queryByRole("button", { name: "Check connection" }) !== null).toBe(shown);
  });

  it("sends the check and shows the ok text with the check time", async () => {
    const notice = await runCheck("canvas", json(answer()));
    expect(fetchMock.mock.calls[0]![0]).toBe("/app-api/connections/con_canvas/check");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST" });
    expect(notice.getByText("Cogniate can reach Canvas.")).toBeTruthy();
    expect(notice.getByText(`Checked ${new Date("2026-10-23T06:00:00.000Z").toLocaleString()}`)).toBeTruthy();
    expect(notice.queryByText(/Key set:/)).toBeNull();
  });

  it.each([
    [{ token: { ok: false, scope: "score", detail: "invalid_client" } }, ["Canvas refused our client id. Check the Client ID in Canvas."], "Key set: ok · Access token: invalid_client"],
    [{ jwks: { ok: false, detail: "http_404" } }, ["Cogniate cannot reach the Canvas key set."], "Key set: http_404 · Access token: ok"],
    [{ token: { ok: false, detail: "no_granted_scope" } }, ["Canvas gave Cogniate no grade scope. Allow the grade (AGS) scopes for the Cogniate tool in Canvas."], "Key set: ok · Access token: no_granted_scope"],
    [{ token: { ok: false, scope: "score", detail: "http_500" } }, ["Canvas did not give Cogniate an access token."], "Key set: ok · Access token: http_500"],
    [{ jwks: { ok: false, detail: "timeout" }, token: { ok: false, scope: "score", detail: "invalid_scope" } },
      ["Cogniate cannot reach the Canvas key set.", "Canvas did not give Cogniate an access token."], "Key set: timeout · Access token: invalid_scope"],
  ] as const)("shows the text of each failed part %j", async (details, texts, summary) => {
    const notice = await runCheck("canvas", json(answer(details)));
    expect(notice.getAllByText(/./).filter((node) => node.tagName === "P").map((node) => node.textContent)).toEqual(texts);
    expect(notice.getByText(summary)).toBeTruthy();
  });

  it("fills {LMS} with the channel's text name", async () => {
    const notice = await runCheck("lti-generic", json(answer()));
    // A1 BD-A1-111: the lti-generic text name is "LMS" (the portal template is "Cogniate can reach {LMS}.").
    expect(notice.getByText("Cogniate can reach LMS.")).toBeTruthy();
  });

  it("shows the server refusal, for example the one-per-minute limit", async () => {
    const alert = await runCheck("canvas", json({ details: { message: "RATE_LIMITED", description: "One check per connection per minute. Retry after 42 s.", retryAfter: 42 } }, 429));
    expect(alert.getByText("One check per connection per minute. Retry after 42 s.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
