// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { CreateConnection } from "./connect/CreateConnection.tsx";
import { ManualSetup } from "./connect/ManualSetup.tsx";
import { MoodleSteps } from "./connect/MoodleSteps.tsx";
import { ConnectionReady } from "./connect/ConnectionStatus.tsx";
import { readFileSync } from "node:fs";
import steps from "./connect/moodle-steps.json";
import { ApiError } from "./api.ts";
import {
  CopyButton,
  ErrorNotice,
  ConnectionError,
  connectionStatus,
} from "./ui.tsx";
import { App } from "./App.tsx";
import { Integrations } from "./Integrations.tsx";
import { NewCourse } from "./courses/Courses.tsx";
import { PublishDialog } from "./courses/PublishDialog.tsx";
import { ResultTableRow, Results } from "./results/Results.tsx";
import { validatePlatform } from "./connect/validation.ts";
import type { Connection, Course, ResultRow, ToolRow } from "./types.ts";

const connection: Connection = {
  id: "con_test",
  name: "Test Moodle",
  siteUrl: "https://moodle.test",
  serviceUrl: "https://moodle.test",
  lms: "moodle",
  profile: "standard",
  capabilities: {
    dynamicRegistration: true, operatorApproval: false, webServices: true,
    courseShell: true, addDeployment: false, canvasConfiguration: false,
  },
  method: "manual",
  status: "pending",
  registrationUrl: null,
  registrationUrlExpiresAt: null,
  platform: null,
  lastError: null,
  createdAt: "2026-10-18T01:00:00Z",
  lastLaunchAt: null,
  webServices: null,
};
const values = {
  issuer: connection.siteUrl,
  clientId: "client",
  deploymentId: "7",
  authenticationEndpoint: `${connection.siteUrl}/mod/lti/auth.php`,
  accessTokenEndpoint: `${connection.siteUrl}/mod/lti/token.php`,
  jwksUrl: `${connection.siteUrl}/mod/lti/certs.php`,
};
const keys = [
  "tool_name",
  "tool_url",
  "lti_version",
  "public_key_type",
  "public_keyset_url",
  "initiate_login_url",
  "redirection_uris",
  "deep_linking",
  "content_selection_url",
  "tool_configuration_usage",
  "launch_container",
  "ags",
  "nrps",
  "share_name",
  "share_email",
  "accept_grades",
];
const toolRows: ToolRow[] = keys.map((key) => ({
  key,
  label: key,
  value: `value:${key}`,
}));
const fetchMock = vi.fn();
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
function inRouter(component: ReturnType<typeof h>) {
  return render(h(MemoryRouter, null, component));
}
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Moodle connection wizard", () => {
  it("matches the exact task contract, including its only optional step", () => {
    const spec = readFileSync("docs/architecture/tasks/T6.md", "utf8");
    const block = spec.match(/```json\s*\n([\s\S]*?)\n\s*```/)!;
    expect(steps).toEqual(JSON.parse(block[1]!));
    expect(
      [...steps.dynamic, ...steps.manual]
        .filter((step) => step.optional)
        .map((step) => step.id),
    ).toEqual(["choose-register-new"]);
    expect(steps.dynamic.at(-1)?.id).toBe("edit-tool-settings");
  });
  it("keeps the Moodle settings step visible after registration completes", () => {
    const { container } = inRouter(
      h(ConnectionReady, {
        connection: { ...connection, method: "dynamic", status: "registered" },
        libraryName: "Example <Library>",
      }),
    );
    expect(
      container.querySelector('[data-step-id="edit-tool-settings"]')
        ?.textContent,
    ).toContain('Set Default launch container to "New window"');
    expect(
      container.querySelector('[data-step-id="activate-tool"]')?.textContent,
    ).toContain("Cogniate (Example <Library>)");
  });
  it.each(["dynamic", "manual"] as const)(
    "renders the %s steps with stable IDs and exact text, in data order",
    (method) => {
      const { container } = render(
        h(MoodleSteps, { method, libraryName: "Example <Library>" }),
      );
      const elements = [...container.querySelectorAll("[data-step-id]")];
      expect(steps.format).toBe("cogniate-moodle-steps/1");
      expect(
        elements.map((element) => element.getAttribute("data-step-id")),
      ).toEqual(steps[method].map((step) => step.id));
      elements.forEach((element, index) =>
        expect(element.textContent).toContain(
          steps[method][index]!.text.replaceAll(
            "{libraryName}",
            "Example <Library>",
          ),
        ),
      );
      expect(
        steps.dynamic.some(
          (step) =>
            step.optional &&
            step.text.includes("Register as a new external tool"),
        ),
      ).toBe(true);
    },
  );
  it("rejects HTTP and foreign endpoint origins without sending a request", async () => {
    fetchMock.mockResolvedValue(json(toolRows));
    render(
      h(ManualSetup, {
        connection,
        libraryName: "Example",
        onRegistered: vi.fn(),
      }),
    );
    await screen.findByText("tool_name");
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Platform ID (issuer)"));
    await user.type(
      screen.getByLabelText("Platform ID (issuer)"),
      "http://moodle.test",
    );
    await user.type(
      screen.getByLabelText("Public keyset URL"),
      "https://foreign.test/keys",
    );
    await user.click(screen.getByRole("button", { name: "Connect Moodle" }));
    expect(
      screen.getByText("Use the HTTPS origin of this Moodle site."),
    ).toBeTruthy();
    expect(
      screen
        .getByLabelText("Platform ID (issuer)")
        .getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("shows all tool rows and sends the six valid contract keys", async () => {
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        json(
          path.endsWith("tool-configuration")
            ? toolRows
            : { ...connection, status: "registered" },
        ),
      ),
    );
    const registered = vi.fn();
    const { container } = render(
      h(ManualSetup, {
        connection,
        libraryName: "Example",
        onRegistered: registered,
      }),
    );
    await screen.findByText("tool_name");
    expect(
      [...container.querySelectorAll("[data-key]")].map((el) =>
        el.getAttribute("data-key"),
      ),
    ).toEqual(keys);
    const user = userEvent.setup();
    for (const [key, value] of Object.entries(values)) {
      const input = container.querySelector<HTMLInputElement>(
        `input[name="${key}"]`,
      )!;
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(screen.getByRole("button", { name: "Connect Moodle" }));
    await waitFor(() =>
      expect(registered).toHaveBeenCalledWith(
        expect.objectContaining({ status: "registered" }),
      ),
    );
    const request = fetchMock.mock.calls.find(([path]) =>
      String(path).endsWith("/platform"),
    )!;
    expect(JSON.parse(request[1].body)).toEqual(values);
  });
  it("keeps the copy value exact", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    render(
      h(CopyButton, {
        label: "registration URL",
        value: "https://lti.cogniate.test/register?ref=example",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Copy registration URL" }),
    );
    expect(write).toHaveBeenCalledWith(
      "https://lti.cogniate.test/register?ref=example",
    );
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });
  it("creates a dynamic connection with the site origin", async () => {
    fetchMock.mockResolvedValue(
      json({ ...connection, method: "dynamic" }, 201),
    );
    const created = vi.fn();
    inRouter(h(CreateConnection, { onCreated: created }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Connection name"), "Example Moodle");
    await user.type(
      screen.getByLabelText("Moodle site URL"),
      "https://moodle.test/",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith(connection.id));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      name: "Example Moodle",
      siteUrl: connection.siteUrl,
      method: "dynamic",
    });
  });
  it("rejects credentials, paths and a foreign issuer", () => {
    expect(
      validatePlatform(connection.siteUrl, {
        ...values,
        issuer: "https://other.test",
      }),
    ).toHaveProperty("issuer");
    expect(
      validatePlatform(connection.siteUrl, {
        ...values,
        issuer: "https://moodle.test/path",
      }),
    ).toHaveProperty("issuer");
    expect(
      validatePlatform(connection.siteUrl, {
        ...values,
        jwksUrl: "https://user:pass@moodle.test/keys",
      }),
    ).toHaveProperty("jwksUrl");
    expect(validatePlatform(connection.siteUrl, values)).toEqual({});
  });
  it("derives link expiry without changing a registered state", () => {
    expect(
      connectionStatus({
        ...connection,
        registrationUrl: "https://lti.example/register?ref=test",
        registrationUrlExpiresAt: "2099-01-01",
      }),
    ).toBe("Waiting for Moodle");
    expect(connectionStatus({ ...connection, status: "disabled" })).toBe(
      "Disconnected",
    );
    expect(
      connectionStatus({
        ...connection,
        registrationUrlExpiresAt: "2000-01-01",
      }),
    ).toBe("Link expired");
    expect(
      connectionStatus({
        ...connection,
        status: "registered",
        registrationUrlExpiresAt: "2000-01-01",
      }),
    ).toBe("Registered — activate in Moodle");
  });
});

describe("portal forms and contract states", () => {
  it("uses server connection text and only the shared pending-tool fallback", () => {
    const error = {
      code: "MOODLE_TOOL_MAY_EXIST",
      ltiCode: null,
      traceId: "trace-pending",
      at: "2026-10-18",
      title: "A server-owned title <b>literal</b>",
      action: "Use this server-owned action.",
    };
    const { rerender, container } = render(
      h(ConnectionError, {
        connection: { ...connection, lastError: error },
        libraryName: "Example",
      }),
    );
    expect(screen.getByText(error.title)).toBeTruthy();
    expect(screen.getByText(error.action)).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.queryByText(/In Manage tools, delete/)).toBeNull();
    rerender(
      h(ConnectionError, {
        connection: {
          ...connection,
          lastError: { ...error, title: undefined, action: undefined },
        },
        libraryName: "Example",
      }),
    );
    expect(
      screen.getByText(
        "Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (Example)', then connect again.",
      ),
    ).toBeTruthy();
  });
  it("shows nine cards, filters them, and shows the newest connection error", async () => {
    fetchMock.mockResolvedValue(
      json({
        connections: [
          {
            ...connection,
            lastError: {
              code: "UPDATE_NOT_ALLOWED",
              title: "Tool updates are refused.",
              action:
                "Go back in Moodle and choose Register as a new external tool.",
              traceId: "trace-1234",
              ltiCode: null,
              at: "2026-10-18",
            },
          },
        ],
      }),
    );
    inRouter(h(Integrations));
    await screen.findByRole("link", { name: /Manage/ });
    expect(screen.getAllByRole("article")).toHaveLength(9);
    expect(
      screen.getByText(
        "Go back in Moodle and choose Register as a new external tool.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Trace id: trace-1234")).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("tab", { name: "LMS Publishing" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Connect another site/ }),
    ).toBeTruthy();
  });
  it("keeps course titles as literal text and sends a title without markup interpretation", async () => {
    fetchMock.mockResolvedValue(json({ id: "crs_test" }, 201));
    const created = vi.fn();
    render(h(NewCourse, { onCreated: created, onCancel: vi.fn() }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Course title"), "<b>x</b>");
    await user.click(screen.getByRole("button", { name: "Create course" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith("crs_test"));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).title).toBe("<b>x</b>");
  });
  it("shows the server action and unsafe path in a reject report", () => {
    render(
      h(ErrorNotice, {
        error: new ApiError(422, {
          message: "PACKAGE_REJECTED",
          description: "The package was rejected.",
          action: "Fix the package and upload it again.",
          reasons: [
            {
              code: "PATH_TRAVERSAL",
              title: "Unsafe file path",
              path: "../evil.html",
              action: "Export safe paths.",
              detail: "Unsafe",
            },
          ],
        }),
      }),
    );
    expect(screen.getByText("Unsafe file path: ../evil.html")).toBeTruthy();
    expect(
      screen.getByText("Fix the package and upload it again."),
    ).toBeTruthy();
  });
  it("publishes only to registered or connected sites and escapes the title", async () => {
    const course = {
      id: "crs_test",
      title: '<img src=x onerror="window.__xss=1">',
      versions: [{ id: "ver_test", version: 1, format: "scorm12" }],
    } as Course;
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        json(
          path.endsWith("/connections")
            ? {
                connections: [
                  connection,
                  {
                    ...connection,
                    id: "con_registered",
                    name: "Ready site",
                    status: "registered",
                  },
                  {
                    ...connection,
                    id: "con_disabled",
                    name: "Disabled site",
                    status: "disabled",
                  },
                ],
              }
            : {},
        ),
      ),
    );
    const published = vi.fn();
    const { container } = inRouter(
      h(PublishDialog, { course, onClose: vi.fn(), onPublished: published }),
    );
    await screen.findByRole("option", { name: /Ready site/ });
    expect(
      screen.queryByRole("option", { name: /Test Moodle|Disabled site/ }),
    ).toBeNull();
    expect(screen.getByText(course.title)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText("Moodle connection"),
      "con_registered",
    );
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(published).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({
      courseId: "crs_test",
      connectionId: "con_registered",
      versionId: "ver_test",
    });
  });
  it("shows the server error when results are not found", async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path.endsWith("/results")
        ? json(
            {
              details: {
                message: "NOT_FOUND",
                description: "Publication not found in this library.",
                action: "Choose a publication in this library.",
              },
            },
            404,
          )
        : json({ courseId: "crs_test", versionId: "ver_test" }),
    );
    inRouter(h(Results));
    expect(
      await screen.findByText("Publication not found in this library."),
    ).toBeTruthy();
    expect(
      screen.getByText("Choose a publication in this library."),
    ).toBeTruthy();
    expect(screen.queryByText(/not available yet/)).toBeNull();
  });
  it("shows conflict, all sync history, an override, and sends the latest failed sync", async () => {
    const row: ResultRow = {
      learner: { sub: "5", label: "cg_student" },
      activity: {
        resourceLinkId: "rl_test",
        title: "<b>x</b>",
        contextTitle: "Course",
      },
      preview: false,
      best: {
        attemptId: "att_test",
        outcome: "passed",
        scoreGiven: 100,
        scoreMaximum: 100,
      },
      attempts: [],
      gradebook: { resultScore: 50, resultMaximum: 100, readAt: "2026-10-18" },
      gradebookDiffers: true,
      scoreSyncs: [
        {
          id: "sync_old",
          status: "sent",
          tries: 1,
          scoreGiven: 70,
          scoreMaximum: 100,
          createdAt: "2026-10-17",
          sentAt: "2026-10-17",
          lastError: null,
        },
        {
          id: "sync_new",
          status: "conflict",
          tries: 1,
          scoreGiven: 100,
          scoreMaximum: 100,
          createdAt: "2026-10-18",
          sentAt: null,
          lastError: "Newer time",
        },
      ],
    };
    const resend = vi.fn();
    render(
      h(
        "table",
        null,
        h(
          "tbody",
          null,
          h(ResultTableRow, { row, busy: false, onResend: resend }),
        ),
      ),
    );
    expect(screen.getByText("Passed 100")).toBeTruthy();
    expect(screen.getByText("<b>x</b>")).toBeTruthy();
    expect(
      screen.getByText("Moodle has a grade with a newer time"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Moodle keeps another grade, for example a teacher override",
      ),
    ).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByText("Sync history (2)"));
    expect(
      within(screen.getByText("Sync history (2)").parentElement!).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Resend" }));
    expect(resend).toHaveBeenCalledWith(row.scoreSyncs[1]);
  });
});

