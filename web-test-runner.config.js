import { esbuildPlugin } from "@web/dev-server-esbuild";
import { chromeLauncher } from "@web/test-runner-chrome";
import { typescriptCheck, vendorCheck } from "./tests/node_checks.ts";

const nodeChecks = {
  name: "node-checks",

  async executeCommand({ command }) {
    if (command == "typescript-check") return typescriptCheck();
    if (command == "vendor-check") return vendorCheck();
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
    esbuildPlugin({ ts: true, target: "esnext" }),
    nodeChecks,
  ],
  testFramework: {
    config: { timeout: 60000 },
  },
};
