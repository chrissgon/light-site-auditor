#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { runAxe } from "./a11y.js";
import { checkConsent } from "./consent.js";
import { runLighthouse } from "./lighthouse.js";
import { buildReport } from "./report.js";

const USAGE = `Uso: auditor <url> [--consent <arquivo>] [--out <pasta>]
     auditor --instalar-navegador

Mede o peso da página, o tempo para aparecer num celular com 3G e as barreiras de acessibilidade,
e escreve relatorio.md e relatorio.html em português, com lighthouse.json e axe.json ao lado.

  --consent <arquivo>   registro do consentimento do dono do site (obrigatório para sites reais;
                        páginas deste computador, como localhost, não precisam). Modelo e texto
                        do pedido: docs/field/consentimento.md
  --out <pasta>         onde salvar (padrão: relatorios/<endereço>-<data e hora>)
  --instalar-navegador  baixa, uma vez, o Chromium que o auditor usa (o do Playwright)
  --help                mostra esta ajuda

Códigos de saída: 0 relatório escrito; 1 a auditoria falhou; 2 uso errado ou endereço recusado;
3 falta instalar o navegador.
`;

/** The command that downloads the Chromium build this package's Playwright expects (full browser only). */
export function browserInstallCommand(): { command: string; args: string[] } {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  return { command: process.execPath, args: [cli, "install", "chromium", "--no-shell"] };
}

export interface Output {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultOutput: Output = { stdout: (t) => process.stdout.write(t), stderr: (t) => process.stderr.write(t) };

/** Runs the CLI and returns its exit code. */
export async function main(argv: string[], io: Output = defaultOutput): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: "string" },
        consent: { type: "string" },
        "instalar-navegador": { type: "boolean" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.values.help) {
    io.stdout(USAGE);
    return 0;
  }
  if (parsed.values["instalar-navegador"]) {
    const { command, args } = browserInstallCommand();
    io.stderr(
      `Baixando o Chromium do Playwright (${args.slice(1).join(" ")}).\n` +
        "Se aparecer um aviso em inglês sobre 'npx playwright install', pode ignorar: o auditor já traz a versão certa do Playwright.\n",
    );
    return spawnSync(command, args, { stdio: "inherit" }).status ?? 1;
  }
  const [target] = parsed.positionals;
  if (!target || parsed.positionals.length > 1) {
    io.stderr(USAGE);
    return 2;
  }
  let url: URL;
  try {
    url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http");
  } catch {
    io.stderr(`Endereço inválido: ${target}. Use um endereço completo, como http://localhost:4173/\n`);
    return 2;
  }
  let consentText: string | undefined;
  if (parsed.values.consent !== undefined) {
    try {
      consentText = readFileSync(parsed.values.consent, "utf8");
    } catch {
      io.stderr(`Recusado: não consegui ler o registro de consentimento ${parsed.values.consent}.\n`);
      return 2;
    }
  }
  const consent = checkConsent(url, consentText, new Date().toISOString().slice(0, 10));
  if (!consent.ok) {
    io.stderr(`Recusado: ${consent.reason}\n`);
    return 2;
  }
  if (consent.record) {
    const r = consent.record;
    io.stderr(`Consentimento: ${r.dono}; ${r.status} em ${r.data}; ${r.como}\n`);
  }
  if (!existsSync(chromium.executablePath())) {
    io.stderr(
      "Falta o navegador que o auditor usa (o Chromium do Playwright).\n" +
        "Instale uma vez com: auditor --instalar-navegador\n" +
        "(com npx: npx @chrissgon/light-site-auditor --instalar-navegador)\n",
    );
    return 3;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = resolve(parsed.values.out ?? join("relatorios", `${url.host.replace(/[^\w.-]/g, "_")}-${stamp}`));
  try {
    mkdirSync(out, { recursive: true });
    // One after the other: the Lighthouse simulation starts from a real load, and a second browser
    // running at the same time would slow that load and change the numbers.
    io.stderr(`Lighthouse (3G, celular): ${url.href}\n`);
    const lhr = await runLighthouse(url.href);
    writeFileSync(join(out, "lighthouse.json"), `${JSON.stringify(lhr, null, 2)}\n`);
    io.stderr(`axe (WCAG 2.1 A e AA): ${url.href}\n`);
    const axe = await runAxe(url.href);
    writeFileSync(join(out, "axe.json"), `${JSON.stringify(axe, null, 2)}\n`);
    const report = buildReport(lhr, axe, { lighthouse: "lighthouse.json", axe: "axe.json" });
    writeFileSync(join(out, "relatorio.md"), report.markdown);
    writeFileSync(join(out, "relatorio.html"), report.html);
  } catch (error) {
    io.stderr(`A auditoria falhou: ${(error as Error).message}\n`);
    return 1;
  }
  io.stdout(`${join(out, "relatorio.md")}\n${join(out, "relatorio.html")}\n`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === invoked) process.exitCode = await main(process.argv.slice(2));
