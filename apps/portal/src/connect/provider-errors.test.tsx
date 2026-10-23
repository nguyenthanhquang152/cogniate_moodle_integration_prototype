import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ChannelManifest, ErrorTextKey } from "@cogniate/channel-kernel";
import { ApiError } from "../api.ts";
import { ChannelScope } from "../channels/context.tsx";
import { channelRegistry } from "../channels/registry.ts";
import { ChannelErrorNotice, ProviderErrorNotice, channelErrorText, providerErrorMessage } from "./provider-errors.tsx";

afterEach(cleanup);
const errors: Record<ErrorTextKey, ApiError> = {
  SITE_RULE_1: new ApiError(422, { message: "INVALID_SITE_URL", rule: 1, field: "siteUrl" }),
  SITE_RULE_5: new ApiError(422, { message: "INVALID_SITE_URL", rule: 5, field: "siteUrl" }),
  PLATFORM_IN_USE: new ApiError(409, { message: "PLATFORM_IN_USE" }),
  DEPLOYMENT_IN_USE: new ApiError(409, { message: "DEPLOYMENT_IN_USE" }),
  DEPLOYMENT_FIXED: new ApiError(409, { message: "DEPLOYMENT_FIXED" }),
};
// The M1 portal texts, byte for byte.
const m1: Record<ErrorTextKey, string> = {
  SITE_RULE_1: "Enter only the address, for example https://school.instructure.com. No path.",
  SITE_RULE_5: "This is an Instructure-hosted address. Choose an Instructure-hosted Canvas type.",
  PLATFORM_IN_USE: "This Canvas developer key is already connected to Cogniate. Make a new developer key for this library.",
  DEPLOYMENT_IN_USE: "This Blackboard site is already connected to Cogniate.",
  DEPLOYMENT_FIXED: "This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.",
};
const generic: Record<ErrorTextKey, string> = {
  SITE_RULE_1: "Enter only the address, for example https://lms.example.edu. No path.",
  SITE_RULE_5: "This is the address of a hosted LMS. Choose a hosted type.",
  PLATFORM_IN_USE: "This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library.",
  DEPLOYMENT_IN_USE: "This LMS site is already connected to Cogniate.",
  DEPLOYMENT_FIXED: "This connection already reserved another deployment. Disconnect it, then make a new connection.",
};
// BD-A1-81: the Moodle manifest has its own PLATFORM_IN_USE text (today's server sentence).
const moodleInUse = "This Moodle tool is already registered with Cogniate. In Moodle, make a new tool for this library and use its values.";
const keys = Object.keys(errors) as ErrorTextKey[];
const channel = (id: string): ChannelManifest => channelRegistry.channel(id)!;
// A data-only channel with no texts.errors, and one with its own text.
const plain: ChannelManifest = { ...channel("moodle"), id: "test-site", names: { text: "Test learning site", label: "Test learning site" }, texts: { ...channel("moodle").texts, errors: undefined } };
const named: ChannelManifest = { ...plain, texts: { ...plain.texts, errors: { PLATFORM_IN_USE: "This {LMS} key is in use. Make a new {LMS} key." } } };

