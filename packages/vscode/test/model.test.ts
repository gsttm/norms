import { describe, expect, test } from "bun:test";
import { parseNorm, serializeNorm } from "@norms/core";
import {
  focusAccessibility,
  groupNorms,
  normAccessibility,
  repositoryAccessibility,
} from "../src/model";

describe("VS Code norm model", () => {
  const norms = [
    norm("style.zebra", "repository", "Use stripes."),
    norm("docs.short", "shared", "Keep docs short."),
    norm("style.alpha", "repository", "Use alpha."),
  ];

  test("groups, sorts, and filters every norm deterministically", () => {
    expect(groupNorms(norms).map(({ focus, norms }) => ({ focus, ids: norms.map(({ id }) => id) }))).toEqual([
      { focus: "docs", ids: ["docs.short"] },
      { focus: "style", ids: ["style.alpha", "style.zebra"] },
    ]);
    expect(groupNorms(norms, "shared").flatMap(({ norms }) => norms.map(({ id }) => id))).toEqual(["docs.short"]);
    expect(groupNorms(norms, "STRIPES").flatMap(({ norms }) => norms.map(({ id }) => id))).toEqual(["style.zebra"]);
  });

  test("provides complete non-color accessibility labels", () => {
    expect(repositoryAccessibility("app", "3 norms")).toBe("app, 3 norms");
    expect(focusAccessibility("style", 2)).toBe("style, 2 norms");
    expect(normAccessibility(norms[0], true)).toBe("style.zebra, source repository, read-only");
  });
});

function norm(id: string, source: string, body: string) {
  return parseNorm(serializeNorm(id, ["**/*"], body), `${id}.md`, source);
}
