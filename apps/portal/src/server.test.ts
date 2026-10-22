// @vitest-environment node
// Node tests for the small T6 app additions. All data is generated in a temporary store.
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { makeZip } from "@cogniate/package-inspector/testing";
import {
  QA_B,
  THANH,
  formBody,
  testApp,
} from "../../../services/cogniate-app/src/testkit.ts";
import type { TestApp } from "../../../services/cogniate-app/src/testkit.ts";
let t: TestApp;
afterEach(async () => {
  if (t) {
    await t.app.close();
    t.db.close();
    await rm(t.dataDir, { recursive: true, force: true });
  }
});
const hash = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
describe("T6 portal serving and original downloads", () => {
  it("redirects each signed-out portal route, while unknown APIs remain JSON 404", async () => {
    t = await testApp();
    for (const route of [
      "/",
      "/integrations",
      "/integrations/moodle/connect",
      "/integrations/moodle/con_x",
      "/libraries/courses",
      "/libraries/courses/crs_x",
      "/libraries/courses/crs_x/publish",
      "/publications/pub_x/results",
    ]) {
      const response = await t.app.inject(route);
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("/signin");
      expect(response.headers["content-security-policy"]).toContain(
        "default-src 'self'; frame-ancestors 'none'",
      );
    }
    const missing = await t.app.inject("/app-api/missing");
    expect(missing.statusCode).toBe(404);
    expect(missing.headers["content-type"]).toContain("application/json");
    expect(
      (await t.app.inject("/portal/assets/%2e%2e%2fpackage.json")).statusCode,
    ).toBe(404);
  });
  it("downloads exactly the uploaded bytes, requires a session and keeps library/version boundaries", async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const foreignCookie = await t.login(QA_B);
    const created = await t.app.inject({
      method: "POST",
      url: "/app-api/courses",
      headers: t.writeHeaders(cookie),
      payload: { title: "Download check" },
    });
    const courseId = created.json().id as string;
    const zip = makeZip([
      { name: "index.html", data: "<html><body>Local course</body></html>" },
    ]);
    const multipart = await formBody({ package: zip });
    const uploaded = await t.app.inject({
      method: "POST",
      url: `/app-api/courses/${courseId}/versions`,
      headers: { ...t.writeHeaders(cookie), ...multipart.headers },
      payload: multipart.payload,
    });
    expect(uploaded.statusCode).toBe(201);
    const versionId = uploaded.json().id as string;
    const path = `/app-api/courses/${courseId}/versions/${versionId}/download?kind=original`;
    const download = await t.app.inject({ url: path, headers: { cookie } });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/zip");
    expect(download.headers["content-disposition"]).toContain("attachment;");
    expect(hash(download.rawPayload)).toBe(hash(zip));
    expect((await t.app.inject(path)).statusCode).toBe(401);
    expect(
      (await t.app.inject({ url: path, headers: { cookie: foreignCookie } }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await t.app.inject({
          url: path.replace(versionId, "ver_missing"),
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await t.app.inject({
          url: path.replace("original", "mbz"),
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(404);
  });
});
