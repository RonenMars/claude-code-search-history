import { describe, it, expect } from "vitest";
import { parseWorktrees } from "./worktree-parser";

describe("parseWorktrees edge cases", () => {
  it("returns empty array for empty string", () => {
    expect(parseWorktrees("")).toEqual([]);
  });

  it("parses single main worktree only", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD abcdef1234567890",
      "branch refs/heads/main",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: "/home/user/project",
      head: "abcdef1",
      branch: "main",
      isMain: true,
      projectPath: "/home/user/project",
      projectName: "project",
    });
  });

  it("parses multiple worktrees with linked worktrees", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD aaaaaaa0000000",
      "branch refs/heads/main",
      "",
      "worktree /home/user/project-feat",
      "HEAD bbbbbbb1111111",
      "branch refs/heads/feature/awesome",
      "",
      "worktree /home/user/project-fix",
      "HEAD ccccccc2222222",
      "branch refs/heads/bugfix/typo",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result).toHaveLength(3);
    expect(result[0].isMain).toBe(true);
    expect(result[1].isMain).toBe(false);
    expect(result[2].isMain).toBe(false);
    expect(result[1].branch).toBe("feature/awesome");
    expect(result[2].branch).toBe("bugfix/typo");
  });

  it("shows (detached) for detached HEAD worktree", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD aaaaaaa0000000",
      "branch refs/heads/main",
      "",
      "worktree /home/user/project-detached",
      "HEAD ddddddd3333333",
      "detached",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result[1].branch).toBe("(detached)");
  });

  it("all worktrees share the same projectPath and projectName from the main worktree", () => {
    const input = [
      "worktree /home/user/my-app",
      "HEAD aaaaaaa0000000",
      "branch refs/heads/main",
      "",
      "worktree /tmp/worktree-1",
      "HEAD bbbbbbb1111111",
      "branch refs/heads/dev",
      "",
      "worktree /var/worktree-2",
      "HEAD ccccccc2222222",
      "branch refs/heads/staging",
    ].join("\n");

    const result = parseWorktrees(input);

    for (const w of result) {
      expect(w.projectPath).toBe("/home/user/my-app");
      expect(w.projectName).toBe("my-app");
    }
  });

  it("truncates HEAD to 7 characters", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD abcdef1234567890abcdef1234567890abcdef12",
      "branch refs/heads/main",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result[0].head).toBe("abcdef1");
    expect(result[0].head).toHaveLength(7);
  });

  it("strips refs/heads/ prefix from branch name", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD aaaaaaa0000000",
      "branch refs/heads/feature/deep/nested/branch",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result[0].branch).toBe("feature/deep/nested/branch");
  });

  it("skips malformed block with missing worktree line", () => {
    const input = [
      "worktree /home/user/project",
      "HEAD aaaaaaa0000000",
      "branch refs/heads/main",
      "",
      "HEAD bbbbbbb1111111",
      "branch refs/heads/orphan",
      "",
      "worktree /home/user/project-valid",
      "HEAD ccccccc2222222",
      "branch refs/heads/valid",
    ].join("\n");

    const result = parseWorktrees(input);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/home/user/project");
    expect(result[1].path).toBe("/home/user/project-valid");
  });
});
