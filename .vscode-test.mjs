import { defineConfig } from "@vscode/test-cli";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const fixtures = join(root, ".vscode-test/fixtures");
const workspace = join(fixtures, "multi-root.code-workspace");

rmSync(fixtures, { recursive: true, force: true });
for (const name of ["initialized", "uninitialized", "invalid"]) {
  mkdirSync(join(fixtures, name, ".git"), { recursive: true });
}
mkdirSync(join(fixtures, "initialized/.norms/norms"), { recursive: true });
writeFileSync(join(fixtures, "initialized/.norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: norms\n");
writeFileSync(join(fixtures, "initialized/.norms/norms/docs.md"), norm("docs.short", "**/*.md", "Keep docs short."));
writeFileSync(join(fixtures, "initialized/.norms/norms/style.md"), norm("style.small", "**/*", "Keep changes small."));
mkdirSync(join(fixtures, "invalid/.norms/norms"), { recursive: true });
writeFileSync(join(fixtures, "invalid/.norms/config.yaml"), "version: 99\nsources: []\n");
writeFileSync(workspace, `${JSON.stringify({
  folders: ["initialized", "uninitialized", "invalid"].map((path) => ({ path })),
}, null, 2)}\n`);

export default defineConfig({
  files: "packages/vscode/dist/test/**/*.integration.js",
  extensionDevelopmentPath: "packages/vscode",
  workspaceFolder: workspace,
  launchArgs: [
    "--disable-extensions",
    "--disable-workspace-trust",
    `--user-data-dir=${join(fixtures, "user-data")}`,
  ],
  mocha: { timeout: 30000 },
});

function norm(id, scope, body) {
  return `---\nid: ${id}\napplies_to:\n  - ${JSON.stringify(scope)}\n---\n\n${body}\n`;
}
