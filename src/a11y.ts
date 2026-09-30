import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { screenEmulationMetrics, userAgents } from "lighthouse/core/config/constants.js";
import { chromium } from "playwright";

/** axe-core's raw result, typed from the builder so axe-core itself is not a direct dependency. */
export type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;

/** The axe tags for WCAG 2.1 levels A and AA (axe-core's tag names). */
export const WCAG21_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/**
 * Opens the page in Playwright's Chromium with the same phone screen Lighthouse emulates, runs
 * axe-core with the WCAG 2.1 A and AA rules, and returns axe's raw result.
 */
export async function runAxe(url: string): Promise<AxeResults> {
  // The full Chromium in its new headless mode, the same browser Lighthouse drives (src/lighthouse.ts),
  // so users install one browser (`playwright install chromium --no-shell`), not two.
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    const screen = screenEmulationMetrics.mobile!;
    const context = await browser.newContext({
      viewport: { width: screen.width, height: screen.height },
      deviceScaleFactor: screen.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      userAgent: userAgents.mobile,
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "load" });
    if (!response || !response.ok()) throw new Error(`could not load ${url}: HTTP ${response?.status() ?? "no response"}`);
    return await new AxeBuilder({ page }).withTags([...WCAG21_AA_TAGS]).analyze();
  } finally {
    await browser.close();
  }
}

// Entry point for trying it alone: `npx tsx src/a11y.ts <url> [out.json]` saves the raw JSON.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [url, out = "axe.json"] = process.argv.slice(2);
  if (!url || url === "--help") {
    process.stdout.write("Usage: npx tsx src/a11y.ts <url> [out.json]\n");
    process.exit(url ? 0 : 2);
  }
  writeFileSync(out, `${JSON.stringify(await runAxe(url), null, 2)}\n`);
  process.stderr.write(`saved ${out}\n`);
}
