import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { serializeStarterPack } from "../packages/core/src/index";

const builds = [
  ["bun-darwin-arm64", "norms-darwin-arm64"],
  ["bun-darwin-x64-baseline", "norms-darwin-x64"],
  ["bun-linux-arm64", "norms-linux-arm64"],
  ["bun-linux-x64-baseline", "norms-linux-x64"],
  ["bun-windows-arm64", "norms-windows-arm64.exe"],
  ["bun-windows-x64-baseline", "norms-windows-x64.exe"],
] as const;

const root = process.cwd();
const directory = join(root, "dist/release");
const extensionDirectory = join(root, "packages/vscode");
const rootVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const extensionVersion = JSON.parse(readFileSync(join(extensionDirectory, "package.json"), "utf8")).version;
if (rootVersion !== extensionVersion) throw new Error("CLI and VS Code extension versions must match.");
rmSync(directory, { recursive: true, force: true });
mkdirSync(directory, { recursive: true });
process.chdir(directory);

const files: string[] = [];
for (const [target, name] of builds) {
  const file = join(directory, name);
  const result = await Bun.build({
    entrypoints: [join(root, "packages/cli/src/index.tsx")],
    compile: { target, outfile: file },
    minify: true,
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${target}.`);
  files.push(file);
}

const starterPack = join(directory, "norms-meta-norms.json");
writeFileSync(starterPack, serializeStarterPack());
files.push(starterPack);

const extensionBuild = await Bun.build({
  entrypoints: [join(extensionDirectory, "src/extension.ts")],
  external: ["vscode"],
  format: "cjs",
  outdir: join(extensionDirectory, "dist"),
  target: "node",
});
if (!extensionBuild.success) throw new AggregateError(extensionBuild.logs, "Failed to build the VS Code extension.");
const vsix = join(directory, "norms-vscode.vsix");
const packageResult = Bun.spawnSync(["bunx", "vsce", "package", "--no-dependencies", "--out", vsix], {
  cwd: extensionDirectory,
  stdout: "inherit",
  stderr: "inherit",
});
if (packageResult.exitCode !== 0) throw new Error("Failed to package the VS Code extension.");
files.push(vsix);

const checksums = files
  .sort()
  .map((file) => `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${basename(file)}`)
  .join("\n");
writeFileSync(join(directory, "SHA256SUMS"), `${checksums}\n`);
for (const name of readdirSync(directory)) {
  if (name.endsWith(".bun-build")) unlinkSync(join(directory, name));
}
console.log(`Built ${files.length} release assets in dist/release.`);
