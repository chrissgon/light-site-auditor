/**
 * Checks a report folder written by the auditor: every number in relatorio.md comes from
 * lighthouse.json or axe.json (a value or a sum of values), every code span with digits is copied
 * from them, and relatorio.html shows the same numbers. The same checks tests/report.test.ts runs on
 * the fixture, for reports on real sites (docs/field/<site>/).
 *
 * Usage: npm run check-report -- <folder>
 * Prints a summary to stdout; exits 0 when clean, 1 on a problem, 2 on wrong usage.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { reportProblems } from "../tests/helpers/report-numbers.js";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean", default: false } } });
if (values.help || positionals.length !== 1) {
  process.stdout.write("Usage: npm run check-report -- <folder with relatorio.md, relatorio.html, lighthouse.json, axe.json>\n");
  process.exit(values.help ? 0 : 2);
}
const dir = positionals[0]!;
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const problems = reportProblems(read("relatorio.md"), read("relatorio.html"), JSON.parse(read("lighthouse.json")), JSON.parse(read("axe.json")));
process.stdout.write(`${JSON.stringify({ folder: dir, ...problems })}\n`);
const clean = !problems.stray.length && !problems.invented.length && !problems.htmlDiffers;
if (!clean) process.stderr.write("check-report: the report has numbers or code that the raw JSON does not hold (see above)\n");
process.exit(clean ? 0 : 1);
