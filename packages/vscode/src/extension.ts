import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import * as vscode from "vscode";
import {
  findRepositoryRoot,
  loadNorms,
  normPathForId,
  parseNorm,
  readConfig,
  resolveSourceDirectory,
  serializeNorm,
  validateNormId,
  type Norm,
} from "@norms/core";
import { initProject, proposeNorm, syncProject } from "../../cli/src/commands";
import {
  focusAccessibility,
  groupNorms,
  normAccessibility,
  repositoryAccessibility,
  type FocusGroup,
} from "./model";

const VIEW_ID = "norms.active";
const PRIMARY = new vscode.ThemeColor("norms.primary");
const BODY_PLACEHOLDER = "# Describe this norm\n\nReplace this text before creating.";

export interface RepositorySnapshot {
  root: string;
  label: string;
  available: boolean;
  initialized: boolean;
  error?: string;
  norms: Norm[];
  groups: FocusGroup[];
}

export interface NewNormInput {
  id: string;
  scopes?: string[];
  conflictsWith?: string[];
  body: string;
  source?: string;
}

export interface NormsExtensionApi {
  repositories(): RepositorySnapshot[];
  initialize(root: string): void;
  synchronize(root: string): void;
  createNorm(root: string, input: NewNormInput): { path: string; source: string };
  setFilter(filter: string): void;
  onDidRefresh(listener: () => void): vscode.Disposable;
}

type TreeNode = RepositoryNode | FocusNode | NormNode | MessageNode;

interface RepositoryNode {
  kind: "repository";
  repository: RepositorySnapshot;
}

interface FocusNode {
  kind: "focus";
  repository: RepositorySnapshot;
  group: FocusGroup;
}

interface NormNode {
  kind: "norm";
  repository: RepositorySnapshot;
  norm: Norm;
}

interface MessageNode {
  kind: "message";
  id: string;
  label: string;
  description?: string;
  icon: string;
}

export function activate(context: vscode.ExtensionContext): NormsExtensionApi {
  const provider = new NormsTreeProvider();
  const details = new NormDetailsProvider();
  const tree = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider });
  const watchers = new NormsWatchers(provider);
  const api = extensionApi(provider);

  context.subscriptions.push(
    tree,
    provider,
    details,
    watchers,
    vscode.workspace.registerTextDocumentContentProvider("norms", details),
    vscode.commands.registerCommand("norms.init", (node?: TreeNode) => runInit(provider, node)),
    vscode.commands.registerCommand("norms.sync", (node?: TreeNode) => runSync(provider, node)),
    vscode.commands.registerCommand("norms.newNorm", (node?: TreeNode) => runNewNorm(provider, node)),
    vscode.commands.registerCommand("norms.filter", () => runFilter(provider)),
    vscode.commands.registerCommand("norms.openNorm", (node: NormNode) => openNorm(node, details)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      watchers.configure();
      provider.refresh();
    }),
  );
  watchers.configure();
  return api;
}

export function deactivate(): void {}

class NormsTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<TreeNode | undefined>();
  private filter = "";
  readonly onDidChangeTreeData = this.changes.event;

  repositories(): RepositorySnapshot[] {
    const seen = new Set<string>();
    return (vscode.workspace.workspaceFolders ?? []).flatMap((folder) => {
      let root: string;
      try {
        root = findRepositoryRoot(folder.uri.fsPath);
      } catch (error) {
        return [{
          root: folder.uri.fsPath,
          label: folder.name,
          available: false,
          initialized: false,
          error: errorMessage(error),
          norms: [],
          groups: [],
        }];
      }
      if (seen.has(root)) return [];
      seen.add(root);
      return [repositorySnapshot(root, folder.name, this.filter)];
    });
  }

  setFilter(filter: string): void {
    this.filter = filter.trim();
    this.refresh();
  }

  currentFilter(): string {
    return this.filter;
  }

  refresh(): void {
    this.changes.fire(undefined);
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === "repository") return repositoryItem(node.repository);
    if (node.kind === "focus") return focusItem(node);
    if (node.kind === "norm") return normItem(node);
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.description = node.description;
    item.iconPath = new vscode.ThemeIcon(node.icon);
    item.accessibilityInformation = { label: [node.label, node.description].filter(Boolean).join(", ") };
    return item;
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (!node) {
      const repositories = this.repositories();
      return repositories.length
        ? repositories.map((repository) => ({ kind: "repository", repository }))
        : [{ kind: "message", id: "no-repository", label: "Open a Git repository", icon: "folder-opened" }];
    }
    if (node.kind === "repository") return repositoryChildren(node.repository, this.filter);
    if (node.kind === "focus") {
      return node.group.norms.map((norm) => ({ kind: "norm", repository: node.repository, norm }));
    }
    return [];
  }

  dispose(): void {
    this.changes.dispose();
  }
}

