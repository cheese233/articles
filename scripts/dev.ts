#!/usr/bin/env node

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import { paths } from "./lib/paths.ts";

const port = Number(process.env.PORT ?? 8788);
const root = paths.dist;

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".ts", "text/typescript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".xml", "text/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".glb", "model/gltf-binary"],
]);

const resolveFile = async (pathname: string) => {
  const target = path.resolve(root, `.${pathname}`);
  if (target != root && !target.startsWith(root + path.sep)) return null;

  try {
    const info = await stat(target);
    if (!info.isFile()) return null;
    return target;
  } catch {
    return null;
  }
};

const send = async (
  response: ServerResponse,
  file: string,
  status = 200,
) => {
  const body = await readFile(file);
  const type = mime.get(path.extname(file).toLowerCase()) ??
    "application/octet-stream";

  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "content-length": body.byteLength,
  });
  response.end(body);
};

const serve = async (request: IncomingMessage, response: ServerResponse) => {
  let pathname: string;

  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("bad request");
    return;
  }

  const file = await resolveFile(pathname) ??
    await resolveFile("/index.html");

  if (!file) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("dist/ is missing; run `npm run build` first");
    return;
  }

  if (request.method == "HEAD") {
    const info = await stat(file);
    response.writeHead(200, {
      "content-type": mime.get(path.extname(file).toLowerCase()) ??
        "application/octet-stream",
      "content-length": info.size,
    });
    response.end();
    return;
  }

  await send(response, file);
};

const server = createServer((request, response) => {
  void serve(request, response).catch((error) => {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("internal error");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dev: http://127.0.0.1:${port}/ (serving dist/)`);
  console.log(`dev: missing files fall back to index.html, like Pages`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
