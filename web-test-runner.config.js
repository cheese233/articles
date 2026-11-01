import { esbuildPlugin } from "@web/dev-server-esbuild";
import { chromeLauncher } from "@web/test-runner-chrome";
import { transform } from "sucrase";
import { compileJsx } from "./shared/jsx.js";
import {
  jsxCheck,
  typescriptCheck,
  vendorCheck,
} from "./tests/node_checks.ts";

const nodeChecks = {
  name: "node-checks",

  async executeCommand({ command }) {
    if (command == "typescript-check") return typescriptCheck();
    if (command == "vendor-check") return vendorCheck();
    if (command == "jsx-check") return jsxCheck();
  },
};

// Mirrors sw.js: `.jsx` module requests are compiled, plain fetches are not.
const isJsxModule = (context) =>
  context.path.endsWith(".jsx") &&
  context.request.headers["sec-fetch-dest"] == "script";

const jsxModules = {
  name: "jsx-modules",

  resolveMimeType(context) {
    if (isJsxModule(context)) return "js";
  },

  transform(context) {
    if (isJsxModule(context)) {
      return { body: compileJsx(transform, String(context.body)) };
    }
  },
};

// The plain fetch and the module import share a URL, and the runner caches
// files for a year; vary on the destination so the import is not served the
// cached JSX source.
const varyJsx = async (context, next) => {
  await next();
  if (context.path.endsWith(".jsx")) context.set("vary", "sec-fetch-dest");
};

export default {
  middleware: [varyJsx],
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
    jsxModules,
    esbuildPlugin({ ts: true, target: "esnext" }),
    nodeChecks,
  ],
  testFramework: {
    config: { timeout: 60000 },
  },
};
