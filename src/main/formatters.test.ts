import { describe, it, expect } from "vitest";
import { formatAsMarkdown, formatAsText } from "./formatters";
import {
  buildConversation,
  buildMessage,
  buildAssistantMessage,
} from "../test/factories";

// ─── formatAsMarkdown – edge cases ──────────────────────────────────

describe("formatAsMarkdown edge cases", () => {
  it("handles messages with unicode content", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "Hello \u{1F30D} \u2014 em-dash, \u201Ccurly quotes\u201D, \u65E5\u672C\u8A9E\u30C6\u30B9\u30C8" }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    expect(md).toContain("Hello \u{1F30D} \u2014 em-dash, \u201Ccurly quotes\u201D, \u65E5\u672C\u8A9E\u30C6\u30B9\u30C8");
  });

  it("handles messages with markdown special characters in content", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({
          content: "Use `code` and **bold** and [link](url) and # heading",
        }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    // Markdown special chars should pass through unescaped
    expect(md).toContain("Use `code` and **bold** and [link](url) and # heading");
  });

  it("handles conversation with null/undefined timestamp gracefully", () => {
    const conversation = buildConversation({
      timestamp: undefined as unknown as string,
      messages: [
        buildMessage({ content: "test", timestamp: undefined as unknown as string }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    expect(md).toContain("**Date:** Unknown");
    // Message should appear without time annotation
    expect(md).toContain("## You");
    expect(md).not.toContain("*(");
    expect(md).toContain("test");
  });

  it("handles message with empty content string", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "" }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    expect(md).toContain("## You");
    // Empty content produces an empty line between role header and next section
    const lines = md.split("\n");
    const youIndex = lines.findIndex((l) => l.startsWith("## You"));
    // Line after header is blank, then content (empty string), then blank
    expect(lines[youIndex + 1]).toBe("");
    expect(lines[youIndex + 2]).toBe("");
  });

  it("maps non-user message types to Claude role label", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ type: "system" as "user", content: "System prompt" }),
      ],
      messageCount: 1,
    });

    const md = formatAsMarkdown(conversation);

    // Any type !== 'user' should render as "## Claude"
    expect(md).toContain("## Claude");
    expect(md).not.toContain("## You");
    expect(md).toContain("System prompt");
  });
});

// ─── formatAsText – edge cases ──────────────────────────────────────

describe("formatAsText edge cases", () => {
  it("handles messages with unicode content", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "H\u00E9llo w\u00F6rld \u4F60\u597D \u{1F389}" }),
      ],
      messageCount: 1,
    });

    const text = formatAsText(conversation);

    expect(text).toContain("H\u00E9llo w\u00F6rld \u4F60\u597D \u{1F389}");
  });

  it("handles messages with markdown special characters in content", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "**bold** _italic_ `code` [link](url)" }),
      ],
      messageCount: 1,
    });

    const text = formatAsText(conversation);

    expect(text).toContain("**bold** _italic_ `code` [link](url)");
  });

  it("handles conversation with null/undefined timestamp gracefully", () => {
    const conversation = buildConversation({
      timestamp: undefined as unknown as string,
      messages: [
        buildMessage({ content: "test", timestamp: undefined as unknown as string }),
      ],
      messageCount: 1,
    });

    const text = formatAsText(conversation);

    expect(text).toContain("Date: Unknown");
    expect(text).toContain("[You]");
    // No time annotation in parentheses after role
    expect(text).not.toMatch(/\[You\] \(/);
  });

  it("handles message with empty content string", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "" }),
      ],
      messageCount: 1,
    });

    const text = formatAsText(conversation);

    expect(text).toContain("[You]");
    const lines = text.split("\n");
    const youIndex = lines.findIndex((l) => l.startsWith("[You]"));
    // Next line is the empty content
    expect(lines[youIndex + 1]).toBe("");
  });

  it("separator between messages is ---\\n\\n", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ content: "First message" }),
        buildAssistantMessage({ content: "Second message" }),
      ],
      messageCount: 2,
    });

    const text = formatAsText(conversation);

    // After each message block: content \n \n --- \n \n
    // Verify the separator pattern exists between messages
    expect(text).toContain("First message\n\n---\n\n[Claude]");
  });

  it("maps non-user message types to Claude role label", () => {
    const conversation = buildConversation({
      messages: [
        buildMessage({ type: "system" as "user", content: "System instruction" }),
      ],
      messageCount: 1,
    });

    const text = formatAsText(conversation);

    expect(text).toContain("[Claude]");
    expect(text).not.toContain("[You]");
    expect(text).toContain("System instruction");
  });
});
