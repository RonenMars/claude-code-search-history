import { describe, it, expect } from "vitest";
import { formatAsMarkdown, formatAsText } from "./formatters";
import { parseWorktrees } from "./worktree-parser";
import {
  buildConversation,
  buildMessage,
  buildAssistantMessage,
} from "../test/factories";

// ─── formatAsMarkdown ───────────────────────────────────────────────

describe("formatAsMarkdown", () => {
  it("generates correct markdown with headers, project info, and message roles", () => {
    const conversation = buildConversation({
      projectName: "my-app",
      sessionId: "sess-001",
      timestamp: "2025-06-01T12:00:00Z",
      messageCount: 2,
      messages: [
        buildMessage({
          content: "How do I fix this?",
          timestamp: "2025-06-01T12:00:00Z",
        }),
        buildAssistantMessage({
          content: "Here is the fix.",
          timestamp: "2025-06-01T12:01:00Z",
        }),
      ],
    });

    const md = formatAsMarkdown(conversation);

    expect(md).toContain("# Conversation Export");
    expect(md).toContain("**Project:** my-app");
    expect(md).toContain("**Session:** sess-001");
    expect(md).toContain("**Messages:** 2");
    expect(md).toContain("## You");
    expect(md).toContain("How do I fix this?");
    expect(md).toContain("## Claude");
    expect(md).toContain("Here is the fix.");
  });

  it("handles empty messages array", () => {
    const conversation = buildConversation({
      messages: [],
      messageCount: 0,
    });

    const md = formatAsMarkdown(conversation);

    expect(md).toContain("# Conversation Export");
    expect(md).toContain("**Messages:** 0");
    // Should not contain any role headers
    expect(md).not.toContain("## You");
    expect(md).not.toContain("## Claude");
  });

  it("handles missing timestamps on messages", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "Hello", timestamp: "" }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    // Role header should appear without a time annotation
    expect(md).toContain("## You");
    expect(md).not.toContain("*(");
    expect(md).toContain("Hello");
  });
});

// ─── formatAsText ───────────────────────────────────────────────────

describe("formatAsText", () => {
  it("generates correct plain text format", () => {
    const conversation = buildConversation({
      projectName: "my-app",
      sessionId: "sess-002",
      timestamp: "2025-06-01T12:00:00Z",
      messageCount: 2,
      messages: [
        buildMessage({
          content: "Help me",
          timestamp: "2025-06-01T12:00:00Z",
        }),
        buildAssistantMessage({
          content: "Sure thing.",
          timestamp: "2025-06-01T12:01:00Z",
        }),
      ],
    });

    const text = formatAsText(conversation);

    expect(text).toContain("CONVERSATION EXPORT");
    expect(text).toContain("===================");
    expect(text).toContain("Project: my-app");
    expect(text).toContain("Session: sess-002");
    expect(text).toContain("Messages: 2");
  });

  it("uses [You] and [Claude] role labels", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "Question" }),
        buildAssistantMessage({ content: "Answer" }),
      ],
    });

    const text = formatAsText(conversation);

    expect(text).toContain("[You]");
    expect(text).toContain("[Claude]");
  });

  it("has separator lines between messages", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "First" }),
        buildAssistantMessage({ content: "Second" }),
      ],
    });

    const text = formatAsText(conversation);

    // Each message block is followed by an empty line, "---", empty line
    const lines = text.split("\n");
    const separatorCount = lines.filter((l) => l === "---").length;
    // Header has one separator, plus one per message
    expect(separatorCount).toBe(3);
  });
});

// ─── parseWorktrees ─────────────────────────────────────────────────

describe("parseWorktrees", () => {
  const porcelainOutput = [
    "worktree /Users/dev/my-project",
    "HEAD abc1234def5678",
    "branch refs/heads/main",
    "",
    "worktree /Users/dev/my-project-feature",
    "HEAD def5678abc1234",
    "branch refs/heads/feature/login",
    "",
    "worktree /Users/dev/my-project-detached",
    "HEAD 1234567890abcd",
    "detached",
  ].join("\n");

  it("parses porcelain output into Worktree[]", () => {
    const result = parseWorktrees(porcelainOutput);
    expect(result).toHaveLength(3);
  });

  it("marks the first block as main worktree", () => {
    const result = parseWorktrees(porcelainOutput);
    expect(result[0].isMain).toBe(true);
  });

  it("marks subsequent blocks as linked (not main)", () => {
    const result = parseWorktrees(porcelainOutput);
    expect(result[1].isMain).toBe(false);
    expect(result[2].isMain).toBe(false);
  });

  it("handles detached HEAD", () => {
    const result = parseWorktrees(porcelainOutput);
    const detached = result[2];
    expect(detached.branch).toBe("(detached)");
  });

  it("returns empty array for empty input", () => {
    expect(parseWorktrees("")).toEqual([]);
  });

  it("returns empty array for malformed input without worktree prefix", () => {
    expect(parseWorktrees("some random text\nno worktree here")).toEqual([]);
  });

  it("all entries share the same projectPath from the first entry", () => {
    const result = parseWorktrees(porcelainOutput);
    for (const w of result) {
      expect(w.projectPath).toBe("/Users/dev/my-project");
    }
  });

  it("produces short SHA (7 chars from HEAD)", () => {
    const result = parseWorktrees(porcelainOutput);
    expect(result[0].head).toBe("abc1234");
    expect(result[0].head).toHaveLength(7);
    expect(result[1].head).toBe("def5678");
    expect(result[1].head).toHaveLength(7);
  });

  it("strips refs/heads/ prefix from branch name", () => {
    const result = parseWorktrees(porcelainOutput);
    expect(result[0].branch).toBe("main");
    expect(result[1].branch).toBe("feature/login");
  });

  it("sets projectName from basename of main worktree path", () => {
    const result = parseWorktrees(porcelainOutput);
    for (const w of result) {
      expect(w.projectName).toBe("my-project");
    }
  });
});
