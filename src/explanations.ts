import en from "./explanations.en.json" with { type: "json" };
import pt from "./explanations.pt.json" with { type: "json" };

/**
 * The catalogs of plain-language explanations (AC-4), one per report language. Nothing here writes new
 * text: every sentence of a report comes from src/explanations.<language>.json, and
 * tests/explanations.test.ts checks each catalog.
 */
export const LANGUAGES = ["pt-BR", "en-US"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "pt-BR";

type Entry = { title: string; what: string; fix: string; terms: string[] };

/** The shape every catalog has: the Portuguese one's keys, with its own glossary terms and jargon list. */
export interface Catalog {
  language: string;
  glossary: Record<string, string>;
  jargon: string[];
  impact: typeof pt.impact;
  fileTypes: typeof pt.fileTypes;
  report: typeof pt.report;
  metrics: typeof pt.metrics;
  axe: Record<keyof typeof pt.axe, Entry>;
  lighthouse: Record<keyof typeof pt.lighthouse, Entry>;
}

export const CATALOGS: Record<Language, Catalog> = { "pt-BR": pt, "en-US": en };

/** The Portuguese catalog, the default language. */
export const CATALOG = CATALOGS[DEFAULT_LANGUAGE];

/** What differs between languages outside the catalog: the report's file name and the decimal mark. */
export const REPORT_NAME: Record<Language, string> = { "pt-BR": "relatorio", "en-US": "report" };
export const DECIMAL_MARK: Record<Language, string> = { "pt-BR": ",", "en-US": "." };

/**
 * The languages asked for with --lang: a comma-separated list of pt-BR and en-US ("pt" and "en" are
 * accepted), in the order given, without repeats. Returns the unknown value instead when there is one.
 */
export function parseLanguages(value: string | undefined): { languages: Language[] } | { unknown: string } {
  if (value === undefined) return { languages: [DEFAULT_LANGUAGE] };
  const languages: Language[] = [];
  for (const raw of value.split(",")) {
    const wanted = raw.trim().toLowerCase();
    const found = LANGUAGES.find((l) => l.toLowerCase() === wanted || l.toLowerCase().split("-")[0] === wanted);
    if (!found) return { unknown: raw.trim() };
    if (!languages.includes(found)) languages.push(found);
  }
  return { languages };
}

export const NO_EXPLANATION = CATALOG.report.noExplanation;

export type Explanation =
  | { explained: true; title: string; what: string; fix: string; terms: string[] }
  | { explained: false; title: string; original: string; mark: string };

type Problems = Record<string, Entry>;

function explain(entries: Problems, id: string, original: string, mark: string): Explanation {
  const entry = Object.hasOwn(entries, id) ? entries[id] : undefined;
  if (entry) return { explained: true, ...entry };
  return { explained: false, title: original, original, mark };
}

/** The explanation of an axe rule, or the rule's own `help` text marked "sem explicação ainda" ("no explanation yet"). */
export const explainAxe = (ruleId: string, help: string, catalog: Catalog = CATALOG) =>
  explain(catalog.axe, ruleId, help, catalog.report.noExplanation);

/** The explanation of a Lighthouse audit, or the audit's own title marked "sem explicação ainda" ("no explanation yet"). */
export const explainLighthouse = (auditId: string, title: string, catalog: Catalog = CATALOG) =>
  explain(catalog.lighthouse, auditId, title, catalog.report.noExplanation);

/** Replaces `{name}` placeholders; a placeholder without a value is an error, never left in a report. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`no value for {${name}} in "${template}"`);
    return String(values[name]);
  });
}

export const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
export const words = (sentence: string) => sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}{]/u.test(w));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** A whole-word, case-insensitive pattern for a term, with the plural (-s, -es) of both languages. */
export const termPattern = (term: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu");

/** The glossary terms that appear in the texts. */
export const glossaryTermsIn = (texts: string[], catalog: Catalog = CATALOG) =>
  Object.keys(catalog.glossary).filter((term) => texts.some((text) => termPattern(term).test(text)));

/** The glossary terms the texts use, plus the terms their definitions use, until nothing new appears. */
export function glossaryClosure(texts: string[], catalog: Catalog = CATALOG): string[] {
  const found = new Set(glossaryTermsIn(texts, catalog));
  for (let size = -1; size !== found.size; ) {
    size = found.size;
    for (const term of glossaryTermsIn([...found].map((t) => catalog.glossary[t] ?? ""), catalog)) found.add(term);
  }
  return Object.keys(catalog.glossary).filter((term) => found.has(term));
}
