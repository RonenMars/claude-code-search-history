# Implementation Prompt: Full-Text Search in Claude Code Conversation History

> **Target project:** `/Users/ronen/Desktop/dev/personal/vscode-claude-code-manager/`
> **Feature:** Rich search UI for browsing and searching Claude Code conversation history within VS Code

---

## Prompt

You are implementing the most important missing feature in the **vscode-claude-code-manager** VS Code extension: a rich, interactive search experience for Claude Code conversation history. The extension already has a sidebar tree, conversation viewer, and folder list — but search is limited to a basic input box that filters the tree. We need a dedicated search panel with real-time results, filters, and in-conversation highlighting.

### Phase 0: Research & Codebase Analysis

**Use these tools before writing any code:**

1. **Serena** (`/serena`) — Activate the project at `/Users/ronen/Desktop/dev/personal/vscode-claude-code-manager/` and analyze:
   - `src/core/indexer.ts` — The existing `SearchIndexer` class using FlexSearch. Understand `buildIndex()`, `search()`, result shape, and scoring.
   - `src/core/scanner.ts` — How `ConversationScanner.scanAllMeta()` builds `contentSnippet` (first 5000 chars) and `preview` (first 200 chars). This is the searchable corpus.
   - `src/core/types.ts` — Full type definitions for `ConversationMeta`, `SearchResult`, `Conversation`, `ConversationMessage`.
   - `src/core/filters.ts` — Existing `applyFilters()` and `applySorting()` functions.
   - `src/services/HistoryService.ts` — The orchestrator that wires scanner + indexer.
   - `src/webview/protocol.ts` and `src/webview/listProtocol.ts` — Message protocol patterns between extension host and webview.
   - `src/webview/ConversationPanel.ts` and `src/webview/ConversationListPanel.ts` — Panel factory patterns (Map-keyed singletons, HTML generation, CSP nonce).
   - `src/webview-ui/App.tsx` — Conversation viewer layout, inline styles with VS Code CSS variables, MessageItem component.
   - `src/webview-ui-list/App.tsx` — List viewer with FilterBar, ConversationCard, useMemo filtering.
   - `src/extension.ts` — Command registration, HistoryService wiring, session management.
   - `src/providers/ConversationTreeProvider.ts` — Tree building, search mode, compacted path segments.
   - `esbuild.js` — Three-bundle build config (extension, webview, webview-list). Search will need a fourth bundle.
   - `package.json` — Commands, views, menus, activation events.
   - `tsconfig.json` and `tsconfig.webview.json` — TypeScript config (note: webview-ui-list must be excluded from main tsconfig).

2. **Context7** (`resolve-library-id` + `query-docs`) — Research:
   - **FlexSearch** — Advanced query syntax, document search options, field boosting, pagination, async search. The current indexer uses basic `.search()` — can we use `.searchAsync()`, field weights, or custom tokenizers for better results?
   - **VS Code Extension API** — `WebviewView` vs `WebviewPanel` for search. Can we use `registerWebviewViewProvider` to embed search in the sidebar? What about `window.createInputBox` vs webview-based search input?
   - **VS Code Extension API** — `TreeView` reveal/selection API for programmatic tree navigation after search.

3. **Octocode** — Research reference implementations:
   - Search for VS Code extensions that implement search panels in webviews (e.g., `vscode-search-everywhere`, `vscode-gitlens` search).
   - Look at how FlexSearch is used in production VS Code extensions for document search patterns.
   - Research the Claude Code CLI source (if public at `anthropics/claude-code`) for how conversation JSONL files are structured — confirm the parsing assumptions in `scanner.ts`.

