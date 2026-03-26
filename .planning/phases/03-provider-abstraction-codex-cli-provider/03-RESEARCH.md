# Phase 3: Provider Abstraction + Codex CLI Provider — Research

**Researched:** 2026-03-26
**Domain:** TypeScript provider pattern, Electron IPC extension, JSONL parsing, React filter UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Provider Interface** — lives in `src/main/providers/types.ts`:
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

**Unified Session Model** — `ProviderSession` has: `id`, `provider`, `projectPath`, `title`, `messageCount`, `lastModified`, `model`, `gitBranch?`, `messages`. `Message` has: `role`, `content`, `toolUse?`, `toolResult?`, `inputTokens?`, `outputTokens?`, `model?`. Messages loaded on demand.

**ClaudeProvider** — extract from `src/main/services/scanner.ts`, file `src/main/providers/claude.ts`. Maps existing `ConversationMeta` scan logic to `ProviderSession[]`. `isAvailable()` checks `~/.claude/projects/` exists. `resumeCommand`: `claude --resume <id>`. `ConversationScanner` still used internally — do NOT delete it.

**ProviderRegistry** — file `src/main/providers/registry.ts`. Loads all enabled providers from settings. `scanAll()` calls each provider's `scanSessions()`, merges results, sorts by `lastModified` desc. Auto-detects available providers on first run (adds to enabled list with notification).

**CodexProvider** — file `src/main/providers/codex.ts`. Scan path: `~/.codex/sessions/**/*.jsonl`. JSONL parsing by `type` field: `session_meta`, `event_msg` (role=user), `response_item`, `TokenCount`. `isAvailable()`: checks `~/.codex/sessions/` exists OR `codex` in PATH. `resumeCommand`: `codex resume <session-id>`.

**Main Process Integration** — `initializeSearch()` in `src/main/index.ts` refactored to use `ProviderRegistry`. IPC handlers for search/list get sessions from registry instead of scanner directly. New IPC: `get-providers` (list enabled/available), `set-provider-enabled` (toggle + persist to settings).

**Settings Extension** — `AppSettings` gains `enabledProviders: string[]` (default: `["claude"]`) and `providerPaths: Record<string, string[]>` for path overrides. Settings page gets "Providers" section with toggle + path override per provider.

**Provider Badge UI** — `SearchResult` and `ConversationMeta` gain optional `provider: string` field. `ResultsList` items show badge only when multiple providers are active or provider ≠ "claude". Badge: `text-xs text-muted-foreground border rounded px-1`.

**Provider Filter UI** — Added to `FilterPanel` as multi-select checkboxes. Only shown when 2+ providers are available/enabled. State persisted to `UserPreferences.providerFilter: string[] | null`. `null` = show all.

### Claude's Discretion
- Exact badge color/style (use muted text pill — `text-xs text-muted-foreground border rounded px-1`)
- Whether registry uses a singleton pattern or is instantiated per scan
- Exact search IPC signature changes (add `provider[]` to options object)
- How provider auto-discovery notification is shown (toast is fine)

### Deferred Ideas (OUT OF SCOPE)
- Continue.dev, OpenCode, Amazon Q, Aider providers → Phase 4 & 5
- `better-sqlite3` integration → Phase 4 (OpenCode)
- Product rename to "AI Session Browser" → separate decision
- Cursor provider (Tier 3, reverse-engineered) → not planned
</user_constraints>

---

## Summary

Phase 3 establishes the provider abstraction layer and ships the Codex CLI provider. The codebase already has a well-defined scanner/indexer/IPC pipeline — the task is to insert a registry layer between `initializeSearch()` and the existing `ConversationScanner` without changing downstream IPC channel names or renderer-side API shapes.

The `ConversationMeta` and `SearchResult` types in `src/shared/types.ts` need a single additive field (`provider?: string`) each. The `AppSettings` type needs two new optional fields. No existing field names change. The IPC handler for `"search"` gets a `provider` array added to its filters object — a backward-compatible extension since the filters object is already optional and destructured.

