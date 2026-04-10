import path from 'path'

/**
 * Resolve a path argument from the LLM: absolute paths that are already under
 * abbeyPath are used as-is; everything else is joined to abbeyPath.
 */
export function resolvePath(abbeyPath: string, p: string): string {
  if (path.isAbsolute(p)) {
    return p.startsWith(abbeyPath) ? p : path.join(abbeyPath, p)
  }
  return path.join(abbeyPath, p)
}
