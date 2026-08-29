import { describe, expect, test } from "bun:test";
import { detectProvider } from "../src/index";

describe("provider detection", () => {
  test("detects GitHub remotes", () => {
    expect(detectProvider("git@github.com:acme/norms.git")).toBe("github");
  });

  test("detects GitLab remotes", () => {
    expect(detectProvider("https://gitlab.com/acme/norms.git")).toBe("gitlab");
  });
});
