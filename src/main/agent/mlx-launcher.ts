/**
 * MLX Launcher — Electron utility process.
 * Resolves the bundled Python 3.11 runtime and spawns mlx_lm.server.
 * Communicates with the main process via process.parentPort (Electron IPC).
 *
 * The main process passes the pythonRuntimePath in the 'start' message so
 * this script has no dependency on `app` from Electron (which is not
 * reliably available in utility processes).
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import net from 'net'

let mlxProc: ChildProcess | null = null
let readyEmitted = false

// ── IPC with main process ─────────────────────────────────────────────────────

process.parentPort.on('message', async ({ data: msg }) => {
  const m = msg as { type: string; hfRepo?: string; port?: number; pythonRuntimePath?: string }
  switch (m.type) {
    case 'start':
      await startMLX(m.hfRepo!, m.port ?? 8765, m.pythonRuntimePath!)
      break
    case 'stop':
      mlxProc?.kill('SIGTERM')
      process.parentPort.postMessage({ type: 'stopped' })
      process.exit(0)
      break
    case 'ping':
      process.parentPort.postMessage({ type: 'pong' })
      break
  }
})

// ── Server startup ────────────────────────────────────────────────────────────

async function startMLX(hfRepo: string, port: number, pythonRuntimePath: string): Promise<void> {
  try {
    const freePort = await findFreePort(port)
    const python = path.join(pythonRuntimePath, 'bin', 'python3.11')
    const sitePackages = path.join(pythonRuntimePath, 'lib', 'python3.11', 'site-packages')

    process.parentPort.postMessage({ type: 'status', status: 'loading' })
    console.log(`[mlx-launcher] Starting mlx_lm.server --model ${hfRepo} --port ${freePort}`)

    mlxProc = spawn(
      python,
      ['-m', 'mlx_lm.server', '--model', hfRepo, '--port', String(freePort)],
      {
        env: {
          ...process.env,
          PYTHONPATH: sitePackages,
          HOME: process.env.HOME ?? '/tmp',
        },
      }
    )

    const onReady = () => {
      if (readyEmitted) return
      readyEmitted = true
      process.parentPort.postMessage({ type: 'ready', url: `http://127.0.0.1:${freePort}/v1` })
    }

    mlxProc.stdout?.on('data', (d: Buffer) => {
      const text = d.toString()
      console.log('[mlx-launcher]', text.trim())
      if (
        text.includes('Running on') ||
        text.includes('Application startup complete') ||
        text.includes('Uvicorn running on')
      ) {
        onReady()
      }
    })

    mlxProc.stderr?.on('data', (d: Buffer) => {
      const text = d.toString()
      // uvicorn writes startup messages to stderr
      if (
        text.includes('Application startup complete') ||
        text.includes('Uvicorn running on') ||
        text.includes('Running on')
      ) {
        onReady()
      } else {
        console.error('[mlx-launcher]', text.trim())
      }
    })

    mlxProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[mlx-launcher] mlx_lm exited with code ${code}`)
        process.parentPort.postMessage({
          type: 'error',
          message: `mlx_lm.server exited with code ${code}`,
        })
      }
    })
  } catch (err) {
    process.parentPort.postMessage({ type: 'error', message: (err as Error).message })
    process.exit(1)
  }
}

// ── Port helper ───────────────────────────────────────────────────────────────

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const s = net.createServer()
      s.listen(port, '127.0.0.1', () => s.close(() => resolve(port)))
      s.on('error', () =>
        port < start + 20 ? tryPort(port + 1) : reject(new Error('No free port found'))
      )
    }
    tryPort(start)
  })
}
