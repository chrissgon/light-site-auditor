# light-site-auditor

A command-line tool, `auditor <url>`, that measures a site's home page weight, how long it takes to appear on a phone over 3G, and its accessibility barriers (WCAG 2.1 AA), and writes a plain-Portuguese report saying what to fix, with the raw Lighthouse and axe JSON beside it.

**Consent rule.** A real site is audited only when its owner accepted: pass a consent record with `--consent <file>` (format and the Portuguese request text in [`docs/field/consentimento.md`](docs/field/consentimento.md)). Without an accepted record for the exact address the tool refuses (exit code 2); a `pendente` (pending) record is refused too. Pages on your own computer need no record. There is no flag to skip the check.

**Install and use** (Node 22.19 or newer):

```sh
npx @chrissgon/light-site-auditor --instalar-navegador   # once: Playwright's Chromium, about 191-205 MB
npx @chrissgon/light-site-auditor https://www.example.com/ --consent consent.md --out report
```

The first `npx` also downloads the package (about 23 kB) and its dependencies (about 148 MB, 185 MB installed). On Linux, Chromium may need system libraries: `sudo npx playwright@1.63.0 install-deps chromium`.

**The report** (`relatorio.md` and `relatorio.html`, in Portuguese): total weight and weight by file type, first and largest content on 3G in seconds, Lighthouse diagnostics that did not pass with what to do, and axe's WCAG 2.1 A and AA violations with the affected snippets. Every number comes from `lighthouse.json` or `axe.json`; every explanation comes from a catalog written in advance.

**Develop:** `npm ci`, `npx playwright install --no-shell chromium`, `npm test`, `npm run build`. MIT license.
