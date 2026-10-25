import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APPEARANCE_COLOR_ROLES, APPEARANCE_PALETTE_DEFINITIONS } from '../src/config/appearance/appearance-definitions.ts'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..')
const PALETTE_DIRECTORY = resolve(PACKAGE_DIRECTORY, 'src/config/appearance/css/palettes')
const OUTPUT_FILE = resolve(PACKAGE_DIRECTORY, 'src/config/appearance/appearance-palette-colors.generated.ts')
/** Reads the six semantic role colors from one authored palette stylesheet. */
async function readPaletteColors(definition) {
  const css = await readFile(resolve(PALETTE_DIRECTORY, definition.cssFile.replace(/^palettes\//, '')), 'utf8')
  const colors = Object.fromEntries(APPEARANCE_COLOR_ROLES.map((role) => {
    const className = definition.classes.background[role]
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const blocks = css.matchAll(new RegExp(`\\.${escapedClassName}[^{}]*\\{([^{}]*)\\}`, 'g'))
    const declaration = [...blocks]
      .map((match) => match[1].match(/\bbackground-color:\s*(#[\da-f]{6})\s*;/i)?.[1])
      .find((color) => color !== undefined)
    return [role, declaration?.toLowerCase()]
  }))
  if (APPEARANCE_COLOR_ROLES.some((role) => colors[role] === undefined)) {
    throw new Error(`Palette CSS ${definition.id} doit définir ses six classes de fond.`)
  }
  return colors
}

/** Writes TypeScript picker metadata derived from the canonical palette CSS files. */
async function generatePaletteMetadata() {
  const palettes = Object.fromEntries(await Promise.all(APPEARANCE_PALETTE_DEFINITIONS.map(async (definition) => [
    definition.id,
    await readPaletteColors(definition),
  ])))
  const source = [
    '// Generated from src/config/appearance/css/palettes/*.css; do not edit.',
    `export const APPEARANCE_PALETTE_COLORS = ${JSON.stringify(palettes, null, 2)} as const`,
    '',
  ].join('\n')
  await writeFile(OUTPUT_FILE, source)
}

await generatePaletteMetadata()
