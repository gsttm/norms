import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { LockedSource, SourceConfig } from "@norms/core";
import { normsDirectory } from "@norms/core";

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
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all", "--", ".norms", "AGENTS.md"]);
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

export function syncGitSource(root: string, source: SourceConfig): LockedSource {
  if (!source.git) throw new Error(`${source.name} is not a Git source.`);
  const target = join(normsDirectory(root), "imports", source.name);
  const ref = source.ref ?? "HEAD";
  mkdirSync(dirname(target), { recursive: true });

  if (!existsSync(join(target, ".git"))) {
    if (existsSync(target)) throw new Error(`Import target ${target} exists but is not a Git checkout.`);
    runGit(root, ["clone", "--quiet", "--no-checkout", source.git, target]);
  } else {
    runGit(target, ["remote", "set-url", "origin", source.git]);
  }

  runGit(target, ["fetch", "--quiet", "--depth=1", "origin", ref]);
  const commit = runGit(target, ["rev-parse", "FETCH_HEAD"]);
  runGit(target, ["checkout", "--quiet", "--detach", commit]);
  return { name: source.name, git: source.git, ref, commit };
}

export function importedCommit(root: string, sourceName: string): string | undefined {
  const target = join(normsDirectory(root), "imports", sourceName);
  if (!existsSync(join(target, ".git"))) return undefined;
  return runGit(target, ["rev-parse", "HEAD"]);
}
