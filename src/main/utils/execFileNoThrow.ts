import { execFile } from 'child_process'

export interface ExecFileResult {
  stdout: string
  stderr: string
  code: number
}

/**
 * Promise wrapper around Node's execFile.
 * Never throws — errors are returned in the result object.
 * Uses execFile (not the shell-based variant) to prevent injection vulnerabilities.
 */
export function execFileNoThrow(
  file: string,
  args: string[],
  options: { cwd: string }
): Promise<ExecFileResult> {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: options.cwd }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: err ? ((err.code as number) ?? 1) : 0,
      })
    })
  })
}
