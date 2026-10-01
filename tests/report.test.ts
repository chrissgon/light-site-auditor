import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { serveFolder, type StaticServer } from "./helpers/static-server.js";
import {
  htmlProse,
  markdownCode,
  markdownProse,
  NUMBER,
  numbersFromRaw,
  oneDecimal,
  reportProblems,
  strings,
  type Json,
} from "./helpers/report-numbers.js";

// T-aud-6, AC-3: `auditor <fixture url>` writes a Portuguese report whose every number comes from the
// raw JSON saved beside it. The expected numbers are recomputed from the raw JSON by
// tests/helpers/report-numbers.ts, independently of src/report.ts and src/weight.ts.

describe("auditor on the fixture page", () => {
  let server: StaticServer;
  let out: string;
  let code: number;
  let stdout = "";
  let md: string;
  let html: string;
  let lhr: Json;
  let axe: Json;
  beforeAll(async () => {
    server = await serveFolder();
    out = mkdtempSync(join(tmpdir(), "auditor-"));
    code = await main([server.url, "--out", out], { stdout: (s) => (stdout += s), stderr: () => {} });
    md = readFileSync(join(out, "relatorio.md"), "utf8");
    html = readFileSync(join(out, "relatorio.html"), "utf8");
    lhr = JSON.parse(readFileSync(join(out, "lighthouse.json"), "utf8"));
    axe = JSON.parse(readFileSync(join(out, "axe.json"), "utf8"));
  }, 180_000);
  afterAll(async () => {
    await server?.close();
    rmSync(out, { recursive: true, force: true });
  });

  it("exits 0, prints where the report is, and saves the report beside both raw JSON files", () => {
    expect(code).toBe(0);
    expect(stdout).toContain(join(out, "relatorio.md"));
    expect(readdirSync(out).sort()).toEqual(["axe.json", "lighthouse.json", "relatorio.html", "relatorio.md"]);
  });

  it("shows only numbers that come from the raw JSON", () => {
    const { allowed } = numbersFromRaw(lhr, axe);
    const stray = (markdownProse(md).match(NUMBER) ?? []).filter((n) => !allowed.has(n));
    expect(stray).toEqual([]);
  });

  it("copies code spans with digits literally from the raw JSON", () => {
    const raw = new Set([...strings(lhr), ...strings(axe)]);
    const invented = markdownCode(md).filter((span) => /\d/.test(span) && ![...raw].some((s) => s.includes(span)));
    expect(invented).toEqual([]);
  });

  it("shows the total weight, both load times on 3G and the number of barriers", () => {
    const { total } = numbersFromRaw(lhr, axe);
    expect(md).toContain(`Total baixado: ${oneDecimal(total.bytes / 1000)} KB em ${total.files} arquivos.`);
    expect(md).toContain(`Primeira coisa na tela: ${oneDecimal(lhr.audits["first-contentful-paint"].numericValue / 1000)} segundos.`);
    expect(md).toContain(`Parte principal na tela: ${oneDecimal(lhr.audits["largest-contentful-paint"].numericValue / 1000)} segundos.`);
    expect(md).toContain(`O axe encontrou ${axe.violations.length} tipos de barreira`);
    expect(md).toContain(`${lhr.configSettings.throttling.rttMs} milissegundos`);
  });

  it("explains both fixture barriers from the catalog, with what to do", () => {
    expect(md).toContain("### Imagem sem descrição");
    expect(md).toContain("### Texto difícil de ler");
    expect(md.match(/\*\*O que fazer:\*\*/g)?.length).toBeGreaterThanOrEqual(2);
    expect(md).toContain('`<img src="foto.png" width="150" height="150">`');
  });

  it("defines every glossary term it uses", () => {
    const terms = md.split("## Palavras usadas neste relatório")[1] ?? "";
    for (const term of ["alt", "leitor de tela", "contraste", "KB", "3G", "JSON"]) expect(terms).toContain(`**${term}:**`);
  });

  it("writes the same numbers in the HTML report as in the Markdown one", () => {
    const fromMd = (markdownProse(md).match(NUMBER) ?? []).sort();
    const fromHtml = (htmlProse(html).match(NUMBER) ?? []).sort();
    expect(fromHtml).toEqual(fromMd);
    expect(html).toMatch(/^<!doctype html>\n<html lang="pt-BR">/);
  });
});

