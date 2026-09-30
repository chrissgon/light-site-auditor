import type { AxeResults } from "./a11y.js";
import { CATALOG, explainAxe, explainLighthouse, fill, glossaryClosure, type Explanation } from "./explanations.js";
import type { LighthouseResult } from "./lighthouse.js";
import { FILE_TYPES, weightByType } from "./weight.js";

/**
 * Builds the Portuguese report from the two raw results. Every sentence comes from the catalog
 * (src/explanations.pt.json); every number is a value of the raw JSON or a sum of its values;
 * everything copied from the JSON as is (URL, date, HTML snippets) is shown as code.
 */

/** Inline content: plain text, text copied literally from the raw JSON (code), or bold text. */
type Inline = string | { code: string } | { strong: string };
type Block =
  | { h: 1 | 2 | 3; text: Inline[] }
  | { p: Inline[] }
  | { ul: Inline[][] }
  | { table: { head: string[]; rows: Inline[][][] } };

export interface ReportFiles {
  lighthouse: string;
  axe: string;
}

const T = CATALOG.report;
const METRICS = ["first-contentful-paint", "largest-contentful-paint"] as const;
/** Lighthouse's own threshold: an audit scoring below 0.9 is not passed. */
const PASS = 0.9;

/** One decimal, Portuguese decimal comma: 4202.484 ms → "4,2" seconds; 200211 bytes → "200,2" KB. */
export const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const seconds = (ms: number) => oneDecimal(ms / 1000);
const kb = (bytes: number) => oneDecimal(bytes / 1000);

