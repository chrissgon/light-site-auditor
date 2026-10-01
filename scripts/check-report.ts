/**
 * Checks a report folder written by the auditor: every number in relatorio.md (Portuguese) and in
 * report.md (English), whichever the folder holds, comes from lighthouse.json or axe.json (a value or
 * a sum of values), every code span with digits is copied from them, and the HTML report of the same
 * language shows the same numbers. The same checks tests/report.test.ts runs on
 * the fixture, for reports on real sites (docs/field/<site>/).
 *
 * Usage: npm run check-report -- <folder>
 * Prints a summary to stdout; exits 0 when clean, 1 on a problem, 2 on wrong usage.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DECIMAL_MARK, LANGUAGES, REPORT_NAME } from "../src/explanations.js";
import { reportProblems } from "../tests/helpers/report-numbers.js";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean", default: false } } });
if (values.help || positionals.length !== 1) {
  process.stdout.write("Usage: npm run check-report -- <folder with relatorio.md and relatorio.html, or report.md and report.html, plus lighthouse.json and axe.json>\n");
  process.exit(values.help ? 0 : 2);
}
const dir = positionals[0]!;
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const languages = LANGUAGES.filter((l) => existsSync(join(dir, `${REPORT_NAME[l]}.md`)));
if (languages.length === 0) {
  process.stderr.write(`check-report: no relatorio.md or report.md in ${dir}\n`);
  process.exit(2);
}
let clean = true;
for (const language of languages) {
  const name = REPORT_NAME[language];
  const problems = reportProblems(read(`${name}.md`), read(`${name}.html`), JSON.parse(read("lighthouse.json")), JSON.parse(read("axe.json")), DECIMAL_MARK[language]);
  process.stdout.write(`${JSON.stringify({ folder: dir, language, ...problems })}\n`);
  if (problems.stray.length || problems.invented.length || problems.htmlDiffers) clean = false;
}
if (!clean) process.stderr.write("check-report: the report has numbers or code that the raw JSON does not hold (see above)\n");
process.exit(clean ? 0 : 1);
