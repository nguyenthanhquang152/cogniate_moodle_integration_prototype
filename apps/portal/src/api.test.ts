import { afterEach, expect, it, vi } from "vitest";
import { extension } from "./api.ts";

afterEach(() => vi.unstubAllGlobals());
it.each(["/../courses", "//other.test", "/\\courses", "/%2e%2e/%2e%2e/courses", "/%2E./courses", "/%2fcourses", "/%5ccourses", "/%zz", "/.\t./courses", "/.\n./courses", "/.\r./.\r./courses"])("rejects extension path %s before sending it", (path) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  expect(() => extension("con_test", path)).toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps a valid escaped extension path inside the connection namespace", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  await expect(extension("con/test", "/files/report%20one")).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith("/app-api/connections/con%2Ftest/x/files/report%20one", expect.objectContaining({ credentials: "same-origin" }));
});