/** The Lighthouse insights and diagnostics that did not pass, largest possible gain first. */
export function lighthouseProblems(lhr: LighthouseResult) {
  const refs = lhr.categories.performance?.auditRefs ?? [];
  return refs
    .filter((ref) => ref.group === "insights" || ref.group === "diagnostics")
    .map((ref) => lhr.audits[ref.id]!)
    .filter(
      (a) => a && a.score !== null && a.score < PASS && ["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode),
    )
    .map((audit) => ({ audit, lcp: audit.metricSavings?.LCP ?? 0, fcp: audit.metricSavings?.FCP ?? 0 }))
    .sort((a, b) => b.lcp - a.lcp || b.fcp - a.fcp);
}

function explanationBlocks(e: Explanation, heading: Inline[], extra: Inline[][] = []): Block[] {
  if (!e.explained) {
    return [
      { h: 3, text: [...heading, ` (${e.mark})`] },
      { p: [T.noExplanationNote] },
      { p: [{ strong: `${T.original}:` }, " ", { code: e.original }] },
      ...extra.map((p) => ({ p })),
    ];
  }
  return [
    { h: 3, text: heading },
    { p: [{ strong: `${T.whatItIs}:` }, ` ${e.what}`] },
    { p: [{ strong: `${T.whatToDo}:` }, ` ${e.fix}`] },
    ...extra.map((p) => ({ p })),
  ];
}

export function buildBlocks(lhr: LighthouseResult, axe: AxeResults, files: ReportFiles): Block[] {
  const weight = weightByType(lhr);
  const throttling = lhr.configSettings.throttling;
  const blocks: Block[] = [
    { h: 1, text: [T.title] },
    { p: [`${T.intro} ${T.introSources} ${T.introTerms}`] },
    {
      ul: [
        [{ strong: `${T.page}:` }, " ", { code: lhr.finalDisplayedUrl }],
        [{ strong: `${T.measuredAt}:` }, " ", { code: lhr.fetchTime }],
      ],
    },
  ];

  // Weight by file type, heaviest first; types with no file are left out.
  const types = FILE_TYPES.filter((t) => weight.byType[t].files > 0).sort(
    (a, b) => weight.byType[b].transferBytes - weight.byType[a].transferBytes,
  );
  blocks.push(
    { h: 2, text: [T.weightHeading] },
    { p: [T.weightIntro] },
    { p: [{ strong: fill(T.weightTotal, { kb: kb(weight.total.transferBytes), files: weight.total.files }) }] },
    {
      table: {
        head: [T.weightType, T.weightFiles, T.weightSize],
        rows: types.map((t) => [[CATALOG.fileTypes[t]], [String(weight.byType[t].files)], [kb(weight.byType[t].transferBytes)]]),
      },
    },
  );

  // Load times on the 3G profile.
  blocks.push(
    { h: 2, text: [T.loadHeading] },
    { p: [T.loadIntro] },
    {
      ul: METRICS.map((id) => [
        { strong: fill(T.loadMetric, { title: CATALOG.metrics[id].title, seconds: seconds(lhr.audits[id]!.numericValue!) }) },
        ` ${CATALOG.metrics[id].what}`,
      ]),
    },
    {
      p: [
        fill(T.loadProfile, {
          rtt: throttling.rttMs ?? "",
          kbps: throttling.throughputKbps ?? "",
          cpu: throttling.cpuSlowdownMultiplier ?? "",
        }),
      ],
    },
  );

  // What makes the page heavy or slow.
  const problems = lighthouseProblems(lhr);
  blocks.push({ h: 2, text: [T.speedHeading] });
  if (problems.length === 0) blocks.push({ p: [T.speedNone] });
  for (const { audit, lcp, fcp } of problems) {
    const e = explainLighthouse(audit.id, audit.title);
    const gain: Inline[][] =
      lcp > 0 ? [[fill(T.speedGainLcp, { seconds: seconds(lcp) })]] : fcp > 0 ? [[fill(T.speedGainFcp, { seconds: seconds(fcp) })]] : [];
    blocks.push(...explanationBlocks(e, [e.title], gain));
  }

  // Accessibility barriers.
  const places = axe.violations.reduce((n, v) => n + v.nodes.length, 0);
  blocks.push({ h: 2, text: [T.a11yHeading] }, { p: [T.a11yIntro] });
  if (axe.violations.length === 0) blocks.push({ p: [T.a11yNone] });
  else blocks.push({ p: [{ strong: fill(T.a11yCount, { rules: axe.violations.length, places }) }] });
  for (const v of axe.violations) {
    const e = explainAxe(v.id, v.help);
    const impact = v.impact ? CATALOG.impact[v.impact] : undefined;
    const shown = v.nodes.slice(0, 5);
    blocks.push(
      ...explanationBlocks(e, [e.title], [
        ...(impact ? [[{ strong: `${T.severity}:` }, ` ${impact}`] as Inline[]] : []),
        [v.nodes.length === 1 ? T.a11yPlacesOne : fill(T.a11yPlaces, { places: v.nodes.length })],
        [{ strong: `${T.a11yWhere}:` }],
      ]),
      { ul: shown.map((n) => [{ code: n.html }]) },
    );
    if (v.nodes.length > shown.length) blocks.push({ p: [T.a11yMore] });
  }
  blocks.push({ p: [T.a11yNote] });

  // Glossary: every term the prose above uses, and the terms its definitions use.
  const prose = blocks.flatMap(textOf);
  const terms = glossaryClosure([...prose, T.termsHeading, T.sourcesHeading, T.sourcesIntro]);
  blocks.push(
    { h: 2, text: [T.termsHeading] },
    { ul: terms.map((t) => [{ strong: `${t}:` }, ` ${CATALOG.glossary[t as keyof typeof CATALOG.glossary]}`]) },
  );

  // Where every number comes from.
  const lh = { code: files.lighthouse };
  blocks.push(
    { h: 2, text: [T.sourcesHeading] },
    { p: [T.sourcesIntro] },
    {
      ul: [
        [
          `${T.sourcesWeight} `,
          lh,
          ", ",
          { code: 'audits["network-requests"].details.items[].transferSize' },
          ", ",
          { code: "resourceType" },
          ": ",
          types.map((t) => `${CATALOG.fileTypes[t]} ${weight.byType[t].transferBytes}`).join("; "),
          ".",
        ],
        [`${T.sourcesTotal}, `, { code: 'audits["total-byte-weight"].numericValue' }, `: ${lhr.audits["total-byte-weight"]!.numericValue}.`],
        [
          `${T.sourcesTime}, `,
          ...METRICS.flatMap((id, i): Inline[] => [
            i ? "; " : "",
            { code: `audits["${id}"].numericValue` },
            `: ${lhr.audits[id]!.numericValue}`,
          ]),
          ".",
        ],
        [
          `${T.sourcesProfile}, `,
          { code: "configSettings.throttling" },
          ": ",
          { code: "rttMs" },
          ` ${throttling.rttMs}, `,
          { code: "throughputKbps" },
          ` ${throttling.throughputKbps}, `,
          { code: "cpuSlowdownMultiplier" },
          ` ${throttling.cpuSlowdownMultiplier}.`,
        ],
        ...(problems.some((p) => p.lcp > 0 || p.fcp > 0)
          ? [
              [
                `${T.sourcesGain}, `,
                ...problems
                  .filter((p) => p.lcp > 0 || p.fcp > 0)
                  .flatMap((p, i): Inline[] => {
                    const metric = p.lcp > 0 ? "LCP" : "FCP";
                    return [i ? "; " : "", { code: `audits["${p.audit.id}"].metricSavings.${metric}` }, `: ${p.lcp > 0 ? p.lcp : p.fcp}`];
                  }),
                ".",
              ] as Inline[],
            ]
          : []),
        [`${T.sourcesA11y}, `, { code: files.axe }, ", ", { code: "violations[].nodes" }, "."],
      ],
    },
  );
  return blocks;
}

/** The plain text of a block, without code spans (what a reader reads as prose). */
function textOf(block: Block): string[] {
  const inline = (parts: Inline[]) => parts.map((p) => (typeof p === "string" ? p : "strong" in p ? p.strong : "")).join("");
  if ("h" in block) return [inline(block.text)];
  if ("p" in block) return [inline(block.p)];
  if ("ul" in block) return block.ul.map(inline);
  return [...block.table.head, ...block.table.rows.flatMap((row) => row.map(inline))];
}

// ---- Markdown -------------------------------------------------------------------------------------

const mdCode = (s: string) => {
  const flat = s.replace(/\s*\n\s*/g, " ");
  return flat.includes("`") ? `\`\` ${flat} \`\`` : `\`${flat}\``;
};
const mdInline = (parts: Inline[]) =>
  parts.map((p) => (typeof p === "string" ? p : "code" in p ? mdCode(p.code) : `**${p.strong}**`)).join("");

export function toMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if ("h" in b) out.push(`${"#".repeat(b.h)} ${mdInline(b.text)}`);
    else if ("p" in b) out.push(mdInline(b.p));
    else if ("ul" in b) out.push(b.ul.map((item) => `- ${mdInline(item)}`).join("\n"));
    else {
      const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
      out.push(
        [row(b.table.head), row(b.table.head.map(() => "---")), ...b.table.rows.map((r) => row(r.map(mdInline)))].join("\n"),
      );
    }
  }
  return `${out.join("\n\n")}\n`;
}

