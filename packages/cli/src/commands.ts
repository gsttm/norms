import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  GENERATED_ADAPTER_PATHS,
  STARTER_PACK,
  diagnoseScopes,
  generateAdapters,
  isGeneratedAdapter,
  inspectConflicts,
  loadNorms,
  normPathForId,
  normalizeRepositoryPath,
  normsDirectory,
  normsForPath,
  readConfig,
  readLockfileState,
  readStarterPack,
  renderContext,
  resolveSourceDirectory,
  serializeNorm,
  serializeStarterPack,
  type Lockfile,
  type Norm,
} from "@norms/core";
import {
  captureImport,
  changedFiles,
  currentBranch,
  diffForFiles,
  gitState,
  importedCommit,
  materializeGitSource,
  originUrl,
  resolveGitSource,
  restoreImport,
  runGit,
} from "@norms/git";
import { openReview } from "@norms/providers";

export interface CommandResult<T = unknown> {
  summary: string;
  details: string[];
  data: T;
}

const ADAPTER_IMPORTS = [
  { path: "AGENTS.md", id: "repository.imported-agent-instructions" },
  { path: "CLAUDE.md", id: "repository.imported-claude-instructions" },
  { path: ".cursor/rules/norms.mdc", id: "repository.imported-cursor-instructions" },
  { path: ".github/copilot-instructions.md", id: "repository.imported-copilot-instructions" },
] as const;

export function initProject(
  root: string,
  importExisting = true,
  cacheFile = starterCacheFile(),
): CommandResult {
  const starter = loadStarterPack(cacheFile);
  const directory = normsDirectory(root);
  const created: string[] = [];
  for (const path of [
    directory,
    join(directory, "norms"),
    join(directory, "assets"),
    join(directory, "imports"),
  ]) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      created.push(relativeName(root, path));
    }
  }

  writeIfMissing(
    join(directory, "config.yaml"),
    "version: 1\nsources:\n  - name: repository\n    path: norms\n",
    root,
    created,
  );
  writeIfMissing(join(directory, "lock.json"), `${JSON.stringify({ version: 2, sources: [] }, null, 2)}\n`, root, created);
  writeIfMissing(join(directory, ".gitignore"), "imports/*\n!imports/.gitkeep\n", root, created);
  writeIfMissing(join(directory, "assets/.gitkeep"), "", root, created);
  writeIfMissing(join(directory, "imports/.gitkeep"), "", root, created);
  const scaffoldCreated = created.length > 0;

  const seeded: string[] = [];
  for (const norm of starter.norms) {
    const target = join(directory, "norms", norm.path);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, norm.content);
    seeded.push(relativeName(root, target));
  }

  const importedAdapters: string[] = [];
  if (importExisting) {
    for (const adapter of ADAPTER_IMPORTS) {
      const adapterPath = join(root, adapter.path);
      if (!existsSync(adapterPath)) continue;
      const existing = readFileSync(adapterPath, "utf8");
      if (isGeneratedAdapter(existing)) continue;
      const importedPath = join(directory, "norms", normPathForId(adapter.id));
      const imported = serializeNorm(adapter.id, ["**/*"], existing);
      if (existsSync(importedPath) && readFileSync(importedPath, "utf8") !== imported) {
        throw new Error(`${adapter.path} differs from its existing imported norm at ${relativeName(root, importedPath)}.`);
      }
      if (!existsSync(importedPath)) {
        mkdirSync(dirname(importedPath), { recursive: true });
        writeFileSync(importedPath, imported);
        created.push(relativeName(root, importedPath));
      }
      importedAdapters.push(adapter.path);
    }
  }

  const sync = syncProject(root, false, importedAdapters);
  return {
    summary: "Norms initialized.",
    details: [
      ...(scaffoldCreated ? ["created .norms/"] : []),
      ...(importedAdapters.length ? [`imported existing ${importedAdapters.join(", ")}`] : []),
      ...(seeded.length ? [`seeded ${seeded.length} starter meta-norms`] : []),
      ...sync.details,
    ],
    data: { created, seeded, starterCache: cacheFile, ...sync.data as object },
  };
}

export function listProjectNorms(root: string): CommandResult<{ norms: Norm[] }> {
  const norms = loadNorms(root);
  return {
    summary: `${norms.length} active norm${norms.length === 1 ? "" : "s"}.`,
    details: norms.map((norm) => `${norm.id}  ${norm.source}  ${norm.appliesTo.join(", ")}`),
    data: { norms },
  };
}

