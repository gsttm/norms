#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { findRepositoryRoot } from "@norms/core";
import { renderResult } from "@norms/ui";
import manifest from "../../../package.json";
import {
  checkProject,
  contextForProject,
  explainProject,
  initProject,
  lintProject,
  listProjectNorms,
  proposeNorm,
  reviewProject,
  statusForProject,
  syncProject,
  type CommandResult,
} from "./commands";

const HELP = `norms <command> [options]

Commands:
  init                  Initialize starter norms and AGENTS.md
  list                  List active norms
  context [path]        Print applicable norms
  explain <path>        Diagnose scopes and declared conflicts
  lint [path...]        Emit agent-evaluated lint context
  status                Show sync and Git state
  propose               Write a local norm proposal
  sync [--update]       Restore pins or explicitly update them
  check                 Validate config, norms, lock, and adapter
  review                Commit, push, and open a Git review

Global:
  --json                Emit deterministic JSON
  --help                Show help
  --version             Show version`;

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  const json = removeFlag(raw, "--json");
  const command = raw.shift();
  if (!command || command === "help" || command === "--help" || removeFlag(raw, "--help")) {
    await output({ summary: "Norms", details: HELP.split("\n"), data: { help: HELP } }, json);
    return;
  }
  if (command === "--version" || command === "version") {
    await output({ summary: `norms ${manifest.version}`, details: [], data: { version: manifest.version } }, json);
    return;
  }

  const root = findRepositoryRoot();
  const args = parseArgs(raw);
  let result: CommandResult;
  switch (command) {
    case "init":
      result = initProject(root, !args.flags.has("no-import"));
      break;
    case "list":
      result = listProjectNorms(root);
      break;
    case "context":
      result = contextForProject(root, args.positionals[0]);
      break;
    case "explain":
      if (!args.positionals[0]) throw new Error("Usage: norms explain <path>.");
      result = explainProject(root, args.positionals[0]);
      break;
    case "lint":
      result = lintProject(root, args.positionals);
      break;
    case "status":
      result = statusForProject(root);
      break;
    case "propose": {
      const id = required(args, "id");
      const bodyFile = args.values.get("body-file")?.[0];
      const inlineBody = args.values.get("body")?.[0];
      const body = bodyFile
        ? readFileSync(bodyFile, "utf8")
        : inlineBody ?? (process.stdin.isTTY ? "" : await Bun.stdin.text());
      if (!body.trim()) throw new Error("Pass --body-file, --body, or a norm body on stdin.");
      result = proposeNorm(root, {
        id,
        scopes: args.values.get("scope") ?? ["**/*"],
        conflictsWith: args.values.get("conflicts-with"),
        body,
        force: args.flags.has("force"),
      });
      break;
    }
    case "sync":
      result = syncProject(root, args.flags.has("update"));
      break;
    case "check":
      result = checkProject(root);
      break;
    case "review":
      result = reviewProject(root, {
        title: required(args, "title"),
        body: args.values.get("body")?.[0],
        base: args.values.get("base")?.[0],
        branch: args.values.get("branch")?.[0],
      });
      break;
    default:
      throw new Error(`Unknown command ${command}. Run \`norms --help\`.`);
  }
  await output(result, json);
}

interface ParsedArgs {
  flags: Set<string>;
  positionals: string[];
  values: Map<string, string[]>;
}

function parseArgs(args: string[]): ParsedArgs {
  const flags = new Set<string>();
  const positionals: string[] = [];
  const values = new Map<string, string[]>();
  const booleanOptions = new Set(["force", "no-import", "update"]);
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    if (booleanOptions.has(name)) {
      flags.add(name);
      continue;
    }
    const next = args[++index];
    if (!next || next.startsWith("--")) throw new Error(`Option --${name} needs a value.`);
    values.set(name, [...(values.get(name) ?? []), next]);
  }
  return { flags, positionals, values };
}

function required(args: ParsedArgs, name: string): string {
  const value = args.values.get(name)?.[0];
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

function removeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

async function output(result: CommandResult, json: boolean): Promise<void> {
  if (json) {
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  } else if (process.stdout.isTTY) {
    await renderResult({ title: result.summary, lines: result.details });
  } else {
    process.stdout.write([result.summary, ...result.details].join("\n") + "\n");
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json")) process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  else if (process.stderr.isTTY) await renderResult({ title: "Norms failed", lines: message.split("\n"), error: true });
  else process.stderr.write(`Norms failed: ${message}\n`);
  process.exitCode = 1;
});
