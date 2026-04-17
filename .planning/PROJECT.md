# Project: claude-search (Electron)

## Overview
Threadbase Electron is a desktop session browser for AI coding assistant history. It scans, indexes, searches, and displays conversation history from Claude Code and other AI coding tools.

## Current Milestone
**Milestone 2: Multi-Assistant Support**
Add support for Codex CLI, Continue.dev, OpenCode, Amazon Q, and Aider providers alongside Claude Code.

## Stack
- Electron + React + TypeScript
- Tailwind CSS v4
- FlexSearch for full-text indexing
- better-sqlite3 for SQLite reads (Phase 4+)
- IPC: contextBridge + ipcMain/ipcRenderer

## Key Files
- `src/main/index.ts` — main process, IPC handlers
- `src/main/scanner.ts` — Claude session scanner (to be refactored into ClaudeProvider)
- `src/renderer/src/App.tsx` — root renderer component
- `src/renderer/src/components/ResultsList.tsx` — conversation list
- `src/renderer/src/components/FilterPanel.tsx` — filters sidebar

## Notes
- Milestone 1 (Context Menus + Speed Search) was planned but not executed — skipped in favor of Milestone 2
- Provider pattern must keep Claude behavior unchanged when other providers are disabled
