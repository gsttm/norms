import { strict as assert } from "node:assert";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { serializeNorm, STARTER_PACK } from "@norms/core";
import type { NormsExtensionApi } from "../src/extension";

suite("Norms VS Code extension", () => {
  let initialized: string;
  let uninitialized: string;
  let invalid: string;
  let api: NormsExtensionApi;
  let extension: vscode.Extension<NormsExtensionApi>;

  suiteSetup(async () => {
    const folders = new Map(vscode.workspace.workspaceFolders?.map((folder) => [folder.name, folder.uri.fsPath]));
    initialized = requiredFolder(folders, "initialized");
    uninitialized = requiredFolder(folders, "uninitialized");
    invalid = requiredFolder(folders, "invalid");
    process.env.NORMS_CACHE_DIR = join(initialized, "../cache");
    const candidate = vscode.extensions.getExtension<NormsExtensionApi>("norms.norms-vscode");
    assert.ok(candidate, "Norms extension is installed in the development host.");
    extension = candidate;
    api = await extension.activate();
  });

  test("isolates multi-root repositories and exposes grouped state", () => {
    const repositories = api.repositories();
    assert.equal(repositories.length, 3);
    const ready = repositories.find(({ root }) => root === initialized);
    const fresh = repositories.find(({ root }) => root === uninitialized);
    const broken = repositories.find(({ root }) => root === invalid);
    assert.deepEqual(ready?.groups.map(({ focus }) => focus), ["docs", "style"]);
    assert.equal(fresh?.initialized, false);
    assert.match(broken?.error ?? "", /version: 1/);
  });

  test("contributes exactly the specified repository action buttons", () => {
    const actions = extension.packageJSON.contributes.menus["view/item/context"] as Array<{ command: string; when: string }>;
    assert.deepEqual(
      actions.filter(({ when }) => when.includes("repository.initialized")).map(({ command }) => command),
      ["norms.sync", "norms.newNorm"],
    );
    assert.deepEqual(
      actions.filter(({ when }) => when.includes("repository.uninitialized")).map(({ command }) => command),
      ["norms.init"],
    );
  });

  test("creates, validates, syncs, and filters a norm", () => {
    const result = api.createNorm(initialized, {
      id: "style.created",
      scopes: ["src/**"],
      body: "# Created\n\nUse the created rule.",
      source: "repository",
    });
    assert.equal(result.path, ".norms/norms/style/created.md");
    for (const path of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/norms.mdc", ".github/copilot-instructions.md"]) {
      assert.equal(existsSync(join(initialized, path)), true);
    }
    assert.throws(() => api.createNorm(initialized, {
      id: "style.created",
      body: "Duplicate.",
      source: "repository",
    }), /already exists/);

    api.setFilter("created rule");
    assert.deepEqual(
      api.repositories().find(({ root }) => root === initialized)?.groups.flatMap(({ norms }) => norms.map(({ id }) => id)),
      ["style.created"],
    );
    api.setFilter("");
  });

  test("initializes an uninitialized repository", () => {
    api.initialize(uninitialized);
    const repository = api.repositories().find(({ root }) => root === uninitialized);
    assert.equal(repository?.initialized, true);
    assert.equal(repository?.norms.length, STARTER_PACK.norms.length);
    assert.equal(existsSync(join(uninitialized, "AGENTS.md")), true);
  });

  test("refreshes after canonical norm changes", async () => {
    const refreshed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Norm watcher did not refresh.")), 2000);
      const subscription = api.onDidRefresh(() => {
        if (!api.repositories().find(({ root }) => root === initialized)?.norms.some(({ id }) => id === "docs.refreshed")) return;
        clearTimeout(timeout);
        subscription.dispose();
        resolve();
      });
    });
    writeFileSync(join(initialized, ".norms/norms/refreshed.md"), serializeNorm("docs.refreshed", ["**/*.md"], "Refresh the view."));
    await refreshed;
  });
});

function requiredFolder(folders: Map<string, string> | undefined, name: string): string {
  const folder = folders?.get(name);
  assert.ok(folder, `Missing ${name} workspace folder.`);
  return folder;
}