// ---- HTML -----------------------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const htmlInline = (parts: Inline[]) =>
  parts
    .map((p) => (typeof p === "string" ? esc(p) : "code" in p ? `<code>${esc(p.code)}</code>` : `<strong>${esc(p.strong)}</strong>`))
    .join("");

const STYLE = `
body { font: 1.0625rem/1.6 system-ui, sans-serif; color: #1a1a1a; background: #ffffff; max-width: 46rem; margin: 0 auto; padding: 1rem; }
h1, h2, h3 { line-height: 1.25; }
h2 { margin-top: 2.5rem; border-bottom: 1px solid #d0d0d0; padding-bottom: 0.25rem; }
code { font-size: 0.9em; background: #f2f2f2; padding: 0.1em 0.3em; border-radius: 0.2em; overflow-wrap: anywhere; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #d0d0d0; }
`;

export function toHtml(blocks: Block[]): string {
  const body = blocks.map((b) => {
    if ("h" in b) return `<h${b.h}>${htmlInline(b.text)}</h${b.h}>`;
    if ("p" in b) return `<p>${htmlInline(b.p)}</p>`;
    if ("ul" in b) return `<ul>\n${b.ul.map((item) => `<li>${htmlInline(item)}</li>`).join("\n")}\n</ul>`;
    const head = `<tr>${b.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr>`;
    const rows = b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${htmlInline(c)}</td>`).join("")}</tr>`).join("\n");
    return `<table>\n<thead>${head}</thead>\n<tbody>\n${rows}\n</tbody>\n</table>`;
  });
  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(T.title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<main>",
    ...body,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function buildReport(lhr: LighthouseResult, axe: AxeResults, files: ReportFiles) {
  const blocks = buildBlocks(lhr, axe, files);
  return { markdown: toMarkdown(blocks), html: toHtml(blocks) };
}