class NormsWatchers implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly provider: NormsTreeProvider) {}

  configure(): void {
    this.clear();
    const roots = new Set<string>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      try {
        roots.add(findRepositoryRoot(folder.uri.fsPath));
      } catch {}
    }
    for (const root of roots) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, ".norms/**/*"));
      this.subscriptions.push(
        watcher,
        watcher.onDidChange(() => this.schedule()),
        watcher.onDidCreate(() => this.schedule()),
        watcher.onDidDelete(() => this.schedule()),
      );
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.provider.refresh(), 100);
  }

  private clear(): void {
    for (const subscription of this.subscriptions.splice(0)) subscription.dispose();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  dispose(): void {
    this.clear();
  }
}

class NormDetailsProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>();
  private readonly changes = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changes.event;

  set(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this.changes.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "Norm unavailable.";
  }

  dispose(): void {
    this.changes.dispose();
  }
}

function repositorySnapshot(root: string, label: string, filter: string): RepositorySnapshot {
  if (!existsSync(join(root, ".norms/config.yaml"))) {
    return { root, label, available: true, initialized: false, norms: [], groups: [] };
  }
  try {
    const norms = loadNorms(root);
    return { root, label, available: true, initialized: true, norms, groups: groupNorms(norms, filter) };
  } catch (error) {
    return { root, label, available: true, initialized: true, error: errorMessage(error), norms: [], groups: [] };
  }
}

function repositoryChildren(repository: RepositorySnapshot, filter: string): TreeNode[] {
  if (!repository.available) {
    return [{ kind: "message", id: `${repository.root}:unavailable`, label: "Not a Git repository", description: repository.error, icon: "warning" }];
  }
  if (!repository.initialized) {
    return [{ kind: "message", id: `${repository.root}:uninitialized`, label: "Norms is not initialized", icon: "info" }];
  }
  if (repository.error) {
    return [{ kind: "message", id: `${repository.root}:error`, label: "Norms unavailable", description: repository.error, icon: "error" }];
  }
  if (!repository.groups.length) {
    return [{
      kind: "message",
      id: `${repository.root}:empty`,
      label: filter ? `No norms match “${filter}”` : "No active norms",
      icon: "search",
    }];
  }
  return repository.groups.map((group) => ({ kind: "focus", repository, group }));
}

function repositoryItem(repository: RepositorySnapshot): vscode.TreeItem {
  const item = new vscode.TreeItem(repository.label, vscode.TreeItemCollapsibleState.Expanded);
  item.id = `repository:${repository.root}`;
  item.description = repository.available
    ? repository.initialized ? `${repository.norms.length} norms` : "Not initialized"
    : "Unavailable";
  item.iconPath = new vscode.ThemeIcon("repo", PRIMARY);
  item.contextValue = repository.available
    ? repository.initialized ? "norms.repository.initialized" : "norms.repository.uninitialized"
    : "norms.repository.unavailable";
  item.accessibilityInformation = { label: repositoryAccessibility(repository.label, String(item.description)) };
  return item;
}

function focusItem(node: FocusNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.group.focus, vscode.TreeItemCollapsibleState.Collapsed);
  item.id = `${node.repository.root}:focus:${node.group.focus}`;
  item.description = String(node.group.norms.length);
  item.iconPath = new vscode.ThemeIcon("symbol-namespace", PRIMARY);
  item.accessibilityInformation = { label: focusAccessibility(node.group.focus, node.group.norms.length) };
  return item;
}

function normItem(node: NormNode): vscode.TreeItem {
  const imported = isImported(node.norm);
  const item = new vscode.TreeItem(node.norm.id, vscode.TreeItemCollapsibleState.None);
  item.id = `${node.repository.root}:norm:${node.norm.id}`;
  item.description = imported ? `${node.norm.source} · read-only` : node.norm.source;
  item.iconPath = new vscode.ThemeIcon("symbol-rule");
  item.tooltip = normTooltip(node.norm, imported);
  item.command = { command: "norms.openNorm", title: "Open Norm", arguments: [node] };
  item.accessibilityInformation = { label: normAccessibility(node.norm, imported) };
  return item;
}

