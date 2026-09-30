import catalog from "./explanations.pt.json" with { type: "json" };

/**
 * The reviewed catalog of plain-Portuguese explanations (AC-4). Nothing here writes new text: every
 * sentence of a report comes from src/explanations.pt.json, and tests/explanations.test.ts checks it.
 */
export const CATALOG = catalog;

export const NO_EXPLANATION = CATALOG.report.noExplanation;

export type Explanation =
  | { explained: true; title: string; what: string; fix: string; terms: string[] }
  | { explained: false; title: string; original: string; mark: string };

type Problems = Record<string, { title: string; what: string; fix: string; terms: string[] }>;

function explain(entries: Problems, id: string, original: string): Explanation {
  const entry = Object.hasOwn(entries, id) ? entries[id] : undefined;
  if (entry) return { explained: true, ...entry };
  return { explained: false, title: original, original, mark: NO_EXPLANATION };
}

/** The explanation of an axe rule, or the rule's own `help` text marked "sem explicação ainda". */
export const explainAxe = (ruleId: string, help: string) => explain(CATALOG.axe as Problems, ruleId, help);

/** The explanation of a Lighthouse audit, or the audit's own title marked "sem explicação ainda". */
export const explainLighthouse = (auditId: string, title: string) => explain(CATALOG.lighthouse as Problems, auditId, title);

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

/** A whole-word, case-insensitive pattern for a term, with the Portuguese plural (-s, -es). */
export const termPattern = (term: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu");

/** The glossary terms that appear in the texts. */
export const glossaryTermsIn = (texts: string[]) =>
  Object.keys(CATALOG.glossary).filter((term) => texts.some((text) => termPattern(term).test(text)));

/** The glossary terms the texts use, plus the terms their definitions use, until nothing new appears. */
export function glossaryClosure(texts: string[]): string[] {
  const found = new Set(glossaryTermsIn(texts));
  for (let size = -1; size !== found.size; ) {
    size = found.size;
    for (const term of glossaryTermsIn([...found].map((t) => CATALOG.glossary[t as keyof typeof CATALOG.glossary]))) found.add(term);
  }
  return Object.keys(CATALOG.glossary).filter((term) => found.has(term));
}
