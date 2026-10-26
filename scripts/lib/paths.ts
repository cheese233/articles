import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);

export const paths = {
  root,
  content: root,
  adapters: path.join(root, "adapters"),
  meta: path.join(root, "meta"),
  render: path.join(root, "render"),
  vendor: path.join(root, "vendor"),
};

export const toPosix = (p: string) => p.split(path.sep).join("/");

export const relative = (p: string) => toPosix(path.relative(root, p));

export const encodePath = (p: string) =>
  p.split("/").map((part) => encodeURIComponent(part)).join("/");
