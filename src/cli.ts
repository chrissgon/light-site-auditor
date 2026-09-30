#!/usr/bin/env node
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { runAxe } from "./a11y.js";
import { runLighthouse } from "./lighthouse.js";
import { buildReport } from "./report.js";

const USAGE = `Uso: auditor <url> [--out <pasta>]

Mede o peso da página, o tempo para aparecer num celular com 3G e as barreiras de acessibilidade,
e escreve relatorio.md e relatorio.html em português, com lighthouse.json e axe.json ao lado.

  --out <pasta>  onde salvar (padrão: relatorios/<endereço>-<data e hora>)
  --help         mostra esta ajuda

Códigos de saída: 0 relatório escrito; 1 a auditoria falhou; 2 uso errado ou endereço recusado.
`;

/** Hosts on this computer. Anything else is a real site, which needs its owner's consent (T-aud-7). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface Output {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultOutput: Output = { stdout: (t) => process.stdout.write(t), stderr: (t) => process.stderr.write(t) };

/** Runs the CLI and returns its exit code. */
export async function main(argv: string[], io: Output = defaultOutput): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: { out: { type: "string" }, help: { type: "boolean" } } });
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.values.help) {
    io.stdout(USAGE);
    return 0;
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
  if (!LOCAL_HOSTS.has(url.hostname)) {
    io.stderr(
      `Recusado: ${url.hostname} não é uma página deste computador.\n` +
        "Por enquanto o auditor só verifica páginas locais (localhost, 127.0.0.1). " +
        "Auditar um site real exige o consentimento do dono, e esse passo ainda não existe.\n",
    );
    return 2;
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
