// ─── Transport Abstraction Layer ─────────────────────────────────────
// Decouples renderer from Electron IPC so the same React code runs in
// both the Electron app and the standalone web client served by `cch serve`.

import type {
  SearchResult,
  Conversation,
  Profile,
} from './types'

// ─── Subset types used by the transport interface ──────────────────────

export interface FilterParams {
  project?: string
  limit?: number
  dateRange?: string
}

export interface ActiveSession {
  id: string
  instanceId: string
  projectPath: string
  projectName: string
  status: 'running' | 'waiting_input' | 'completed' | 'failed' | 'idle'
  branch?: string
  machineName?: string
  lastOutput: string
  elapsedMs: number
  promptCount: number
  startedAt: string   // ISO timestamp
  completedAt?: string
}

// ─── Core Transport Interface ──────────────────────────────────────────

export interface Transport {
  listConversations(filter: FilterParams): Promise<SearchResult[]>
  getConversation(id: string): Promise<Conversation | null>
  search(query: string, filter?: FilterParams): Promise<SearchResult[]>
  getProfiles(): Promise<Profile[]>
  getActiveSessions(): Promise<ActiveSession[]>
  streamTerminal(sessionId: string, onData: (chunk: string) => void): () => void
  sendInput(sessionId: string, input: string): Promise<void>
}

// ─── Electron Transport ────────────────────────────────────────────────
// Delegates to the existing window.electronAPI IPC bridge.

class ElectronTransport implements Transport {
  async listConversations(filter: FilterParams): Promise<SearchResult[]> {
    return window.electronAPI.search('', { project: filter.project, limit: filter.limit })
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return window.electronAPI.getConversation(id)
  }

  async search(query: string, filter?: FilterParams): Promise<SearchResult[]> {
    return window.electronAPI.search(query, { project: filter?.project, limit: filter?.limit })
  }

  async getProfiles(): Promise<Profile[]> {
    return window.electronAPI.getProfiles()
  }

  async getActiveSessions(): Promise<ActiveSession[]> {
    // Electron manages sessions in-process; web client callers subscribe via
    // pty events instead. Return empty — App.tsx manages chatInstances directly.
    return []
  }

  streamTerminal(_sessionId: string, _onData: (chunk: string) => void): () => void {
    // Electron streams terminal data via IPC events (onPtyData), not this transport.
    return () => {}
  }

  async sendInput(_sessionId: string, _input: string): Promise<void> {
    // Electron sends input via ptyInput IPC — not used through this transport.
  }
}

// ─── WebSocket Transport ───────────────────────────────────────────────
// Connects to the Go `cch serve` HTTP/WebSocket server.

class WebSocketTransport implements Transport {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
  }

  private authHeaders(): HeadersInit {
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.authHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
    return res.json() as Promise<T>
  }

  async listConversations(filter: FilterParams): Promise<SearchResult[]> {
    const params = new URLSearchParams()
    if (filter.project) params.set('project', filter.project)
    if (filter.limit) params.set('limit', String(filter.limit))
    const qs = params.toString()
    return this.get<SearchResult[]>(`/api/conversations${qs ? `?${qs}` : ''}`)
  }

  async getConversation(id: string): Promise<Conversation | null> {
    try {
      return await this.get<Conversation>(`/api/conversations/${encodeURIComponent(id)}`)
    } catch {
      return null
    }
  }

  async search(query: string, filter?: FilterParams): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query })
    if (filter?.project) params.set('project', filter.project)
    if (filter?.limit) params.set('limit', String(filter.limit))
    return this.get<SearchResult[]>(`/api/search?${params.toString()}`)
  }

  async getProfiles(): Promise<Profile[]> {
    return this.get<Profile[]>('/api/profiles')
  }

  async getActiveSessions(): Promise<ActiveSession[]> {
    return this.get<ActiveSession[]>('/api/sessions')
  }

  streamTerminal(sessionId: string, onData: (chunk: string) => void): () => void {
    const wsUrl = this.baseUrl
      .replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'))
    const ws = new WebSocket(`${wsUrl}/ws?session=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(this.apiKey)}`)

    ws.addEventListener('message', (e) => onData(e.data as string))
    ws.addEventListener('error', (e) => console.error('[WebSocketTransport] ws error', e))

    return () => ws.close()
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/input`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    if (!res.ok) throw new Error(`sendInput failed: HTTP ${res.status}`)
  }
}

// ─── Transport Factory ─────────────────────────────────────────────────
// Reads window.__TRANSPORT__ at runtime to select the right implementation.
// In Electron: __TRANSPORT__ is undefined → ElectronTransport.
// In web client: __TRANSPORT__ is 'ws' and __WS_BASE__ / __API_KEY__ are set.

declare global {
  interface Window {
    __TRANSPORT__?: 'ws' | 'electron'
    __WS_BASE__?: string
    __API_KEY__?: string
  }
}

let _transport: Transport | null = null

export function getTransport(): Transport {
  if (_transport) return _transport

  if (typeof window !== 'undefined' && window.__TRANSPORT__ === 'ws') {
    const base = window.__WS_BASE__ ?? `${window.location.protocol}//${window.location.host}`
    const key = window.__API_KEY__ ?? ''
    _transport = new WebSocketTransport(base, key)
  } else {
    _transport = new ElectronTransport()
  }

  return _transport
}

// Allow tests to inject a mock transport (pass null to reset the singleton)
export function setTransport(t: Transport | null): void {
  _transport = t
}

export type { Transport as ITransport }
