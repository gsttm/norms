import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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

const checksums = files
  .sort()
  .map((file) => `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${basename(file)}`)
  .join("\n");
writeFileSync(join(directory, "SHA256SUMS"), `${checksums}\n`);
for (const name of readdirSync(directory)) {
  if (name.endsWith(".bun-build")) unlinkSync(join(directory, name));
}
console.log(`Built ${files.length} release binaries in dist/release.`);
