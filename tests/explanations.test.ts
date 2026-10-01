import { basename } from "node:path";
import axe from "axe-core";
import { getAuditList } from "lighthouse";
import { describe, expect, it } from "vitest";
import { WCAG21_AA_TAGS } from "../src/a11y.js";
import {
  CATALOG,
  CATALOGS,
  LANGUAGES,
  explainAxe,
  explainLighthouse,
  fill,
  glossaryTermsIn,
  parseLanguages,
  sentences,
  termPattern,
  words,
  type Catalog,
} from "../src/explanations.js";

// T-aud-5, AC-4: every explanation comes from a reviewed catalog, in plain Portuguese or plain English:
// sentences of at most 25 words, a "what to do" for every problem, no number, and no technical term
// left unexplained. The same checks run on each language's catalog.

type Entry = { title: string; what: string; fix: string; terms: string[] };

describe.each(LANGUAGES.map((l) => [l, CATALOGS[l]] as [string, Catalog]))("%s", (language, CATALOG) => {
  const problems: [string, string, Entry][] = [
    ...Object.entries(CATALOG.axe).map(([id, e]) => ["axe", id, e] as [string, string, Entry]),
    ...Object.entries(CATALOG.lighthouse).map(([id, e]) => ["lighthouse", id, e] as [string, string, Entry]),
  ];

  /** Every text of the catalog, with where it lives. */
  const texts: [string, string][] = [
    ...Object.entries(CATALOG.glossary).map(([t, d]) => [`glossary.${t}`, d] as [string, string]),
    ...Object.entries(CATALOG.impact).map(([k, v]) => [`impact.${k}`, v] as [string, string]),
    ...Object.entries(CATALOG.fileTypes).map(([k, v]) => [`fileTypes.${k}`, v] as [string, string]),
    ...Object.entries(CATALOG.report).map(([k, v]) => [`report.${k}`, v] as [string, string]),
    ...Object.entries(CATALOG.metrics).flatMap(([id, m]) => [
      [`metrics.${id}.title`, m.title],
      [`metrics.${id}.what`, m.what],
    ] as [string, string][]),
    ...problems.flatMap(([source, id, e]) => [
      [`${source}.${id}.title`, e.title],
      [`${source}.${id}.what`, e.what],
      [`${source}.${id}.fix`, e.fix],
    ] as [string, string][]),
  ];

  describe("the explanation catalog", () => {
    it("has at least the most common axe rules and the Lighthouse weight audits", () => {
      for (const id of ["color-contrast", "image-alt", "label", "link-name", "button-name", "html-has-lang", "document-title"]) {
        expect(CATALOG.axe, id).toHaveProperty([id]);
      }
      for (const id of ["total-byte-weight", "image-delivery-insight", "render-blocking-insight", "unused-css-rules", "unused-javascript", "cache-insight"]) {
        expect(CATALOG.lighthouse, id).toHaveProperty([id]);
      }
    });

    it.each(problems)("%s %s has a title, an explanation and a what-to-do", (_source, _id, entry) => {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.what.trim()).not.toBe("");
      expect(entry.fix.trim()).not.toBe("");
    });

    it("keeps every sentence at 25 words or fewer", () => {
      const long = texts.flatMap(([where, text]) =>
        sentences(text).filter((s) => words(s).length > 25).map((s) => `${where}: ${words(s).length} words: ${s}`),
      );
      expect(long).toEqual([]);
    });

    it("writes no digits, so no number in a report can come from the catalog (the name 3G aside)", () => {
      const withDigits = texts.filter(([, text]) => /\d/.test(text.replace(termPattern("3G"), ""))).map(([where]) => where);
      expect(withDigits).toEqual([]);
    });

    it("never uses a technical word from the jargon list", () => {
      const found = texts.flatMap(([where, text]) =>
        // Placeholders ({rtt}, {title}) are replaced by data before anyone reads them.
        CATALOG.jargon.filter((word) => termPattern(word).test(text.replace(/\{\w+\}/g, ""))).map((word) => `${where}: ${word}`),
      );
      expect(found).toEqual([]);
    });

    it.each(problems)("%s %s declares exactly the glossary terms its text uses", (_source, _id, entry) => {
      expect([...entry.terms].sort()).toEqual(glossaryTermsIn([entry.title, entry.what, entry.fix], CATALOG).sort());
    });

    it("defines, in the glossary, every glossary term that a definition uses", () => {
      const used = glossaryTermsIn(Object.values(CATALOG.glossary), CATALOG);
      for (const term of used) expect(CATALOG.glossary).toHaveProperty([term]);
    });

    it("only explains real axe-core 4.13.0 rules that belong to WCAG 2.1 A or AA", () => {
      const tags = new Set<string>(WCAG21_AA_TAGS);
      const rules = new Map(axe.getRules().map((r) => [r.ruleId, r.tags]));
      const wrong = Object.keys(CATALOG.axe).filter((id) => !(rules.get(id) ?? []).some((t) => tags.has(t)));
      expect(wrong).toEqual([]);
    });

    it("only explains real Lighthouse 13.5.0 audits", () => {
      const audits = new Set(getAuditList().map((file) => basename(file, ".js")));
      expect(Object.keys(CATALOG.lighthouse).filter((id) => !audits.has(id))).toEqual([]);
    });

    it("explains both metrics the report shows and every file type", () => {
      expect(Object.keys(CATALOG.metrics).sort()).toEqual(["first-contentful-paint", "largest-contentful-paint"]);
      expect(Object.keys(CATALOG.fileTypes).sort()).toEqual(["css", "font", "html", "image", "js", "other"]);
    });
  });

  it("names its own language and has the entries of every other catalog", () => {
    expect(CATALOG.language).toBe(language);
    for (const other of Object.values(CATALOGS)) {
      expect(Object.keys(CATALOG.axe)).toEqual(Object.keys(other.axe));
      expect(Object.keys(CATALOG.lighthouse)).toEqual(Object.keys(other.lighthouse));
      expect(Object.keys(CATALOG.report)).toEqual(Object.keys(other.report));
      expect(Object.keys(CATALOG.impact)).toEqual(Object.keys(other.impact));
    }
  });

  it("keeps the placeholders of every report text", () => {
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const reference = CATALOGS["pt-BR"].report;
    for (const [key, text] of Object.entries(CATALOG.report)) expect(holes(text), key).toEqual(holes(reference[key as keyof typeof reference]));
  });
});

