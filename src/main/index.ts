import { app, shell, BrowserWindow, ipcMain } from 'electron'
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
