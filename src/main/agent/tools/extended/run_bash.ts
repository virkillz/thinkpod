import { exec } from 'child_process'
import type { ToolEntry } from '../types.js'

export const runBashTool: ToolEntry = {
  meta: {
    name: 'run_bash',
    label: 'Run Bash',
    description: 'Execute a bash command and return stdout, stderr, and exit code.',
    category: 'extended',
    defaultEnabled: false,
    dangerous: true,
  },
  definition: {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Execute a bash command or shell script and return its stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command or script to execute.' },
          cwd: { type: 'string', description: 'Working directory to run the command in.' },
          timeout_ms: { type: 'number', description: 'Timeout in milliseconds. Defaults to 10000.' },
        },
        required: ['command'],
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const { command, cwd, timeout_ms = 10_000 } = args as {
      command: string; cwd?: string; timeout_ms?: number
    }
    const timeout = Math.min(timeout_ms, 60_000)
    return new Promise<{ stdout: string; stderr: string; exit_code: number }>((resolve) => {
      exec(command, { cwd, timeout, shell: '/bin/bash' }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exit_code: err?.code ? Number(err.code) : 0,
        })
      })
    })
  },
}