The most complex part is the `ProviderRegistry` wiring in `initializeSearch()`: replacing `scanner.scanAllMeta()` with `registry.scanAll()` while keeping `getConversation()`, `getProjects()`, `getLatestForProject()`, and the export flow intact. These currently reach directly into `ConversationScanner` — they need to route through the registry to the correct provider.

**Primary recommendation:** Build the provider system as a thin coordination layer over the existing `ConversationScanner`. `ClaudeProvider` is essentially a wrapper that delegates to `ConversationScanner` internally. `ProviderRegistry` aggregates results. The renderer changes are purely additive (new optional badge, new optional filter).

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Purpose | Notes |
|---------|---------|-------|
| Node.js `fs/promises` + `readline` | JSONL file reading | Already used in `scanner.ts` — same pattern for `codex.ts` |
| Node.js `path`, `os` | Path resolution | Already used throughout |
| FlexSearch (existing `SearchIndexer`) | Full-text search | `IndexedDocument` needs `provider` field added to stored fields |
| Vitest | Testing | Already configured, `npm test` runs vitest |

### No New Dependencies Required
Codex JSONL parsing uses the same readline-over-stream pattern already in `scanner.ts`. No additional npm packages needed for Phase 3. `better-sqlite3` is deferred to Phase 4.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended Directory Structure
```
src/main/
├── providers/
│   ├── types.ts          # AssistantProvider interface, ProviderSession, Message types
│   ├── registry.ts       # ProviderRegistry class
│   ├── claude.ts         # ClaudeProvider (wraps ConversationScanner)
│   └── codex.ts          # CodexProvider (new JSONL parser)
├── services/
│   ├── scanner.ts        # UNCHANGED — still used by ClaudeProvider internally
│   └── indexer.ts        # MINOR CHANGE — add `provider` to IndexedDocument + stored fields
└── index.ts              # CHANGED — initializeSearch() uses ProviderRegistry
```

### Pattern 1: Provider as ConversationScanner Adapter
The `ClaudeProvider` wraps `ConversationScanner` rather than re-implementing scanning logic.

`scanSessions()` calls `scanner.scanAllMeta()` and maps each `ConversationMeta` to `ProviderSession`.
`loadSession()` calls `scanner.getConversation(session.id)` and maps the result to a populated `ProviderSession`.

This means `ClaudeProvider` needs to hold a `ConversationScanner` instance internally, constructed from the enabled profiles list.

### Pattern 2: Registry as Pass-Through for Per-Conversation Operations
The `ProviderRegistry` must support `getSession(id)` that routes to the correct provider. Since each session's `id` embeds the provider (via `provider` field on `ProviderSession`), the registry can dispatch lookups by maintaining a `Map<string, AssistantProvider>` keyed by provider id.

The existing IPC `"get-conversation"` currently calls `scanner.getConversation(id)`. With the registry, the `id` is still the file path (for Claude) so routing works: the registry's session map tells it which provider owns a given session id.

### Pattern 3: Additive SearchResult/ConversationMeta Extension
Add `provider?: string` to `ConversationMeta` (used by indexer), `SearchResult` (sent to renderer), and the internal `IndexedDocument` in `indexer.ts`. The FlexSearch `Document` constructor's `store` array needs `'provider'` added.

Because it's optional (`?`), all existing code that creates these objects without a `provider` field keeps compiling without changes.

### Pattern 4: Account Filter → Provider Filter (same structural pattern)
The existing profile/account filter pattern is the exact template for the provider filter:
- `accountFilter: string | null` in App.tsx state → `providerFilter: string[] | null` (multi-select vs single)
- `FilterPanel` renders profile select only when `enabledProfiles.length > 1` → provider checkboxes only when 2+ providers enabled
- `ResultsList.showProfileBadge = enabledProfiles.length > 1` → `showProviderBadge = activeProviders.length > 1 || (activeProviders.length === 1 && activeProviders[0] !== 'claude')`

Note: Provider filter is `string[] | null` (multi-select checkboxes) while account filter is `string | null` (single select dropdown). The filtering logic in `sortedResults` useMemo in App.tsx needs to handle the array intersection.

