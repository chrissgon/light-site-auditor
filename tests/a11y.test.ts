import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAxe, WCAG21_AA_TAGS, type AxeResults } from "../src/a11y.js";
import { serveFolder, type StaticServer } from "./helpers/static-server.js";

// T-aud-4, AC-2: axe-core through @axe-core/playwright 4.13.0 lists the page's WCAG 2.1 AA violations.
describe("axe on the fixture site", () => {
  let server: StaticServer;
  let problems: AxeResults;
  let clean: AxeResults;
  beforeAll(async () => {
    server = await serveFolder();
    [problems, clean] = await Promise.all([runAxe(server.url), runAxe(`${server.url}acessivel.html`)]);
  }, 120_000);
  afterAll(() => server?.close());

  it("runs axe-core 4.13.0 with only the WCAG 2.1 A and AA tags", () => {
    expect(problems.testEngine.version).toBe("4.13.0");
    expect(problems.toolOptions.runOnly).toEqual({ type: "tag", values: [...WCAG21_AA_TAGS] });
  });

  it("finds the image without alt and the low-contrast text, and nothing else", () => {
    expect(problems.violations.map((v) => v.id).sort()).toEqual(["color-contrast", "image-alt"]);
    const byId = Object.fromEntries(problems.violations.map((v) => [v.id, v.nodes.map((n) => n.html)]));
    expect(byId["image-alt"]).toEqual(['<img src="foto.png" width="150" height="150">']);
    expect(byId["color-contrast"]).toEqual(['<p class="fraco">Aberto de segunda a sábado.</p>']);
  });

  it("finds no violation on the same page with alt text and readable contrast", () => {
    expect(clean.violations).toEqual([]);
  });

  it("fails loudly when the page does not load", async () => {
    await expect(runAxe(`${server.url}nao-existe.html`)).rejects.toThrow(/HTTP 404/);
  }, 60_000);
});