describe("lookups", () => {
  it("returns the catalog's text for a rule it knows", () => {
    expect(explainAxe("image-alt", "Images must have alternative text")).toEqual({ explained: true, ...CATALOG.axe["image-alt"] });
    expect(explainLighthouse("cache-insight", "Use efficient cache lifetimes")).toEqual({
      explained: true,
      ...CATALOG.lighthouse["cache-insight"],
    });
  });

  it("shows a rule it does not know with the tool's original text and the mark 'sem explicação ainda'", () => {
    expect(explainAxe("some-new-rule", "Some new rule must hold")).toEqual({
      explained: false,
      title: "Some new rule must hold",
      original: "Some new rule must hold",
      mark: "sem explicação ainda",
    });
    expect(explainLighthouse("some-new-insight", "Some new insight")).toMatchObject({ explained: false, mark: "sem explicação ainda" });
  });

  it("marks an unknown rule 'no explanation yet' in the English catalog, and finds English glossary terms", () => {
    const en = CATALOGS["en-US"];
    expect(explainAxe("some-new-rule", "Some new rule must hold", en)).toMatchObject({ explained: false, mark: "no explanation yet" });
    expect(explainAxe("image-alt", "Images must have alternative text", en)).toEqual({ explained: true, ...en.axe["image-alt"] });
    expect(glossaryTermsIn(["Browsers keep copies in a cache.", "although", "the image's alt"], en).sort()).toEqual(["alt", "browser", "cache"]);
  });

  it("reads the languages asked for with --lang", () => {
    expect(parseLanguages(undefined)).toEqual({ languages: ["pt-BR"] });
    expect(parseLanguages("en-US")).toEqual({ languages: ["en-US"] });
    expect(parseLanguages("EN, pt-br,en")).toEqual({ languages: ["en-US", "pt-BR"] });
    expect(parseLanguages("pt-BR,fr")).toEqual({ unknown: "fr" });
    expect(parseLanguages("")).toEqual({ unknown: "" });
  });

  it("fills placeholders and refuses a missing one", () => {
    expect(fill("{a} e {b}", { a: "um", b: 2 })).toBe("um e 2");
    expect(() => fill("{a} e {b}", { a: "um" })).toThrow(/b/);
  });

  it("finds glossary terms as whole words, plural included, ignoring case", () => {
    expect(glossaryTermsIn(["Os navegadores guardam cópias em cache.", "altura", "o alt da imagem"]).sort()).toEqual(
      ["alt", "cache", "navegador"].sort(),
    );
  });

  it("counts words per sentence, so a 26-word sentence is caught", () => {
    const long = Array.from({ length: 26 }, () => "palavra").join(" ") + ".";
    expect(sentences(`Curta. ${long}`).map((s) => words(s).length)).toEqual([1, 26]);
  });
});
