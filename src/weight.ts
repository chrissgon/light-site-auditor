import type { LighthouseResult } from "./lighthouse.js";

/** The file types the report groups bytes by. */
export const FILE_TYPES = ["html", "css", "js", "image", "font", "other"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface Bytes {
  /** Number of files (network requests) of this type. */
  files: number;
  /** Bytes that crossed the network: the body as sent (compressed if the server compresses) plus headers. */
  transferBytes: number;
  /** Bytes of the body once decoded. */
  resourceBytes: number;
}

export interface Weight {
  byType: Record<FileType, Bytes>;
  total: Bytes;
}

/** Lighthouse's `resourceType` (Chrome's DevTools resource types) to the report's file types. */
const TYPE_OF: Record<string, FileType> = {
  Document: "html",
  Stylesheet: "css",
  Script: "js",
  Image: "image",
  Font: "font",
};

interface NetworkItem {
  resourceType?: string;
  transferSize?: number;
  resourceSize?: number;
}

/** The items of the `network-requests` audit: one per request the page made. */
export function networkItems(lhr: LighthouseResult): NetworkItem[] {
  const details = lhr.audits["network-requests"]?.details as { items?: NetworkItem[] } | undefined;
  if (!details?.items) throw new Error("the Lighthouse result has no network-requests table");
  return details.items;
}

/** Sums the bytes of every request by file type, from Lighthouse's `network-requests` audit. */
export function weightByType(lhr: LighthouseResult): Weight {
  const empty = (): Bytes => ({ files: 0, transferBytes: 0, resourceBytes: 0 });
  const byType = Object.fromEntries(FILE_TYPES.map((type) => [type, empty()])) as Record<FileType, Bytes>;
  const total = empty();
  for (const item of networkItems(lhr)) {
    const type = TYPE_OF[item.resourceType ?? ""] ?? "other";
    for (const bytes of [byType[type], total]) {
      bytes.files += 1;
      bytes.transferBytes += item.transferSize ?? 0;
      bytes.resourceBytes += item.resourceSize ?? 0;
    }
  }
  return { byType, total };
}
