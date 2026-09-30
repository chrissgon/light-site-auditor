/**
 * Serves the fixture site (tests/fixtures/site) on 127.0.0.1 until stopped, for trying the CLI by hand.
 *
 * Usage: npm run fixture -- [--port <n>]   (default port 4173)
 */
import { parseArgs } from "node:util";
import { serveFolder } from "../tests/helpers/static-server.js";

const { values } = parseArgs({ options: { port: { type: "string", default: "4173" }, help: { type: "boolean", default: false } } });
if (values.help) {
  process.stdout.write("Usage: npm run fixture -- [--port <n>]  (default 4173)\n");
  process.exit(0);
}
const server = await serveFolder(undefined, Number(values.port));
process.stdout.write(`${server.url}\n`);
process.stderr.write("serving tests/fixtures/site; Ctrl+C to stop\n");