export function contextForProject(root: string, filePath?: string): CommandResult {
  const normalized = filePath ? normalizeRepositoryPath(root, filePath) : undefined;
  const norms = normsForPath(loadNorms(root), normalized);
  const context = renderContext(norms, normalized);
  return {
    summary: `${norms.length} norm${norms.length === 1 ? "" : "s"} apply${norms.length === 1 ? "ies" : ""}.`,
    details: context.trimEnd().split("\n"),
    data: { file: normalized, norms, context },
  };
}

export function explainProject(root: string, filePath: string): CommandResult {
  const normalized = normalizeRepositoryPath(root, filePath);
  const norms = loadNorms(root);
  const diagnostics = diagnoseScopes(norms, normalized);
  const report = inspectConflicts(norms, normalized);
  const applicable = diagnostics.filter(({ applies }) => applies).map(({ id }) => id);
  return {
    summary: `${applicable.length} of ${norms.length} norms apply to ${normalized}.`,
    details: [
      ...diagnostics.map((diagnostic) => diagnostic.applies
        ? `applies ${diagnostic.id}: ${diagnostic.matchedScopes.join(", ")}`
        : `skips ${diagnostic.id}: ${diagnostic.unmatchedScopes.join(", ")}`),
      ...report.missingTargets.map(({ normId, targetId }) => `missing conflict target: ${normId} -> ${targetId}`),
      ...report.conflicts.flatMap((conflict) => [`conflict: ${conflict.ids.join(" <> ")}`, conflict.task]),
    ],
    data: { file: normalized, applicable, diagnostics, ...report },
  };
}

export function lintProject(root: string, filePaths: string[] = []): CommandResult {
  const files = [...new Set((filePaths.length ? filePaths.map((path) => normalizeRepositoryPath(root, path)) : changedFiles(root)))].sort();
  if (!files.length) throw new Error("No changed files to lint. Pass one or more paths explicitly.");
  const norms = loadNorms(root);
  const contexts = files.map((path) => {
    const applicable = normsForPath(norms, path);
    return { path, normIds: applicable.map(({ id }) => id), ...inspectConflicts(norms, path) };
  });
  const activeIds = new Set(contexts.flatMap(({ normIds }) => normIds));
  const activeNorms = norms.filter(({ id }) => activeIds.has(id));
  const diff = diffForFiles(root, files);
  const task = "Read the listed files from the repository and use the diff as change context. Evaluate each file against every associated norm. Report violations with the file, norm id, concrete evidence, and minimal correction. Do not invent violations or change norms to excuse code. If fixes are authorized, apply them, then run `norms check`.";
  return {
    summary: `Lint context prepared for ${files.length} file${files.length === 1 ? "" : "s"}.`,
    details: [
      task,
      "",
      ...contexts.map(({ path, normIds }) => `${path}: ${normIds.length ? normIds.join(", ") : "no applicable norms"}`),
      "",
      ...renderContext(activeNorms).trimEnd().split("\n"),
      "",
      "# Repository Diff",
      "",
      diff || "No tracked diff; read the listed files from the repository.",
    ],
    data: { version: 1, task, files: contexts, norms: activeNorms, diff },
  };
}

export function statusForProject(root: string): CommandResult {
  const config = readConfig(root);
  const norms = loadNorms(root);
  const lockState = readLockfileState(root);
  const lock = lockState.lockfile;
  const adapters = adaptersForProject(root, norms);
  const staleAdapters = adapters.filter(({ filePath, content }) =>
    !existsSync(filePath) || readFileSync(filePath, "utf8") !== content
  ).map(({ path }) => path);
  const adapterSynced = staleAdapters.length === 0;
  const remoteSources = config.sources.filter((source) => source.git);
  const conflictReport = inspectConflicts(norms);
  const lockMatches = remoteSources.length === lock.sources.length && remoteSources.every((source) => {
    const locked = lock.sources.find(({ name }) => name === source.name);
    return locked?.git === source.git && locked?.ref === (source.ref ?? "HEAD");
  });
  const importsSynced = lockMatches && remoteSources
    .every((source) => {
      const locked = lock.sources.find(({ name }) => name === source.name);
      return locked && importedCommit(root, source.name) === locked.commit;
    });
  const state = gitState(root);
  const synced = adapterSynced && importsSynced && !lockState.migratedFrom && !conflictReport.conflicts.length;
  return {
    summary: synced ? "Norms are synced." : "Norms need sync.",
    details: [
      `active norms: ${norms.length}`,
      `sources: ${config.sources.length}`,
      `adapters: ${adapterSynced ? "synced" : `stale (${staleAdapters.join(", ")})`}`,
      `imports: ${importsSynced ? "synced" : "stale"}`,
      `config: ${lockMatches ? "matches lock" : "needs update"}`,
      `lock: ${lockState.migratedFrom ? "migration needed" : "current"}`,
      `norm conflicts: ${conflictReport.conflicts.length}`,
      `unresolved conflict targets: ${conflictReport.missingTargets.length}`,
      `git: ${state.label}`,
    ],
    data: { synced, adapterSynced, staleAdapters, importsSynced, lockMigration: lockState.migratedFrom, norms: norms.length, sources: config.sources.length, conflicts: conflictReport, git: state },
  };
}

