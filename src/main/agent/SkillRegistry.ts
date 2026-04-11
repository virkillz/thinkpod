/**
 * SkillRegistry — discovers and reads SKILL.md-based skills from the vault.
 *
 * Skills follow the same format as Anthropic's Agent Skills:
 *   {vaultPath}/.skills/{skill-name}/SKILL.md
 *
 * Progressive disclosure:
 *   Level 1 — YAML frontmatter (name + description) injected into system prompt at startup
 *   Level 2 — Full SKILL.md body loaded on-demand via the read_skill tool
 *   Level 3 — Bundled sub-files loaded on-demand via read_skill(name, file)
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface SkillMeta {
  name: string
  description: string
  dirPath: string
}

export class SkillRegistry {
  readonly skillsDir: string

  /**
   * Set this once at app startup (in main/index.ts) to make built-in skills
   * available in all vaults without per-vault seeding.
   */
  static builtinSkillsPath: string | null = null

  constructor(vaultPath: string) {
    this.skillsDir = path.join(vaultPath, '.skills')
  }

  /**
   * Discover all installed skills — vault skills + built-in skills.
   * Reads only the YAML frontmatter — Level 1 loading.
   * Vault skills take precedence over built-ins with the same name.
   */
  async discover(): Promise<SkillMeta[]> {
    const [vaultSkills, builtinSkills] = await Promise.all([
      this.scanDir(this.skillsDir),
      SkillRegistry.builtinSkillsPath ? this.scanDir(SkillRegistry.builtinSkillsPath) : Promise.resolve([]),
    ])

    // Merge: vault skills override built-ins with the same name
    const seen = new Set(vaultSkills.map(s => s.name))
    return [...vaultSkills, ...builtinSkills.filter(s => !seen.has(s.name))]
  }

  /**
   * Read the full content of a skill file — Level 2/3 loading.
   * @param skillName  The skill's name (must match a discovered skill's name)
   * @param file       Optional sub-file (e.g. "REFERENCE.md"). Defaults to "SKILL.md".
   */
  async readSkillFile(skillName: string, file = 'SKILL.md'): Promise<string> {
    const skills = await this.discover()
    const skill = skills.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill not found: ${skillName}`)

    // Prevent path traversal
    const resolved = path.resolve(skill.dirPath, file)
    if (!resolved.startsWith(path.resolve(skill.dirPath))) {
      throw new Error('Invalid file path')
    }

    return fs.readFile(resolved, 'utf-8')
  }

  private async scanDir(dir: string): Promise<SkillMeta[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const skills: SkillMeta[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dirPath = path.join(dir, entry.name)
        const skillMdPath = path.join(dirPath, 'SKILL.md')

        try {
          const raw = await fs.readFile(skillMdPath, 'utf-8')
          const meta = parseFrontmatter(raw)
          if (meta.name && meta.description) {
            skills.push({ name: meta.name, description: meta.description, dirPath })
          }
        } catch {
          // Skip directories without a valid SKILL.md
        }
      }

      return skills
    } catch {
      return []
    }
  }

  /**
   * Build the Level-1 metadata block to inject into the system prompt.
   * Each skill is represented as a single line (~15-20 tokens).
   */
  static buildMetadataBlock(skills: SkillMeta[]): string {
    if (skills.length === 0) return ''

    const lines = skills.map(s => `- ${s.name}: ${s.description}`)
    return [
      '## Available Skills',
      '',
      'When the user\'s request matches one of these skills, call read_skill with the skill name to load its full instructions before proceeding.',
      '',
      ...lines,
    ].join('\n')
  }

  /**
   * Ensure the .skills directory exists (called lazily, not on every boot).
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.skillsDir, { recursive: true })
  }
}

// ── YAML frontmatter parser ───────────────────────────────────────────────────

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
    if (key) result[key] = value
  }
  return result
}
