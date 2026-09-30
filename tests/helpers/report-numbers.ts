// Every number a report may show, recomputed from the raw JSON independently of src/report.ts and
// src/weight.ts. Used by tests/report.test.ts (the fixture) and scripts/check-report.ts (a report on disk).

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const TYPE: Record<string, string> = { Document: "html", Stylesheet: "css", Script: "js", Image: "image", Font: "font" };

/** Every number the report may show, derived from the raw JSON. */
export function numbersFromRaw(lhr: Json, axe: Json) {
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
export function strings(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") out.add(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

export const NUMBER = /\d+(?:[.,]\d+)?/g;
export const without3G = (text: string) => text.replace(/(?<![\p{L}\p{N}])3G(?![\p{L}\p{N}])/gu, "");
export const markdownProse = (md: string) => without3G(md.replace(/`[^`\n]*`/g, " "));
export const markdownCode = (md: string) => [...md.matchAll(/`([^`\n]*)`/g)].map((m) => m[1]!);
export const htmlProse = (html: string) =>
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

/** The report's problems: numbers that no raw value explains, code spans with digits not copied from
 * the JSON, and a difference between the numbers of the Markdown and the HTML report. Empty = clean. */
export function reportProblems(md: string, html: string, lhr: Json, axe: Json) {
  const { allowed } = numbersFromRaw(lhr, axe);
  const stray = (markdownProse(md).match(NUMBER) ?? []).filter((n) => !allowed.has(n));
  const raw = [...strings(lhr), ...strings(axe)];
  const invented = markdownCode(md).filter((span) => /\d/.test(span) && !raw.some((s) => s.includes(span)));
  const fromMd = (markdownProse(md).match(NUMBER) ?? []).sort();
  const fromHtml = (htmlProse(html).match(NUMBER) ?? []).sort();
  const htmlDiffers = JSON.stringify(fromMd) !== JSON.stringify(fromHtml);
  return { stray, invented, htmlDiffers, numbers: fromMd.length };
}
