/**
 * Writes tests/fixtures/site/foto.png: a 256x256 RGB PNG of seeded noise. Noise does not compress,
 * so the image is heavy on purpose, and the page shows it at 150x150, so it is also oversized.
 * Deterministic: the same seed always writes the same bytes.
 *
 * Usage: npx tsx scripts/make-fixture-image.ts [--out <file>] [--size <pixels>]
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "tests/fixtures/site/foto.png" },
    size: { type: "string", default: "256" },
    help: { type: "boolean", default: false },
  },
});
if (values.help) {
  process.stdout.write("Usage: npx tsx scripts/make-fixture-image.ts [--out <file>] [--size <pixels>]\n");
  process.exit(0);
}

const size = Number(values.size);
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

let seed = 20260930;
const next = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed >>> 24;
};
const rows: Buffer[] = [];
for (let y = 0; y < size; y++) {
  const row = Buffer.alloc(1 + size * 3);
  for (let i = 1; i < row.length; i++) row[i] = next();
  rows.push(row);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8; // bit depth
header[9] = 2; // colour type: RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(values.out, png);
process.stderr.write(`wrote ${values.out} (${png.length} bytes)\n`);