describe("T5 results integration", () => {
  const row: ResultRow = {
    learner: { sub: "5", label: "Learner 5 @ moodle.test" },
    activity: {
      resourceLinkId: "rl_live",
      title: "SCORM course",
      contextTitle: "Moodle course",
    },
    preview: false,
    best: {
      attemptId: "att_live",
      outcome: "passed",
      scoreGiven: 100,
      scoreMaximum: 100,
    },
    attempts: [
      {
        attemptId: "att_live",
        versionId: "ver_live",
        outcome: "passed",
        scoreGiven: 100,
        scoreMaximum: 100,
        updatedAt: "2026-10-18T00:00:00Z",
      },
    ],
    scoreSyncs: [
      {
        id: "sync_live",
        status: "failed",
        tries: 1,
        scoreGiven: 100,
        scoreMaximum: 100,
        createdAt: "2026-10-18T00:00:00Z",
        sentAt: null,
        lastError: "AGS_USER_NOT_GRADABLE",
      },
    ],
    gradebook: null,
  };
  it.each([404, 409, 501])(
    "shows server errors and keeps saved results when Resend or Refresh returns %s",
    async (status) => {
      fetchMock.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (options?.method === "POST")
            return json(
              {
                details: {
                  message: status === 409 ? "SYNC_NOT_RESENDABLE" : "NOT_FOUND",
                  description: "The server refused this action.",
                  action: "Check the saved score in Moodle.",
                  traceId: "trace-server-action",
                },
              },
              status,
            );
          if (path.endsWith("/results")) return json({ rows: [row] });
          if (path.includes("/versions/"))
            return json({ report: { scorm: null } });
          return json({
            id: "pub_live",
            courseId: "crs_live",
            versionId: "ver_live",
            courseTitle: "SCORM course",
            format: "scorm12",
            version: 1,
          });
        },
      );
      render(
        h(
          MemoryRouter,
          { initialEntries: ["/publications/pub_live/results"] },
          h(
            Routes,
            null,
            h(Route, {
              path: "/publications/:publicationId/results",
              element: h(Results),
            }),
          ),
        ),
      );
      await screen.findByText("Passed 100");
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Resend" }));
      expect(
        await screen.findByText("The server refused this action."),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        "/app-api/score-syncs/sync_live/resend",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText("Passed 100")).toBeTruthy();
      expect(screen.queryByText("Pending")).toBeNull();
      expect(screen.getByText("Check the saved score in Moodle.")).toBeTruthy();
      expect(screen.getByText("Trace id: trace-server-action")).toBeTruthy();
      expect(screen.queryByText(/not available yet/)).toBeNull();
      await user.click(
        screen.getByRole("button", { name: "Refresh from Moodle" }),
      );
      expect(
        await screen.findByText("The server refused this action."),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        "/app-api/publications/pub_live/results/refresh",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText("Sync history (1)")).toBeTruthy();
      expect(screen.getByText("Attempts (1)")).toBeTruthy();
    },
  );
  it("uses the actual Resend response status and fields", async () => {
    const sent = {
      ...row.scoreSyncs[0]!,
      status: "sent",
      tries: 2,
      sentAt: "2026-10-18T01:00:00Z",
      lastError: null,
    };
    fetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "POST") return json(sent);
        if (path.endsWith("/results")) return json({ rows: [row] });
        return json({ courseId: "crs_live", versionId: "ver_live" });
      },
    );
    inRouter(h(Results));
    await screen.findByText("Passed 100");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Resend" }));
    expect(
      await screen.findByText("Sent. Status updates every 5 seconds."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resend" })).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(screen.getByText(/2 tries/)).toBeTruthy();
  });
  it("keeps the server gradebook and differs flag authoritative across refresh and polling", async () => {
    vi.useFakeTimers();
    const sent = {
      ...row,
      scoreSyncs: [{ ...row.scoreSyncs[0]!, status: "sent" as const }],
    };
    const refreshed = {
      ...sent,
      gradebook: { resultScore: 20, resultMaximum: 100, readAt: "2026-10-18" },
      gradebookDiffers: false,
    };
    fetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "POST") return json({ rows: [refreshed] });
        if (path.endsWith("/results"))
          return json({
            rows: [{ ...sent, gradebook: null, gradebookDiffers: false }],
          });
        return json({ courseId: "crs_live", versionId: "ver_live" });
      },
    );
    try {
      await act(async () => {
        inRouter(h(Results));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Refresh from Moodle" }),
        );
      });
      expect(screen.getByText("20 / 100")).toBeTruthy();
      expect(screen.queryByText(/Moodle keeps another grade/)).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.getByText("Not refreshed")).toBeTruthy();
      expect(screen.queryByText("20 / 100")).toBeNull();
      expect(screen.queryByText(/Moodle keeps another grade/)).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });
  it("shows preview results without a grade or a Resend action", () => {
    render(
      h(
        "table",
        null,
        h(
          "tbody",
          null,
          h(ResultTableRow, {
            row: { ...row, preview: true, scoreSyncs: [] },
            busy: false,
            onResend: vi.fn(),
          }),
        ),
      ),
    );
    expect(screen.getByText("Passed 100")).toBeTruthy();
    expect(screen.getByText("Preview — no grade sent")).toBeTruthy();
    expect(screen.getByText("Not applicable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resend" })).toBeNull();
  });
});

