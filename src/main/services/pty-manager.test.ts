import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock node-pty ──────────────────────────────────────────────────

type ExitHandler = (e: { exitCode: number }) => void
type DataHandler = (data: string) => void

interface MockProc {
  pid: number
  onData: (cb: DataHandler) => void
  onExit: (cb: ExitHandler) => void
  write: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  _fireExit: (code: number) => void
  _fireData: (data: string) => void
}

let procCounter = 0
const spawnedProcs: MockProc[] = []

function createMockProc(): MockProc {
  let exitCb: ExitHandler | null = null
  let dataCb: DataHandler | null = null
  const proc: MockProc = {
    pid: ++procCounter,
    onData: (cb) => { dataCb = cb },
    onExit: (cb) => { exitCb = cb },
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    _fireExit: (code) => exitCb?.({ exitCode: code }),
    _fireData: (data) => dataCb?.(data),
  }
  spawnedProcs.push(proc)
  return proc
}

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => createMockProc()),
}))

// Import after mock is set up
import { PtyManager } from './pty-manager'
import * as ptyMod from 'node-pty'

const baseOptions = { instanceId: 'test-1', cwd: '/tmp' }

beforeEach(() => {
  procCounter = 0
  spawnedProcs.length = 0
  vi.clearAllMocks()
})

// ─── Basic lifecycle ────────────────────────────────────────────────

