import path from 'path'

/**
 * Resolve a path argument from the LLM: absolute paths that are already under
 * vaultPath are used as-is; everything else is joined to vaultPath.
 */
export function resolvePath(vaultPath: string, p: string): string {
  if (path.isAbsolute(p)) {
    return p.startsWith(vaultPath) ? p : path.join(vaultPath, p)
  }
  return path.join(vaultPath, p)
}
