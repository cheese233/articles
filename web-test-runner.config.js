import { esbuildPlugin } from "@web/dev-server-esbuild";
import { chromeLauncher } from "@web/test-runner-chrome";
import { transform } from "sucrase";
import {
  jsxCheck,
  typescriptCheck,
  vendorCheck,
} from "./tests/node_checks.ts";

const nodeChecks = {
  name: "node-checks",

  async executeCommand({ command, payload }) {
    if (command == "typescript-check") return typescriptCheck();
    if (command == "vendor-check") return vendorCheck();
    if (command == "jsx-check") return jsxCheck();
    if (command == "sucrase-transform") {
      return transform(payload.source, payload.options);
    }
  },
};

// Sucrase is CommonJS-heavy and the site serves it from vendor/, which the
// runner does not build. Tests import a stub that runs the real transform
// in Node, so render/lib/jsx_loader.ts is exercised unchanged.
const sucraseStub = `
import { executeServerCommand } from "@web/test-runner-commands";
const results = new Map();
export const prepare = async (source, options) => {
  const result = await executeServerCommand("sucrase-transform", {
    source,
    options,
  });
  results.set(source, result);
};
export const transform = (source) => {
  const result = results.get(source);
  if (!result) throw new Error("sucrase stub: call prepare() first");
  return result;
};
`;

const sucraseModule = {
  name: "sucrase-module",

  resolveImport({ source }) {
    if (source == "sucrase") return "/__sucrase.js";
  },

  serve(context) {
    if (context.path == "/__sucrase.js") {
      return { body: sucraseStub, type: "js" };
    }
  },
};

export default {
  files: ["tests/**/*.test.ts"],
  nodeResolve: true,
  browsers: [
    chromeLauncher({
      launchOptions: {
        executablePath: process.env.CHROME_PATH,
        args: ["--no-sandbox", "--disable-gpu"],
      },
    }),
  ],
  plugins: [
    sucraseModule,
    esbuildPlugin({ ts: true, target: "esnext" }),
    nodeChecks,
  ],
  testFramework: {
    config: { timeout: 60000 },
  },
};