describe('PtyManager', () => {
  it('spawns a process and reports success', () => {
    const mgr = new PtyManager()
    const result = mgr.spawn(baseOptions)

    expect(result).toEqual({ success: true })
    expect(mgr.isActive()).toBe(true)
    expect(mgr.getPid()).toBe(1)
  })

  it('forwards data from PTY to the data handler', () => {
    const mgr = new PtyManager()
    const handler = vi.fn()
    mgr.setDataHandler(handler)
    mgr.spawn(baseOptions)

    spawnedProcs[0]._fireData('hello')

    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('calls exit handler and clears state on process exit', () => {
    const mgr = new PtyManager()
    const exitHandler = vi.fn()
    mgr.setExitHandler(exitHandler)
    mgr.spawn(baseOptions)

    spawnedProcs[0]._fireExit(0)

    expect(exitHandler).toHaveBeenCalledWith(0)
    expect(mgr.isActive()).toBe(false)
    expect(mgr.getPid()).toBeUndefined()
  })

  it('forwards write() to the active process', () => {
    const mgr = new PtyManager()
    mgr.spawn(baseOptions)

    mgr.write('input')

    expect(spawnedProcs[0].write).toHaveBeenCalledWith('input')
  })

  it('forwards resize() to the active process', () => {
    const mgr = new PtyManager()
    mgr.spawn(baseOptions)

    mgr.resize(80, 24)

    expect(spawnedProcs[0].resize).toHaveBeenCalledWith(80, 24)
  })

  // ─── Stale process guard (the bug fix) ────────────────────────────

  describe('stale process guard on re-spawn', () => {
    it('kills stale process when spawn is called again', () => {
      const mgr = new PtyManager()
      mgr.spawn(baseOptions)
      const staleProc = spawnedProcs[0]

      mgr.spawn(baseOptions)

      expect(staleProc.kill).toHaveBeenCalledWith('SIGKILL')
      expect(mgr.getPid()).toBe(2) // new process
    })

    it('stale process exit does NOT fire the exit handler', () => {
      const mgr = new PtyManager()
      const exitHandler = vi.fn()
      mgr.setExitHandler(exitHandler)
      mgr.spawn(baseOptions)
      const staleProc = spawnedProcs[0]

      // Re-spawn replaces the process
      mgr.spawn(baseOptions)

      // Stale process fires onExit asynchronously
      staleProc._fireExit(0)

      // Exit handler must NOT have been called — stale exit is silenced
      expect(exitHandler).not.toHaveBeenCalled()
      // New process is still active
      expect(mgr.isActive()).toBe(true)
      expect(mgr.getPid()).toBe(2)
    })

    it('new process exit still fires the exit handler correctly', () => {
      const mgr = new PtyManager()
      const exitHandler = vi.fn()
      mgr.setExitHandler(exitHandler)
      mgr.spawn(baseOptions)

      mgr.spawn(baseOptions)
      const newProc = spawnedProcs[1]

      newProc._fireExit(42)

      expect(exitHandler).toHaveBeenCalledWith(42)
      expect(mgr.isActive()).toBe(false)
    })
  })

  // ─── Two-phase kill ───────────────────────────────────────────────

  describe('two-phase kill', () => {
    it('first kill sends SIGINT', () => {
      const mgr = new PtyManager()
      mgr.spawn(baseOptions)

      mgr.kill()

      expect(spawnedProcs[0].kill).toHaveBeenCalledWith('SIGINT')
    })

    it('second kill sends SIGKILL', () => {
      const mgr = new PtyManager()
      mgr.spawn(baseOptions)

      mgr.kill()
      mgr.kill()

      expect(spawnedProcs[0].kill).toHaveBeenCalledWith('SIGKILL')
    })

    it('kill resolves when process exits', async () => {
      const mgr = new PtyManager()
      mgr.setExitHandler(() => {})
      mgr.spawn(baseOptions)

      const killPromise = mgr.kill()

      // Not resolved yet
      let resolved = false
      killPromise.then(() => { resolved = true })
      await Promise.resolve() // flush microtasks
      expect(resolved).toBe(false)

      // Fire exit
      spawnedProcs[0]._fireExit(0)
      await killPromise

      expect(resolved).toBe(true)
    })

    it('kill on no process resolves immediately', async () => {
      const mgr = new PtyManager()
      await mgr.kill() // should not throw
    })
  })

  // ─── Registry identity guard (simulates the index.ts fix) ────────

  describe('registry identity guard (StrictMode race condition)', () => {
    it('stale manager exit does not corrupt the registry', () => {
      // Simulate the Map<string, PtyManager> registry from index.ts
      const registry = new Map<string, PtyManager>()
      const exitEvents: Array<{ instanceId: string; code: number }> = []

      // First mount: create manager A
      const managerA = new PtyManager()
      managerA.setExitHandler((code) => {
        // Identity guard: only act if still the active manager
        if (registry.get('inst-1') !== managerA) return
        registry.delete('inst-1')
        exitEvents.push({ instanceId: 'inst-1', code })
      })
      registry.set('inst-1', managerA)
      managerA.spawn(baseOptions)
      const procA = spawnedProcs[0]

      // StrictMode re-mount: kill stale, create manager B
      managerA.kill().catch(() => {})
      registry.delete('inst-1')

      const managerB = new PtyManager()
      managerB.setExitHandler((code) => {
        if (registry.get('inst-1') !== managerB) return
        registry.delete('inst-1')
        exitEvents.push({ instanceId: 'inst-1', code })
      })
      registry.set('inst-1', managerB)
      managerB.spawn(baseOptions)
      const procB = spawnedProcs[1]

      // Stale process A exits (async, after manager B is already active)
      procA._fireExit(0)

      // Registry must still contain manager B
      expect(registry.get('inst-1')).toBe(managerB)
      // No exit event should have been sent
      expect(exitEvents).toHaveLength(0)

      // Manager B's process exits normally
      procB._fireExit(0)

      // Now the exit event fires and registry is cleaned
      expect(exitEvents).toEqual([{ instanceId: 'inst-1', code: 0 }])
      expect(registry.has('inst-1')).toBe(false)
    })

    it('without identity guard, stale exit would corrupt registry', () => {
      // Demonstrate what happens WITHOUT the guard (the original bug)
      const registry = new Map<string, PtyManager>()
      const exitEvents: Array<{ instanceId: string; code: number }> = []

      // Manager A — NO identity guard (the old buggy behavior)
      const managerA = new PtyManager()
      managerA.setExitHandler((code) => {
        // BUG: unconditionally deletes and notifies
        registry.delete('inst-1')
        exitEvents.push({ instanceId: 'inst-1', code })
      })
      registry.set('inst-1', managerA)
      managerA.spawn(baseOptions)
      const procA = spawnedProcs[0]

      // Re-mount: replace with manager B
      managerA.kill().catch(() => {})
      registry.delete('inst-1')

      const managerB = new PtyManager()
      managerB.setExitHandler((code) => {
        registry.delete('inst-1')
        exitEvents.push({ instanceId: 'inst-1', code })
      })
      registry.set('inst-1', managerB)
      managerB.spawn(baseOptions)

      // Stale process A exits
      procA._fireExit(0)

      // BUG: registry no longer contains manager B!
      expect(registry.has('inst-1')).toBe(false) // deleted by stale handler
      // BUG: spurious exit event was sent
      expect(exitEvents).toHaveLength(1)
    })
  })

  // ─── Command building ─────────────────────────────────────────────

  describe('command building', () => {
    it('includes --resume flag when resumeSessionId is provided', () => {
      const spawnSpy = vi.mocked(ptyMod.spawn)
      const mgr = new PtyManager()
      mgr.spawn({ ...baseOptions, resumeSessionId: 'sess-abc' })

      const args = spawnSpy.mock.calls[spawnSpy.mock.calls.length - 1][1] as string[]
      const command = args[args.length - 1]
      expect(command).toContain('--resume')
      expect(command).toContain('sess-abc')
    })

    it('does not include --resume for new sessions', () => {
      const spawnSpy = vi.mocked(ptyMod.spawn)
      const mgr = new PtyManager()
      mgr.spawn(baseOptions)

      const args = spawnSpy.mock.calls[spawnSpy.mock.calls.length - 1][1] as string[]
      const command = args[args.length - 1]
      expect(command).not.toContain('--resume')
    })
  })
})