function normTooltip(norm: Norm, imported: boolean): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.isTrusted = false;
  tooltip.appendMarkdown(`**${norm.id}**\n\n`);
  tooltip.appendMarkdown(`Source: \`${norm.source}\`  \n`);
  tooltip.appendMarkdown(`Applies to: ${norm.appliesTo.map((scope) => `\`${scope}\``).join(", ")}  \n`);
  if (norm.conflictsWith.length) tooltip.appendMarkdown(`Conflicts with: ${norm.conflictsWith.map((id) => `\`${id}\``).join(", ")}  \n`);
  tooltip.appendMarkdown(`File: \`${norm.filePath}\`${imported ? " · read-only" : ""}\n\n`);
  tooltip.appendMarkdown(norm.body);
  return tooltip;
}

async function openNorm(node: NormNode, details: NormDetailsProvider): Promise<void> {
  if (!isImported(node.norm)) {
    const document = await vscode.workspace.openTextDocument(join(node.repository.root, node.norm.filePath));
    await vscode.window.showTextDocument(document, { preview: true });
    return;
  }
  const uri = vscode.Uri.from({
    scheme: "norms",
    path: `/${encodeURIComponent(node.repository.root)}/${encodeURIComponent(node.norm.id)}.md`,
  });
  details.set(uri, importedDetail(node.norm));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: true });
}

function importedDetail(norm: Norm): string {
  return `# ${norm.id}\n\nImported norm · read-only\n\nSource: \`${norm.source}\`\n\nApplies to: ${norm.appliesTo.map((scope) => `\`${scope}\``).join(", ")}${norm.conflictsWith.length ? `\n\nConflicts with: ${norm.conflictsWith.map((id) => `\`${id}\``).join(", ")}` : ""}\n\nCanonical checkout: \`${norm.filePath}\`\n\n${norm.body}\n`;
}

async function runInit(provider: NormsTreeProvider, node?: TreeNode): Promise<void> {
  const repository = await selectRepository(provider, node, false);
  if (!repository || !ensureTrusted()) return;
  await runWithProgress("Initializing Norms", async () => {
    initProject(repository.root);
    provider.refresh();
    await vscode.window.showInformationMessage(`Norms initialized in ${repository.label}.`);
  });
}

async function runSync(provider: NormsTreeProvider, node?: TreeNode): Promise<void> {
  const repository = await selectRepository(provider, node, true);
  if (!repository || !ensureTrusted()) return;
  await runWithProgress("Syncing Norms", async () => {
    syncProject(repository.root);
    provider.refresh();
    await vscode.window.showInformationMessage(`Norms synced in ${repository.label}.`);
  });
}

async function runNewNorm(provider: NormsTreeProvider, node?: TreeNode): Promise<void> {
  const repository = await selectRepository(provider, node, true);
  if (!repository || !ensureTrusted()) return;
  try {
    const source = await selectLocalSource(repository.root);
    if (!source) return;
    const existing = new Set(loadNorms(repository.root).map(({ id }) => id));
    const id = await vscode.window.showInputBox({
      title: "New Norm · 1 of 3",
      prompt: "Stable lowercase norm id",
      placeHolder: "style.example",
      ignoreFocusOut: true,
      validateInput: (value) => validateNewId(value, existing),
    });
    if (!id) return;
    const scopesValue = await vscode.window.showInputBox({
      title: "New Norm · 2 of 3",
      prompt: "Comma-separated applies_to globs",
      value: "**/*",
      ignoreFocusOut: true,
    });
    if (scopesValue === undefined) return;
    const conflictsValue = await vscode.window.showInputBox({
      title: "New Norm · 3 of 3",
      prompt: "Optional comma-separated conflicts_with ids",
      ignoreFocusOut: true,
    });
    if (conflictsValue === undefined) return;
    const scopes = commaList(scopesValue);
    const conflictsWith = commaList(conflictsValue);
    const draft = serializeNorm(id, scopes.length ? scopes : ["**/*"], BODY_PLACEHOLDER, conflictsWith);
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: draft });
    await vscode.window.showTextDocument(document, { preview: false });
    const reviewed = await vscode.window.showInformationMessage(
      `Edit the norm preview, then continue. Initial target: ${proposalPath(repository.root, source.name, id)}`,
      "Continue",
      "Cancel",
    );
    if (reviewed !== "Continue") return;
    const parsed = parseNorm(document.getText(), "new norm preview", source.name);
    if (parsed.body === BODY_PLACEHOLDER) throw new Error("Replace the placeholder body before creating the norm.");
    if (existing.has(parsed.id)) throw new Error(`Norm id ${parsed.id} already exists.`);
    const target = proposalPath(repository.root, source.name, parsed.id);
    const confirmed = await vscode.window.showInformationMessage(
      `Create ${target} and sync generated adapters?`,
      { modal: true },
      "Create",
    );
    if (confirmed !== "Create") return;
    await runWithProgress("Creating Norm", async () => {
      createAndSync(repository.root, {
        id: parsed.id,
        scopes: parsed.appliesTo,
        conflictsWith: parsed.conflictsWith,
        body: parsed.body,
        source: source.name,
      });
      provider.refresh();
      const canonical = await vscode.workspace.openTextDocument(join(repository.root, target));
      await vscode.window.showTextDocument(canonical, { preview: false });
      await vscode.window.showInformationMessage(`Created ${parsed.id}.`);
    });
  } catch (error) {
    await vscode.window.showErrorMessage(`Norms: ${errorMessage(error)}`);
  }
}

