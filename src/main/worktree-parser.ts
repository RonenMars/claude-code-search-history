import { basename } from "path";
import type { Worktree } from "../shared/types";

export function parseWorktrees(stdout: string): Worktree[] {
  const blocks = stdout.trim().split(/\n\n+/);

  const parseBlock = (
    block: string,
  ): { path: string; head: string; branch: string } | null => {
    const lines = block.split("\n");
    const get = (prefix: string): string =>
      lines
        .find((l) => l.startsWith(prefix))
        ?.slice(prefix.length)
        .trim() ?? "";
    const path = get("worktree ");
    if (!path) return null;
    const head = get("HEAD ").slice(0, 7);
    const rawBranch = get("branch ");
    const isDetached = lines.some((l) => l === "detached");
    const branch = isDetached
      ? "(detached)"
      : rawBranch.replace(/^refs\/heads\//, "");
    return { path, head, branch };
  };

  // Block 0 is always the main worktree — its path is the canonical projectPath
  const mainEntry = parseBlock(blocks[0]);
  if (!mainEntry) return [];
  const projectPath = mainEntry.path;
  const projectName = basename(projectPath);

  return blocks
    .map((block, index) => {
      const entry = parseBlock(block);
      if (!entry) return null;
      return {
        path: entry.path,
        head: entry.head,
        branch: entry.branch,
        isMain: index === 0,
        projectPath,
        projectName,
      } satisfies Worktree;
    })
    .filter((w): w is Worktree => w !== null);
}