export function proposeNorm(
  root: string,
  input: { id: string; scopes: string[]; body: string; conflictsWith?: string[]; force?: boolean; source?: string },
): CommandResult<{ id: string; path: string; source: string }> {
  const source = readConfig(root).sources.find(({ name, git }) => !git && (!input.source || name === input.source));
  if (!source) {
    throw new Error(input.source
      ? `Writable source ${input.source} is not configured.`
      : "No local source accepts proposals. Add one to .norms/config.yaml.");
  }
  const base = resolveSourceDirectory(root, source);
  const target = join(base, normPathForId(input.id));
  if (existsSync(target) && !input.force) {
    throw new Error(`${relativeName(root, target)} exists. Pass --force to replace it.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, serializeNorm(input.id, input.scopes.length ? input.scopes : ["**/*"], input.body, input.conflictsWith));
  return {
    summary: `Proposed ${input.id}.`,
    details: [`wrote ${relativeName(root, target)}`, "Run `norms sync` to refresh generated adapters."],
    data: { id: input.id, path: relativeName(root, target), source: source.name },
  };
}

export function syncProject(root: string, update = false, replaceAdapters: readonly string[] = []): CommandResult {
  const config = readConfig(root);
  const remoteSources = config.sources.filter(({ git }) => git);
  let state;
  try {
    state = readLockfileState(root);
  } catch (error) {
    if (!update) throw error;
    state = { lockfile: { version: 2, sources: [] } as Lockfile };
  }
  const snapshots = remoteSources.map(({ name }) => captureImport(root, name));
  const lockPath = join(normsDirectory(root), "lock.json");
  const previousLock = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : undefined;
  const previousAdapters = GENERATED_ADAPTER_PATHS.map((path) => {
    const filePath = join(root, path);
    return { path, filePath, content: existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined };
  });

  try {
    const locked = update
      ? remoteSources.map((source) => resolveGitSource(root, source))
      : remoteSources.map((source) => lockedSource(source, state.lockfile));
    if (!update) {
      const removed = state.lockfile.sources.find(({ name }) => !remoteSources.some((source) => source.name === name));
      if (removed) throw new Error(`Source ${removed.name} was removed from config. Run \`norms sync --update\`.`);
    }
    for (const source of remoteSources) {
      materializeGitSource(root, source, locked.find(({ name }) => name === source.name)!);
    }
    const lockfile: Lockfile = { version: 2, sources: locked };
    const norms = loadNorms(root);
    const adapters = adaptersForProject(root, norms);
    for (const adapter of adapters) {
      if (
        existsSync(adapter.filePath)
        && !isGeneratedAdapter(readFileSync(adapter.filePath, "utf8"))
        && !replaceAdapters.includes(adapter.path)
      ) {
        throw new Error(`${adapter.path} is not generated by Norms. Import or move it before sync.`);
      }
    }
    writeFileSync(lockPath, `${JSON.stringify(lockfile, null, 2)}\n`);
    for (const adapter of adapters) {
      mkdirSync(dirname(adapter.filePath), { recursive: true });
      writeFileSync(adapter.filePath, adapter.content);
    }
    return {
      summary: update ? "Norms updated." : "Norms synced.",
      details: [
        ...(remoteSources.length ? [`${update ? "updated" : "restored"} ${remoteSources.length} import${remoteSources.length === 1 ? "" : "s"}`] : []),
        ...(state.migratedFrom ? [`migrated lockfile from version ${state.migratedFrom}`] : []),
        `generated ${adapters.length} adapters with ${norms.length} norm${norms.length === 1 ? "" : "s"}`,
      ],
      data: { sources: config.sources.length, norms: norms.length, updated: update, lockfile, adapters: adapters.map(({ path }) => path) },
    };
  } catch (error) {
    for (const snapshot of snapshots) restoreImport(root, snapshot);
    restoreFile(lockPath, previousLock);
    for (const adapter of previousAdapters) restoreFile(adapter.filePath, adapter.content);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Sync failed; previous imports and generated files were restored. ${message}`);
  }
}

export function checkProject(root: string): CommandResult {
  const config = readConfig(root);
  const norms = loadNorms(root);
  const state = readLockfileState(root);
  const lock = state.lockfile;
  const errors: string[] = [];
  const conflictReport = inspectConflicts(norms);
  for (const conflict of conflictReport.conflicts) {
    errors.push(`declared conflict ${conflict.ids.join(" and ")}: ${conflict.task}`);
  }
  if (state.migratedFrom) errors.push(`lockfile version ${state.migratedFrom} needs migration; run \`norms sync\``);
  const remoteSources = config.sources.filter(({ git }) => git);
  for (const source of remoteSources) {
    const locked = lock.sources.find(({ name }) => name === source.name);
    if (!locked) errors.push(`source ${source.name} is not locked`);
    else if (locked.git !== source.git || locked.ref !== (source.ref ?? "HEAD")) {
      errors.push(`source ${source.name} lock does not match config`);
    } else if (importedCommit(root, source.name) !== locked.commit) {
      errors.push(`source ${source.name} checkout does not match lock`);
    }
  }
  for (const locked of lock.sources) {
    if (!remoteSources.some(({ name }) => name === locked.name)) errors.push(`lock contains removed source ${locked.name}`);
  }
  const adapters = adaptersForProject(root, norms);
  for (const adapter of adapters) {
    if (!existsSync(adapter.filePath) || readFileSync(adapter.filePath, "utf8") !== adapter.content) {
      errors.push(`${adapter.path} is stale; run \`norms sync\``);
    }
  }
  if (errors.length) throw new Error(`Norms check failed:\n- ${errors.join("\n- ")}`);
  return {
    summary: "Norms check passed.",
    details: [
      `${norms.length} norms valid`,
      "no active declared conflicts",
      ...(conflictReport.missingTargets.length ? [`${conflictReport.missingTargets.length} unresolved conflict target${conflictReport.missingTargets.length === 1 ? "" : "s"}`] : []),
      `${remoteSources.length} imports pinned`,
      `${adapters.length} adapters current`,
    ],
    data: { valid: true, norms: norms.length, imports: remoteSources.length },
  };
}

