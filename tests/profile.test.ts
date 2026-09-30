import { throttling } from "lighthouse/core/config/constants.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runLighthouse, type LighthouseResult } from "../src/lighthouse.js";
import { REGULAR_3G, THROTTLING_METHOD } from "../src/profile.js";
import { serveFolder, type StaticServer } from "./helpers/static-server.js";

// T-aud-2, AC-1: the 3G profile is Lighthouse's own mobileRegular3G (docs/spikes/3g.md), and a run
// through the Node API records it in the raw JSON.
describe("3G profile", () => {
  it("matches the mobileRegular3G preset of the installed Lighthouse", () => {
    expect(REGULAR_3G).toEqual(throttling.mobileRegular3G);
  });
});

describe("Lighthouse through the Node API on the fixture page", () => {
  let server: StaticServer;
  let lhr: LighthouseResult;
  beforeAll(async () => {
    server = await serveFolder();
    lhr = await runLighthouse(server.url);
  }, 120_000);
  afterAll(() => server?.close());

  it("runs Lighthouse 13.5.0 on a phone with the 3G profile, simulated", () => {
    expect(lhr.lighthouseVersion).toBe("13.5.0");
    expect(lhr.configSettings.formFactor).toBe("mobile");
    expect(lhr.configSettings.throttlingMethod).toBe(THROTTLING_METHOD);
    expect(lhr.configSettings.throttling).toEqual(REGULAR_3G);
  });

  it("measures the load metrics the report uses", () => {
    for (const id of ["first-contentful-paint", "largest-contentful-paint"]) {
      expect(lhr.audits[id]?.numericUnit).toBe("millisecond");
      expect(lhr.audits[id]?.numericValue).toBeGreaterThan(0);
    }
  });
});
