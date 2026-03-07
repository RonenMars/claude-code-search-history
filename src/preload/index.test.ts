/**
 * Preload contract tests.
 *
 * These verify that the ElectronAPI interface exposes the expected shape
 * and that all IPC channels are correctly wired. We can't run the actual
 * preload in a test environment (it requires Electron's contextBridge),
 * so we verify the contract by checking the type-level API shape and
 * the channel names used.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read the preload source to verify channel wiring
const preloadSource = readFileSync(
  join(__dirname, 'index.ts'),
  'utf-8'
)

describe('Preload API Contract', () => {
  describe('IPC channel mapping', () => {
    // Each preload method should invoke the correct IPC channel
    const expectedChannels = [
      { method: 'search', channel: 'search' },
      { method: 'getConversation', channel: 'get-conversation' },
      { method: 'getProjects', channel: 'get-projects' },
      { method: 'getStats', channel: 'get-stats' },
      { method: 'rebuildIndex', channel: 'rebuild-index' },
      { method: 'getLatestConversation', channel: 'get-latest-conversation' },
      { method: 'exportConversation', channel: 'export-conversation' },
      { method: 'getPreferences', channel: 'get-preferences' },
      { method: 'setPreferences', channel: 'set-preferences' },
      { method: 'ptySpawn', channel: 'pty-spawn' },
      { method: 'ptyInput', channel: 'pty-input' },
      { method: 'ptyResize', channel: 'pty-resize' },
      { method: 'ptyKill', channel: 'pty-kill' },
      { method: 'ptyStatus', channel: 'pty-status' },
      { method: 'getSettings', channel: 'get-settings' },
      { method: 'setSettings', channel: 'set-settings' },
      { method: 'selectDirectory', channel: 'select-directory' },
      { method: 'getDailyStats', channel: 'get-daily-stats' },
      { method: 'getProfilesUsage', channel: 'get-profiles-usage' },
      { method: 'getProfiles', channel: 'get-profiles' },
      { method: 'saveProfiles', channel: 'save-profiles' },
      { method: 'getWorktrees', channel: 'get-worktrees' },
      { method: 'openInFinder', channel: 'open-in-finder' },
      { method: 'isIndexReady', channel: 'is-index-ready' },
      { method: 'getGitInfo', channel: 'get-git-info' },
      { method: 'createWorktree', channel: 'create-worktree' },
    ]

    for (const { method, channel } of expectedChannels) {
      it(`${method} maps to channel '${channel}'`, () => {
        expect(preloadSource).toContain(`'${channel}'`)
      })
    }
  })

  describe('event listener channels', () => {
    it('onIndexReady listens to index-ready', () => {
      expect(preloadSource).toContain("'index-ready'")
    })

    it('onScanProgress listens to scan-progress', () => {
      expect(preloadSource).toContain("'scan-progress'")
    })

    it('onPtyData listens to pty-data', () => {
      expect(preloadSource).toContain("'pty-data'")
    })

    it('onPtyExit listens to pty-exit', () => {
      expect(preloadSource).toContain("'pty-exit'")
    })
  })

  describe('IPC method types', () => {
    // Verify invoke vs send usage
    it('ptyInput uses ipcRenderer.send (fire-and-forget)', () => {
      expect(preloadSource).toMatch(/ptyInput.*ipcRenderer\.send/)
    })

    it('ptyResize uses ipcRenderer.send (fire-and-forget)', () => {
      expect(preloadSource).toMatch(/ptyResize.*ipcRenderer\.send/)
    })

    it('search uses ipcRenderer.invoke (request-response)', () => {
      expect(preloadSource).toMatch(/search.*ipcRenderer\.invoke/)
    })
  })

  describe('listener cleanup', () => {
    it('onScanProgress returns cleanup function', () => {
      // The function should return a removeListener call
      expect(preloadSource).toContain('removeListener')
    })

    it('onPtyData returns cleanup function', () => {
      expect(preloadSource).toContain("removeListener('pty-data'")
    })

    it('onPtyExit returns cleanup function', () => {
      expect(preloadSource).toContain("removeListener('pty-exit'")
    })
  })

  describe('API completeness', () => {
    it('exposes api via contextBridge.exposeInMainWorld', () => {
      expect(preloadSource).toContain("contextBridge.exposeInMainWorld('electronAPI'")
    })
  })
})