export function reviewProject(
  root: string,
  input: { title: string; body?: string; base?: string; branch?: string },
): CommandResult {
  checkProject(root);
  const changes = runGit(root, ["status", "--porcelain=v1", "--", ".norms", ...GENERATED_ADAPTER_PATHS]);
  if (!changes) throw new Error("No Norms changes to review.");
  let branch = currentBranch(root);
  if (!branch || branch === "main" || branch === "master") {
    branch = input.branch ?? `norms/${slug(input.title)}-${dateStamp()}`;
    runGit(root, ["switch", "-c", branch]);
  }
  runGit(root, ["add", "--", ".norms", ...GENERATED_ADAPTER_PATHS]);
  runGit(root, ["commit", "-m", input.title]);
  runGit(root, ["push", "--set-upstream", "origin", branch]);
  const review = openReview({
    root,
    remote: originUrl(root),
    title: input.title,
    body: input.body ?? "Norm proposal generated by Norms.",
    base: input.base,
  });
  return {
    summary: `${review.provider} review opened.`,
    details: [review.url],
    data: { ...review, branch },
  };
}

function writeIfMissing(path: string, content: string, root: string, created: string[]): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  created.push(relativeName(root, path));
}

function adaptersForProject(root: string, norms: Norm[]) {
  return generateAdapters(norms).map((adapter) => ({ ...adapter, filePath: join(root, adapter.path) }));
}

function starterCacheFile(): string {
  const directory = process.env.NORMS_CACHE_DIR
    ?? (process.env.XDG_CACHE_HOME ? join(process.env.XDG_CACHE_HOME, "norms") : undefined)
    ?? (process.platform === "win32" && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "norms") : undefined)
    ?? join(homedir(), ".cache", "norms");
  return join(directory, "meta-norms.json");
}

function loadStarterPack(path: string) {
  if (existsSync(path)) return readStarterPack(readFileSync(path, "utf8"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeStarterPack());
  return STARTER_PACK;
}

function lockedSource(source: { name: string; git?: string; ref?: string }, lockfile: Lockfile) {
  const locked = lockfile.sources.find(({ name }) => name === source.name);
  if (!locked) throw new Error(`Source ${source.name} is not locked. Run \`norms sync --update\`.`);
  if (locked.git !== source.git || locked.ref !== (source.ref ?? "HEAD")) {
    throw new Error(`Source ${source.name} changed in config. Run \`norms sync --update\`.`);
  }
  return locked;
}

function restoreFile(path: string, content: string | undefined): void {
  if (content === undefined) {
    if (existsSync(path)) rmSync(path);
  } else {
    writeFileSync(path, content);
  }
}

function relativeName(root: string, path: string): string {
  return path.slice(root.length + 1);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "proposal";
}

function dateStamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}
