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
