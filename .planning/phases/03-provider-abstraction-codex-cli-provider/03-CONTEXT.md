# Phase 3: Provider Abstraction + Codex CLI Provider — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** multi-assistant-support.md (spec document)

<domain>
## Phase Boundary

This phase establishes the `AssistantProvider` abstraction and ships the first non-Claude provider (OpenAI Codex CLI). All existing Claude behavior must be preserved. No UI redesign — only additive changes: provider badge on list items, provider filter in FilterPanel, and a provider settings section.

</domain>

<decisions>
## Implementation Decisions

### Provider Interface (locked from spec)
- Interface lives in `src/main/providers/types.ts`
- Shape:
  ```typescript
  interface AssistantProvider {
    id: string
    displayName: string
    defaultPaths: string[]
    isAvailable(): Promise<boolean>
    scanSessions(paths: string[]): Promise<ProviderSession[]>
    loadSession(session: ProviderSession): Promise<ProviderSession>
    resumeCommand(session: ProviderSession): string | null
  }
  ```

### Unified Session Model (locked from spec)
- `ProviderSession` has: `id`, `provider`, `projectPath`, `title`, `messageCount`, `lastModified`, `model`, `gitBranch?`, `messages`
- `Message` has: `role`, `content`, `toolUse?`, `toolResult?`, `inputTokens?`, `outputTokens?`, `model?`
- Messages loaded on demand (scanSessions returns metadata only)

### ClaudeProvider (locked)
- Extract from `src/main/services/scanner.ts`
- File: `src/main/providers/claude.ts`
- Maps existing `ConversationMeta` scan logic to `ProviderSession[]`
- `isAvailable()`: checks if `~/.claude/projects/` exists
- `resumeCommand`: `claude --resume <id>`

### ProviderRegistry (locked)
- File: `src/main/providers/registry.ts`
- Loads all enabled providers from settings
- `scanAll()`: calls each provider's `scanSessions()`, merges results, sorts by `lastModified` desc
- Auto-detects available providers on first run (adds to enabled list with notification)

### CodexProvider (locked)
- File: `src/main/providers/codex.ts`
- Scan path: `~/.codex/sessions/**/*.jsonl`
- JSONL parsing by `type` field:
  - `session_meta` → session header (id, title, cwd, timestamp)
  - `event_msg` where role=user → user message
  - `response_item` → assistant message
  - `TokenCount` → token metadata
- `isAvailable()`: checks if `~/.codex/sessions/` exists OR `codex` is in PATH
- `resumeCommand`: `codex resume <session-id>`

### Main Process Integration (locked)
- `initializeSearch()` in `src/main/index.ts` refactored to use `ProviderRegistry`
- `ConversationScanner` still used by `ClaudeProvider` internally (don't delete it)
- IPC handlers for search/list still work — they now get sessions from registry instead of scanner directly
- New IPC: `get-providers` → returns list of enabled/available providers
- New IPC: `set-provider-enabled` → toggle provider on/off, persists to settings

### Settings Extension (locked)
- `AppSettings` gains `enabledProviders: string[]` (default: `["claude"]`)
- `providerPaths: Record<string, string[]>` for path overrides per provider
- Settings page gets "Providers" section showing all detected providers with toggle + path override

### Provider Badge UI (locked)
- `SearchResult` and `ConversationMeta` gain optional `provider: string` field
- `ResultsList` items show badge only when multiple providers are active or provider ≠ "claude"
- Badge style: small pill, muted color — `[codex]`, `[claude]`

### Provider Filter UI (locked)
- Added to `FilterPanel` as multi-select checkboxes
- Only shown when 2+ providers are available/enabled
- State persisted to `UserPreferences.providerFilter: string[] | null`
- `null` = show all (default)

### Claude's Discretion
- Exact badge color/style (use muted text pill — `text-xs text-muted-foreground border rounded px-1`)
- Whether registry uses a singleton pattern or is instantiated per scan
- Exact search IPC signature changes (add `provider[]` to options object)
- How provider auto-discovery notification is shown (toast is fine)

</decisions>

<specifics>
## Specific Implementation Notes

**JSONL format for Codex (from research):**
Each line is JSON with a `type` field. Key types:
- `{ type: "session_meta", session: { id, title, cwd, createdAt } }`
- `{ type: "event_msg", role: "user", content: "..." }`
- `{ type: "response_item", message: { content: [...], model: "..." } }`
- `{ type: "TokenCount", inputTokens: N, outputTokens: N }`

**Existing scanner.ts keeps working:** `ClaudeProvider` wraps it. Don't delete `ConversationScanner` — it's the implementation detail of `ClaudeProvider`.

**SearchResult type:** Currently has `account` field (profile). Adding `provider` field follows the same pattern.

**FilterPanel:** Currently shows profile filter when `enabledProfiles.length > 1`. Provider filter follows same conditional logic.

</specifics>

<deferred>
## Deferred to Later Phases

- Continue.dev, OpenCode, Amazon Q, Aider providers → Phase 4 & 5
- `better-sqlite3` integration → Phase 4 (OpenCode)
- Product rename to "AI Session Browser" → separate decision
- Cursor provider (Tier 3, reverse-engineered) → not planned

</deferred>

---

*Phase: 03-provider-abstraction-codex-cli-provider*
*Context gathered: 2026-03-27 via spec document (multi-assistant-support.md)*
