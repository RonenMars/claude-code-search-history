import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ConversationScanner } from './services/scanner'
import { SearchIndexer } from './services/indexer'

let mainWindow: BrowserWindow | null = null
let scanner: ConversationScanner | null = null
let indexer: SearchIndexer | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function initializeSearch(): Promise<void> {
  scanner = new ConversationScanner()
  indexer = new SearchIndexer()

  console.log('Scanning for conversations...')
  const conversations = await scanner.scanAll()
  console.log(`Found ${conversations.length} conversations`)

  console.log('Building search index...')
  await indexer.buildIndex(conversations)
  console.log('Search index ready')
}

// IPC Handlers
function setupIpcHandlers(): void {
  ipcMain.handle('search', async (_event, query: string, filters?: { project?: string; limit?: number }) => {
    if (!indexer) return []
    return indexer.search(query, filters?.limit || 50, filters?.project)
  })

  ipcMain.handle('get-conversation', async (_event, id: string) => {
    if (!scanner) return null
    return scanner.getConversation(id)
  })

  ipcMain.handle('get-projects', async () => {
    if (!scanner) return []
    return scanner.getProjects()
  })

  ipcMain.handle('get-stats', async () => {
    if (!scanner || !indexer) return { conversations: 0, projects: 0 }
    const projects = scanner.getProjects()
    return {
      conversations: indexer.getDocumentCount(),
      projects: projects.length
    }
  })

  ipcMain.handle('rebuild-index', async () => {
    await initializeSearch()
    return true
  })

  ipcMain.handle(
    'export-conversation',
    async (_event, id: string, format: 'markdown' | 'json' | 'text') => {
      if (!scanner || !mainWindow) return { success: false, error: 'Not initialized' }

      const conversation = await scanner.getConversation(id)
      if (!conversation) return { success: false, error: 'Conversation not found' }

      const extensions: Record<string, string> = {
        markdown: 'md',
        json: 'json',
        text: 'txt'
      }

      const sessionPrefix = conversation.sessionId?.slice(0, 8) || Date.now().toString()
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Conversation',
        defaultPath: `conversation-${sessionPrefix}.${extensions[format]}`,
        filters: [
          { name: format.charAt(0).toUpperCase() + format.slice(1), extensions: [extensions[format]] }
        ]
      })

      if (canceled || !filePath) return { success: false, canceled: true }

      let content: string
      if (format === 'json') {
        content = JSON.stringify(conversation, null, 2)
      } else if (format === 'markdown') {
        content = formatAsMarkdown(conversation)
      } else {
        content = formatAsText(conversation)
      }

      try {
        await writeFile(filePath, content, 'utf-8')
        return { success: true, filePath }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )
}

interface ConversationForExport {
  projectName: string
  sessionId: string
  timestamp: string
  messageCount: number
  messages: Array<{ type: string; content: string; timestamp: string }>
}

function formatAsMarkdown(conversation: ConversationForExport): string {
  const timestamp = conversation.timestamp
    ? new Date(conversation.timestamp).toLocaleString()
    : 'Unknown'

  const lines: string[] = [
    `# Conversation Export`,
    '',
    `**Project:** ${conversation.projectName || 'Unknown'}`,
    `**Session:** ${conversation.sessionId || 'Unknown'}`,
    `**Date:** ${timestamp}`,
    `**Messages:** ${conversation.messageCount || 0}`,
    '',
    '---',
    ''
  ]

  for (const message of conversation.messages || []) {
    const role = message.type === 'user' ? '## You' : '## Claude'
    const time = message.timestamp ? ` *(${new Date(message.timestamp).toLocaleTimeString()})*` : ''
    lines.push(`${role}${time}`)
    lines.push('')
    lines.push(message.content || '')
    lines.push('')
  }

  return lines.join('\n')
}

function formatAsText(conversation: ConversationForExport): string {
  const timestamp = conversation.timestamp
    ? new Date(conversation.timestamp).toLocaleString()
    : 'Unknown'

  const lines: string[] = [
    'CONVERSATION EXPORT',
    '===================',
    '',
    `Project: ${conversation.projectName || 'Unknown'}`,
    `Session: ${conversation.sessionId || 'Unknown'}`,
    `Date: ${timestamp}`,
    `Messages: ${conversation.messageCount || 0}`,
    '',
    '---',
    ''
  ]

  for (const message of conversation.messages || []) {
    const role = message.type === 'user' ? '[You]' : '[Claude]'
    const time = message.timestamp ? ` (${new Date(message.timestamp).toLocaleTimeString()})` : ''
    lines.push(`${role}${time}`)
    lines.push(message.content || '')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.claude-code-search')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  // Initialize search in background
  initializeSearch().catch(console.error)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
