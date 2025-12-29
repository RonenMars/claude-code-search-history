# Claude Code Search History

A native macOS Electron application for searching through all your Claude Code conversation history across local projects.

## Features

- **Fast Full-Text Search**: Uses FlexSearch for instant search across thousands of conversations
- **Project Filtering**: Filter results by specific project
- **Real-Time Results**: Search results update as you type
- **Conversation Preview**: See message previews with search term highlighting
- **Full Conversation View**: View complete conversation history with user/assistant messages

## Installation

### Development Mode

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Install as macOS Application

To build and install as a standalone macOS app:

```bash
# Build and package the app
npm run package
```

This creates a DMG installer at `dist/claude-code-search-history-1.0.0.dmg`.

To install:
1. Double-click the DMG file
2. Drag "Claude Code Search" to your Applications folder
3. Launch from Applications or Spotlight

**Alternative: Direct .app install (no DMG)**

```bash
npm run build
npx electron-builder --mac --dir
```

This creates an unpacked `.app` in `dist/mac-arm64/` (Apple Silicon) or `dist/mac/` (Intel) that you can drag directly to Applications.

### Other Platforms

```bash
# Windows
npm run package:win

# Linux
npm run package:linux
```

## How It Works

The app scans your Claude Code conversation history stored in `~/.claude/projects/`. Each project directory contains JSONL files with conversation data.

On startup, the app:
1. Scans all project directories
2. Parses conversation files
3. Builds a search index using FlexSearch
4. Displays the most recent conversations

## Keyboard Shortcuts

- `Cmd/Ctrl + F`: Focus search input
- `Escape`: Clear search / unfocus

## Tech Stack

- **Electron**: Cross-platform desktop app framework
- **React**: UI library
- **FlexSearch**: High-performance full-text search
- **Tailwind CSS**: Utility-first CSS framework
- **electron-vite**: Fast build tool for Electron

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── index.ts          # App entry point
│   └── services/
│       ├── scanner.ts    # Conversation file scanner
│       └── indexer.ts    # FlexSearch indexing
├── preload/              # Secure IPC bridge
│   └── index.ts
└── renderer/             # React UI
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── SearchBar.tsx
        │   ├── ResultsList.tsx
        │   ├── ConversationView.tsx
        │   └── FilterPanel.tsx
        └── hooks/
            └── useSearch.ts
```

## License

MIT
