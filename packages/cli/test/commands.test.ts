import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGit } from "@norms/git";
import { loadNorms, readLockfile, serializeNorm, serializeStarterPack } from "@norms/core";
import { checkProject, initProject, proposeNorm, syncProject } from "../src/commands";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("CLI commands", () => {
  test("init imports existing agent instructions", () => {
    const root = fixture();
    writeFileSync(join(root, "AGENTS.md"), "# Existing\n\nKeep this rule.\n");
    const result = initProject(root, true, cache(root));
    expect(result.summary).toBe("Norms initialized.");
    expect((result.data as { seeded: string[] }).seeded).toHaveLength(9);
    expect(existsSync(cache(root))).toBe(true);
    expect(existsSync(join(root, ".norms/norms/repository/imported-agent-instructions.md"))).toBe(true);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toContain("Keep this rule.");
  });

  test("init uses the cached starter pack without overwriting norms", () => {
    const root = fixture();
    const cacheFile = cache(root);
    mkdirSync(join(root, ".cache"));
    writeFileSync(cacheFile, serializeStarterPack({
      version: 1,
      norms: [{ path: "meta/custom.md", content: serializeNorm("meta.custom", ["**/*"], "Use the cache.") }],
    }));
    expect((initProject(root, false, cacheFile).data as { seeded: string[] }).seeded).toHaveLength(1);
    const target = join(root, ".norms/norms/meta/custom.md");
    writeFileSync(target, serializeNorm("meta.custom", ["**/*"], "Keep the project copy."));
    expect((initProject(root, false, cacheFile).data as { seeded: string[] }).seeded).toHaveLength(0);
    expect(readFileSync(target, "utf8")).toContain("Keep the project copy.");
  });

  test("propose, sync, and check form an end-to-end loop", () => {
    const root = fixture();
    initProject(root, false, cache(root));
    proposeNorm(root, { id: "backend.repositories", scopes: ["src/controllers/**"], body: "Use repositories." });
    syncProject(root);
    expect(checkProject(root).data).toEqual({ valid: true, norms: 10, imports: 0 });
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toContain("backend.repositories");
  });

  test("sync composes and pins a Git source", () => {
    const root = fixture();
    const shared = fixture();
    mkdirSync(join(shared, ".norms/norms"), { recursive: true });
    writeFileSync(
      join(shared, ".norms/norms/shared.md"),
      serializeNorm("shared.typescript", ["**/*.ts"], "Use TypeScript."),
    );
    runGit(shared, ["config", "user.name", "Norms Test"]);
    runGit(shared, ["config", "user.email", "norms@example.test"]);
    runGit(shared, ["add", ".norms/norms/shared.md"]);
    runGit(shared, ["commit", "--quiet", "-m", "Add shared norm"]);

    mkdirSync(join(root, ".norms/norms"), { recursive: true });
    writeFileSync(
      join(root, ".norms/config.yaml"),
      `version: 1\nsources:\n  - name: repository\n    path: norms\n  - name: shared\n    git: ${JSON.stringify(shared)}\n    ref: HEAD\n    path: .norms/norms\n`,
    );
    syncProject(root, true);

    expect(loadNorms(root).map(({ id }) => id)).toEqual(["shared.typescript"]);
    expect(readLockfile(root).sources[0]?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(checkProject(root).data).toEqual({ valid: true, norms: 1, imports: 1 });
  });

  test("sync preserves pins offline, migrates locks, updates explicitly, and recovers", () => {
    const root = fixture();
    const shared = fixture();
    const normPath = join(shared, ".norms/norms/shared.md");
    mkdirSync(join(shared, ".norms/norms"), { recursive: true });
    writeFileSync(normPath, serializeNorm("shared.typescript", ["**/*.ts"], "Use TypeScript."));
    commit(shared, "Add shared norm");
    const first = runGit(shared, ["rev-parse", "HEAD"]);

    initProject(root, false, cache(root));
    writeFileSync(
      join(root, ".norms/config.yaml"),
      `version: 1\nsources:\n  - name: repository\n    path: norms\n  - name: shared\n    git: ${JSON.stringify(shared)}\n    ref: HEAD\n    path: .norms/norms\n`,
    );
    syncProject(root, true);

    writeFileSync(normPath, serializeNorm("shared.typescript", ["**/*.ts"], "Use strict TypeScript."));
    commit(shared, "Tighten shared norm");
    const second = runGit(shared, ["rev-parse", "HEAD"]);
    const unavailable = `${shared}-offline`;
    renameSync(shared, unavailable);
    syncProject(root);
    expect(readLockfile(root).sources[0]?.commit).toBe(first);
    renameSync(unavailable, shared);
    rmSync(join(root, ".norms/imports/shared"), { recursive: true });
    syncProject(root);
    expect(imported(root, "shared")).toBe(first);

    syncProject(root, true);
    expect(readLockfile(root).sources[0]?.commit).toBe(second);
    const adapter = readFileSync(join(root, "AGENTS.md"), "utf8");
    writeFileSync(join(root, ".norms/lock.json"), `${JSON.stringify({ version: 1, sources: readLockfile(root).sources }, null, 2)}\n`);
    expect(syncProject(root).data).toMatchObject({ lockfile: { version: 2 } });

    const config = readFileSync(join(root, ".norms/config.yaml"), "utf8");
    writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: norms\n");
    expect(() => syncProject(root)).toThrow("Source shared was removed from config");
    expect(readLockfile(root).sources[0]?.commit).toBe(second);
    writeFileSync(join(root, ".norms/config.yaml"), config);

    writeFileSync(normPath, "invalid norm\n");
    commit(shared, "Break shared norm");
    expect(() => syncProject(root, true)).toThrow("previous imports and generated files were restored");
    expect(imported(root, "shared")).toBe(second);
    expect(readLockfile(root).sources[0]?.commit).toBe(second);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(adapter);
  });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "norms-cli-"));
  roots.push(root);
  runGit(root, ["init", "--quiet"]);
  return root;
}

function commit(root: string, message: string): void {
  runGit(root, ["config", "user.name", "Norms Test"]);
  runGit(root, ["config", "user.email", "norms@example.test"]);
  runGit(root, ["add", "--all"]);
  runGit(root, ["commit", "--quiet", "-m", message]);
}

function imported(root: string, source: string): string {
  return runGit(join(root, ".norms/imports", source), ["rev-parse", "HEAD"]);
}

function cache(root: string): string {
  return join(root, ".cache/meta-norms.json");
}
