import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { browserInstallCommand, main } from "../src/cli.js";
import { checkConsent, parseConsent } from "../src/consent.js";
import { existsSync } from "node:fs";

// T-aud-7: a real site is audited only with an accepted consent record for its exact address.
// Nothing here loads a real site: every refusal happens before a browser starts.

const TODAY = "2026-09-30";
const record = (fields: Record<string, string>) =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n---\n\nTexto livre.\n`;
const ACCEPTED = {
  endereco: "https://example.com/",
  dono: "Dona do site",
  status: "aceito",
  data: "2026-09-29",
  como: "por e-mail, respondendo ao pedido",
  reacao: "pendente",
};
const site = new URL("https://example.com/");

describe("checkConsent", () => {
  it("lets pages on this computer through without a record", () => {
    for (const url of ["http://localhost:4173/", "http://127.0.0.1/", "http://[::1]:8080/"]) {
      expect(checkConsent(new URL(url), undefined, TODAY)).toEqual({ ok: true });
    }
  });

  it("refuses a real site without a record, and says how to get consent", () => {
    const result = checkConsent(site, undefined, TODAY);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/consentimento do dono[\s\S]*docs\/field\/consentimento\.md[\s\S]*--consent/);
  });

  it("accepts a record with status aceito for the exact address", () => {
    const result = checkConsent(site, record(ACCEPTED), TODAY);
    expect(result).toEqual({ ok: true, record: ACCEPTED });
    expect(checkConsent(new URL("https://EXAMPLE.com"), record(ACCEPTED), TODAY).ok).toBe(true);
  });

  it("refuses a pending record", () => {
    const result = checkConsent(site, record({ ...ACCEPTED, status: "pendente: aguardando o aceite do dono", data: "-" }), TODAY);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/pendente/);
  });

  it.each([["recusado"], ["Aceito"], ["aceito?"], ["sim"]])("refuses any status other than aceito: %s", (status) => {
    expect(checkConsent(site, record({ ...ACCEPTED, status }), TODAY).ok).toBe(false);
  });

  it("refuses another page or another host than the one accepted", () => {
    for (const url of ["https://example.com/contato", "https://www.example.com/", "http://example.com/", "https://example.org/"]) {
      const result = checkConsent(new URL(url), record(ACCEPTED), TODAY);
      expect(result.ok, url).toBe(false);
    }
  });

  it("refuses a record with a missing field, a bad date or a date in the future", () => {
    for (const key of ["endereco", "dono", "status", "data", "como"] as const) {
      const { [key]: _, ...rest } = ACCEPTED;
      expect(checkConsent(site, record(rest), TODAY).ok, key).toBe(false);
    }
    expect(checkConsent(site, record({ ...ACCEPTED, data: "30/09/2026" }), TODAY).ok).toBe(false);
    expect(checkConsent(site, record({ ...ACCEPTED, data: "2026-10-01" }), TODAY).ok).toBe(false);
  });

  it("refuses a file without front matter", () => {
    expect(parseConsent("endereco: https://example.com/\n")).toHaveProperty("error");
    expect(checkConsent(site, "# Consentimento\n\nstatus: aceito\n", TODAY).ok).toBe(false);
  });
});

describe("auditor --consent", () => {
  const dir = mkdtempSync(join(tmpdir(), "consent-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = async (args: string[]) => {
    let err = "";
    const code = await main(args, { stdout: () => {}, stderr: (s) => (err += s) });
    return { code, err };
  };

  it("exits 2 on a pending record and writes nothing", async () => {
    const file = join(dir, "pendente.md");
    const out = join(dir, "out");
    writeFileSync(file, record({ ...ACCEPTED, status: "pendente: aguardando o aceite do dono", data: "-" }));
    const { code, err } = await run(["https://example.com/", "--consent", file, "--out", out]);
    expect(code).toBe(2);
    expect(err).toMatch(/pendente/);
    expect(existsSync(out)).toBe(false);
  });

  it("exits 2 when the record file cannot be read", async () => {
    const { code, err } = await run(["https://example.com/", "--consent", join(dir, "nao-existe.md")]);
    expect(code).toBe(2);
    expect(err).toMatch(/registro de consentimento/);
  });

  it("exits 2 when the record names another address", async () => {
    const file = join(dir, "outro.md");
    writeFileSync(file, record({ ...ACCEPTED, endereco: "https://example.org/" }));
    const { code } = await run(["https://example.com/", "--consent", file]);
    expect(code).toBe(2);
  });
});

describe("auditor --instalar-navegador", () => {
  it("runs this package's own Playwright CLI for the full Chromium only", () => {
    const { command, args } = browserInstallCommand();
    expect(command).toBe(process.execPath);
    expect(existsSync(args[0]!)).toBe(true);
    expect(args.slice(1)).toEqual(["install", "chromium", "--no-shell"]);
  });
});
