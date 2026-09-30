import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { serveFolder, type StaticServer } from "./helpers/static-server.js";

// T-aud-6, AC-3: `auditor <fixture url>` writes a Portuguese report whose every number comes from the
// raw JSON saved beside it. The expected numbers are recomputed here from the raw JSON, independently
// of src/report.ts and src/weight.ts.

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const TYPE: Record<string, string> = { Document: "html", Stylesheet: "css", Script: "js", Image: "image", Font: "font" };

/** Every number the report may show, derived from the raw JSON. */
function numbersFromRaw(lhr: Json, axe: Json) {
  const allowed = new Set<string>();
  const add = (...values: (string | number)[]) => values.forEach((v) => allowed.add(String(v)));
  const sums: Record<string, { files: number; bytes: number }> = {};
  let files = 0;
  let bytes = 0;
  for (const item of lhr.audits["network-requests"].details.items) {
    const type = TYPE[item.resourceType] ?? "other";
    sums[type] ??= { files: 0, bytes: 0 };
    sums[type].files += 1;
    sums[type].bytes += item.transferSize;
    files += 1;
    bytes += item.transferSize;
  }
  for (const s of Object.values(sums)) add(s.files, s.bytes, oneDecimal(s.bytes / 1000));
  add(files, bytes, oneDecimal(bytes / 1000), lhr.audits["total-byte-weight"].numericValue);
  for (const id of ["first-contentful-paint", "largest-contentful-paint"]) {
    const ms = lhr.audits[id].numericValue;
    add(ms, oneDecimal(ms / 1000));
  }
  const t = lhr.configSettings.throttling;
  add(t.rttMs, t.throughputKbps, t.cpuSlowdownMultiplier);
  for (const audit of Object.values<Json>(lhr.audits)) {
    for (const ms of Object.values<number>(audit.metricSavings ?? {})) add(ms, oneDecimal(ms / 1000));
  }
  add(axe.violations.length, axe.violations.reduce((n: number, v: Json) => n + v.nodes.length, 0));
  for (const v of axe.violations) add(v.nodes.length);
  return { allowed, total: { files, bytes } };
}

/** Every string value in a JSON document. */
function strings(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") out.add(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
const without3G = (text: string) => text.replace(/(?<![\p{L}\p{N}])3G(?![\p{L}\p{N}])/gu, "");
const markdownProse = (md: string) => without3G(md.replace(/`[^`\n]*`/g, " "));
const markdownCode = (md: string) => [...md.matchAll(/`([^`\n]*)`/g)].map((m) => m[1]!);
const htmlProse = (html: string) =>
  without3G(
    html
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<code>[\s\S]*?<\/code>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&"),
  );

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

  it("refuses a real site: consent comes first (T-aud-7), so M1 audits only this computer", async () => {
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
