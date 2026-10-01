# light-site-auditor

A command-line tool, `auditor <url>`, that measures a site's home page weight, how long it takes to appear on a phone over a 3G connection, and its accessibility barriers, and writes a report in plain Portuguese saying what to fix.

Every number in the report comes from the JSON files saved beside it (`lighthouse.json` and `axe.json`), and every explanation comes from a catalog written and checked in advance (`src/explanations.pt.json`), never from text generated at run time. The review of the catalog by a person is still pending.

The command's own messages, some of its flags and the report are in Portuguese.

## Consent rule

The auditor only checks a real site when its owner accepted. Without an accepted consent record for the exact address, it refuses and exits with code 2. Pages on this computer (`localhost`, `127.0.0.1`, `[::1]`) need no record. There is no option to skip this check.

1. Ask the owner with the text in [`docs/field/consentimento.md`](docs/field/consentimento.md) (in Portuguese). It says what the check does (opens the public home page twice, as a visitor would, and measures it with Lighthouse and axe on your computer), what it does not do (no login, no forms, no other pages) and that the report stays with the owner alone, unless they agree to another use.
2. Record the acceptance in a file that starts like this (the field names and the `aceito` status are in Portuguese, as the tool reads them):

   ```markdown
   ---
   endereco: https://www.exemplo.com.br/
   dono: Name of the person who accepted
   status: aceito
   data: 2026-09-30
   como: by e-mail, replying to the consent request
   reacao: pendente
   ---
   ```

   `endereco` is the address, `dono` the owner, `data` the date of the acceptance, `como` how it was given and `reacao` what the owner thought of the report.

3. Run with `--consent <file>`. A record with `status: pendente` (pending), another address, a missing field or a future date is refused.

## Install and use

Needs Node 22.19 or newer (Lighthouse 13.5.0 requires it).

Once, download the browser the auditor uses (Playwright's Chromium):

```sh
npx @chrissgon/light-site-auditor --instalar-navegador
```

Then audit:

```sh
npx @chrissgon/light-site-auditor https://www.exemplo.com.br/ --consent consentimento.md --out relatorio-exemplo
```

Or install the `auditor` command for good: `npm install -g @chrissgon/light-site-auditor`, and then `auditor --instalar-navegador` and `auditor <url> --consent <file>`.

What is downloaded (measured on 2026-09-30, on a Mac with an Apple processor, with an empty cache):

| What | Size | When |
|------|------|------|
| The `@chrissgon/light-site-auditor` package | about 23 kB | on the first `npx` |
| The dependencies (Lighthouse, Playwright, axe and what they use) | about 148 MB downloaded, 185 MB installed | on the first `npx` |
| Playwright's Chromium (Chrome for Testing 153.0.8010.12) | about 191 MB downloaded on a Mac with an Apple processor, 196 MB on Linux and 205 MB on Windows; 369 MB installed on the Mac | once, with `--instalar-navegador` |
| Playwright's FFmpeg | about 1 MB | together with Chromium |

The browser stays in Playwright's browsers folder (on a Mac, `~/Library/Caches/ms-playwright`) and serves the next audits. On Linux, Chromium may ask for system libraries: `sudo npx playwright@1.63.0 install-deps chromium`. If the browser is missing, the auditor says so and exits with code 3.

Exit codes: 0 the report was written; 1 the audit failed; 2 wrong usage or a refused address; 3 the browser is not installed.

## What the report holds

The report folder receives `relatorio.md`, `relatorio.html`, `lighthouse.json` and `axe.json`. Without `--out`, it is `relatorios/<address>-<date and time>/`.

| Part | What it shows | Where it comes from in the JSON |
|------|---------------|---------------------------------|
| Page weight | total downloaded and weight by file type (HTML, CSS, JavaScript, images, fonts, other) | `lighthouse.json`: `audits["network-requests"].details.items[].transferSize` |
| Time on 3G | first thing on the screen and main part on the screen, in seconds | `audits["first-contentful-paint"]` and `audits["largest-contentful-paint"]`, `numericValue` |
| What makes the page slow | Lighthouse diagnostics and insights below 0.9, each with what it is and what to do | `audits[<id>]` |
| Accessibility barriers | WCAG 2.1 level A and AA rules of axe-core 4.13.0, with the snippets of the page | `axe.json`: `violations` |
| Words used | a glossary of the report's technical terms | the catalog |

The 3G profile is Lighthouse's own `mobileRegular3G` (300 ms round trip, 700 kbit/s, a processor 4 times slower), with Lighthouse's default simulation. Sources and access dates: [`docs/spikes/3g.md`](docs/spikes/3g.md).

An excerpt of the example page's report, as the tool writes it:

```markdown
**Total baixado: 200,2 KB em 4 arquivos.**

- **Parte principal na tela: 4,2 segundos.** Quanto tempo leva até aparecer o maior texto ou imagem da tela.

### Imagem sem descrição

**O que é:** A imagem não tem texto alternativo, o alt. Quem usa leitor de tela não sabe o que ela mostra.
```

In English: "Total downloaded: 200.2 KB in 4 files." "Main part on the screen: 4.2 seconds. How long it takes for the largest text or image of the screen to appear." "Image without a description. What it is: the image has no alternative text, the alt. Someone using a screen reader does not know what it shows."

## Develop

```sh
npm ci
npx playwright install --no-shell chromium
npm test
npm run build
```

The tests start a local server with the example page in `tests/fixtures/site/` and do not use the internet. To try it by hand: `npm run fixture` in one terminal and `npm run auditor -- http://127.0.0.1:4173/ --out relatorios/exemplo` in another. `npm run check-report -- <folder>` checks that every number of a report already written comes from the JSON files in the folder.

## How the numbers are checked

`tests/report.test.ts` runs the auditor on the example page, recomputes from the saved JSON files every number the report may show (without using the report's code) and fails if any other number appears. The catalog has no digits, so no number can come from it.

## The catalog of explanations

`src/explanations.pt.json` holds, for each axe rule and each Lighthouse weight audit, a title, what it is and what to do. `tests/explanations.test.ts` checks that every sentence has at most 25 words, that every problem has a "what to do", that no technical word appears without being in the report's glossary and that the ids exist in the installed versions. A rule outside the catalog appears with the tool's original text and the mark "sem explicação ainda" (no explanation yet).

## License

MIT.
