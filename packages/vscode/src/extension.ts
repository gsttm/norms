import * as vscode from "vscode";
import {
  findRepositoryRoot,
  loadNorms,
  normalizeRepositoryPath,
  normsForPath,
  renderContext,
  type Norm,
} from "@norms/core";
import { gitState } from "@norms/git";

export function activate(context: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;

  const provider = new NormsTreeProvider(folder.uri.fsPath);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("norms.active", provider),
    vscode.commands.registerCommand("norms.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("norms.showContext", () => showContext(provider)),
    vscode.window.onDidChangeActiveTextEditor(() => provider.refresh()),
  );

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(folder, ".norms/**/*"),
  );
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}

class NormsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changes = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(private readonly workspaceRoot: string) {}

  refresh(): void {
    this.changes.fire();
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(): vscode.TreeItem[] {
    try {
      const root = findRepositoryRoot(this.workspaceRoot);
      const norms = loadNorms(root);
      const activePath = this.activePath(root);
      const applicable = new Set(normsForPath(norms, activePath).map(({ id }) => id));
      const state = gitState(root);
      return [
        item(`Active norms: ${norms.length}`, "book", vscode.TreeItemCollapsibleState.None),
        item(`Git: ${state.label}`, gitIcon(state.label), vscode.TreeItemCollapsibleState.None),
        ...norms.map((norm) => normItem(norm, applicable.has(norm.id), Boolean(activePath))),
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failure = item("Norms unavailable", "warning", vscode.TreeItemCollapsibleState.None);
      failure.tooltip = message;
      return [failure];
    }
  }

  context(): { path?: string; norms: Norm[]; markdown: string } {
    const root = findRepositoryRoot(this.workspaceRoot);
    const path = this.activePath(root);
    const norms = normsForPath(loadNorms(root), path);
    return { path, norms, markdown: renderContext(norms, path) };
  }

  private activePath(root: string): string | undefined {
    const file = vscode.window.activeTextEditor?.document.uri;
    return file?.scheme === "file" ? normalizeRepositoryPath(root, file.fsPath) : undefined;
  }
}

async function showContext(provider: NormsTreeProvider): Promise<void> {
  try {
    const context = provider.context();
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: context.markdown });
    await vscode.window.showTextDocument(document, { preview: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Norms: ${message}`);
  }
}

function normItem(norm: Norm, applies: boolean, hasActiveFile: boolean): vscode.TreeItem {
  const treeItem = item(norm.id, applies ? "check" : "circle-slash", vscode.TreeItemCollapsibleState.None);
  treeItem.description = hasActiveFile
    ? `${norm.source} · ${applies ? "applies" : "not applicable"}`
    : norm.source;
  treeItem.tooltip = [
    `Source: ${norm.source}`,
    `Applies to: ${norm.appliesTo.join(", ")}`,
    hasActiveFile ? `Current file: ${applies ? "applies" : "not applicable"}` : "",
  ].filter(Boolean).join("\n");
  return treeItem;
}

function item(label: string, icon: string, state: vscode.TreeItemCollapsibleState): vscode.TreeItem {
  const treeItem = new vscode.TreeItem(label, state);
  treeItem.iconPath = new vscode.ThemeIcon(icon);
  return treeItem;
}

function gitIcon(label: string): string {
  if (label === "canonical") return "pass";
  if (label === "conflict") return "warning";
  if (label === "remote update available") return "cloud-download";
  if (label === "proposed in review") return "git-pull-request";
  return "circle-filled";
}
