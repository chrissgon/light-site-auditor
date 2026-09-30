import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// T-aud-1: the pinned versions the backlog names are the ones installed.
const installed = (name: string) =>
  (JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8")) as { version: string }).version;

describe("pinned dependencies", () => {
  it.each([
    ["lighthouse", "13.5.0"],
    ["@axe-core/playwright", "4.13.0"],
    ["playwright", "1.63.0"],
  ])("%s is installed at %s", (name, version) => {
    expect(installed(name)).toBe(version);
  });

  it("package.json pins every dependency to an exact version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<string, Record<string, string>>;
    const ranges = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v));
    expect(ranges).toEqual([]);
  });
});