async function runFilter(provider: NormsTreeProvider): Promise<void> {
  const filter = await vscode.window.showInputBox({
    title: "Filter Norms",
    prompt: "Match id, source, scope, conflict, or body. Clear to reset.",
    value: provider.currentFilter(),
    ignoreFocusOut: true,
  });
  if (filter !== undefined) provider.setFilter(filter);
}

async function selectRepository(
  provider: NormsTreeProvider,
  node: TreeNode | undefined,
  initialized: boolean,
): Promise<RepositorySnapshot | undefined> {
  if (node?.kind === "repository") {
    if (node.repository.available && node.repository.initialized === initialized) return node.repository;
    return undefined;
  }
  const repositories = provider.repositories().filter((repository) => repository.available && repository.initialized === initialized);
  if (repositories.length === 1) return repositories[0];
  if (!repositories.length) {
    await vscode.window.showErrorMessage(initialized ? "No initialized Norms repository is open." : "No uninitialized Git repository is open.");
    return undefined;
  }
  const selected = await vscode.window.showQuickPick(
    repositories.map((repository) => ({ label: repository.label, description: repository.root, repository })),
    { title: "Select repository", placeHolder: "Repository" },
  );
  return selected?.repository;
}

async function selectLocalSource(root: string) {
  const sources = readConfig(root).sources.filter(({ git }) => !git);
  if (!sources.length) throw new Error("No writable local norm source is configured.");
  if (sources.length === 1) return sources[0];
  const selected = await vscode.window.showQuickPick(
    sources.map((source) => ({ label: source.name, description: source.path ?? "norms", source })),
    { title: "New Norm", placeHolder: "Writable local source" },
  );
  return selected?.source;
}

function createAndSync(root: string, input: NewNormInput): { path: string; source: string } {
  if (loadNorms(root).some(({ id }) => id === input.id)) throw new Error(`Norm id ${input.id} already exists.`);
  const proposal = proposeNorm(root, {
    id: input.id,
    scopes: input.scopes ?? ["**/*"],
    conflictsWith: input.conflictsWith,
    body: input.body,
    source: input.source,
  });
  try {
    syncProject(root);
  } catch (error) {
    throw new Error(`Created ${proposal.data.path}, but sync failed. Fix the reported issue, then run Norms: Sync. ${errorMessage(error)}`);
  }
  return { path: proposal.data.path, source: proposal.data.source };
}

function proposalPath(root: string, sourceName: string, id: string): string {
  const source = readConfig(root).sources.find(({ name, git }) => name === sourceName && !git);
  if (!source) throw new Error(`Writable source ${sourceName} is not configured.`);
  return relative(root, join(resolveSourceDirectory(root, source), normPathForId(id)));
}

function extensionApi(provider: NormsTreeProvider): NormsExtensionApi {
  return {
    repositories: () => provider.repositories(),
    initialize: (root) => {
      initProject(root);
      provider.refresh();
    },
    synchronize: (root) => {
      syncProject(root);
      provider.refresh();
    },
    createNorm: (root, input) => {
      const result = createAndSync(root, input);
      provider.refresh();
      return result;
    },
    setFilter: (filter) => provider.setFilter(filter),
    onDidRefresh: (listener) => provider.onDidChangeTreeData(() => listener()),
  };
}

async function runWithProgress(title: string, operation: () => Promise<void>): Promise<void> {
  try {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, operation);
  } catch (error) {
    await vscode.window.showErrorMessage(`Norms: ${errorMessage(error)}`);
  }
}

function ensureTrusted(): boolean {
  if (vscode.workspace.isTrusted) return true;
  void vscode.window.showWarningMessage("Trust this workspace to change Norms state.");
  return false;
}

function validateNewId(value: string, existing: Set<string>): string | undefined {
  try {
    validateNormId(value);
  } catch (error) {
    return errorMessage(error);
  }
  return existing.has(value) ? `Norm id ${value} already exists.` : undefined;
}

function commaList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function isImported(norm: Norm): boolean {
  return norm.filePath.startsWith(".norms/imports/");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
