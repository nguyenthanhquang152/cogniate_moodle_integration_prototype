import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConnectionError } from "../ui.tsx";
import type { ChannelUiModule, Connection } from "../sdk/index.ts";
import { ChannelProvider } from "./context.tsx";
import { channelRegistry } from "./registry.ts";

afterEach(cleanup);
const connection: Connection = {
  id: "con_error", channel: "slot-test", lms: "slot-test", name: "Test", siteUrl: "https://test.example", serviceUrl: "https://test.example",
  profile: "test", method: "manual", status: "pending", capabilities: channelRegistry.legacyCapabilities("slot-test"),
  registrationUrl: null, registrationUrlExpiresAt: null, createdAt: "2026-10-22T00:00:00Z", lastLaunchAt: null, webServices: null, platform: null,
  lastError: { code: "TEST_CODE", ltiCode: null, traceId: "trace-test", title: "Server title", action: "Server action", at: "2026-10-22T00:00:00Z" },
};
it("uses the shell error component when there is no module slot", () => {
  render(<ChannelProvider registry={channelRegistry}><ConnectionError connection={connection} /></ChannelProvider>);
  expect(screen.getByRole("alert").textContent).toContain("Server titleServer action");
});
it("renders an error slot as a component and passes the default component", () => {
  const module: ChannelUiModule = {
    ConnectionError({ Default, ...props }) {
      const [details, setDetails] = useState(false);
      return <><button onClick={() => setDetails(!details)}>Details</button>{details && <Default {...props} error={{ ...props.error, title: "Module title" }} />}</>;
    },
  };
  render(<ChannelProvider registry={channelRegistry} modules={new Map([["slot-test", module]])}><ConnectionError connection={connection} /></ChannelProvider>);
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.getByRole("alert").textContent).toContain("Module titleServer action");
  expect(screen.getByRole("alert").textContent).toContain("trace-test");
});
