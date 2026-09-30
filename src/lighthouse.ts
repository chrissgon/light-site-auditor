import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import type { Result as LighthouseResult } from "lighthouse";
import { chromium } from "playwright";
import { REGULAR_3G, THROTTLING_METHOD } from "./profile.js";

export type { LighthouseResult };

/**
 * Runs Lighthouse 13.5.0 through its Node API on one URL, mobile, with the 3G profile, and returns
 * the raw result (the `lhr`). Only the performance category runs: it carries the network requests
 * (weight) and the load metrics; accessibility comes from axe (src/a11y.ts).
 */
export async function runLighthouse(url: string): Promise<LighthouseResult> {
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance"],
      formFactor: "mobile",
      throttlingMethod: THROTTLING_METHOD,
      throttling: { ...REGULAR_3G },
    });
    if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
    if (result.lhr.runtimeError) throw new Error(`Lighthouse could not load ${url}: ${result.lhr.runtimeError.message}`);
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

// Spike entry point (T-aud-2): `npx tsx src/lighthouse.ts <url> [out.json]` saves the raw JSON.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [url, out = "lighthouse.json"] = process.argv.slice(2);
  if (!url || url === "--help") {
    process.stdout.write("Usage: npx tsx src/lighthouse.ts <url> [out.json]\n");
    process.exit(url ? 0 : 2);
  }
  const lhr = await runLighthouse(url);
  writeFileSync(out, `${JSON.stringify(lhr, null, 2)}\n`);
  process.stderr.write(`saved ${out}\n`);
}
