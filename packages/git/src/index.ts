import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { LockedSource, SourceConfig } from "@norms/core";
import { GENERATED_ADAPTER_PATHS, normsDirectory } from "@norms/core";

export type GitStateLabel =
  | "canonical"
  | "locally modified"
  | "remote update available"
  | "proposed in review"
  | "conflict";

export interface GitState {
  label: GitStateLabel;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface ImportSnapshot {
  name: string;
  existed: boolean;
  commit?: string;
}

export function runGit(
  root: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error) throw new Error(`Cannot run Git: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
  return result.status === 0 ? result.stdout.trim() : "";
}

export function currentCommit(root: string): string {
  return runGit(root, ["rev-parse", "HEAD"]);
}

export function currentBranch(root: string): string {
  return runGit(root, ["branch", "--show-current"]);
}

export function originUrl(root: string): string {
  return runGit(root, ["remote", "get-url", "origin"]);
}

export function gitState(root: string): GitState {
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all", "--", ".norms", ...GENERATED_ADAPTER_PATHS]);
  const codes = status ? status.split("\n").map((line) => line.slice(0, 2)) : [];
  const dirty = codes.length > 0;
  const conflict = codes.some((code) => ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(code));
  const counts = runGit(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], {
    allowFailure: true,
  });
  const [ahead = 0, behind = 0] = counts ? counts.split(/\s+/).map(Number) : [0, 0];
  const proposed = currentBranch(root).startsWith("norms/");
  const label: GitStateLabel = conflict
    ? "conflict"
    : dirty
      ? "locally modified"
      : behind > 0
        ? "remote update available"
        : proposed
          ? "proposed in review"
          : "canonical";
  return { label, dirty, ahead, behind };
}

export function resolveGitSource(root: string, source: SourceConfig): LockedSource {
  if (!source.git) throw new Error(`${source.name} is not a Git source.`);
  const target = importDirectory(root, source.name);
  const ref = source.ref ?? "HEAD";
  prepareImport(root, source);
  runGit(target, ["fetch", "--quiet", "--depth=1", "origin", ref]);
  const commit = runGit(target, ["rev-parse", "FETCH_HEAD"]);
  return { name: source.name, git: source.git, ref, commit };
}

export function materializeGitSource(root: string, source: SourceConfig, locked: LockedSource): void {
  if (!source.git) throw new Error(`${source.name} is not a Git source.`);
  const target = importDirectory(root, source.name);
  prepareImport(root, source);
  if (!runGit(target, ["rev-parse", "--verify", `${locked.commit}^{commit}`], { allowFailure: true })) {
    runGit(target, ["fetch", "--quiet", "--depth=1", "origin", locked.commit]);
  }
  runGit(target, ["checkout", "--quiet", "--detach", locked.commit]);
}

export function captureImport(root: string, sourceName: string): ImportSnapshot {
  const target = importDirectory(root, sourceName);
  return { name: sourceName, existed: existsSync(target), commit: importedCommit(root, sourceName) };
}

export function restoreImport(root: string, snapshot: ImportSnapshot): void {
  const target = importDirectory(root, snapshot.name);
  if (!snapshot.existed) rmSync(target, { recursive: true, force: true });
  else if (snapshot.commit && existsSync(join(target, ".git"))) {
    runGit(target, ["checkout", "--quiet", "--detach", snapshot.commit]);
  }
}

export function importedCommit(root: string, sourceName: string): string | undefined {
  const target = importDirectory(root, sourceName);
  if (!existsSync(join(target, ".git"))) return undefined;
  return runGit(target, ["rev-parse", "HEAD"], { allowFailure: true }) || undefined;
}

export function changedFiles(root: string): string[] {
  const commands = [
    ["diff", "--name-only", "--diff-filter=ACMRD", "--cached"],
    ["diff", "--name-only", "--diff-filter=ACMRD"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const files = commands.flatMap((args) => runGit(root, args).split("\n").filter(Boolean));
  return [...new Set(files)].sort();
}

export function diffForFiles(root: string, files: string[]): string {
  if (!files.length) return "";
  const diff = runGit(root, ["diff", "--no-ext-diff", "--unified=3", "HEAD", "--", ...files], { allowFailure: true });
  if (diff) return diff;
  return [
    runGit(root, ["diff", "--no-ext-diff", "--unified=3", "--cached", "--", ...files], { allowFailure: true }),
    runGit(root, ["diff", "--no-ext-diff", "--unified=3", "--", ...files], { allowFailure: true }),
  ].filter(Boolean).join("\n");
}

function prepareImport(root: string, source: SourceConfig): void {
  if (!source.git) throw new Error(`${source.name} is not a Git source.`);
  const target = importDirectory(root, source.name);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) {
    mkdirSync(target);
    runGit(target, ["init", "--quiet"]);
    runGit(target, ["remote", "add", "origin", source.git]);
  } else if (!existsSync(join(target, ".git"))) {
    throw new Error(`Import target ${target} exists but is not a Git checkout.`);
  } else {
    runGit(target, ["remote", "set-url", "origin", source.git]);
  }
}

function importDirectory(root: string, sourceName: string): string {
  return join(normsDirectory(root), "imports", sourceName);
}
