# light-site-auditor

[Português](#português) · [English](#english)

## Português

Uma ferramenta de linha de comando, `auditor <url>`, que mede o peso da página inicial de um site, o tempo que ela leva para aparecer num celular com conexão 3G e as barreiras de acessibilidade, e escreve um relatório em português simples com o que corrigir.

Cada número do relatório vem dos arquivos JSON salvos ao lado dele (`lighthouse.json` e `axe.json`), e cada explicação vem de um catálogo escrito e conferido de antemão (`src/explanations.pt.json`), nunca de texto gerado na hora. A leitura do catálogo por uma pessoa ainda está pendente.

### Regra do consentimento

O auditor só verifica um site real se o dono aceitou. Sem um registro de consentimento aceito para o endereço exato, ele recusa e sai com o código 2. Páginas deste computador (`localhost`, `127.0.0.1`, `[::1]`) não precisam de registro. Não existe opção para pular essa verificação.

1. Peça o aceite ao dono com o texto de [`docs/field/consentimento.md`](docs/field/consentimento.md). Ele diz o que a verificação faz (abre a página inicial pública duas vezes, como um visitante, e mede com o Lighthouse e o axe no seu computador), o que não faz (não entra com login, não usa formulários, não abre outras páginas) e que o relatório fica só com o dono, a menos que ele concorde com outro uso.
2. Registre o aceite num arquivo que comece assim:

   ```markdown
   ---
   endereco: https://www.exemplo.com.br/
   dono: Nome de quem aceitou
   status: aceito
   data: 2026-09-30
   como: por e-mail, respondendo ao pedido de consentimento
   reacao: pendente
   ---
   ```

3. Rode com `--consent <arquivo>`. Um registro com `status: pendente`, outro endereço, um campo faltando ou uma data futura é recusado.

### Instalar e usar

Precisa do Node 22.19 ou mais novo (o Lighthouse 13.5.0 exige isso).

Uma vez, baixe o navegador que o auditor usa (o Chromium do Playwright):

```sh
npx @chrissgon/light-site-auditor --instalar-navegador
```

Depois, audite:

```sh
npx @chrissgon/light-site-auditor https://www.exemplo.com.br/ --consent consentimento.md --out relatorio-exemplo
```

Ou instale o comando `auditor` de vez: `npm install -g @chrissgon/light-site-auditor`, e então `auditor --instalar-navegador` e `auditor <url> --consent <arquivo>`.

O que é baixado (medido em 2026-09-30, num Mac com processador Apple, com cache vazio):

| O quê | Tamanho | Quando |
|-------|---------|--------|
| O pacote `@chrissgon/light-site-auditor` | cerca de 23 kB | no primeiro `npx` |
| As dependências (Lighthouse, Playwright, axe e o que elas usam) | cerca de 148 MB baixados, 185 MB instalados | no primeiro `npx` |
| O Chromium do Playwright (Chrome for Testing 153.0.8010.12) | cerca de 191 MB baixados no Mac com processador Apple, 196 MB no Linux e 205 MB no Windows; 369 MB instalado no Mac | uma vez, com `--instalar-navegador` |
| O FFmpeg do Playwright | cerca de 1 MB | junto com o Chromium |

O navegador fica na pasta de navegadores do Playwright (no Mac, `~/Library/Caches/ms-playwright`) e serve para as próximas auditorias. No Linux, o Chromium pode pedir bibliotecas do sistema: `sudo npx playwright@1.63.0 install-deps chromium`. Se o navegador faltar, o auditor avisa e sai com o código 3.

### O que o relatório traz

A pasta do relatório recebe `relatorio.md`, `relatorio.html`, `lighthouse.json` e `axe.json`. Sem `--out`, ela é `relatorios/<endereço>-<data e hora>/`.

| Parte | O que mostra | De onde vem no JSON |
|-------|--------------|---------------------|
| Peso da página | total baixado e peso por tipo de arquivo (HTML, CSS, JavaScript, imagens, fontes, outros) | `lighthouse.json`: `audits["network-requests"].details.items[].transferSize` |
| Tempo no 3G | primeira coisa na tela e parte principal na tela, em segundos | `audits["first-contentful-paint"]` e `audits["largest-contentful-paint"]`, `numericValue` |
| O que deixa a página lenta | diagnósticos e insights do Lighthouse abaixo de 0,9, cada um com o que é e o que fazer | `audits[<id>]` |
| Barreiras de acessibilidade | regras WCAG 2.1 níveis A e AA do axe-core 4.13.0, com os trechos da página | `axe.json`: `violations` |
| Palavras usadas | glossário dos termos técnicos do relatório | catálogo |

O perfil de 3G é o `mobileRegular3G` do próprio Lighthouse (300 ms de ida e volta, 700 kbit/s, processador 4 vezes mais lento), com a simulação padrão do Lighthouse. Fontes e datas de acesso: [`docs/spikes/3g.md`](docs/spikes/3g.md).

Trecho do relatório da página de exemplo:

```markdown
**Total baixado: 200,2 KB em 4 arquivos.**

- **Parte principal na tela: 4,2 segundos.** Quanto tempo leva até aparecer o maior texto ou imagem da tela.

### Imagem sem descrição

**O que é:** A imagem não tem texto alternativo, o alt. Quem usa leitor de tela não sabe o que ela mostra.
```

### Desenvolver

```sh
npm ci
npx playwright install --no-shell chromium
npm test
npm run build
```

Os testes sobem um servidor local com a página de exemplo de `tests/fixtures/site/` e não usam a internet. Para testar à mão: `npm run fixture` num terminal e `npm run auditor -- http://127.0.0.1:4173/ --out relatorios/exemplo` em outro. `npm run check-report -- <pasta>` confere se todo número de um relatório já escrito vem dos JSON da pasta.

### Como os números são conferidos

`tests/report.test.ts` roda o auditor na página de exemplo, recalcula a partir dos JSON salvos cada número que o relatório pode mostrar (sem usar o código do relatório) e falha se aparecer qualquer outro número. O catálogo não tem algarismos, então nenhum número pode vir dele.

### O catálogo de explicações

`src/explanations.pt.json` tem, para cada regra do axe e cada auditoria de peso do Lighthouse, um título, o que é e o que fazer. `tests/explanations.test.ts` confere que cada frase tem no máximo 25 palavras, que todo problema tem um "o que fazer", que nenhuma palavra técnica aparece sem estar no glossário do relatório e que os ids existem nas versões instaladas. Uma regra fora do catálogo aparece com o texto original da ferramenta e a marca "sem explicação ainda".

### Licença

MIT.

## English

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