describe("route focus", () => {
  it("returns focus to Publish after delayed course data loads on close", async () => {
    const version = {
      id: "ver_focus",
      courseId: "crs_focus",
      version: 1,
      format: "html",
      packageId: "pkg_focus",
      createdAt: "2026-10-18",
      report: {
        format: "html",
        entryPath: "index.html",
        fileCount: 1,
        totalBytes: 100,
        scorm: null,
        html: null,
        externalHosts: [],
        warnings: [],
      },
      trackingProfile: {
        pages: ["index"],
        questionIds: [],
        masteryScore: null,
      },
    };
    const course = {
      id: "crs_focus",
      title: "Focus course",
      summary: "",
      variant: "default",
      lang: "en",
      createdAt: "2026-10-18",
      latestVersion: version,
      versions: [version],
      publications: [],
    };
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/app-api/me")
        return json({
          user: {
            name: "Thanh",
            id: "usr_test",
            email: "thanh@cogniate.test",
            role: "owner",
          },
          library: { id: "lib_test", name: "Library" },
        });
      if (path === "/app-api/courses/crs_focus") {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return json(course);
      }
      if (path === "/app-api/connections")
        return json({ connections: [{ ...connection, status: "registered" }] });
      return json({ publications: [] });
    });
    render(
      h(
        MemoryRouter,
        { initialEntries: ["/libraries/courses/crs_focus"] },
        h(App),
      ),
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("link", { name: "Publish to Moodle" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Publish to Moodle",
    });
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("publish-opener"),
    );
  });
});