// The English report: one measurement, both languages (--lang en-US,pt-BR). The same checks, with the
// English decimal point, and the two reports show the same numbers.
describe("auditor on the fixture page, in English and Portuguese", () => {
  let server: StaticServer;
  let out: string;
  let code: number;
  let stdout = "";
  let md: string;
  let html: string;
  let lhr: Json;
  let axe: Json;
  beforeAll(async () => {
    server = await serveFolder();
    out = mkdtempSync(join(tmpdir(), "auditor-en-"));
    code = await main([server.url, "--out", out, "--lang", "en-US,pt-BR"], { stdout: (s) => (stdout += s), stderr: () => {} });
    md = readFileSync(join(out, "report.md"), "utf8");
    html = readFileSync(join(out, "report.html"), "utf8");
    lhr = JSON.parse(readFileSync(join(out, "lighthouse.json"), "utf8"));
    axe = JSON.parse(readFileSync(join(out, "axe.json"), "utf8"));
  }, 180_000);
  afterAll(async () => {
    await server?.close();
    rmSync(out, { recursive: true, force: true });
  });

  it("exits 0 and writes both reports beside one pair of raw JSON files, English first", () => {
    expect(code).toBe(0);
    expect(stdout.trim().split("\n")).toEqual(["report.md", "report.html", "relatorio.md", "relatorio.html"].map((f) => join(out, f)));
    expect(readdirSync(out).sort()).toEqual(["axe.json", "lighthouse.json", "relatorio.html", "relatorio.md", "report.html", "report.md"]);
  });

  it("shows only numbers and code that come from the raw JSON, the same in the HTML report", () => {
    expect(reportProblems(md, html, lhr, axe, ".")).toMatchObject({ stray: [], invented: [], htmlDiffers: false });
    expect(html).toMatch(/^<!doctype html>\n<html lang="en-US">/);
  });

  it("shows the total weight, both load times on 3G and the number of barriers, in English", () => {
    const { total } = numbersFromRaw(lhr, axe, ".");
    expect(md).toContain("# Site report");
    expect(md).toContain(`Total downloaded: ${oneDecimal(total.bytes / 1000, ".")} KB in ${total.files} files.`);
    expect(md).toContain(`First thing on the screen: ${oneDecimal(lhr.audits["first-contentful-paint"].numericValue / 1000, ".")} seconds.`);
    expect(md).toContain(`Main part on the screen: ${oneDecimal(lhr.audits["largest-contentful-paint"].numericValue / 1000, ".")} seconds.`);
    expect(md).toContain(`The axe tool found ${axe.violations.length} types of barrier`);
    expect(md).toContain(`${lhr.configSettings.throttling.rttMs} milliseconds`);
  });

  it("explains both fixture barriers from the English catalog and defines the terms it uses", () => {
    expect(md).toContain("### Image without a description");
    expect(md).toContain("### Text hard to read");
    expect(md.match(/\*\*What to do:\*\*/g)?.length).toBeGreaterThanOrEqual(2);
    expect(md).not.toMatch(/O que fazer|Palavras usadas/);
    const terms = md.split("## Words used in this report")[1] ?? "";
    for (const term of ["alt", "screen reader", "contrast", "KB", "3G", "JSON"]) expect(terms).toContain(`**${term}:**`);
  });

  it("shows the same numbers as the Portuguese report of the same measurement", () => {
    const pt = readFileSync(join(out, "relatorio.md"), "utf8");
    const numbers = (text: string) => (markdownProse(text).match(NUMBER) ?? []).map((n) => n.replace(",", ".")).sort();
    expect(numbers(md)).toEqual(numbers(pt));
    expect(reportProblems(pt, readFileSync(join(out, "relatorio.html"), "utf8"), lhr, axe)).toMatchObject({ stray: [], invented: [], htmlDiffers: false });
  });
});

describe("auditor without a local fixture", () => {
  const quiet = { stdout: () => {}, stderr: () => {} };

  it("refuses a real site without a consent record (T-aud-7)", async () => {
    let err = "";
    expect(await main(["https://example.com/"], { ...quiet, stderr: (s) => (err += s) })).toBe(2);
    expect(err).toMatch(/consentimento/);
  });

  it("prints usage and exits 2 without a URL, and 0 with --help", async () => {
    let err = "";
    expect(await main([], { ...quiet, stderr: (s) => (err += s) })).toBe(2);
    expect(err).toMatch(/auditor <url>/);
    let out = "";
    expect(await main(["--help"], { ...quiet, stdout: (s) => (out += s) })).toBe(0);
    expect(out).toMatch(/auditor <url>/);
    expect(out).toMatch(/--lang/);
  });

  it("refuses a report language it does not have", async () => {
    let err = "";
    expect(await main(["http://127.0.0.1:9/", "--lang", "fr"], { ...quiet, stderr: (s) => (err += s) })).toBe(2);
    expect(err).toMatch(/fr.*pt-BR ou en-US/);
  });
});

describe("counts in the singular", () => {
  it("says one type of barrier, one place and one file without a plural", async () => {
    const { fill, CATALOG } = await import("../src/explanations.js");
    const T = CATALOG.report;
    expect(fill(T.a11yCount, { rules: 1, rulesWord: T.a11yRuleOne, places: 1, placesWord: T.a11yPlaceOne })).toBe(
      "O axe encontrou 1 tipo de barreira, em 1 lugar da página.",
    );
    expect(fill(T.a11yCount, { rules: 2, rulesWord: T.a11yRuleMany, places: 4, placesWord: T.a11yPlaceMany })).toBe(
      "O axe encontrou 2 tipos de barreira, em 4 lugares da página.",
    );
    expect(fill(T.weightTotal, { kb: "1,0", files: 1, filesWord: T.weightFileOne })).toBe("Total baixado: 1,0 KB em 1 arquivo.");
  });
});
