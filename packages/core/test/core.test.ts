import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateAgentAdapter,
  loadNorms,
  normApplies,
  parseNorm,
  readStarterPack,
  serializeNorm,
  serializeStarterPack,
  STARTER_PACK,
} from "../src/index";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("norms core", () => {
  test("loads, sorts, and scopes local norms", () => {
    const root = fixture();
    writeFileSync(
      join(root, ".norms/norms/typescript.md"),
      serializeNorm("coding.typescript", ["src/**/*.ts"], "# TypeScript\n\nUse strict types."),
    );
    const norms = loadNorms(root);
    expect(norms.map(({ id }) => id)).toEqual(["coding.typescript"]);
    expect(normApplies(norms[0], "src/index.ts")).toBe(true);
    expect(normApplies(norms[0], "README.md")).toBe(false);
  });

  test("rejects duplicate ids", () => {
    const root = fixture();
    writeFileSync(join(root, ".norms/norms/a.md"), serializeNorm("coding.typescript", ["**/*"], "Use TypeScript."));
    writeFileSync(join(root, ".norms/norms/b.md"), serializeNorm("coding.typescript", ["**/*"], "Use JavaScript."));
    expect(() => loadNorms(root)).toThrow("Conflicting norm id");
  });

  test("combines provenance for identical ids", () => {
    const root = fixture();
    const norm = serializeNorm("coding.typescript", ["**/*"], "Use TypeScript.");
    writeFileSync(join(root, ".norms/norms/a.md"), norm);
    writeFileSync(join(root, ".norms/norms/b.md"), norm);
    expect(loadNorms(root)).toHaveLength(1);
  });

  test("generates a deterministic adapter", () => {
    const norm = parseNorm(
      serializeNorm("docs.short", ["**/*.md"], "Keep docs short."),
      "short.md",
      "repository",
    );
    const first = generateAgentAdapter([norm]);
    expect(generateAgentAdapter([norm])).toBe(first);
    expect(first).toContain("docs.short");
    expect(first).toContain("Do not edit");
    expect(first).toContain("provenance, not priority");
    expect(first).toContain("report the conflict");
    expect(first).not.toMatch(/VISION\.md|TypeScript|Bun|React|Ink|Yoga/);
  });

  test("packages every canonical meta-norm", () => {
    const files = readdirSync(join(import.meta.dir, "../../../.norms/norms/meta")).sort();
    expect(STARTER_PACK.norms.map(({ path }) => path.replace("meta/", ""))).toEqual(files);
    expect(readStarterPack(serializeStarterPack())).toEqual(STARTER_PACK);
  });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "norms-core-"));
  roots.push(root);
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, ".norms/norms"), { recursive: true });
  writeFileSync(join(root, ".norms/config.yaml"), "version: 1\nsources:\n  - name: repository\n    path: norms\n");
  return root;
}
