/**
 * The 3G profile every audit uses: Lighthouse's `mobileRegular3G` preset, copied from its source so
 * the numbers are visible here. Source and access date: docs/spikes/3g.md.
 * tests/profile.test.ts fails if the installed Lighthouse ever defines the preset differently.
 */
export const REGULAR_3G = {
  /** Round-trip time between the phone and the server, in milliseconds. */
  rttMs: 300,
  /** Download and upload bandwidth, in kilobits per second. */
  throughputKbps: 700,
  /** The DevTools-throttling equivalents (not used by simulated throttling; kept for completeness). */
  requestLatencyMs: 300 * 3.75,
  downloadThroughputKbps: 700 * 0.9,
  uploadThroughputKbps: 700 * 0.9,
  /** The phone's processor is emulated as this many times slower than the machine running the audit. */
  cpuSlowdownMultiplier: 4,
} as const;

/** Lighthouse's own throttling method by default: a simulation from one unthrottled load. */
export const THROTTLING_METHOD = "simulate" as const;
