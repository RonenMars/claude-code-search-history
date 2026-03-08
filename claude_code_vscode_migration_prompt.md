Be ruthless about migration ROI: maximize reuse of domain logic,
minimize Electron baggage, and rebuild the UX as a VS Code‑native
extension rather than a desktop clone.

# Claude Code Prompt --- Electron App → VS Code Extension Migration

You are migrating an existing Electron + React + TypeScript desktop app
into a VS Code extension.

This is NOT a greenfield rewrite and NOT a superficial scaffold. Treat
it as a careful product-and-architecture migration with maximum reuse of
domain logic, deliberate UI redesign for VS Code primitives, and strict
separation between reusable core logic and VS Code-specific integration.

Act like the staff engineer responsible for shipping this migration to
production: preserve the product's core value, reject architecture
drift, document tradeoffs, and implement in small verifiable stages with
tests.

---

## Output location

Create the VS Code extension migration in a separate folder.

Target directory: ../claude-history-vscode-extension

Rules: - All new VS Code extension files must be created under the
target directory. - Do not overwrite or restructure the existing
Electron app in place. - Treat the current Electron app as the source
project to read from and reuse from. - Only copy or extract code from
the existing app when needed, and place the migrated result under the
target directory. - Preserve the original Electron app untouched unless
explicitly approved. - Use the target directory as the root for imports,
configs, and build tooling.

Assume the current repository is read‑only reference material unless
explicitly instructed otherwise.

---

# Product context

The current app is a native Electron application used for searching,
browsing, and interacting with Claude Code conversation history across
local projects.

Core capabilities include:

## Search and indexing

- Full‑text search using FlexSearch
- Two‑tier indexing (metadata first, full content lazy loaded)
- Batched scanning of JSONL conversation files
- Search highlighting in results and full conversation view

## Filtering and sorting

- Project filters
- Profile/account filters
- Date range filters
- Sort by recent/oldest/message count/alphabetical
- Combined multi‑criteria filtering

## Conversation list/sidebar

- Virtualized list
- Project grouping
- Result counters
- Git/worktree badges
- Profile badges
- Last message indicators
- Live chat indicators

## Conversation viewer

- Markdown rendering
- Syntax highlighted code blocks
- Collapsible JSON blocks
- Tool result cards
- Tool invocation badges
- Message navigation
- Token/model metadata
- Export conversation
- Continue conversation
- Copy messages

## Embedded Claude chat

- xterm.js terminal backed by node‑pty
- Multiple concurrent Claude sessions
- Chat in project or resume conversation
- Profile selection before starting chat

## Profiles

- Multiple Claude config directories
- Default profile support
- CRUD profile management
- Persistence in profiles.json

## Git worktrees

- Worktree detection
- Branch/worktree badges
- Chat in worktree
- Create worktrees
- Navigate between worktree and root repo

## Settings and preferences

- Max chat instances
- Group by project
- Default profile
- Scan progress indicator
- Manual refresh

## Performance features

- Dark theme
- Virtualization
- Debounced search
- LRU conversation cache

## Technical stack

- Electron main process
- preload bridge
- shared domain types
- React renderer
- services for scanner/indexer/pty
- Vitest unit tests
- Playwright + Electron E2E tests

---

# Migration Objective

Build a production‑quality VS Code extension that allows developers to:

- Search Claude Code conversation history
- Filter and browse conversations
- View full conversations with rich rendering
- Resume or continue conversations from the current workspace
- Support multiple Claude profiles
- Understand project/worktree context

Do NOT migrate irrelevant desktop shell features such as: - custom
window chrome - Dock integration - DMG packaging - standalone
application lifecycle

---

# Migration Principles

## 1. Extract reusable core logic

Create a reusable platform‑agnostic core layer containing:

- conversation scanning/parsing
- metadata extraction
- indexing/search
- filter logic
- sorting logic
- project/worktree detection
- export serialization
- caching logic
- profile resolution
- shared domain types

The core must: - contain no Electron imports - contain no VS Code
imports - expose clean APIs - be unit testable

---

## 2. Prefer VS Code native primitives

Use:

- TreeView / TreeDataProvider
- Commands + QuickPick
- WebviewPanels only when necessary
- VS Code terminals instead of custom PTY where possible
- VS Code settings API
- Status bar / progress notifications

