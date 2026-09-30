# light-site-auditor

[Português](#português) · [English](#english)

## Português

Uma ferramenta de linha de comando, `auditor <url>`, que mede o peso de uma página, o tempo que ela leva para aparecer num celular com conexão 3G e as barreiras de acessibilidade, e escreve um relatório em português simples com o que corrigir.

Cada número do relatório vem dos arquivos JSON salvos ao lado dele (`lighthouse.json` e `axe.json`), e cada explicação vem de um catálogo escrito e conferido de antemão (`src/explanations.pt.json`), nunca de texto gerado na hora. A leitura do catálogo por uma pessoa ainda está pendente.

### Estado

Primeira versão (M1): roda só no seu computador e só audita páginas locais (`localhost`, `127.0.0.1`, `[::1]`). Auditar um site real exige o consentimento do dono; esse passo ainda não existe, e a ferramenta recusa qualquer outro endereço.

### Requisitos

- Node 22.19 ou mais novo (o Lighthouse 13.5.0 exige isso).
- O Chromium do Playwright. Se ainda não estiver instalado: `npx playwright install chromium`.

### Instalar e testar

```sh
npm install
npm test
```

Os testes sobem um servidor local com a página de exemplo de `tests/fixtures/site/` e não usam a internet.

### Usar

Num terminal, sirva a página de exemplo:

```sh
npm run fixture
```

Em outro, audite:

```sh
npm run auditor -- http://127.0.0.1:4173/ --out relatorios/exemplo
```

A pasta recebe `relatorio.md`, `relatorio.html`, `lighthouse.json` e `axe.json`. Sem `--out`, o relatório vai para `relatorios/<endereço>-<data e hora>/`. Depois de `npm run build`, o mesmo comando funciona com `node dist/cli.js <url>`.

Trecho do relatório da página de exemplo:

```markdown
**Total baixado: 200,2 KB em 4 arquivos.**

- **Parte principal na tela: 4,2 segundos.** Quanto tempo leva até aparecer o maior texto ou imagem da tela.

### Imagem sem descrição

**O que é:** A imagem não tem texto alternativo, o alt. Quem usa leitor de tela não sabe o que ela mostra.
```

### O que é medido

| O quê | Como | De onde vem no JSON |
|-------|------|---------------------|
| Peso por tipo de arquivo | soma dos bytes transferidos por tipo (HTML, CSS, JavaScript, imagens, fontes, outros) | `lighthouse.json`: `audits["network-requests"].details.items[].transferSize` |
| Tempo para aparecer no 3G | primeira coisa na tela e parte principal na tela, em segundos | `audits["first-contentful-paint"]` e `audits["largest-contentful-paint"]`, `numericValue` |
| O que deixa a página lenta | diagnósticos e insights do Lighthouse abaixo de 0,9 | `audits[<id>]` |
| Barreiras de acessibilidade | regras WCAG 2.1 níveis A e AA do axe-core 4.13.0 | `axe.json`: `violations` |

O perfil de 3G é o `mobileRegular3G` do próprio Lighthouse (300 ms de ida e volta, 700 kbit/s, processador 4 vezes mais lento), com a simulação padrão do Lighthouse. Fontes e datas de acesso: [`docs/spikes/3g.md`](docs/spikes/3g.md).

### Como os números são conferidos

`tests/report.test.ts` roda o auditor na página de exemplo, recalcula a partir dos JSON salvos cada número que o relatório pode mostrar (sem usar o código do relatório) e falha se aparecer qualquer outro número. O catálogo não tem algarismos, então nenhum número pode vir dele.

### O catálogo de explicações

`src/explanations.pt.json` tem, para cada regra do axe e cada auditoria de peso do Lighthouse, um título, o que é e o que fazer. `tests/explanations.test.ts` confere que cada frase tem no máximo 25 palavras, que todo problema tem um "o que fazer", que nenhuma palavra técnica aparece sem estar no glossário do relatório e que os ids existem nas versões instaladas. Uma regra fora do catálogo aparece com o texto original da ferramenta e a marca "sem explicação ainda".

### Licença

MIT.

## English

A command-line tool, `auditor <url>`, that measures a page's weight, how long it takes to appear on a phone over 3G, and its accessibility barriers, and writes a plain-Portuguese report saying what to fix.

Every number in the report comes from the JSON files saved beside it (`lighthouse.json` and `axe.json`), and every explanation comes from a catalog written and checked in advance (`src/explanations.pt.json`), never from text generated at run time. A human read of the catalog is still pending.

### Status

First version (M1): runs on your computer only and audits local pages only (`localhost`, `127.0.0.1`, `[::1]`). Auditing a real site needs its owner's consent; that step does not exist yet, so the tool refuses any other address.

### Requirements

- Node 22.19 or newer (Lighthouse 13.5.0 requires it).
- Playwright's Chromium. If it is not installed yet: `npx playwright install chromium`.

### Install and test

```sh
npm install
npm test
```

The tests start a local server with the sample page in `tests/fixtures/site/` and do not use the internet.

### Use

In one terminal, serve the sample page:

```sh
npm run fixture
```

In another, audit it:

```sh
npm run auditor -- http://127.0.0.1:4173/ --out relatorios/exemplo
```

The folder receives `relatorio.md`, `relatorio.html`, `lighthouse.json` and `axe.json`. Without `--out`, the report goes to `relatorios/<address>-<date and time>/`. After `npm run build`, the same command works as `node dist/cli.js <url>`.

### What is measured

| What | How | Where it comes from in the JSON |
|------|-----|---------------------------------|
| Weight by file type | sum of transferred bytes per type (HTML, CSS, JavaScript, images, fonts, other) | `lighthouse.json`: `audits["network-requests"].details.items[].transferSize` |
| Time to appear on 3G | first content and largest content on screen, in seconds | `audits["first-contentful-paint"]` and `audits["largest-contentful-paint"]`, `numericValue` |
| What makes the page slow | Lighthouse diagnostics and insights scoring below 0.9 | `audits[<id>]` |
| Accessibility barriers | axe-core 4.13.0 rules for WCAG 2.1 levels A and AA | `axe.json`: `violations` |

The 3G profile is Lighthouse's own `mobileRegular3G` (300 ms round trip, 700 kbit/s, CPU 4 times slower), with Lighthouse's default simulated throttling. Sources and access dates: [`docs/spikes/3g.md`](docs/spikes/3g.md).

### How the numbers are checked

`tests/report.test.ts` runs the auditor on the sample page, recomputes from the saved JSON every number the report may show (without the report's own code), and fails on any other number. The catalog holds no digits, so no number can come from it.

### The explanation catalog

`src/explanations.pt.json` holds, for each axe rule and each Lighthouse weight audit, a title, what it is and what to do. `tests/explanations.test.ts` checks that every sentence has at most 25 words, that every problem has a what-to-do, that no technical word appears without a glossary entry in the report, and that the ids exist in the installed versions. A rule missing from the catalog is shown with the tool's original text and the mark "sem explicação ainda" (no explanation yet).

### License

MIT.
