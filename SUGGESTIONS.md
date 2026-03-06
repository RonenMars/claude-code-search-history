# Claude Code Search — Feature Suggestions

## Optimizations

### 1. Incremental Re-indexing with File Watcher
`scanner.ts:36` — `scanAllMeta()` clears and re-scans **everything** on each refresh. With many conversations, this is slow. A much better approach:
- Use `chokidar` (already in the Electron ecosystem) to watch `~/.claude/projects/` (and profile dirs) for new/modified `.jsonl` files
- Only parse the changed files and update the in-memory cache + FlexSearch index incrementally
- The user would see new conversations appear **automatically** without clicking refresh

### 2. LRU Cache is Very Small
`scanner.ts:13` — `LRU_MAX = 5` means navigating 6+ conversations evicts cached ones, forcing a full re-parse on every revisit. Bumping to 20–50 would eliminate almost all re-parsing latency.

---

## New Features

### 3. Token Usage Analytics
`scanner.ts:279–284` — `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens` are parsed into every message's metadata but never surfaced in the UI.

Ideas:
- Show token counts per message in `ConversationView`
- Show total tokens per conversation in `ResultsList`
- Add a **Stats panel** showing per-project totals and approximate API cost (model is tracked in `metadata.model`)

### 4. Keyboard Navigation in the Sidebar
No arrow-key navigation in `ResultsList`. Adding `↑`/`↓` to move through conversations and `Enter` to open them would make the app much faster to use as a power tool.

### 5. Pinned / Starred Conversations
A lightweight local JSON file (in `~/.claude/`) storing starred conversation IDs. Starred conversations appear at the top of the list with a ⭐ indicator. No backend required — just `fs.readFile`/`fs.writeFile`.

### 6. Group-by-Project View
Currently all conversations are in one flat sorted list. An optional "grouped" mode that collapses conversations by project (with a count badge) would help users who work across many repos.

### 7. Copy Message Button
In `ConversationView`, hovering a message could show a copy-to-clipboard icon. Simple, but very useful when referencing Claude's past answers.

### 8. Search Within Tool Results
`scanner.ts:300` — `textParts` only accumulates human-readable text content. Tool results (file paths read, bash output, etc.) aren't indexed. Adding file paths from `ReadToolResult`/`WriteToolResult`/`EditToolResult` to the search index would let you find "which conversation edited `api/auth.ts`?".

---

## Priority Order

| Priority | Item | Effort |
|---|---|---|
| 🔴 High | File watcher + incremental indexing | Medium |
| 🔴 High | Token/cost analytics | Small |
| 🟡 Medium | Keyboard navigation | Small |
| 🟡 Medium | Increase LRU cache | Trivial |
| 🟡 Medium | Copy message button | Small |
| 🟢 Low | Pinned conversations | Medium |
| 🟢 Low | Group by project view | Medium |
| 🟢 Low | Search tool results | Small |
