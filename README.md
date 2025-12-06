# Claude Code Search History

A native macOS Electron application for searching through all your Claude Code conversation history across local projects.

## Features

- **Fast Full-Text Search**: Uses FlexSearch for instant search across thousands of conversations
- **Project Filtering**: Filter results by specific project
- **Real-Time Results**: Search results update as you type
- **Conversation Preview**: See message previews with search term highlighting
- **Full Conversation View**: View complete conversation history with user/assistant messages

## Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for macOS
npm run package
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
