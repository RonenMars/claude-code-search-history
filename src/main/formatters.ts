import type { Conversation } from "../shared/types";

export function formatAsMarkdown(conversation: Conversation): string {
  const timestamp = conversation.timestamp
    ? new Date(conversation.timestamp).toLocaleString()
    : "Unknown";

  const lines: string[] = [
    `# Conversation Export`,
    "",
    `**Project:** ${conversation.projectName || "Unknown"}`,
    `**Session:** ${conversation.sessionId || "Unknown"}`,
    `**Date:** ${timestamp}`,
    `**Messages:** ${conversation.messageCount || 0}`,
    "",
    "---",
    "",
  ];

  for (const message of conversation.messages || []) {
    const role = message.type === "user" ? "## You" : "## Claude";
    const time = message.timestamp
      ? ` *(${new Date(message.timestamp).toLocaleTimeString()})*`
      : "";
    lines.push(`${role}${time}`);
    lines.push("");
    lines.push(message.content || "");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatAsText(conversation: Conversation): string {
  const timestamp = conversation.timestamp
    ? new Date(conversation.timestamp).toLocaleString()
    : "Unknown";

  const lines: string[] = [
    "CONVERSATION EXPORT",
    "===================",
    "",
    `Project: ${conversation.projectName || "Unknown"}`,
    `Session: ${conversation.sessionId || "Unknown"}`,
    `Date: ${timestamp}`,
    `Messages: ${conversation.messageCount || 0}`,
    "",
    "---",
    "",
  ];

  for (const message of conversation.messages || []) {
    const role = message.type === "user" ? "[You]" : "[Claude]";
    const time = message.timestamp
      ? ` (${new Date(message.timestamp).toLocaleTimeString()})`
      : "";
    lines.push(`${role}${time}`);
    lines.push(message.content || "");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
