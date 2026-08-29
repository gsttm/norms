import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runGit } from "@norms/git";

const cli = join(dirname(fileURLToPath(import.meta.url)), "../src/index.tsx");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("golden two-repository workflow", () => {
  test("initializes, proposes, syncs, checks, and imports norms", () => {
    const source = repository("source");
    expect(command(source, ["init", "--no-import"])).toMatchObject({ sources: 1, norms: 9 });
    expect(command(source, [
      "propose",
      "--id", "shared.typescript",
      "--scope", "src/**/*.ts",
      "--body", "# TypeScript\n\nUse strict TypeScript.",
    ])).toEqual({
      id: "shared.typescript",
      path: ".norms/norms/shared/typescript.md",
      source: "repository",
    });
    expect(command(source, ["sync"])).toMatchObject({ sources: 1, norms: 10 });
    expect(command(source, ["check"])).toEqual({ valid: true, norms: 10, imports: 0 });
    runGit(source, ["add", "--all"]);
    runGit(source, ["commit", "--quiet", "-m", "Add shared norm"]);
    const commit = runGit(source, ["rev-parse", "HEAD"]);

    const consumer = repository("consumer");
    writeFileSync(join(consumer, "AGENTS.md"), "# Existing instructions\n\nKeep changes focused.\n");
    expect(command(consumer, ["init"])).toMatchObject({ sources: 1, norms: 10 });
    writeFileSync(
      join(consumer, ".norms/config.yaml"),
      `version: 1\nsources:\n  - name: repository\n    path: norms\n  - name: shared\n    git: ${JSON.stringify(source)}\n    ref: HEAD\n    path: .norms/norms\n`,
    );

    expect(command(consumer, ["sync", "--update"])).toMatchObject({
      sources: 2,
      norms: 11,
      updated: true,
      lockfile: { sources: [{ name: "shared", git: source, ref: "HEAD", commit }] },
    });
    expect(command(consumer, ["check"])).toEqual({ valid: true, norms: 11, imports: 1 });

    const typescript = command(consumer, ["context", "src/index.ts"]) as Context;
    expect(typescript.norms.map(({ id }) => id)).toContain("repository.imported-agent-instructions");
    expect(typescript.norms.map(({ id }) => id)).toContain("shared.typescript");
    expect(typescript.norms.find(({ id }) => id === "meta.norms-usage")?.source).toBe("repository, shared");
    const readme = command(consumer, ["context", "README.md"]) as Context;
    expect(readme.norms.map(({ id }) => id)).toContain("repository.imported-agent-instructions");
    expect(readme.norms.map(({ id }) => id)).not.toContain("shared.typescript");
    expect(readFileSync(join(consumer, "AGENTS.md"), "utf8")).toContain("shared.typescript");
  }, 30_000);
});

interface Context {
  norms: Array<{ id: string; source: string }>;
}

function repository(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `norms-${name}-`));
  roots.push(root);
  roots.push(`${root}-cache`);
  runGit(root, ["init", "--quiet"]);
  runGit(root, ["config", "user.name", "Norms Test"]);
  runGit(root, ["config", "user.email", "norms@example.test"]);
  return root;
}

function command(root: string, args: string[]): unknown {
  const result = Bun.spawnSync({
    cmd: [process.execPath, cli, ...args, "--json"],
    cwd: root,
    env: { ...process.env, NO_COLOR: "1", NORMS_CACHE_DIR: `${root}-cache` },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return JSON.parse(result.stdout.toString());
}
