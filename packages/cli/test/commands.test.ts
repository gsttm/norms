import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGit } from "@norms/git";
import { loadNorms, readLockfile, serializeNorm, serializeStarterPack, STARTER_PACK } from "@norms/core";
import { checkProject, explainProject, initProject, lintProject, proposeNorm, syncProject } from "../src/commands";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("CLI commands", () => {
  test("init imports existing adapter instructions", () => {
    const root = fixture();
    mkdirSync(join(root, ".cursor/rules"), { recursive: true });
    mkdirSync(join(root, ".github"), { recursive: true });
    writeFileSync(join(root, "AGENTS.md"), "# Existing\n\nKeep this rule.\n");
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nKeep Claude's rule.\n");
    writeFileSync(join(root, ".cursor/rules/norms.mdc"), "# Cursor\n\nKeep Cursor's rule.\n");
    writeFileSync(join(root, ".github/copilot-instructions.md"), "# Copilot\n\nKeep Copilot's rule.\n");
    const result = initProject(root, true, cache(root));
    expect(result.summary).toBe("Norms initialized.");
    expect((result.data as { seeded: string[] }).seeded).toHaveLength(STARTER_PACK.norms.length);
    expect((result.data as { created: string[] }).created).toContain(".norms/config.yaml");
    expect(result.details).toContain("created .norms/");
    expect(result.details).not.toContain("created .norms/config.yaml");
    expect(result.details).toContain("imported existing AGENTS.md, CLAUDE.md, .cursor/rules/norms.mdc, .github/copilot-instructions.md");
    expect(existsSync(cache(root))).toBe(true);
    expect(existsSync(join(root, ".norms/norms/repository/imported-agent-instructions.md"))).toBe(true);
    expect(existsSync(join(root, ".norms/norms/repository/imported-claude-instructions.md"))).toBe(true);
    expect(existsSync(join(root, ".norms/norms/repository/imported-cursor-instructions.md"))).toBe(true);
    expect(existsSync(join(root, ".norms/norms/repository/imported-copilot-instructions.md"))).toBe(true);
    for (const path of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/norms.mdc", ".github/copilot-instructions.md"]) {
      const content = readFileSync(join(root, path), "utf8");
      expect(content).toContain("Keep this rule.");
      expect(content).toContain("Keep Claude's rule.");
      expect(content).toContain("Keep Cursor's rule.");
      expect(content).toContain("Keep Copilot's rule.");
    }
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
    expect(checkProject(root).data).toEqual({ valid: true, norms: STARTER_PACK.norms.length + 1, imports: 0 });
    for (const path of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/norms.mdc", ".github/copilot-instructions.md"]) {
      expect(readFileSync(join(root, path), "utf8")).toContain("backend.repositories");
    }
  });

  test("proposes to a selected writable source", () => {
    const root = fixture();
    mkdirSync(join(root, ".norms/repository"), { recursive: true });
    mkdirSync(join(root, ".norms/team"));
    writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: repository\n  - name: team\n    path: team\n");

    const result = proposeNorm(root, { id: "team.selected", scopes: ["**/*"], body: "Use the selected source.", source: "team" });
    expect(result.data).toEqual({ id: "team.selected", path: ".norms/team/team/selected.md", source: "team" });
    expect(existsSync(join(root, result.data.path))).toBe(true);
    expect(() => proposeNorm(root, { id: "team.missing", scopes: ["**/*"], body: "Missing.", source: "missing" })).toThrow("Writable source missing is not configured");
  });

  test("sync protects existing adapters and check detects stale generated adapters", () => {
    const root = fixture();
    initProject(root, false, cache(root));
    writeFileSync(join(root, "CLAUDE.md"), "# Handwritten\n");
    expect(() => syncProject(root)).toThrow("CLAUDE.md is not generated by Norms");
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("# Handwritten\n");

    initProject(root, true, cache(root));
    for (const path of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/norms.mdc", ".github/copilot-instructions.md"]) {
      const adapter = join(root, path);
      writeFileSync(adapter, readFileSync(adapter, "utf8").replaceAll("\n", "\r\n"));
    }
    expect(checkProject(root).data).toEqual({ valid: true, norms: STARTER_PACK.norms.length + 1, imports: 0 });
    writeFileSync(join(root, ".cursor/rules/norms.mdc"), "stale\n");
    expect(() => checkProject(root)).toThrow(".cursor/rules/norms.mdc is stale");
  });

  test("explain reports scope decisions and declared conflicts", () => {
    const root = fixture();
    mkdirSync(join(root, ".norms/norms"), { recursive: true });
    writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: norms\n");
    writeFileSync(join(root, ".norms/norms/backend.md"), serializeNorm("backend.errors", ["src/**"], "Use typed errors.", ["company.errors"]));
    writeFileSync(join(root, ".norms/norms/company.md"), serializeNorm("company.errors", ["src/**/*.ts"], "Use error codes."));
    writeFileSync(join(root, ".norms/norms/docs.md"), serializeNorm("docs.short", ["docs/**"], "Keep docs short."));
    syncProject(root);

    const result = explainProject(root, "src/index.ts");
    expect(result.summary).toBe("2 of 3 norms apply to src/index.ts.");
    expect(result.data).toMatchObject({
      applicable: ["backend.errors", "company.errors"],
      conflicts: [{ ids: ["backend.errors", "company.errors"] }],
    });
    expect(result.details).toContain("skips docs.short: docs/**");
    expect(() => checkProject(root)).toThrow("declared conflict backend.errors and company.errors");

    rmSync(join(root, ".norms/norms/company.md"));
    syncProject(root);
    expect(checkProject(root).data).toEqual({ valid: true, norms: 2, imports: 0 });
    expect(explainProject(root, "src/index.ts").data).toMatchObject({
      missingTargets: [{ normId: "backend.errors", targetId: "company.errors" }],
    });
  });

  test("lint packages changed files, applicable norms, and diff context", () => {
    const root = fixture();
    mkdirSync(join(root, ".norms/norms"), { recursive: true });
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: norms\n");
    writeFileSync(join(root, ".norms/norms/typescript.md"), serializeNorm("coding.typescript", ["src/**/*.ts"], "Use strict TypeScript."));
    writeFileSync(join(root, "src/index.ts"), "export const value = 1;\n");
    syncProject(root);
    commit(root, "Initialize lint fixture");
    writeFileSync(join(root, "src/index.ts"), "export const value = 2;\n");

    const result = lintProject(root);
    expect(result.summary).toBe("Lint context prepared for 1 file.");
    expect(result.data).toMatchObject({
      version: 1,
      files: [{ path: "src/index.ts", normIds: ["coding.typescript"] }],
      norms: [{ id: "coding.typescript" }],
    });
    expect((result.data as { diff: string }).diff).toContain("+export const value = 2;");
    expect(lintProject(root, ["README.md"]).data).toMatchObject({ files: [{ path: "README.md", normIds: [] }] });
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