### Anti-Patterns to Avoid
- **Deleting ConversationScanner:** The spec is explicit — keep it. ClaudeProvider delegates to it.
- **Re-implementing Claude JSONL parsing in ClaudeProvider:** ClaudeProvider wraps scanner, not duplicates it.
- **Changing existing IPC channel names:** `"search"`, `"get-conversation"`, `"get-projects"` etc. must keep the same names. Only add new channels (`"get-providers"`, `"set-provider-enabled"`).
- **Breaking the export flow:** The `"export-conversation"` IPC handler and the `"context-menu:show"` handler both call `scanner.getConversation(id)` directly. These must be updated to go through `registry.getSession(id)`.
- **Storing `enabledProviders` in preferences.json:** It goes in `settings.json` (via `AppSettings`) not `preferences.json` (via `UserPreferences`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Recursive JSONL file discovery | Custom glob implementation | Reuse `findJsonlFiles()` pattern from `scanner.ts` — it already handles recursion, skips `.` dirs, skips `subagents/tool-results/` |
| PATH lookup for `codex` binary | Shell exec + parse | `import { execFileNoThrow } from '../utils/execFileNoThrow'` — already in the codebase |
| Result deduplication by id | Custom Set logic | Virutally free: build a `Map<string, ProviderSession>` keyed by `session.id` in `scanAll()` |
| Progress reporting during scan | New IPC channel | Reuse existing `"scan-progress"` IPC push and `scanner.setProgressCallback()` pattern |

---

## Common Pitfalls

### Pitfall 1: IndexedDocument Missing `provider` in FlexSearch `store` Array
**What goes wrong:** FlexSearch stores only fields listed in the `store` array. If `provider` isn't in `store`, the search result returned from `indexer.search()` will have `provider: undefined` even if it was set on the document.

**How to avoid:** In `indexer.ts`, update the `Document` constructor:
```typescript
store: ['id', 'projectName', 'projectPath', 'sessionId', 'sessionName',
        'timestamp', 'messageCount', 'lastMessageSender', 'account', 'provider']
```
And add `provider?: string` to `IndexedDocument` interface.

### Pitfall 2: Export Flow and Context Menu Still Reference `scanner` Directly
**What goes wrong:** `"export-conversation"` IPC handler and the `"context-menu:show"` handler call `scanner.getConversation(id)` — a module-level `let scanner` variable. After the refactor, `scanner` will be managed inside `ClaudeProvider`/`ProviderRegistry`, not exposed at module scope.

**How to avoid:** Replace `scanner.getConversation(id)` calls in both handlers with `registry.getSession(id)`. The registry's `getSession()` must return a full `Conversation`-compatible object. Since `ClaudeProvider.loadSession()` returns a `ProviderSession`, there needs to be a mapping step, or `registry.getSession()` can return the existing `Conversation` type for backward compatibility.

**Recommendation:** Keep a thin adapter in the registry: `getConversation(id: string): Promise<Conversation | null>` that routes to the correct provider's `loadSession()` and maps `ProviderSession` back to `Conversation`. This avoids changing the export formatter (`formatAsMarkdown`, `formatAsText`) which expect `Conversation`.

### Pitfall 3: `getProjects()` Becomes Provider-Aware
**What goes wrong:** `scanner.getProjects()` currently returns projects from Claude sessions only. `"get-worktrees"` and `"get-git-info"` IPC handlers call `scanner.getProjects()`. After refactor, these should include projects from all enabled providers (or at least Claude ones, since git operations only make sense for Claude-origin sessions).

**How to avoid:** `ProviderRegistry.getProjects()` should return the union of all provider projects. Git operations remain scoped to projects that are actual git repos — the git commands handle that gracefully with non-zero exit codes already.

### Pitfall 4: `initializeSearch()` Called from Multiple Places with Different Signatures
**What goes wrong:** `initializeSearch(profiles: Profile[])` is called in: `app.whenReady()`, `"rebuild-index"` handler, `"save-profiles"` handler, and `"set-settings"` handler. After refactor, the registry needs both `profiles` AND settings (`enabledProviders`, `providerPaths`) to initialize.

**How to avoid:** Change `initializeSearch()` signature to load settings internally (it already loads settings in some callers). Or pass a combined config object. The simplest approach: `initializeSearch()` calls `loadSettings()` at its start to get provider config, then calls `loadProfilesConfig()` — both are async reads. This avoids signature changes at all call sites.

### Pitfall 5: Codex Session ID vs File Path as `id`
**What goes wrong:** Claude sessions use `filePath` as the `id` (a stable, unique key). Codex sessions should also use file path as `id` for consistency. The `sessionId` field from `session_meta.session.id` is a separate identifier used for the `resumeCommand`. Mixing these up breaks `getConversation(id)` routing.

**How to avoid:** In `CodexProvider`, set `ProviderSession.id = filePath` (the `.jsonl` path) and `ProviderSession.sessionId = session_meta.session.id` (the Codex-native UUID for the resume command). `resumeCommand()` uses `session.sessionId`.

### Pitfall 6: Codex JSONL `type` Values Are Different from Claude JSONL `type` Values
**What goes wrong:** Claude's JSONL uses `type: "user" | "assistant"`. Codex uses `type: "session_meta" | "event_msg" | "response_item" | "TokenCount"`. A naive shared parser would misinterpret Codex lines.

**How to avoid:** `CodexProvider` has its own dedicated parser. It does not reuse or call into `ConversationScanner`'s parsing methods. The parsing dispatch is entirely on the `type` field values specific to Codex format.

### Pitfall 7: providerFilter UI — Multi-Select vs Single-Select
**What goes wrong:** The existing account filter uses a `<select>` (single value). The spec requires provider filter to be multi-select checkboxes. Using `<select multiple>` is tempting but renders poorly cross-platform and doesn't match the app's UI style.

**How to avoid:** Render provider filter as a group of checkboxes or toggle buttons, similar to a small button group. Each provider gets a checkbox that independently toggles. State is `providerFilter: string[] | null` — `null` means all selected.

---

## Code Examples

### Codex JSONL Line Types
```typescript
// Source: CONTEXT.md (spec document, 2026-03-27)

// session_meta — first line of a Codex session file
{ type: "session_meta", session: { id: "uuid", title: "...", cwd: "/path", createdAt: 1234567890 } }

// event_msg — user message
{ type: "event_msg", role: "user", content: "fix the bug" }

// response_item — assistant message
{ type: "response_item", message: { content: [{ type: "text", text: "..." }], model: "gpt-4o" } }

// TokenCount — token metadata
{ type: "TokenCount", inputTokens: 1234, outputTokens: 567 }
```

### Minimal `ProviderSession` Mapping from `ConversationMeta` (for ClaudeProvider)
```typescript
// Maps existing ConversationMeta → ProviderSession
function metaToSession(meta: ConversationMeta): ProviderSession {
  return {
    id: meta.id,              // filePath — stable key
    provider: 'claude',
    projectPath: meta.projectPath,
    title: meta.sessionName || meta.preview?.slice(0, 80) || meta.sessionId,
    messageCount: meta.messageCount,
    lastModified: meta.timestamp,
    model: undefined,         // not stored in meta — available only in full conversation
    messages: [],             // loaded on demand via loadSession()
  }
}
```

### `initializeSearch()` Shape After Refactor
```typescript
// Conceptual outline — exact shape is Claude's discretion
async function initializeSearch(profiles: Profile[]): Promise<void> {
  const settings = await loadSettings()
  const registry = new ProviderRegistry(profiles, settings)
  const metas = await registry.scanAll()           // returns ConversationMeta[] for indexer compat
  indexer = new SearchIndexer()
  await indexer.buildIndex(metas)
  indexerReady = true
}
```

### FilterPanel — Provider Filter Section Pattern
```typescript
// Mirror of the existing profile filter section (lines 86-113 of FilterPanel.tsx)
// Shown only when 2+ providers are available
{enabledProviders.length > 1 && (
  <div className="space-y-1">
    <p className="text-xs text-neutral-500">Providers</p>
    {enabledProviders.map((providerId) => (
      <label key={providerId} className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={providerFilter === null || providerFilter.includes(providerId)}
          onChange={() => handleProviderToggle(providerId)}
        />
        {providerDisplayName(providerId)}
      </label>
    ))}
  </div>
)}
```

### Provider Badge in ResultsList Item
```typescript
// Badge style from spec (Claude's discretion for exact styling)
// Only shown when showProviderBadge is true
{showProviderBadge && result.provider && result.provider !== 'claude' && (
  <span className="text-xs text-muted-foreground border rounded px-1 ml-1">
    {result.provider}
  </span>
)}
```

### ElectronAPI Extension (preload/index.ts)
```typescript
// New entries added to ElectronAPI interface
getProviders: () => Promise<Array<{ id: string; displayName: string; enabled: boolean; available: boolean }>>
setProviderEnabled: (providerId: string, enabled: boolean) => Promise<boolean>
```

---

## Wiring Map: Where Each Change Touches

This section directly answers the research questions posed in the task.

### Q1: How `initializeSearch()` wires scanner → indexer → IPC
**Current flow:**
1. `initializeSearch(profiles)` → creates `ConversationScanner(profiles)` → `scanner.scanAllMeta()` → `SearchIndexer.buildIndex(metas)` → sets `indexerReady = true` → `mainWindow.send("index-ready")`
2. `"search"` IPC → `indexer.search(query, limit, project)` → returns `SearchResult[]`
3. `"get-conversation"` IPC → `scanner.getConversation(id)` → returns `Conversation | null`
4. `"get-projects"` IPC → `scanner.getProjects()` → returns `string[]`

**After Phase 3:**
- `initializeSearch()` creates `ProviderRegistry` instead of `ConversationScanner` directly. `ProviderRegistry` internally creates the appropriate providers (ClaudeProvider, CodexProvider if enabled).
- `registry.scanAll()` replaces `scanner.scanAllMeta()`. Returns `ConversationMeta[]` (same type, with optional `provider` field) for backward-compatible indexer input.
- Module-level `scanner` variable is replaced by `registry`. `indexer` variable unchanged.
- `"get-conversation"` IPC calls `registry.getConversation(id)` (routes to correct provider).
- `"get-projects"` IPC calls `registry.getProjects()` (union of all provider projects).

### Q2: Minimal `SearchResult` change
Add `provider?: string` to `SearchResult` in `src/shared/types.ts`. Also add to `ConversationMeta` (same file) and `IndexedDocument` interface in `src/main/services/indexer.ts`. The FlexSearch `Document` store array needs `'provider'` added. All existing code compiles unchanged since the field is optional.

### Q3: `AppSettings` extension
Current `AppSettings` in `src/shared/types.ts`:
```typescript
interface AppSettings {
  maxChatInstances: number
  displayMode: DisplayMode
  profilesDir?: string
}
```
Add:
```typescript
  enabledProviders?: string[]      // default: ["claude"] — undefined treated as ["claude"]
  providerPaths?: Record<string, string[]>  // custom scan paths per provider id
```
Both optional with defaults applied in `loadSettings()` via `{ ...DEFAULT_SETTINGS, ...parsed }` pattern. `DEFAULT_SETTINGS` gains `enabledProviders: ['claude']` and `providerPaths: {}`.

### Q4: FilterPanel prop interface extension
Current props: `profiles`, `accountFilter`, `onAccountFilterChange`.
Add: `enabledProviders: string[]`, `providerFilter: string[] | null`, `onProviderFilterChange: (filter: string[] | null) => void`.

`enabledProviders` is the list of currently active provider IDs (fetched via `"get-providers"` IPC on startup, stored in App.tsx state). The provider filter section renders only when `enabledProviders.length > 1`.

The `onAccountFilterChange` → `setAccountFilter` callback in App.tsx is called `handleFilterByProfile` — the equivalent for provider is a new `handleProviderFilterChange` callback that sets `providerFilter` state and also filters `sortedResults` in the useMemo.

### Q5: Export and context menu
**`"export-conversation"` handler** (line ~344 of `index.ts`): calls `scanner.getConversation(data.id)`. Must change to `registry.getConversation(id)`.

**`"context-menu:show"` handler** (line ~698 of `index.ts`): the `doExport` closure calls `scanner.getConversation(data.id)`. Must change to `registry.getConversation(id)`.

**`"get-latest-conversation"` handler**: calls `scanner.getLatestForProject(projectPath)` → `scanner.getConversation(meta.id)`. Must change to `registry.getLatestForProject(projectPath)` → `registry.getConversation(id)`.

**`"get-worktrees"` and `"get-git-info"`**: call `scanner.getProjects()`. Change to `registry.getProjects()`.

**`resumeCommand` in PTY spawn flow**: Currently the PTY spawn uses `sessionId` from the conversation's `account` field and the profile's `configDir`. With providers, `resumeCommand` varies. The existing `"pty-spawn"` flow constructs `claude --resume <id>` based on the profile config. Codex sessions use `codex resume <session-id>` instead — a different binary. This affects `handleContinueChat` in App.tsx and the context menu "Open in New Chat". The `resumeCommand` is provider-specific. For Phase 3: Codex sessions should NOT show "Open in New Chat" in the context menu (or the button should be hidden for non-claude providers). The `provider` field on `SearchResult` enables this check in the UI.

### Q6: TypeScript types — shared vs provider-specific
**`src/shared/types.ts`** (renderer + main process share these):
- Add `provider?: string` to `ConversationMeta` and `SearchResult`
- Add `enabledProviders?: string[]` and `providerPaths?: Record<string, string[]>` to `AppSettings`
- Add `providerFilter?: string[] | null` to `UserPreferences`

**`src/main/providers/types.ts`** (main process only — new file):
- `AssistantProvider` interface
- `ProviderSession` type
- `Message` type (provider-level message model, distinct from `ConversationMessage` in shared types)

The two message models coexist: `ConversationMessage` (rich Claude-specific shape used by renderer for display) and `Message` (lean provider-level shape). `ClaudeProvider.loadSession()` maps `Conversation.messages` (ConversationMessage[]) to `Message[]` and back, or the registry maintains the `Conversation` type for backward compatibility with the renderer.

---

## State of the Art

| Old Approach | Phase 3 Approach | Impact |
|--------------|------------------|--------|
| Direct `ConversationScanner` usage in `initializeSearch()` | `ProviderRegistry` aggregates multiple providers | All existing IPC channels preserved |
| `scanner` module-level variable | `registry` module-level variable; `ClaudeProvider` holds scanner internally | Export/context menu must be updated |
| `account` field only on `SearchResult` | `account` + optional `provider` field | Badge and filter become possible |
| Hard-coded Claude scan paths in scanner | Provider's `defaultPaths` + `providerPaths` overrides from settings | Flexible path customization |

---

## Open Questions

1. **`resumeCommand` for Codex sessions via PTY**
   - What we know: Codex uses `codex resume <session-id>`. The existing PTY spawn uses a `PtySpawnOptions` with `resumeSessionId` and `configDir`.
   - What's unclear: Does the existing PTY manager need a `command` override to run `codex` instead of `claude`? Or is "Open in New Chat" simply hidden for Codex sessions?
   - Recommendation: Hide "Open in New Chat" context menu item and "Continue chat" button for non-claude providers in Phase 3. PTY/terminal resume for Codex is a separate concern deferred to later. Phase 3 spec says `resumeCommand` returns `string | null` — null for providers without resume support, or a shell string the caller can use. The PTY infrastructure for running arbitrary commands is beyond Phase 3 scope.

2. **ProviderRegistry singleton vs per-scan instantiation**
   - What we know: Left to Claude's discretion per CONTEXT.md.
   - Recommendation: Singleton pattern (module-level `let registry: ProviderRegistry | null`). Consistent with existing `scanner` and `indexer` module variables. Re-created on `initializeSearch()` calls (already the pattern for scanner/indexer).

3. **Auto-discovery notification mechanism**
   - What we know: Registry should auto-detect available providers on first run and notify. CONTEXT.md says "toast is fine."
   - What's unclear: The app has no existing toast infrastructure — need to either add a simple toast component or use the OS notification API.
   - Recommendation: Send an IPC push event `"provider-detected"` to the renderer with the provider list; App.tsx renders a dismissible notification div (simple, no library needed). This matches the `"scan-progress"` push pattern.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Behavior | Test Type | File | Status |
|----------|-----------|------|--------|
| `AssistantProvider` interface compliance (ClaudeProvider) | unit | `src/main/providers/claude.test.ts` | Wave 0 gap |
| `AssistantProvider` interface compliance (CodexProvider) | unit | `src/main/providers/codex.test.ts` | Wave 0 gap |
| `ProviderRegistry.scanAll()` merges and sorts sessions | unit | `src/main/providers/registry.test.ts` | Wave 0 gap |
| CodexProvider JSONL parser handles all 4 line types | unit | `src/main/providers/codex.test.ts` | Wave 0 gap |
| `SearchResult.provider` field flows through indexer | unit | `src/main/services/indexer.test.ts` | Extend existing |
| FilterPanel renders provider filter when 2+ providers | unit | `src/renderer/src/components/FilterPanel.test.tsx` | Extend existing |
| `ResultsList` shows/hides provider badge correctly | unit | `src/renderer/src/components/ResultsList.test.tsx` | Extend existing |
| Claude sessions unaffected when Codex disabled | integration | `src/main/providers/registry.test.ts` | Wave 0 gap |
| Settings `enabledProviders` persists and reloads | unit | `src/main/index.test.ts` | Extend existing |

### Sampling Rate
- Per task commit: `npm test`
- Per wave merge: `npm run test:coverage`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/providers/claude.test.ts` — ClaudeProvider wrapping ConversationScanner
- [ ] `src/main/providers/codex.test.ts` — CodexProvider JSONL parsing (fixture-based)
- [ ] `src/main/providers/registry.test.ts` — ProviderRegistry merge/sort, auto-discovery, disabled provider exclusion

*(Existing test files for `indexer.test.ts`, `FilterPanel.test.tsx`, `ResultsList.test.tsx` need new test cases added, not new files.)*

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `src/main/index.ts` — full IPC handler inventory and `initializeSearch()` implementation
- Direct code reading: `src/main/services/scanner.ts` — `ConversationScanner` full implementation
- Direct code reading: `src/main/services/indexer.ts` — `IndexedDocument`, FlexSearch config, `search()` method
- Direct code reading: `src/shared/types.ts` — `ConversationMeta`, `SearchResult`, `AppSettings`, `UserPreferences` current shapes
- Direct code reading: `src/renderer/src/components/FilterPanel.tsx` — prop interface and profile filter pattern
- Direct code reading: `src/renderer/src/App.tsx` — `accountFilter` state, `handleFilterByProfile`, `sortedResults` useMemo, FilterPanel/ResultsList prop threading
- Direct code reading: `src/preload/index.ts` — full `ElectronAPI` interface definition
- `.planning/phases/03-provider-abstraction-codex-cli-provider/03-CONTEXT.md` — locked decisions and spec

### Secondary (MEDIUM confidence)
- `.planning/multi-assistant-support.md` — Codex JSONL format specification (based on prior research, 2026-03-16)
- `.planning/ROADMAP.md` — phase scope and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from source files, no external dependency research needed
- Architecture: HIGH — derived from direct code reading; all wiring points verified in source
- Pitfalls: HIGH — identified from concrete code paths observed in source files
- Codex JSONL format: MEDIUM — sourced from spec document (prior research); not verified against live Codex CLI installation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable TypeScript/Electron patterns, Codex CLI format unlikely to change rapidly)