4. **Sequential Thinking** (`sequentialthinking`) — Work through these design decisions step by step:
   - **Where should search live?** Options: (A) Dedicated webview panel like ConversationListPanel, (B) WebviewViewProvider embedded in sidebar below the tree, (C) QuickPick-based overlay. Consider: persistent results, screen real estate, discoverability, keyboard-first UX.
   - **Full-text vs message-level search?** Current indexer searches `contentSnippet` (first 5000 chars per conversation). Should we index ALL message text? What about tool results? What's the memory/perf tradeoff for 10K+ conversations?
   - **Search result granularity?** Return conversations (current) vs individual messages within conversations? Message-level results would need a different index structure.
   - **Real-time vs debounced search?** FlexSearch is fast but with 10K+ documents, should we debounce input? What's the target latency?
   - **How to highlight matches in the conversation viewer?** Current `highlightQuery` protocol message exists but the implementation in `MessageContent.tsx` needs verification.

### Phase 1: Design & Planning

**Use these tools to create the implementation plan:**

5. **Brainstorming** (`/brainstorming`) — Explore approaches:
   - **Approach A: Search Panel (new webview)** — Fourth esbuild bundle, dedicated search panel opening in ViewColumn.One with query input, filters, paginated results, click-to-open.
   - **Approach B: Sidebar Search View** — `registerWebviewViewProvider` in the existing `claude-history` activity bar container. Search lives below the tree, always visible.
   - **Approach C: Enhanced Tree Search** — Keep search in tree but add a webview header panel with filters, date ranges, regex toggle, project scope.
   - Evaluate: UX flow, implementation complexity, reuse of existing components, keyboard accessibility.

6. **Writing Plans** (`/writing-plans`) — After design approval, create a step-by-step implementation plan covering:
   - New files to create, existing files to modify
   - Build config changes (esbuild bundle, tsconfig)
   - Package.json contributions (commands, views, menus, keybindings)
   - Protocol types (search-specific messages)
   - Core search enhancements (indexer upgrades)
   - React components (search input, result list, filter controls)
   - Integration points (tree ↔ search, search → conversation viewer)
   - Testing strategy

7. **Task Master AI** (`parse_prd` + `get_tasks`) — Break the plan into ordered, dependency-aware tasks suitable for parallel agent execution.

### Phase 2: Implementation

**Use these tools to execute the plan:**

8. **Dispatching Parallel Agents** (`/dispatching-parallel-agents`) — Identify independent work streams:
   - **Stream A (Core):** Indexer enhancements, new search protocol types, search service methods
   - **Stream B (UI):** Search webview React app, components, styling
   - **Stream C (Extension):** Panel factory, command registration, keybindings, tree integration
   - **Stream D (Build):** esbuild config, tsconfig, package.json

9. **Subagent-Driven Development** (`/subagent-driven-development`) — Execute each task with:
   - Implementation agent (writes code)
   - Spec compliance review (verifies against plan)
   - Code quality review (checks conventions, types, edge cases)

### Existing Architecture to Preserve

