import { spawnSync } from "node:child_process";

export type Provider = "github" | "gitlab";

export interface ReviewRequest {
  root: string;
  remote: string;
  title: string;
  body: string;
  base?: string;
}

export function detectProvider(remote: string): Provider {
  if (/github\.com[/:]/i.test(remote)) return "github";
  if (/gitlab[^/:]*[/:]/i.test(remote)) return "gitlab";
  throw new Error(`Unsupported Git host in ${remote}. Phase 0 supports GitHub and GitLab.`);
}

export function openReview(request: ReviewRequest): { provider: Provider; url: string } {
  const provider = detectProvider(request.remote);
  const command = provider === "github" ? "gh" : "glab";
  const args =
    provider === "github"
      ? ["pr", "create", "--title", request.title, "--body", request.body]
      : ["mr", "create", "--title", request.title, "--description", request.body, "--yes"];
  if (request.base) {
    args.push(provider === "github" ? "--base" : "--target-branch", request.base);
  }

  const result = spawnSync(command, args, { cwd: request.root, encoding: "utf8" });
  if (result.error?.message.includes("ENOENT")) {
    throw new Error(`Install and authenticate ${command} before running \`norms review\`.`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  const url = result.stdout.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`${command} did not return a review URL.`);
  return { provider, url };
}
