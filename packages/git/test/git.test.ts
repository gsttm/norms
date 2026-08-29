import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitState, runGit } from "../src/index";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Git state", () => {
  test("reports canonical, proposed, and modified states", () => {
    const root = mkdtempSync(join(tmpdir(), "norms-git-"));
    roots.push(root);
    runGit(root, ["init", "--quiet"]);
    runGit(root, ["config", "user.name", "Norms Test"]);
    runGit(root, ["config", "user.email", "norms@example.test"]);
    mkdirSync(join(root, ".norms"));
    writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources: []\n");
    runGit(root, ["add", ".norms/config.yaml"]);
    runGit(root, ["commit", "--quiet", "-m", "Initialize"]);
    expect(gitState(root).label).toBe("canonical");

    runGit(root, ["switch", "--quiet", "-c", "norms/example"]);
    expect(gitState(root).label).toBe("proposed in review");

    writeFileSync(join(root, "AGENTS.md"), "changed\n");
    expect(gitState(root).label).toBe("locally modified");
  });
});