Avoid recreating the Electron UI inside a single webview.

---

## 3. Design for developer workflows

Prioritize:

- current workspace
- git repository context
- worktrees
- keyboard‑first workflows

---

# Implementation Stages

## Stage 0 --- Migration analysis

Produce:

1.  Migration assessment
2.  Feature parity matrix
3.  Target architecture document
4.  Execution plan

Classify each feature as:

- Full parity
- Partial redesign
- Deferred
- Dropped

---

## Stage 1 --- Extract reusable core

Create:

src/core/

Modules may include:

- types
- scanner
- indexer
- search
- filters
- git
- profiles
- export
- cache

Refactor logic from the Electron project into this core layer.

---

## Stage 2 --- VS Code extension scaffold

Create extension project:

- package.json
- extension.ts
- command registration
- configuration schema
- output logging

Initial commands:

- Claude History: Search
- Claude History: Refresh Index
- Claude History: Open Workspace Conversations
- Claude History: Select Profile
- Claude History: Continue Conversation

---

## Stage 3 --- Search service

Implement search/index service in extension host.

Responsibilities:

- resolve profile directories
- scan history folders
- build metadata index
- lazy load conversations
- cache conversations

Maintain metadata‑first indexing strategy.

---

## Stage 4 --- Navigation UI

Use TreeView for conversation lists.

Support:

- project grouping
- badges for profile/branch/date
- workspace filtering
- refresh commands

Use QuickPick dialogs for advanced filters if needed.

---

## Stage 5 --- Conversation viewer

Create webview panel that supports:

- markdown rendering
- syntax highlighted code
- collapsible JSON blocks
- tool result cards
- token metadata
- copy message
- export conversation

Use extension → webview messaging bridge.

---

## Stage 6 --- Profiles

Implement profile management using:

- extension settings
- QuickPick commands

Support:

- add/edit/remove profiles
- default profile
- config validation

---

## Stage 7 --- Git/worktree integration

Implement:

- repo/worktree detection
- branch badges
- workspace‑scoped conversations
- chat in workspace

Creating worktrees may be deferred if complexity outweighs value.

---

## Stage 8 --- Chat integration

Evaluate two options:

### Option A (preferred)

Use VS Code native terminals to run Claude CLI.

### Option B

Implement custom xterm webview backed by node‑pty.

Prefer Option A unless strong justification exists.

Document tradeoffs before implementing.

---

## Stage 9 --- Settings & persistence

Use:

- contributes.configuration
- context.globalState
- context.workspaceState

Support:

- default profile
- grouping preferences
- chat instance limits
- scan progress

---

## Stage 10 --- Testing

### Unit tests

Test core modules thoroughly.

### Extension integration tests

Test commands, services, views.

### E2E smoke tests

Validate extension activation and main flows.

Focus on high ROI tests protecting real behavior.

---

# Expected User Workflows

### Search history

Search across Claude conversations.

### Workspace conversations

Show conversations related to the current repo/workspace.

### Conversation viewer

Read conversations with rich rendering.

### Resume conversation

Continue a conversation from the current workspace.

### Start Claude session

Launch Claude CLI from workspace context.

---

# Target Project Structure

src/ extension.ts commands/ services/ views/ core/ utils/ test/

Optional packages structure:

packages/ core/ extension/

---

## Output location

Build the migration in a separate folder:

Target directory:
../vscode-claude-code-manager

Important rules:

- Create all new extension code, docs, configs, and tests only inside this target directory.
- Do not modify the existing Electron app in place.
- Read from the existing project as the source of truth, but write the migrated implementation only into the target directory.
- If code is reused or extracted, copy/adapt it into the target directory structure.
- You must never create new migration files in the existing Electron app root. All migration artifacts, code, docs, and tests must go only into the target directory.

---

# Work Mode

Work iteratively:

1.  design
2.  implement
3.  test
4.  document
5.  summarize progress

Do not stop at scaffolding. Deliver working implementation.

---

# First task

Start with Stage 0.

Analyze the existing Electron project and produce:

- migration assessment
- feature parity matrix
- target architecture
- execution plan
- initial core extraction refactor

Then proceed to implementation.
