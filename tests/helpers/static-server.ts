import { createReadStream, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The fixture site the tests and `npm run fixture` serve. */
export const FIXTURE_SITE = resolve(fileURLToPath(new URL("../fixtures/site", import.meta.url)));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

/**
 * Serves a folder on 127.0.0.1 without compression, so each response body has exactly the bytes of
 * the file on disk. Only GET and HEAD; paths outside the folder answer 404.
 */
export function serveFolder(root: string = FIXTURE_SITE, port = 0): Promise<StaticServer> {
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = normalize(join(root, path.endsWith("/") ? `${path}index.html` : path));
    let size = -1;
    try {
      if (file.startsWith(root + sep)) size = statSync(file).isFile() ? statSync(file).size : -1;
    } catch {
      size = -1;
    }
    if ((req.method !== "GET" && req.method !== "HEAD") || size < 0) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "content-length": String(size),
      "cache-control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actual = typeof address === "object" && address ? address.port : port;
      ok({
        url: `http://127.0.0.1:${actual}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
