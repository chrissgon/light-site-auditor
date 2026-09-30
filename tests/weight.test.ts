import { statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runLighthouse, type LighthouseResult } from "../src/lighthouse.js";
import { FILE_TYPES, weightByType } from "../src/weight.js";
import { FIXTURE_SITE, serveFolder, type StaticServer } from "./helpers/static-server.js";

// T-aud-3, AC-3: bytes by file type, from Lighthouse's network-requests audit.
const lhrWith = (items: { url: string; resourceType?: string; transferSize?: number; resourceSize?: number }[]) =>
  ({ audits: { "network-requests": { details: { type: "table", items } } } }) as unknown as LighthouseResult;

describe("weightByType on a hand-made result", () => {
  it("groups every Lighthouse resource type into html, css, js, image, font and other", () => {
    const weight = weightByType(
      lhrWith([
        { url: "https://a.test/", resourceType: "Document", transferSize: 1000, resourceSize: 3000 },
        { url: "https://a.test/a.css", resourceType: "Stylesheet", transferSize: 200, resourceSize: 900 },
        { url: "https://a.test/a.js", resourceType: "Script", transferSize: 300, resourceSize: 1200 },
        { url: "https://a.test/b.js", resourceType: "Script", transferSize: 50, resourceSize: 50 },
        { url: "https://a.test/a.png", resourceType: "Image", transferSize: 4000, resourceSize: 4000 },
        { url: "https://a.test/a.woff2", resourceType: "Font", transferSize: 700, resourceSize: 700 },
        { url: "https://a.test/api", resourceType: "Fetch", transferSize: 10, resourceSize: 8 },
        { url: "https://a.test/v.mp4", resourceType: "Media", transferSize: 90, resourceSize: 90 },
        { url: "https://a.test/x", transferSize: 5, resourceSize: 5 },
      ]),
    );
    expect(weight.byType).toEqual({
      html: { files: 1, transferBytes: 1000, resourceBytes: 3000 },
      css: { files: 1, transferBytes: 200, resourceBytes: 900 },
      js: { files: 2, transferBytes: 350, resourceBytes: 1250 },
      image: { files: 1, transferBytes: 4000, resourceBytes: 4000 },
      font: { files: 1, transferBytes: 700, resourceBytes: 700 },
      other: { files: 3, transferBytes: 105, resourceBytes: 103 },
    });
    expect(weight.total).toEqual({ files: 9, transferBytes: 6355, resourceBytes: 9953 });
  });

  it("returns zero for every type when the page made no requests", () => {
    const weight = weightByType(lhrWith([]));
    for (const type of FILE_TYPES) expect(weight.byType[type]).toEqual({ files: 0, transferBytes: 0, resourceBytes: 0 });
    expect(weight.total).toEqual({ files: 0, transferBytes: 0, resourceBytes: 0 });
  });

  it("counts a missing size as zero", () => {
    expect(weightByType(lhrWith([{ url: "https://a.test/", resourceType: "Document" }])).total).toEqual({
      files: 1,
      transferBytes: 0,
      resourceBytes: 0,
    });
  });

  it("fails loudly when the result has no network-requests table", () => {
    expect(() => weightByType({ audits: {} } as unknown as LighthouseResult)).toThrow(/network-requests/);
  });
});

describe("weightByType on the fixture page", () => {
  let server: StaticServer;
  let lhr: LighthouseResult;
  beforeAll(async () => {
    server = await serveFolder();
    lhr = await runLighthouse(server.url);
  }, 120_000);
  afterAll(() => server?.close());

  const size = (file: string) => statSync(join(FIXTURE_SITE, file)).size;

  it("matches each type's bytes with the fixture files on disk", () => {
    const { byType } = weightByType(lhr);
    expect(byType.html).toMatchObject({ files: 1, resourceBytes: size("index.html") });
    expect(byType.css).toMatchObject({ files: 1, resourceBytes: size("style.css") });
    expect(byType.js).toMatchObject({ files: 1, resourceBytes: size("app.js") });
    expect(byType.image).toMatchObject({ files: 1, resourceBytes: size("foto.png") });
    expect(byType.font).toEqual({ files: 0, transferBytes: 0, resourceBytes: 0 });
    expect(byType.other).toEqual({ files: 0, transferBytes: 0, resourceBytes: 0 });
  });

  it("matches the total with the sum of the fixture files and with Lighthouse's total-byte-weight", () => {
    const { total } = weightByType(lhr);
    const files = ["index.html", "style.css", "app.js", "foto.png"];
    expect(total.resourceBytes).toBe(files.reduce((sum, f) => sum + size(f), 0));
    expect(total.transferBytes).toBe(lhr.audits["total-byte-weight"]?.numericValue);
    // Transferred bytes are the body plus the response headers.
    expect(total.transferBytes).toBeGreaterThan(total.resourceBytes);
  });
});
