/**
 * The consent gate (T-aud-7): a real site is audited only when a consent record says its owner
 * accepted. The record is a Markdown file whose front matter holds the fields below; the text that
 * asks for consent is docs/field/consentimento.md. There is no bypass: without an accepted record
 * that names the exact address, the CLI refuses.
 *
 * ---
 * endereco: https://example.com/
 * dono: Nome do dono
 * status: aceito
 * data: 2026-09-30
 * como: por e-mail, respondendo ao pedido de consentimento
 * reacao: pendente
 * ---
 */

/** Hosts on this computer. They need no consent: they are the user's own pages. */
export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const ACCEPTED = "aceito";

export interface ConsentRecord {
  endereco: string;
  dono: string;
  status: string;
  data: string;
  como: string;
  [field: string]: string;
}

export type ConsentCheck = { ok: true; record?: ConsentRecord } | { ok: false; reason: string };

const REQUIRED = ["endereco", "dono", "status", "data", "como"] as const;

/** Reads the front matter (`key: value` lines between two `---` lines at the top of the file). */
export function parseConsent(text: string): ConsentRecord | { error: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { error: "o arquivo não começa com um bloco entre linhas ---" };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { error: "o bloco do registro não fecha com uma linha ---" };
  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) return { error: `linha sem "campo: valor": ${line}` };
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  const missing = REQUIRED.filter((key) => !fields[key]);
  if (missing.length) return { error: `faltam os campos ${missing.join(", ")}` };
  return fields as ConsentRecord;
}

/** Normalises an address so `https://Site.com` and `https://site.com/` compare equal. */
function normalise(address: string): string | undefined {
  try {
    return new URL(address).href;
  } catch {
    return undefined;
  }
}

/**
 * Decides whether `url` may be audited. `recordText` is the consent file's content (undefined when
 * no file was given); `today` is YYYY-MM-DD.
 */
export function checkConsent(url: URL, recordText: string | undefined, today: string): ConsentCheck {
  if (LOCAL_HOSTS.has(url.hostname)) return { ok: true };
  if (recordText === undefined) {
    return {
      ok: false,
      reason:
        `${url.hostname} é um site real. Auditar um site exige o consentimento do dono.\n` +
        "Peça o aceite com o texto de docs/field/consentimento.md (no pacote e em " +
        "https://github.com/chrissgon/light-site-auditor/blob/main/docs/field/consentimento.md), " +
        "registre-o num arquivo e rode de novo com --consent <arquivo>.",
    };
  }
  const record = parseConsent(recordText);
  if ("error" in record) return { ok: false, reason: `O registro de consentimento não pôde ser lido: ${record.error}.` };
  const expected = normalise(record.endereco);
  if (!expected) return { ok: false, reason: `O endereço do registro não é válido: ${record.endereco}.` };
  if (expected !== url.href) {
    return {
      ok: false,
      reason: `O consentimento cobre ${expected}, não ${url.href}. Audite exatamente o endereço aceito pelo dono.`,
    };
  }
  if (record.status !== ACCEPTED) {
    const pending = record.status.startsWith("pendente");
    return {
      ok: false,
      reason: pending
        ? `O consentimento de ${expected} está pendente (${record.status}). Registre o aceite do dono (status: aceito, data e como) antes de auditar.`
        : `O consentimento de ${expected} não está aceito (status: ${record.status}). Só "status: aceito" libera a auditoria.`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.data) || Number.isNaN(Date.parse(record.data))) {
    return { ok: false, reason: `A data do consentimento não está no formato AAAA-MM-DD: ${record.data}.` };
  }
  if (record.data > today) return { ok: false, reason: `A data do consentimento (${record.data}) é futura.` };
  return { ok: true, record };
}
