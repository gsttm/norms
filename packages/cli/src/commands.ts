import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  generateAgentAdapter,
  isGeneratedAdapter,
  loadNorms,
  normPathForId,
  normalizeRepositoryPath,
  normsDirectory,
  normsForPath,
  readConfig,
  readLockfileState,
  renderContext,
  resolveSourceDirectory,
  serializeNorm,
  type Lockfile,
  type Norm,
} from "@norms/core";
import {
  captureImport,
  currentBranch,
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

export function initProject(root: string, importExisting = true): CommandResult {
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

  const adapterPath = join(root, "AGENTS.md");
  const importedPath = join(directory, "norms/repository/imported-agent-instructions.md");
  if (importExisting && existsSync(adapterPath)) {
    const existing = readFileSync(adapterPath, "utf8");
    if (!isGeneratedAdapter(existing) && !existsSync(importedPath)) {
      mkdirSync(dirname(importedPath), { recursive: true });
      writeFileSync(
        importedPath,
        serializeNorm("repository.imported-agent-instructions", ["**/*"], existing),
      );
      created.push(relativeName(root, importedPath));
    }
  }

  const sync = syncProject(root);
  return {
    summary: "Norms initialized.",
    details: [...created.map((path) => `created ${path}`), ...sync.details],
    data: { created, ...sync.data as object },
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

export function statusForProject(root: string): CommandResult {
  const config = readConfig(root);
  const norms = loadNorms(root);
  const lockState = readLockfileState(root);
  const lock = lockState.lockfile;
  const adapterPath = join(root, "AGENTS.md");
  const adapterSynced =
    existsSync(adapterPath) && readFileSync(adapterPath, "utf8") === generateAgentAdapter(norms);
  const remoteSources = config.sources.filter((source) => source.git);
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
  const synced = adapterSynced && importsSynced && !lockState.migratedFrom;
  return {
    summary: synced ? "Norms are synced." : "Norms need sync.",
    details: [
      `active norms: ${norms.length}`,
      `sources: ${config.sources.length}`,
      `adapter: ${adapterSynced ? "synced" : "stale"}`,
      `imports: ${importsSynced ? "synced" : "stale"}`,
      `config: ${lockMatches ? "matches lock" : "needs update"}`,
      `lock: ${lockState.migratedFrom ? "migration needed" : "current"}`,
      `git: ${state.label}`,
    ],
    data: { synced, adapterSynced, importsSynced, lockMigration: lockState.migratedFrom, norms: norms.length, sources: config.sources.length, git: state },
  };
}

export function proposeNorm(
  root: string,
  input: { id: string; scopes: string[]; body: string; force?: boolean },
): CommandResult {
  const source = readConfig(root).sources.find(({ git }) => !git);
  if (!source) throw new Error("No local source accepts proposals. Add one to .norms/config.yaml.");
  const base = resolveSourceDirectory(root, source);
  const target = join(base, normPathForId(input.id));
  if (existsSync(target) && !input.force) {
    throw new Error(`${relativeName(root, target)} exists. Pass --force to replace it.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, serializeNorm(input.id, input.scopes.length ? input.scopes : ["**/*"], input.body));
  return {
    summary: `Proposed ${input.id}.`,
    details: [`wrote ${relativeName(root, target)}`, "Run `norms sync` to refresh AGENTS.md."],
    data: { id: input.id, path: relativeName(root, target), source: source.name },
  };
}

export function syncProject(root: string, update = false): CommandResult {
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
  const adapterPath = join(root, "AGENTS.md");
  const previousLock = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : undefined;
  const previousAdapter = existsSync(adapterPath) ? readFileSync(adapterPath, "utf8") : undefined;

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
    writeFileSync(lockPath, `${JSON.stringify(lockfile, null, 2)}\n`);
    writeFileSync(adapterPath, generateAgentAdapter(norms));
    return {
      summary: update ? "Norms updated." : "Norms synced.",
      details: [
        `${update ? "updated" : "restored"} ${remoteSources.length} import${remoteSources.length === 1 ? "" : "s"}`,
        ...(state.migratedFrom ? [`migrated lockfile from version ${state.migratedFrom}`] : []),
        `generated AGENTS.md with ${norms.length} norm${norms.length === 1 ? "" : "s"}`,
      ],
      data: { sources: config.sources.length, norms: norms.length, updated: update, lockfile },
    };
  } catch (error) {
    for (const snapshot of snapshots) restoreImport(root, snapshot);
    restoreFile(lockPath, previousLock);
    restoreFile(adapterPath, previousAdapter);
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
  const adapterPath = join(root, "AGENTS.md");
  if (!existsSync(adapterPath) || readFileSync(adapterPath, "utf8") !== generateAgentAdapter(norms)) {
    errors.push("AGENTS.md is stale; run `norms sync`");
  }
  if (errors.length) throw new Error(`Norms check failed:\n- ${errors.join("\n- ")}`);
  return {
    summary: "Norms check passed.",
    details: [`${norms.length} norms valid`, `${remoteSources.length} imports pinned`, "AGENTS.md current"],
    data: { valid: true, norms: norms.length, imports: remoteSources.length },
  };
}

export function reviewProject(
  root: string,
  input: { title: string; body?: string; base?: string; branch?: string },
): CommandResult {
  checkProject(root);
  const changes = runGit(root, ["status", "--porcelain=v1", "--", ".norms", "AGENTS.md"]);
  if (!changes) throw new Error("No Norms changes to review.");
  let branch = currentBranch(root);
  if (!branch || branch === "main" || branch === "master") {
    branch = input.branch ?? `norms/${slug(input.title)}-${dateStamp()}`;
    runGit(root, ["switch", "-c", branch]);
  }
  runGit(root, ["add", "--", ".norms", "AGENTS.md"]);
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
