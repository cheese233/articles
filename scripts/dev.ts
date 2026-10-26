#!/usr/bin/env node

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import mime from "mime";
import { paths } from "./lib/paths.ts";

const port = Number(process.env.PORT ?? 8788);
const root = paths.root;

const contentType = (file: string) =>
  mime.getType(file) ?? "application/octet-stream";

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
  const type = contentType(file);

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
    response.end("index.html is missing; run `npm run build` first");
    return;
  }

  if (request.method == "HEAD") {
    const info = await stat(file);
    response.writeHead(200, {
      "content-type": contentType(file),
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
  console.log(`dev: http://127.0.0.1:${port}/ (serving repository root)`);
  console.log(`dev: missing files fall back to index.html, like Pages`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
