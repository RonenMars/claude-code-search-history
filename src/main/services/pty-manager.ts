import * as pty from 'node-pty'
import { platform, homedir } from 'os'
import { join } from 'path'
import type { PtySpawnOptions } from '../../shared/types'

export class PtyManager {
  private process: pty.IPty | null = null
  private onData?: (data: string) => void
  private onExit?: (code: number) => void
  private exitResolvers: Array<() => void> = []
  private killing = false

  setDataHandler(handler: (data: string) => void): void {
    this.onData = handler
  }

  setExitHandler(handler: (code: number) => void): void {
    this.onExit = handler
  }

  spawn(options: PtySpawnOptions): { success: boolean; error?: string } {
    // Force-kill any stale process (fire-and-forget)
    if (this.process) {
      const stale = this.process
      this.process = null
      this.killing = false
      for (const resolve of this.exitResolvers) { resolve() }
      this.exitResolvers = []
      try { stale.kill('SIGKILL') } catch { /* already dead */ }
    }

    try {
      const shell = platform() === 'win32' ? 'cmd.exe' : '/bin/zsh'
      const args: string[] = []

      if (platform() === 'win32') {
        args.push('/c', 'claude')
      } else {
        args.push('-l', '-c', this.buildClaudeCommand(options))
      }

      this.killing = false

      const spawnEnv: NodeJS.ProcessEnv = {
        ...process.env,
        // Unset CLAUDECODE to avoid "nested session" error
        CLAUDECODE: ''
      }
      if (options.configDir) {
        spawnEnv.CLAUDE_CONFIG_DIR = options.configDir.replace(/^~/, homedir())
      } else if (options.profile === 'work') {
        spawnEnv.CLAUDE_CONFIG_DIR = join(homedir(), '.claude-work')
      } else if (options.profile === 'personal') {
        spawnEnv.CLAUDE_CONFIG_DIR = join(homedir(), '.claude-personal')
      }

      const proc = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        env: spawnEnv
      })

      this.process = proc

      proc.onData((data) => {
        this.onData?.(data)
      })

      proc.onExit(({ exitCode }) => {
        // Guard: only clean up if this is still the active process.
        // A stale process's onExit must not null out a newer process.
        if (this.process === proc) {
          this.process = null
          this.killing = false
          for (const resolve of this.exitResolvers) { resolve() }
          this.exitResolvers = []
          this.onExit?.(exitCode)
        }
      })

      return { success: true }
    } catch (err) {
      this.process = null
      return { success: false, error: String(err) }
    }
  }

  private buildClaudeCommand(options: PtySpawnOptions): string {
    const parts = ['claude', '--dangerously-skip-permissions']
    if (options.resumeSessionId) {
      parts.push('--resume', options.resumeSessionId)
    }
    return parts.join(' ')
  }

  write(data: string): void {
    this.process?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.process?.resize(cols, rows)
  }

  /**
   * Kill the process. First call sends SIGINT, second call sends SIGKILL immediately.
   * Returns a promise that resolves when the process has actually exited.
   */
  kill(): Promise<void> {
    if (!this.process) return Promise.resolve()

    const exitPromise = new Promise<void>((resolve) => {
      this.exitResolvers.push(resolve)
    })

    if (this.killing) {
      // Second call — force kill immediately
      this.process.kill('SIGKILL')
    } else {
      // First call — graceful SIGINT
      this.killing = true
      this.process.kill('SIGINT')
      // Force kill after 3 seconds if still alive
      const pid = this.process.pid
      setTimeout(() => {
        if (this.process && this.process.pid === pid) {
          this.process.kill('SIGKILL')
        }
      }, 3000)
    }

    return exitPromise
  }

  isActive(): boolean {
    return this.process !== null
  }

  getPid(): number | undefined {
    return this.process?.pid
  }
}