describe("provider error texts from the channel manifest (BD-A1-63, LA-IC-20)", () => {
  it.each([
    ["moodle", ["SITE_RULE_1", "PLATFORM_IN_USE"]],
    ["canvas", ["SITE_RULE_1", "SITE_RULE_5", "PLATFORM_IN_USE"]],
    ["blackboard", ["SITE_RULE_1", "DEPLOYMENT_IN_USE", "DEPLOYMENT_FIXED"]],
  ])("gives %s its own texts byte for byte and the generic text for the other keys", (id, own) => {
    const ownText = (key: ErrorTextKey) => (id === "moodle" && key === "PLATFORM_IN_USE" ? moodleInUse : m1[key]);
    for (const key of keys) expect(providerErrorMessage(errors[key], channel(id)), key).toBe(own.includes(key) ? ownText(key) : generic[key]);
  });
  it("gives the generic texts with no channel and with a channel that has no texts.errors", () => {
    for (const key of keys) {
      expect(providerErrorMessage(errors[key]), key).toBe(generic[key]);
      expect(providerErrorMessage(errors[key], null), key).toBe(generic[key]);
      expect(providerErrorMessage(errors[key], plain), key).toBe(generic[key]);
    }
    for (const text of Object.values(generic)) expect(text).not.toMatch(/moodle|canvas|instructure|blackboard|brightspace|d2l|schoology|sakai|totara/i);
  });
  it("fills {LMS} with the channel's text name", () => {
    expect(providerErrorMessage(errors.PLATFORM_IN_USE, named)).toBe("This Test learning site key is in use. Make a new Test learning site key.");
    expect(providerErrorMessage(errors.DEPLOYMENT_IN_USE, named)).toBe(generic.DEPLOYMENT_IN_USE);
  });
  it("keeps the texts that name no LMS for every channel", () => {
    for (const manifest of [undefined, channel("moodle"), channel("canvas"), channel("blackboard"), named]) {
      expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule: 2 }), manifest)).toBe("Enter a host name, not an IP address or localhost.");
      expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule: 3 }), manifest)).toBe("This is a Cogniate address. Enter your LMS address.");
      expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL", rule: 4 }), manifest)).toBe("This is the LMS sign-in service, not your school site. Enter the address that teachers use.");
      expect(providerErrorMessage(new ApiError(422, { message: "INVALID_SITE_URL" }), manifest)).toBeUndefined();
      expect(providerErrorMessage(new ApiError(422, { message: "GRANT_INVALID" }), manifest)).toBe("This approval code is not valid, was used, or expired. Ask your Cogniate operator for a new code.");
      expect(providerErrorMessage(new ApiError(502, { message: "LTI_SERVICE_ERROR" }, "trace-1"), manifest)).toBe("Cogniate could not save the connection. Try again. Trace id: trace-1");
      expect(providerErrorMessage(new ApiError(409, { message: "SOMETHING_ELSE" }), manifest)).toBeUndefined();
      expect(providerErrorMessage(new Error("network"), manifest)).toBeUndefined();
    }
  });
  it("shows the text of the channel in scope, else the generic text", () => {
    const notice = (manifest: ChannelManifest | null | undefined, error: ApiError) => {
      const element = <ProviderErrorNotice error={error} />;
      const view = render(manifest === undefined ? element : <ChannelScope manifest={manifest}>{element}</ChannelScope>);
      const text = within(screen.getByRole("alert")).getAllByText(/./).map((node) => node.textContent);
      view.unmount();
      return text;
    };
    expect(notice(channel("blackboard"), errors.DEPLOYMENT_IN_USE)).toContain(m1.DEPLOYMENT_IN_USE);
    expect(notice(channel("canvas"), errors.PLATFORM_IN_USE)).toContain(m1.PLATFORM_IN_USE);
    expect(notice(channel("moodle"), errors.PLATFORM_IN_USE)).toContain(moodleInUse);
    expect(notice(null, errors.SITE_RULE_5)).toContain(generic.SITE_RULE_5);
    expect(notice(undefined, errors.DEPLOYMENT_FIXED)).toContain(generic.DEPLOYMENT_FIXED);
    expect(notice(channel("blackboard"), errors.DEPLOYMENT_FIXED)).toEqual([m1.DEPLOYMENT_FIXED, "Code: DEPLOYMENT_FIXED"]);
  });
});

describe("channel texts only, for forms that show the server texts (A-LA-E1-12-01)", () => {
  const server = (status: number, message: string) => new ApiError(status, { message, description: `Server text of ${message}.`, action: "Server action." }, "trace-2");
  it("gives the channel or generic text for the texts.errors codes and nothing for the other errors", () => {
    for (const key of keys) {
      expect(channelErrorText(errors[key], channel("canvas")), key).toBe(providerErrorMessage(errors[key], channel("canvas")));
      expect(channelErrorText(errors[key]), key).toBe(generic[key]);
    }
    expect(channelErrorText(errors.PLATFORM_IN_USE, named)).toBe("This Test learning site key is in use. Make a new Test learning site key.");
    for (const code of ["INVALID_PLATFORM_VALUES", "GRANT_INVALID", "CONNECTION_NOT_PENDING", "PROVIDER_NOT_READY", "LTI_SERVICE_ERROR", "INVALID_SITE_URL"])
      expect(channelErrorText(server(422, code), channel("moodle")), code).toBeUndefined();
    expect(channelErrorText(new ApiError(422, { message: "INVALID_SITE_URL", rule: 4 }), channel("canvas"))).toBeUndefined();
    expect(channelErrorText(new Error("network"))).toBeUndefined();
  });
  it("keeps the server text and action of the other errors, and replaces only the text of a texts.errors code", () => {
    const shown = (manifest: ChannelManifest | null, error: unknown) => {
      const view = render(<ChannelScope manifest={manifest}><ChannelErrorNotice error={error} /></ChannelScope>);
      const text = within(screen.getByRole("alert")).getAllByText(/./).map((node) => node.textContent);
      view.unmount();
      return text;
    };
    for (const code of ["INVALID_PLATFORM_VALUES", "PROVIDER_NOT_READY", "LTI_SERVICE_ERROR"])
      expect(shown(channel("moodle"), server(409, code))).toEqual([`Server text of ${code}.`, "Server action.", `Code: ${code}`, "Trace id: trace-2"]);
    expect(shown(channel("moodle"), server(409, "PLATFORM_IN_USE"))).toEqual([moodleInUse, "Server action.", "Code: PLATFORM_IN_USE", "Trace id: trace-2"]);
    expect(shown(channel("blackboard"), server(409, "DEPLOYMENT_IN_USE"))).toEqual([m1.DEPLOYMENT_IN_USE, "Server action.", "Code: DEPLOYMENT_IN_USE", "Trace id: trace-2"]);
    expect(shown(null, new Error("Network down"))).toEqual(["Network down"]);
  });
});