**Build system:**
- esbuild with 3 bundles: extension (`out/extension.js`), webview (`out/webview/main.js`), webview-list (`out/webview-list/main.js`)
- All webview bundles need `jsx: 'automatic'` (esbuild ignores tsconfig's jsx setting)
- `tsconfig.json` excludes `src/webview-ui/**/*` and `src/webview-ui-list/**/*` (no DOM/JSX in extension host)
- `tsconfig.webview.json` covers all webview code

**Styling convention:**
- ALL webview styling uses **inline styles with VS Code CSS variables** (e.g., `var(--vscode-foreground)`, `var(--vscode-input-background)`)
- NO Tailwind, NO CSS files, NO className strings
- Theme-aware: everything adapts to light/dark/high-contrast automatically

**Panel pattern:**
- Static `Map<key, Panel>` for singleton-per-key management
- `createOrShow` / `openX` factory methods
- CSP with nonce, `localResourceRoots`, `webview.asWebviewUri()`
- `generateNonce()` from `src/webview/utils.ts`

**Protocol pattern:**
- Discriminated union types: `type ExtensionMessage = { type: 'foo'; ... } | { type: 'bar'; ... }`
- Webview posts `{ type: 'ready' }` on mount, extension responds with data
- `postMessage()` shim in each webview-ui's `vscodeApi.ts`

**React pattern:**
- Functional components with hooks
- `useMemo` for derived/filtered data
- `useCallback` for stable handler references
- `React.forwardRef` for scrollable message refs
- `memo()` for pure display components

### Functional Requirements

1. **Search input** — Text field with:
   - Debounced search (200-300ms)
   - Clear button
   - Result count display
   - Keyboard shortcut to focus (`Cmd+Shift+F` or configurable)

2. **Search results list** — Scrollable list showing:
   - Conversation title (sessionName or truncated sessionId)
   - Project name
   - Match preview with highlighted query terms (±80 chars context)
   - Timestamp (relative: "2h ago", "3 days ago")
   - Message count badge
   - Click → opens conversation in ConversationPanel with query highlighting

3. **Filter controls** — Above results:
   - Date range: All time | Today | This week | This month | Custom range
   - Project scope: All projects | Current workspace | Specific project
   - Sort by: Relevance | Recent | Most messages
   - Account/profile filter (if multiple profiles configured)

4. **In-conversation highlighting** — When opening a result:
   - Pass query to ConversationPanel via `highlightQuery` message
   - MessageContent.tsx should highlight matching terms in yellow/accent
   - Auto-scroll to first match

5. **Integration with existing tree:**
   - Search command in tree title bar (magnifying glass icon)
   - Search results update the tree view OR open the search panel
   - Clear search restores normal tree

### Non-Functional Requirements

- Search must return results in <100ms for typical queries on 10K+ conversations
- Index rebuild on `claudeHistory.refresh` must include search index
- Memory: FlexSearch index + metadata should stay under ~50MB for 10K conversations
- Keyboard-navigable: Tab through results, Enter to open, Escape to clear

### Key Files Reference

| File | Role | Lines |
|------|------|-------|
| `src/core/indexer.ts` | FlexSearch document indexer | ~120 |
| `src/core/scanner.ts` | JSONL parser, metadata extractor | ~350 |
| `src/core/types.ts` | All domain types | ~180 |
| `src/core/filters.ts` | Sort/filter functions | ~80 |
| `src/services/HistoryService.ts` | Scanner + Indexer orchestrator | ~80 |
| `src/extension.ts` | Extension entry, commands, sessions | ~200 |
| `src/providers/ConversationTreeProvider.ts` | Sidebar tree | ~250 |
| `src/webview/ConversationPanel.ts` | Conversation viewer panel | ~130 |
| `src/webview/ConversationListPanel.ts` | Folder list panel | ~120 |
| `src/webview/protocol.ts` | Viewer message types | ~30 |
| `src/webview/listProtocol.ts` | List message types | ~30 |
| `src/webview/utils.ts` | Shared utilities (nonce) | ~10 |
| `src/webview-ui/App.tsx` | Conversation viewer React app | ~320 |
| `src/webview-ui-list/App.tsx` | Folder list React app | ~150 |
| `esbuild.js` | Build config (3 bundles) | ~60 |
| `package.json` | Extension manifest | ~100 |
| `tsconfig.json` | Extension host TS config | ~25 |
| `tsconfig.webview.json` | Webview TS config | ~20 |

### Success Criteria

- [ ] User can press `Cmd+Shift+H` (or similar) to open search
- [ ] Typing a query shows matching conversations in <100ms
- [ ] Results show highlighted preview snippets
- [ ] Clicking a result opens the conversation with matches highlighted
- [ ] Filters narrow results by date, project, profile
- [ ] Search panel follows VS Code theming (light/dark/high-contrast)
- [ ] Zero TypeScript errors, builds cleanly with `node esbuild.js`
- [ ] Existing tree search (`claudeHistory.search`) continues to work
