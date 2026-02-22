import * as pty from 'node-pty'
import { platform } from 'os'
import type { PtySpawnOptions } from '../../shared/types'

export class PtyManager {
  private process: pty.IPty | null = null
  private onData?: (data: string) => void
  private onExit?: (code: number) => void

  setDataHandler(handler: (data: string) => void): void {
    this.onData = handler
  }

  setExitHandler(handler: (code: number) => void): void {
    this.onExit = handler
  }

  spawn(options: PtySpawnOptions): { success: boolean; error?: string } {
    if (this.process) {
      return { success: false, error: 'A session is already active. Kill it first.' }
    }

    try {
      const shell = platform() === 'win32' ? 'cmd.exe' : '/bin/zsh'
      const args: string[] = []

      if (platform() === 'win32') {
        args.push('/c', 'claude')
      } else {
        args.push('-l', '-c', this.buildClaudeCommand(options))
      }

      this.process = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        env: {
          ...process.env,
          // Unset CLAUDECODE to avoid "nested session" error
          CLAUDECODE: ''
        }
      })

      this.process.onData((data) => {
        this.onData?.(data)
      })

      this.process.onExit(({ exitCode }) => {
        this.process = null
        this.onExit?.(exitCode)
      })

      return { success: true }
    } catch (err) {
      this.process = null
      return { success: false, error: String(err) }
    }
  }

  private buildClaudeCommand(options: PtySpawnOptions): string {
    const parts = ['claude']
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

  kill(): void {
    if (!this.process) return
    // Send SIGINT first (graceful)
    this.process.kill('SIGINT')
    // Force kill after 3 seconds if still alive
    const pid = this.process.pid
    setTimeout(() => {
      if (this.process && this.process.pid === pid) {
        this.process.kill('SIGKILL')
        this.process = null
      }
    }, 3000)
  }

  isActive(): boolean {
    return this.process !== null
  }

  getPid(): number | undefined {
    return this.process?.pid
  }
}
